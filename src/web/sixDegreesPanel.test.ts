// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type { ActorSummary, ChainToCenter, LayerSummary } from "../shared/types";
import { createSixDegreesPanel } from "./sixDegreesPanel";

const kevin: ActorSummary = { id: "nm01", name: "Kevin Bacon", birthYear: 1958 };
const sid: ActorSummary = { id: "nm12", name: "Sid Moss", birthYear: 1975 };
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
};

function setup(chain: ChainToCenter | Error = toXia) {
  const search = vi.fn(async (query: string) => actors.filter((a) => a.name.toLowerCase().startsWith(query)));
  const findLayers = vi.fn(async (center?: string) => (center === "nm16" ? aroundGus : aroundKevin));
  const findChain = vi.fn(async (_center: string, _actor: string) => {
    if (chain instanceof Error) throw chain;
    return chain;
  });
  const panel = createSixDegreesPanel(search, findLayers, findChain);
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
  const result = () => panel.querySelector(".result")!;
  const loaded = (text: string) => vi.waitFor(() => expect(layers()).toContain(text));
  return { inputs, pick, button, layers, result, loaded, findLayers, findChain };
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
    expect(findChain).toHaveBeenCalledWith("nm01", "nm14");
    expect(result().textContent).toBe("layer 2: Kevin Bacon — Low Tide — Sid Moss — Low Tide 2 — Xia Ortiz");
    expect(result().classList.contains("not-possible")).toBe(false);
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
    await vi.waitFor(() => expect(findChain).toHaveBeenCalledWith("nm16", "nm17"));
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
});
