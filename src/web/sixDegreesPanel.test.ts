// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type { ActorSummary, ChainMode, ChainToCenter, LayerSummary, UnlinkedPage } from "../shared/types";
import { layoutRings } from "./rings/ringsLayout";
import { createSixDegreesPanel } from "./sixDegreesPanel";
import { endInks, FAKE_COLUMNS, FAKE_ROWS, fakeStage } from "./stage/fakeStage";

const kevin: ActorSummary = { id: "nm01", name: "Kevin Bacon", birthYear: 1958 };
const sid: ActorSummary = { id: "nm12", name: "Sid Moss", birthYear: 1975 };
const sue: ActorSummary = { id: "nm13", name: "Sue Nash", birthYear: 1979 };
const xia: ActorSummary = { id: "nm14", name: "Xia Ortiz", birthYear: 1990 };
const gus: ActorSummary = { id: "nm16", name: "Gus Price", birthYear: 1960 };
const gia: ActorSummary = { id: "nm17", name: "Gia Quinn", birthYear: 1982 };
const actors = [kevin, xia, gus, gia];

const aroundKevin: LayerSummary = { center: kevin, layerCounts: [1, 3, 4, 4, 1, 1], unlinkedCount: 3 };
const aroundGus: LayerSummary = { center: gus, layerCounts: [1, 2], unlinkedCount: 14 };
const toXia: ChainToCenter = {
  found: true,
  distance: 2,
  actors: [kevin, sid, xia],
  movies: [
    { id: "tt07", title: "Low Tide" },
    { id: "tt08", title: "Low Tide 2" },
  ],
  totalRating: 12.5,
  averageRating: 6.25,
  positions: [0, 1, 3],
};
const bestToXia: ChainToCenter = {
  found: true,
  distance: 2,
  actors: [kevin, sue, xia],
  movies: [
    { id: "tt13", title: "High Noon Redux" },
    { id: "tt14", title: "High Noon Redux 2" },
  ],
  totalRating: 17.3,
  averageRating: 8.65,
  positions: [0, 2, 3],
};

function setup(chain: ChainToCenter | Error = toXia) {
  const search = vi.fn(async (query: string) => actors.filter((a) => a.name.toLowerCase().startsWith(query)));
  const findLayers = vi.fn(async (center?: string) => (center === "nm16" ? aroundGus : aroundKevin));
  const findChain = vi.fn(async (_center: string, _actor: string, mode: ChainMode) => {
    if (chain instanceof Error) throw chain;
    return mode === "best-rated" && chain === toXia ? bestToXia : chain;
  });
  const findActorAt = vi.fn(async (_center: string, layer: number, position: number) => (layer === 2 && position === 3 ? xia : kevin));
  const findUnlinked = vi.fn(async (): Promise<UnlinkedPage> => ({ total: 3, actors: [gia] }));
  const { stage, scenes, finish, click } = fakeStage();
  const panel = createSixDegreesPanel(search, { findLayers, findChain, findActorAt, findUnlinked }, stage);
  document.body.replaceChildren(panel);
  const inputs = [...panel.querySelectorAll("input")];
  const pick = async (field: number, text: string) => {
    inputs[field]!.value = text;
    inputs[field]!.dispatchEvent(new Event("input"));
    await vi.waitFor(() => expect(panel.querySelector('[role="option"]')).not.toBeNull());
    panel.querySelector('[role="option"]')!.dispatchEvent(new MouseEvent("mousedown"));
  };
  const button = (text: string) => [...panel.querySelectorAll("button")].find((b) => b.textContent === text)!;
  const layers = () => panel.querySelector(".layers")!.textContent;
  const result = () => panel.querySelector<HTMLElement>(".result")!;
  const loaded = (text: string) => vi.waitFor(() => expect(layers()).toContain(text));
  return { panel, stage, inputs, pick, button, layers, result, loaded, findLayers, findChain, findActorAt, findUnlinked, scenes, finish, click };
}

describe("six degrees panel", () => {
  it("starts around Kevin Bacon and shows the Layer counts and the can't-be-linked count", async () => {
    const { inputs, layers, loaded, findLayers } = setup();
    await loaded("layer 5: 1");
    expect(findLayers).toHaveBeenCalledWith(undefined);
    expect(inputs[0]!.value).toBe("Kevin Bacon (1958)");
    expect(layers()).toBe(
      "layer 0: 1" + "layer 1: 3" + "layer 2: 4" + "layer 3: 4" + "layer 4: 1" + "layer 5: 1" + "can't be linked: 3",
    );
  });

  it("shows the chain from the Center to a picked Actor", async () => {
    const { pick, button, result, loaded, findChain } = setup();
    await loaded("layer 5");
    await pick(1, "xia");
    button("[enter]").click();
    await vi.waitFor(() => expect(result().textContent).not.toBe(""));
    expect(findChain).toHaveBeenCalledWith("nm01", "nm14", "shortest");
    expect(result().textContent).toBe(
      "layer 2: Kevin Bacon — Low Tide — Sid Moss — Low Tide 2 — Xia Ortiz (rating 12.5, average 6.25)",
    );
    expect(result().classList.contains("not-possible")).toBe(false);
  });

  it("switches to the best-rated chain without reloading the Layers, and back", async () => {
    const { pick, button, result, loaded, findLayers, findChain } = setup();
    await loaded("layer 5");
    expect(button("[shortest link]").getAttribute("aria-pressed")).toBe("true");
    await pick(1, "xia");
    button("[enter]").click();
    await vi.waitFor(() => expect(result().textContent).toContain("Low Tide"));
    button("[best-rated link]").click();
    await vi.waitFor(() => expect(result().textContent).toContain("High Noon"));
    expect(findChain).toHaveBeenLastCalledWith("nm01", "nm14", "best-rated");
    expect(result().textContent).toBe(
      "layer 2: Kevin Bacon — High Noon Redux — Sue Nash — High Noon Redux 2 — Xia Ortiz (rating 17.3, average 8.65)",
    );
    expect(button("[best-rated link]").getAttribute("aria-pressed")).toBe("true");
    expect(button("[shortest link]").getAttribute("aria-pressed")).toBe("false");
    button("[shortest link]").click();
    await vi.waitFor(() => expect(result().textContent).toContain("Low Tide"));
    expect(findLayers).toHaveBeenCalledOnce();
  });

  it("uses the chosen mode for the next [enter], and asks for nothing when no chain is shown", async () => {
    const { pick, button, result, loaded, findChain } = setup();
    await loaded("layer 5");
    button("[best-rated link]").click();
    expect(findChain).not.toHaveBeenCalled();
    await pick(1, "xia");
    button("[enter]").click();
    await vi.waitFor(() => expect(result().textContent).toContain("High Noon"));
    expect(findChain).toHaveBeenCalledWith("nm01", "nm14", "best-rated");
  });

  it("writes the Center's own chain without ratings", async () => {
    const { pick, button, result, loaded } = setup({ found: true, distance: 0, actors: [kevin], movies: [], totalRating: 0, averageRating: null, positions: [0] });
    await loaded("layer 5");
    await pick(1, "kev");
    button("[enter]").click();
    await vi.waitFor(() => expect(result().textContent).toBe("layer 0: Kevin Bacon"));
  });

  it("says in red when a picked Actor can't be linked", async () => {
    const { pick, button, result, loaded } = setup({ found: false });
    await loaded("layer 5");
    await pick(1, "gia");
    button("[enter]").click();
    await vi.waitFor(() => expect(result().textContent).not.toBe(""));
    expect(result().textContent).toBe("can't be linked: Gia Quinn shares no chain of movies with Kevin Bacon");
    expect(result().classList.contains("not-possible")).toBe(true);
  });

  it("moves to the Center in the field before showing a chain, so the chain starts there", async () => {
    const { pick, button, loaded, findLayers, findChain } = setup();
    await loaded("layer 5");
    await pick(0, "gus");
    await pick(1, "gia");
    button("[enter]").click();
    await loaded("can't be linked: 14");
    expect(findLayers).toHaveBeenLastCalledWith("nm16");
    await vi.waitFor(() => expect(findChain).toHaveBeenCalledWith("nm16", "nm17", "shortest"));
  });

  it("does not reload the Layers when the Center is unchanged", async () => {
    const { pick, button, result, loaded, findLayers } = setup();
    await loaded("layer 5");
    await pick(1, "xia");
    button("[enter]").click();
    await vi.waitFor(() => expect(result().textContent).not.toBe(""));
    expect(findLayers).toHaveBeenCalledOnce();
  });

  it("clears the old counts when loading a Center fails", async () => {
    const { pick, button, layers, result, loaded, findLayers, findChain } = setup();
    await loaded("layer 5");
    findLayers.mockRejectedValueOnce(new Error("Layers failed: 500"));
    await pick(0, "gus");
    await pick(1, "xia");
    button("[enter]").click();
    await vi.waitFor(() => expect(result().textContent).toBe("search failed, try again"));
    expect(layers()).toBe("");
    expect(findChain).not.toHaveBeenCalled();
  });

  it("ignores an answer that arrives after a newer request", async () => {
    const { pick, button, result, loaded, findChain } = setup();
    await loaded("layer 5");
    let answerSlow: (chain: ChainToCenter) => void = () => {};
    findChain.mockImplementationOnce(() => new Promise((resolve) => (answerSlow = resolve)));
    findChain.mockResolvedValueOnce({ found: false });
    await pick(1, "gia");
    button("[enter]").click(); // slow
    button("[enter]").click(); // fast: Gia can't be linked
    await vi.waitFor(() => expect(result().textContent).toContain("can't be linked"));
    answerSlow(toXia);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result().textContent).toContain("can't be linked");
  });

  it("says the search failed, in plain ink, when the chain request fails", async () => {
    const { pick, button, result, loaded } = setup(new Error("Chain failed: 500"));
    await loaded("layer 5");
    await pick(1, "xia");
    button("[enter]").click();
    await vi.waitFor(() => expect(result().textContent).toBe("search failed, try again"));
    expect(result().classList.contains("not-possible")).toBe(false);
  });

  it("does nothing until an Actor is picked", async () => {
    const { button, result, loaded, findChain } = setup();
    await loaded("layer 5");
    button("[enter]").click();
    expect(findChain).not.toHaveBeenCalled();
    expect(result().textContent).toBe("");
  });

  it("plays the rings for the Center once its Layers are loaded, and again for a new Center", async () => {
    const { pick, button, loaded, scenes } = setup();
    await loaded("layer 5");
    expect(scenes).toHaveLength(1);
    expect(scenes[0]!.duration).toBeGreaterThanOrEqual(5);
    expect(endInks(scenes[0]!).has("green")).toBe(false);
    await pick(0, "gus");
    button("[enter]").click();
    await loaded("can't be linked: 14");
    expect(scenes).toHaveLength(2);
  });

  it("draws a found chain in green on the rings, hiding the result line while it plays", async () => {
    const { pick, button, result, loaded, scenes, finish } = setup();
    await loaded("layer 5");
    await pick(1, "xia");
    button("[enter]").click();
    await vi.waitFor(() => expect(scenes).toHaveLength(2));
    expect(endInks(scenes[1]!).has("green")).toBe(true);
    expect(result().hidden).toBe(true);
    finish();
    expect(result().hidden).toBe(false);
    expect(result().textContent).toContain("Low Tide");
  });

  it("redraws the chain when the mode changes", async () => {
    const { pick, button, result, loaded, scenes } = setup();
    await loaded("layer 5");
    await pick(1, "xia");
    button("[enter]").click();
    await vi.waitFor(() => expect(scenes).toHaveLength(2));
    button("[best-rated link]").click();
    await vi.waitFor(() => expect(scenes).toHaveLength(3));
    await vi.waitFor(() => expect(result().textContent).toContain("High Noon"));
    expect(scenes[2]).not.toEqual(scenes[1]);
  });

  it("draws nothing new for an Actor who can't be linked", async () => {
    const { pick, button, result, loaded, scenes } = setup({ found: false });
    await loaded("layer 5");
    await pick(1, "gia");
    button("[enter]").click();
    await vi.waitFor(() => expect(result().textContent).toContain("can't be linked"));
    expect(scenes).toHaveLength(1);
    expect(result().hidden).toBe(false);
  });

  it("picking a dot asks who it stands for, puts them in the actor field, and draws their chain", async () => {
    const { inputs, result, loaded, scenes, click, findActorAt, findChain } = setup();
    await loaded("layer 5");
    const dot = layoutRings(aroundKevin.layerCounts, FAKE_COLUMNS, FAKE_ROWS).rings[2]!.dots[3]!;
    click({ x: dot.x, y: dot.y });
    await vi.waitFor(() => expect(scenes).toHaveLength(2));
    expect(findActorAt).toHaveBeenCalledWith("nm01", 2, 3);
    expect(findChain).toHaveBeenCalledWith("nm01", "nm14", "shortest");
    expect(inputs[1]!.value).toBe("Xia Ortiz (1990)");
    expect(result().textContent).toContain("layer 2: Kevin Bacon");
  });

  it("does nothing for a click far from every dot", async () => {
    const { loaded, click, findActorAt } = setup();
    await loaded("layer 5");
    click({ x: 0, y: 0 });
    expect(findActorAt).not.toHaveBeenCalled();
  });

  it("shows the can't-be-linked count as a button that opens and closes the list in place of the stage", async () => {
    const { panel, stage, button, loaded, findUnlinked } = setup();
    await loaded("layer 5");
    const open = button("[can't be linked: 3]");
    expect(open.getAttribute("aria-expanded")).toBe("false");
    open.click();
    expect(open.getAttribute("aria-expanded")).toBe("true");
    expect(stage.element.hidden).toBe(true);
    await vi.waitFor(() => expect(panel.querySelector(".unlinked")!.textContent).toContain("Gia Quinn (1982)"));
    expect(findUnlinked).toHaveBeenCalledWith("nm01", "", 0, 10);
    open.click();
    expect(stage.element.hidden).toBe(false);
    expect((panel.querySelector(".unlinked") as HTMLElement).hidden).toBe(true);
  });

  it.each(["[shortest link]", "[best-rated link]"])("closes the list when %s is clicked, with or without a chain shown", async (mode) => {
    const { pick, button, loaded, stage } = setup();
    await loaded("layer 5");
    button("[can't be linked: 3]").click();
    button(mode).click();
    expect(button("[can't be linked: 3]").getAttribute("aria-expanded")).toBe("false");
    expect(stage.element.hidden).toBe(false);
    await pick(1, "xia");
    button("[enter]").click();
    button("[can't be linked: 3]").click();
    button(mode).click();
    expect(stage.element.hidden).toBe(false);
  });

  it("closes the list and shows the new count when the Center changes", async () => {
    const { pick, button, loaded, stage } = setup();
    await loaded("layer 5");
    button("[can't be linked: 3]").click();
    await pick(0, "gus");
    button("[enter]").click();
    await loaded("can't be linked: 14");
    expect(button("[can't be linked: 14]").getAttribute("aria-expanded")).toBe("false");
    expect(stage.element.hidden).toBe(false);
  });
});
