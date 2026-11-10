// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type { ActorSummary, ShortestPath } from "../shared/types";
import { createPathPanel } from "./pathPanel";

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
  explored: [],
};

function setup(path: ShortestPath | Error) {
  const search = vi.fn(async (query: string) => actors.filter((a) => a.name.toLowerCase().startsWith(query)));
  const findPath = vi.fn(async (_a: string, _b: string) => {
    if (path instanceof Error) throw path;
    return path;
  });
  const panel = createPathPanel(search, findPath);
  document.body.replaceChildren(panel);
  const inputs = [...panel.querySelectorAll("input")];
  const pick = async (field: number, text: string) => {
    inputs[field]!.value = text;
    inputs[field]!.dispatchEvent(new Event("input"));
    await vi.waitFor(() => expect(panel.querySelector('[role="option"]')).not.toBeNull());
    panel.querySelector('[role="option"]')!.dispatchEvent(new MouseEvent("mousedown"));
  };
  const enter = async () => {
    panel.querySelector<HTMLButtonElement>("button")!.click();
    await vi.waitFor(() => expect(result().textContent).not.toBe(""));
  };
  const result = () => panel.querySelector(".result")!;
  return { pick, enter, result, findPath };
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
    const { pick, enter, result } = setup({ found: false, explored: [] });
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
    const { pick, result, findPath } = setup(twoLinks);
    await pick(0, "kevin");
    document.querySelector("button")!.click();
    expect(findPath).not.toHaveBeenCalled();
    expect(result().textContent).toBe("");
  });
});
