// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type { ActorSummary, FoundPath, ShortestPath } from "../shared/types";
import { createPathPanel } from "./pathPanel";
import { endInks, fakeStage } from "./stage/fakeStage";

const kevin: ActorSummary = { id: "nm01", name: "Kevin Bacon", birthYear: 1958 };
const ada: ActorSummary = { id: "nm02", name: "Ada Hart", birthYear: 1971 };
const ben: ActorSummary = { id: "nm03", name: "Ben Cole", birthYear: 1965 };
const gia: ActorSummary = { id: "nm17", name: "Gia Quinn", birthYear: 1982 };
const actors = [kevin, ben, gia];

const twoLinks: ShortestPath = {
  found: true,
  distance: 2,
  actors: [kevin, ada, ben],
  movies: [
    { id: "tt01", title: "Open Road" },
    { id: "tt02", title: "Ring One" },
  ],
  rounds: [
    { side: "a", depth: 1, reached: 2, shown: [{ from: "nm01", movie: "tt01", to: "nm02", side: "a" }, { from: "nm01", movie: "tt09", to: "nm09", side: "a" }] },
    { side: "b", depth: 1, reached: 1, shown: [{ from: "nm03", movie: "tt02", to: "nm02", side: "b" }] },
  ],
  names: { nm01: "Kevin Bacon", nm02: "Ada Hart", nm03: "Ben Cole", nm09: "Tom Irwin", tt01: "Open Road", tt02: "Ring One", tt09: "Side Door" },
};

const noPath: ShortestPath = {
  found: false,
  rounds: [
    { side: "a", depth: 1, reached: 1, shown: [{ from: "nm01", movie: "tt01", to: "nm02", side: "a" }] },
    { side: "b", depth: 1, reached: 1, shown: [{ from: "nm17", movie: "tt07", to: "nm16", side: "b" }] },
  ],
  names: { nm02: "Ada Hart", nm16: "Gus Price", tt01: "Open Road", tt07: "Far Shore 2" },
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
  rounds: [{ side: "a", depth: 1, reached: 1, shown: [{ from: "nm0", movie: "tt0", to: "nm1", side: "a" }] }],
  names: {},
};

function setup(path: ShortestPath | Error, largest: FoundPath | Error = sevenLinks) {
  const searchActors = vi.fn(async (query: string) => actors.filter((a) => a.name.toLowerCase().startsWith(query)));
  const findPath = vi.fn(async (_a: string, _b: string) => {
    if (path instanceof Error) throw path;
    return path;
  });
  const findLargestPath = vi.fn(async () => {
    if (largest instanceof Error) throw largest;
    return largest;
  });
  const randomActors = vi.fn(async (count: number) => [kevin, ben].slice(0, count));
  const { stage, scenes, finish } = fakeStage();
  const panel = createPathPanel({ searchActors, findPath, findLargestPath, randomActors }, stage);
  document.body.replaceChildren(panel);
  const inputs = [...panel.querySelectorAll("input")];
  const pick = async (field: number, text: string) => {
    inputs[field]!.value = text;
    inputs[field]!.dispatchEvent(new Event("input"));
    await vi.waitFor(() => expect(panel.querySelector('[role="option"]')).not.toBeNull());
    panel.querySelector('[role="option"]')!.dispatchEvent(new MouseEvent("mousedown"));
  };
  const button = (text: string) => [...panel.querySelectorAll("button")].find((b) => b.textContent === text)!;
  const result = () => panel.querySelector<HTMLElement>(".result")!;
  const chain = () => [...panel.querySelectorAll(".chain li")].map((li) => li.textContent);
  /** Presses a button and lets the animation, if any, finish. */
  const press = async (text: string) => {
    button(text).click();
    await vi.waitFor(() => expect(result().textContent).not.toBe("searching…"));
    finish();
  };
  return { panel, inputs, pick, press, button, result, chain, findPath, findLargestPath, randomActors, scenes, finish };
}

describe("largest path panel", () => {
  it("is headed 'largest path'", () => {
    const { panel } = setup(twoLinks);
    expect(panel.querySelector("h1")!.textContent).toBe("largest path");
  });

  it("shows the Distance, then the chain as a graph of Actors and Movies, for two picked Actors", async () => {
    const { pick, press, result, chain, findPath } = setup(twoLinks);
    await pick(0, "kevin");
    await pick(1, "ben");
    await press("[enter]");
    expect(findPath).toHaveBeenCalledWith("nm01", "nm03");
    expect(result().textContent).toBe("distance 2");
    expect(chain()).toEqual(["@Kevin Bacon1958", "|Open Road", "@Ada Hart1971", "|Ring One", "@Ben Cole1965"]);
    expect(result().classList.contains("not-possible")).toBe(false);
  });

  it("names the two ends while the search plays, and the answer only once it ends", async () => {
    const { pick, button, result, chain, scenes, finish } = setup(twoLinks);
    await pick(0, "kevin");
    await pick(1, "ben");
    button("[enter]").click();
    await vi.waitFor(() => expect(scenes).toHaveLength(1));
    expect(result().textContent).toBe("searching: Kevin Bacon and Ben Cole");
    expect(chain()).toEqual([]);
    finish();
    expect(result().textContent).toBe("distance 2");
    expect(endInks(scenes[0]!).has("green")).toBe(true);
  });

  it("shows a red 'no path', played fully red, when the Actors are in different Groups", async () => {
    const { pick, press, result, chain, scenes } = setup(noPath);
    await pick(0, "kevin");
    await pick(1, "gia");
    await press("[enter]");
    expect(result().textContent).toBe("no path: these actors share no chain of movies");
    expect(result().classList.contains("not-possible")).toBe(true);
    expect(chain()).toEqual([]);
    expect(endInks(scenes[0]!).has("green")).toBe(false);
  });

  it("says the search failed, in plain ink, and plays nothing, when the request fails", async () => {
    const { pick, press, result, scenes } = setup(new Error("Path search failed: 500"));
    await pick(0, "kevin");
    await pick(1, "ben");
    await press("[enter]");
    expect(result().textContent).toBe("search failed, try again");
    expect(result().classList.contains("not-possible")).toBe(false);
    expect(scenes).toHaveLength(0);
  });

  it("does nothing until both Actors are picked", async () => {
    const { pick, button, findPath } = setup(twoLinks);
    await pick(0, "kevin");
    button("[enter]").click();
    expect(findPath).not.toHaveBeenCalled();
  });

  it("shows the largest finite shortest path with no Actor fields filled in", async () => {
    const { press, result, chain, findLargestPath, findPath, scenes } = setup(twoLinks);
    await press("[largest path]");
    expect(findLargestPath).toHaveBeenCalledOnce();
    expect(findPath).not.toHaveBeenCalled();
    expect(result().textContent).toBe("distance 7");
    expect(chain()).toHaveLength(15);
    expect(chain()[0]).toBe("@Pia Holt");
    expect(endInks(scenes[0]!).has("green")).toBe(true);
  });

  it("[random] picks two Actors, fills the fields, and searches between them", async () => {
    const { inputs, press, randomActors, findPath } = setup(twoLinks);
    await press("[random]");
    expect(randomActors).toHaveBeenCalledWith(2);
    expect(inputs.map((i) => i.value)).toEqual(["Kevin Bacon (1958)", "Ben Cole (1965)"]);
    expect(findPath).toHaveBeenCalledWith("nm01", "nm03");
  });

  it("ignores an answer that arrives after a newer request", async () => {
    const { pick, button, result, findPath, scenes, finish } = setup(twoLinks);
    let answerSlow: (path: ShortestPath) => void = () => {};
    findPath.mockImplementationOnce(() => new Promise((resolve) => (answerSlow = resolve)));
    await pick(0, "kevin");
    await pick(1, "ben");
    button("[enter]").click(); // slow
    button("[largest path]").click(); // fast
    await vi.waitFor(() => expect(scenes).toHaveLength(1));
    finish();
    answerSlow(noPath);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(scenes).toHaveLength(1);
    expect(result().textContent).toBe("distance 7");
  });
});
