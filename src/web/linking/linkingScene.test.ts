import { describe, expect, it } from "vitest";
import type { ExploredLink } from "../../shared/types";
import type { Grid, Ink } from "../stage/charGrid";
import { layoutLinks, type Linking } from "./linkLayout";
import { linkingScene } from "./linkingScene";

const link = (from: string, to: string, side: "a" | "b"): ExploredLink => ({ from, movie: "tt", to, side });

/** a — x — y — b, met at y; p, q, r are rejected. */
const found: Linking = {
  ends: ["a", "b"],
  tried: [link("a", "x", "a"), link("a", "p", "a"), link("b", "y", "b"), link("b", "q", "b"), link("x", "y", "a"), link("x", "r", "a")],
  answer: ["a", "x", "y", "b"],
};

const notPossible: Linking = {
  ends: ["a", "b"],
  tried: [link("a", "p", "a"), link("b", "q", "b"), link("p", "r", "a")],
  answer: [],
};

const [COLUMNS, ROWS] = [80, 25];
const SOLID = ["-", "|", "/", "\\"];
const DOTTED = [".", ":", "'"];

/** Every frame at 60 fps, from 0 to the scene's end. */
function frames(linking: Linking): { t: number; grid: Grid }[] {
  const scene = linkingScene(linking);
  const count = Math.ceil(scene.duration * 60);
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = Math.min(scene.duration, i / 60);
    return { t, grid: scene.frame(t, COLUMNS, ROWS) };
  });
}

const lastFrame = (linking: Linking) => {
  const scene = linkingScene(linking);
  return scene.frame(scene.duration, COLUMNS, ROWS);
};

function cellAt(linking: Linking, grid: Grid, id: string): { char: string; ink: Ink } {
  const { x, y } = layoutLinks(linking, COLUMNS, ROWS).get(id)!;
  const i = y * COLUMNS + x;
  return { char: grid.chars[i]!, ink: grid.inks[i]! };
}

const cellsInk = (grid: Grid, ink: Ink) => grid.chars.filter((_, i) => grid.inks[i] === ink);

/** The first time an Actor shows on the stage. */
const firstShown = (linking: Linking, id: string) =>
  frames(linking).find(({ grid }) => ["o", "@", "+"].includes(cellAt(linking, grid, id).char))?.t;

describe("linkingScene", () => {
  it("runs 5 to 15 seconds, however many Links were tried", () => {
    for (const count of [0, 1, 10, 300, 5000]) {
      const tried = Array.from({ length: count }, (_, i) => link("a", `n${i}`, "a"));
      const { duration } = linkingScene({ ends: ["a", "b"], tried, answer: [] });
      expect(duration).toBeGreaterThanOrEqual(5);
      expect(duration).toBeLessThanOrEqual(15);
    }
  });

  it("tries the Links one after another, in the order given", () => {
    const shown = ["x", "p", "y", "q", "r"].map((id) => firstShown(found, id)!);
    expect(shown.every((t) => t !== undefined)).toBe(true);
    expect([...shown].sort((s, t) => s - t)).toEqual(shown);
    expect(new Set(shown).size).toBe(shown.length);
  });

  it("shows an Actor being tried as `o` in ink, then a rejected one as red `+`, then fades it into the halftone", () => {
    const states = frames(found).map(({ grid }) => cellAt(found, grid, "p"));
    const kinds = states.map(({ char, ink }) => (char === "o" && ink === "ink" ? "tried" : char === "+" && ink === "red" ? "rejected" : "other"));
    const order = kinds.filter((k, i) => k !== kinds[i - 1]);
    expect(order).toEqual(["other", "tried", "rejected", "other"]);
  });

  it("ends with the answer chain green and solid, the end Actors and the chain as `@`, and every rejected Link faded", () => {
    const grid = lastFrame(found);
    for (const id of found.answer) expect(cellAt(found, grid, id)).toEqual({ char: "@", ink: "green" });
    const green = cellsInk(grid, "green");
    expect(green.filter((c) => SOLID.includes(c)).length).toBeGreaterThan(20);
    expect(green.every((c) => SOLID.includes(c) || c === "@")).toBe(true);
    expect(cellsInk(grid, "red")).toEqual([]);
  });

  it("draws rejected Links red and dotted", () => {
    const reds = frames(found).flatMap(({ grid }) => cellsInk(grid, "red"));
    expect(reds.length).toBeGreaterThan(0);
    expect(reds.every((c) => DOTTED.includes(c) || c === "+")).toBe(true);
  });

  it("flashes the answer gold and throws sparkles off the end Actors, only after every Link was tried", () => {
    const all = frames(found);
    const lastTried = Math.max(...["x", "p", "y", "q", "r"].map((id) => firstShown(found, id)!));
    const sparkFrames = all.filter(({ grid }) => cellsInk(grid, "spark").length > 0);
    expect(sparkFrames.length).toBeGreaterThan(30);
    expect(sparkFrames[0]!.t).toBeGreaterThan(lastTried);
    const offTheChain = sparkFrames.some(({ grid }) => grid.inks.some((ink, i) => ink === "spark" && Math.floor(i / COLUMNS) !== Math.floor(ROWS / 2)));
    expect(offTheChain).toBe(true);
    expect(cellsInk(lastFrame(found), "spark")).toEqual([]);
  });

  it("plays a 'no path' fully red: every Link red and dotted at the end, nothing green, no sparkles", () => {
    const grid = lastFrame(notPossible);
    for (const id of ["p", "q", "r"]) expect(cellAt(notPossible, grid, id)).toEqual({ char: "+", ink: "red" });
    expect(cellsInk(grid, "red").filter((c) => DOTTED.includes(c)).length).toBeGreaterThan(10);
    expect(frames(notPossible).every(({ grid }) => cellsInk(grid, "green").length === 0 && cellsInk(grid, "spark").length === 0)).toBe(true);
  });

  it("shows the two end Actors as `@` from the start", () => {
    const grid = linkingScene(notPossible).frame(0, COLUMNS, ROWS);
    expect(cellAt(notPossible, grid, "a")).toEqual({ char: "@", ink: "accent" });
    expect(cellAt(notPossible, grid, "b")).toEqual({ char: "@", ink: "accent" });
  });

  it("draws the same picture every time it is played", () => {
    const scene = linkingScene(found);
    expect(scene.frame(2.5, COLUMNS, ROWS)).toEqual(linkingScene(found).frame(2.5, COLUMNS, ROWS));
  });
});
