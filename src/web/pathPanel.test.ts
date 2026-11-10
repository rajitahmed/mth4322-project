// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type { ActorSummary, ExploredLink, FoundPath, ShortestPath } from "../shared/types";
import { createPathPanel } from "./pathPanel";
import { endInks, fakeStage } from "./stage/fakeStage";

const kevin: ActorSummary = { id: "nm01", name: "Kevin Bacon", birthYear: 1958 };
const ben: ActorSummary = { id: "nm03", name: "Ben Cole", birthYear: 1965 };
const gia: ActorSummary = { id: "nm17", name: "Gia Quinn", birthYear: 1982 };
const actors = [kevin, ben, gia];

const twoLinks: ShortestPath = {
  found: true,
  distance: 2,
  actors: [kevin, { id: "nm02", name: "Ada Hart", birthYear: 1971 }, ben],
  movies: [
    { id: "tt01", title: "Open Road" },
    { id: "tt02", title: "Ring One" },
  ],
  explored: [
    { from: "nm01", movie: "tt01", to: "nm02", side: "a" },
    { from: "nm01", movie: "tt09", to: "nm09", side: "a" },
    { from: "nm03", movie: "tt02", to: "nm02", side: "b" },
  ],
};

const noPath: ShortestPath = {
  found: false,
  explored: [
    { from: "nm01", movie: "tt01", to: "nm02", side: "a" },
    { from: "nm17", movie: "tt07", to: "nm18", side: "b" },
  ] satisfies ExploredLink[],
};

const sevenLinks: FoundPath = {
  found: true,
  distance: 7,
  actors: ["Pia Holt", "Dev Ennis", "Cara Diaz", "Ben Cole", "Ada Hart", "Kevin Bacon", "Sid Moss", "Xia Ortiz"].map(
    (name, i) => ({ id: `nm${i}`, name, birthYear: null }),
  ),
  movies: ["Lone Star", "Ring Three", "Ring Two", "Ring One", "Open Road", "Low Tide", "Low Tide 2"].map((title, i) => ({
    id: `tt${i}`,
    title,
  })),
  explored: [],
};

function setup(path: ShortestPath | Error, largest: FoundPath | Error = sevenLinks) {
  const search = vi.fn(async (query: string) => actors.filter((a) => a.name.toLowerCase().startsWith(query)));
  const findPath = vi.fn(async (_a: string, _b: string) => {
    if (path instanceof Error) throw path;
    return path;
  });
  const findLargestPath = vi.fn(async () => {
    if (largest instanceof Error) throw largest;
    return largest;
  });
  const { stage, scenes, finish } = fakeStage();
  const panel = createPathPanel(search, findPath, findLargestPath, stage);
  document.body.replaceChildren(panel);
  const inputs = [...panel.querySelectorAll("input")];
  const pick = async (field: number, text: string) => {
    inputs[field]!.value = text;
    inputs[field]!.dispatchEvent(new Event("input"));
    await vi.waitFor(() => expect(panel.querySelector('[role="option"]')).not.toBeNull());
    panel.querySelector('[role="option"]')!.dispatchEvent(new MouseEvent("mousedown"));
  };
  const button = (text: string) => [...panel.querySelectorAll("button")].find((b) => b.textContent === text)!;
  /** Presses a button and lets the animation finish. */
  const press = async (text: string) => {
    button(text).click();
    await vi.waitFor(() => expect(result().textContent).not.toBe(""));
    finish();
  };
  const enter = () => press("[enter]");
  const result = () => panel.querySelector<HTMLElement>(".result")!;
  return { pick, enter, press, button, result, findPath, findLargestPath, scenes, finish };
}

describe("largest path panel", () => {
  it("shows the Distance and the chain of Movies for two picked Actors", async () => {
    const { pick, enter, result, findPath } = setup(twoLinks);
    await pick(0, "kevin");
    await pick(1, "ben");
    await enter();
    expect(findPath).toHaveBeenCalledWith("nm01", "nm03");
    expect(result().textContent).toBe("distance 2: Kevin Bacon — Open Road — Ada Hart — Ring One — Ben Cole");
    expect(result().classList.contains("not-possible")).toBe(false);
  });

  it("shows a fully red 'no path' when the Actors are in different Groups", async () => {
    const { pick, enter, result } = setup(noPath);
    await pick(0, "kevin");
    await pick(1, "gia");
    await enter();
    expect(result().textContent).toBe("no path: these actors share no chain of movies");
    expect(result().classList.contains("not-possible")).toBe(true);
  });

  it("says the search failed, in plain ink, when the request fails", async () => {
    const { pick, enter, result } = setup(new Error("Path search failed: 500"));
    await pick(0, "kevin");
    await pick(1, "ben");
    await enter();
    expect(result().textContent).toBe("search failed, try again");
    expect(result().classList.contains("not-possible")).toBe(false);
  });

  it("does nothing until both Actors are picked", async () => {
    const { pick, button, result, findPath } = setup(twoLinks);
    await pick(0, "kevin");
    button("[enter]").click();
    expect(findPath).not.toHaveBeenCalled();
    expect(result().textContent).toBe("");
  });

  it("shows the largest finite shortest path with no Actor fields filled in", async () => {
    const { press, result, findLargestPath, findPath } = setup(twoLinks);
    await press("[largest path]");
    expect(findLargestPath).toHaveBeenCalledOnce();
    expect(findPath).not.toHaveBeenCalled();
    expect(result().textContent).toBe(
      "distance 7: Pia Holt — Lone Star — Dev Ennis — Ring Three — Cara Diaz — Ring Two — Ben Cole — Ring One — " +
        "Ada Hart — Open Road — Kevin Bacon — Low Tide — Sid Moss — Low Tide 2 — Xia Ortiz",
    );
  });

  it("says the search failed when the largest path request fails", async () => {
    const { press, result } = setup(twoLinks, new Error("Largest path failed: 500"));
    await press("[largest path]");
    expect(result().textContent).toBe("search failed, try again");
  });

  it("plays the search as live linking, and shows the result line only once the animation ends", async () => {
    const { pick, button, result, scenes, finish } = setup(twoLinks);
    await pick(0, "kevin");
    await pick(1, "ben");
    button("[enter]").click();
    await vi.waitFor(() => expect(scenes).toHaveLength(1));
    expect(result().hidden).toBe(true);
    finish();
    expect(result().hidden).toBe(false);
    expect(endInks(scenes[0]!).has("green")).toBe(true);
  });

  it("plays a 'no path' fully red", async () => {
    const { pick, enter, scenes } = setup(noPath);
    await pick(0, "kevin");
    await pick(1, "gia");
    await enter();
    const inks = endInks(scenes[0]!);
    expect(inks.has("red")).toBe(true);
    expect(inks.has("green")).toBe(false);
  });

  it("plays the largest path the same way, from its bidirectional search", async () => {
    const { press, scenes } = setup(twoLinks, { ...sevenLinks, explored: [{ from: "nm0", movie: "tt0", to: "nm1", side: "a" }] });
    await press("[largest path]");
    expect(scenes).toHaveLength(1);
    expect(endInks(scenes[0]!).has("green")).toBe(true);
  });

  it("plays nothing when the request fails", async () => {
    const { pick, enter, result, scenes } = setup(new Error("Path search failed: 500"));
    await pick(0, "kevin");
    await pick(1, "ben");
    await enter();
    expect(scenes).toHaveLength(0);
    expect(result().hidden).toBe(false);
  });
});
