import { describe, expect, it } from "vitest";
import type { Link } from "../../shared/types";
import { type Grid, type Ink, rowText } from "../stage/charGrid";
import { layoutCycle } from "./cycleLayout";
import type { CycleRun } from "./cycleRun";
import { cycleScene } from "./cycleScene";

const link = (from: string, to: string): Link => ({ from, movie: "tt", to });
const [COLUMNS, ROWS] = [100, 30];
const SOLID = ["-", "|", "/", "\\"];
const DOTTED = [".", ":", "'"];

/** a, x, b, c on the Cycle (a, b, c chosen), "Heat" used twice; p, q, r rejected. */
const found: CycleRun = {
  chosen: ["a", "b", "c"],
  circle: ["a", "x", "b", "c"],
  movies: ["Heat", "Ring One", "Heat", "Low Tide"],
  rejected: [link("a", "p"), link("x", "q"), link("q", "r")],
  moreRejected: 0,
  cut: null,
};
const noCycle: CycleRun = { chosen: ["a", "b", "c"], circle: ["a", "b", "c"], movies: null, rejected: [link("a", "p"), link("b", "q")], moreRejected: 0, cut: null };
const differentGroups: CycleRun = { ...noCycle, rejected: [] };
const cutActor: CycleRun = { ...differentGroups, cut: { actor: "d", between: ["a", "c"] } };
const notPossible = { "no-cycle": noCycle, "different-groups": differentGroups, "cut-actor": cutActor };

/** Every frame at 30 fps, from 0 to the scene's end. */
function frames(run: CycleRun): { t: number; grid: Grid }[] {
  const scene = cycleScene(run);
  const count = Math.ceil(scene.duration * 30);
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = Math.min(scene.duration, i / 30);
    return { t, grid: scene.frame(t, COLUMNS, ROWS) };
  });
}

const lastFrame = (run: CycleRun) => {
  const scene = cycleScene(run);
  return scene.frame(scene.duration, COLUMNS, ROWS);
};

function cellAt(run: CycleRun, grid: Grid, id: string): { char: string; ink: Ink } {
  const { x, y } = layoutCycle(run, COLUMNS, ROWS).at.get(id)!;
  const i = y * COLUMNS + x;
  return { char: grid.chars[i]!, ink: grid.inks[i]! };
}

const cellsInk = (grid: Grid, ink: Ink) => grid.chars.filter((_, i) => grid.inks[i] === ink);
const screenText = (grid: Grid) => Array.from({ length: grid.height }, (_, y) => rowText(grid, y)).join("\n");
const firstWhen = (run: CycleRun, test: (grid: Grid) => boolean) => frames(run).find(({ grid }) => test(grid))?.t;

describe("cycleScene", () => {
  it("runs 5 to 15 seconds, however many branches were rejected and however long the circle", () => {
    for (const count of [0, 1, 10, 300]) {
      for (const size of [3, 6, 20]) {
        const circle = Array.from({ length: size }, (_, i) => `r${i}`);
        const rejected = Array.from({ length: count }, (_, i) => link("r0", `n${i}`));
        const base: CycleRun = { chosen: circle.slice(0, 3), circle, movies: circle.map(() => "Heat"), rejected, moreRejected: 0, cut: null };
        for (const run of [base, { ...base, movies: null }, { ...base, movies: null, rejected: [], cut: { actor: "d", between: ["r0", "r1"] as [string, string] } }]) {
          const { duration } = cycleScene(run);
          expect(duration).toBeGreaterThanOrEqual(5);
          expect(duration).toBeLessThanOrEqual(15);
        }
      }
    }
  });

  it("shows the Chosen Actors on the circle as `@` in accent from the start", () => {
    const grid = cycleScene(found).frame(0, COLUMNS, ROWS);
    for (const id of found.chosen) expect(cellAt(found, grid, id)).toEqual({ char: "@", ink: "accent" });
  });

  it("plays the rejected branches red and dotted before any of the Cycle is drawn", () => {
    const all = frames(found);
    const firstRed = all.find(({ grid }) => cellsInk(grid, "red").length > 0)!.t;
    const firstGreen = all.find(({ grid }) => cellsInk(grid, "green").length > 0)!.t;
    expect(firstRed).toBeLessThan(firstGreen);
    expect(all.flatMap(({ grid }) => cellsInk(grid, "red")).every((c) => DOTTED.includes(c) || c === "+")).toBe(true);
  });

  it("draws the Cycle link by link in green, reaching each Actor in order and closing on the first", () => {
    const reached = (id: string) => firstWhen(found, (grid) => cellAt(found, grid, id).ink === "green")!;
    const order = ["x", "b", "c", "a"].map(reached);
    expect(order.every((t) => t !== undefined)).toBe(true);
    expect([...order].sort((s, t) => s - t)).toEqual(order);
    expect(new Set(order).size).toBe(order.length);
  });

  it("ends with the Cycle green and solid, every circle Actor `@`, the rejected branches faded, and each Link labelled with its Movie", () => {
    const grid = lastFrame(found);
    for (const id of found.circle) expect(cellAt(found, grid, id)).toEqual({ char: "@", ink: "green" });
    const green = cellsInk(grid, "green");
    expect(green.filter((c) => SOLID.includes(c)).length).toBeGreaterThan(20);
    expect(green.every((c) => SOLID.includes(c) || c === "@")).toBe(true);
    expect(cellsInk(grid, "red")).toEqual([]);
    const text = screenText(grid);
    expect(text.split("Heat").length - 1).toBe(2);
    expect(text).toContain("Ring One");
    expect(text).toContain("Low Tide");
  });

  it("flashes gold and throws sparkles only once the Cycle has closed", () => {
    const closed = firstWhen(found, (grid) => cellAt(found, grid, "a").ink !== "accent")!;
    const sparks = frames(found).filter(({ grid }) => cellsInk(grid, "spark").length > 0);
    expect(sparks.length).toBeGreaterThan(10);
    expect(sparks[0]!.t).toBeGreaterThanOrEqual(closed);
    expect(cellsInk(lastFrame(found), "spark")).toEqual([]);
  });

  it("notes how many more branches were tried when the list was cut short, once they have played", () => {
    const cutShort = { ...found, moreRejected: 15600 };
    expect(screenText(lastFrame(cutShort))).toContain("+ 15,600 more branches tried");
    expect(screenText(cycleScene(cutShort).frame(0, COLUMNS, ROWS))).not.toContain("more branches tried");
    expect(screenText(lastFrame(found))).not.toContain("more branches tried");
  });

  for (const [reason, run] of Object.entries(notPossible)) {
    it(`ends fully red when not possible (${reason}): nothing green, no sparkles, the circle red and dotted`, () => {
      const grid = lastFrame(run);
      expect(cellsInk(grid, "red").filter((c) => DOTTED.includes(c)).length).toBeGreaterThan(10);
      expect(frames(run).every(({ grid }) => cellsInk(grid, "green").length === 0 && cellsInk(grid, "spark").length === 0)).toBe(true);
      for (const id of run.chosen) expect(cellAt(run, grid, id)).toEqual({ char: "@", ink: "accent" });
      for (const { to } of run.rejected) expect(cellAt(run, grid, to)).toEqual({ char: "+", ink: "red" });
    });
  }

  it("shows a cut actor off the circle as a red `+`", () => {
    expect(cellAt(cutActor, lastFrame(cutActor), "d")).toEqual({ char: "+", ink: "red" });
  });

  it("draws the same picture every time it is played", () => {
    expect(cycleScene(found).frame(3, COLUMNS, ROWS)).toEqual(cycleScene(found).frame(3, COLUMNS, ROWS));
  });
});
