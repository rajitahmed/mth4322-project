import { describe, expect, it } from "vitest";
import { type Cell, type Grid, rowText } from "../stage/charGrid";
import { dotOf, layoutRings } from "./ringsLayout";
import { ringsScene } from "./ringsScene";

const [COLUMNS, ROWS] = [100, 30];
const TINY = [1, 3, 4, 4, 1, 1];
const BACON = [1, 320, 13_060, 51_640, 39_764, 8_067, 786, 140];
/** Xia Ortiz's chain on the tiny data: Kevin (Layer 0, position 0), Sid (1, 1), Xia (2, 3). */
const XIA = [0, 1, 3];
const SOLID = ["-", "|", "/", "\\"];
const WEIGHTS = ["·", "•", "●"];

function frames(counts: number[], chain: number[] | null): { t: number; grid: Grid }[] {
  const scene = ringsScene(counts, chain);
  const count = Math.ceil(scene.duration * 30);
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = Math.min(scene.duration, i / 30);
    return { t, grid: scene.frame(t, COLUMNS, ROWS) };
  });
}
const lastFrame = (counts: number[], chain: number[] | null) => {
  const scene = ringsScene(counts, chain);
  return scene.frame(scene.duration, COLUMNS, ROWS);
};
const at = (grid: Grid, { x, y }: Cell) => ({ char: grid.chars[y * grid.width + x]!, ink: grid.inks[y * grid.width + x]! });
const inks = (grid: Grid) => new Set(grid.inks);
const screenText = (grid: Grid) => Array.from({ length: grid.height }, (_, y) => rowText(grid, y)).join("\n");
/** The cell of the chain Actor in Layer i. */
const chainCell = (counts: number[], chain: number[], i: number) => dotOf(layoutRings(counts, COLUMNS, ROWS).rings[i]!, chain[i]!);

describe("ringsScene, the rings", () => {
  it("runs 5 to 15 seconds however many Layers there are", () => {
    for (const layers of [1, 2, 6, 8, 20, 40]) {
      const { duration } = ringsScene([1, ...Array(layers).fill(5)], null);
      expect(duration).toBeGreaterThanOrEqual(5);
      expect(duration).toBeLessThanOrEqual(15);
    }
  });

  it("shows the Center as @ in accent from the start", () => {
    const { center } = layoutRings(BACON, COLUMNS, ROWS);
    for (const { grid } of frames(BACON, null)) expect(at(grid, center)).toEqual({ char: "@", ink: "accent" });
  });

  it("adds the rings one Layer at a time from the inside out, each count with its ring", () => {
    const { rings, labels } = layoutRings(BACON, COLUMNS, ROWS);
    const all = frames(BACON, null);
    const firstDot = (layer: number) => all.find(({ grid }) => rings[layer]!.dots.some((d) => WEIGHTS.includes(at(grid, d).char) && at(grid, d).ink === "ink"))!.t;
    const ringDone = (layer: number) => all.find(({ grid }) => rings[layer]!.dots.every((d) => WEIGHTS.includes(at(grid, d).char)))!.t;
    const labelShown = (layer: number) => all.find(({ grid }) => rowText(grid, labels[layer - 1]!.y).includes(labels[layer - 1]!.text))!.t;
    for (let layer = 2; layer < BACON.length; layer++) {
      expect(firstDot(layer)).toBeGreaterThanOrEqual(ringDone(layer - 1));
      expect(labelShown(layer)).toBeGreaterThan(labelShown(layer - 1));
    }
    for (let layer = 1; layer < BACON.length; layer++) expect(labelShown(layer)).toBe(ringDone(layer));
  });

  it("ends with every ring and every count, in ink, with no green, red or gold", () => {
    const grid = lastFrame(BACON, null);
    const { rings, labels } = layoutRings(BACON, COLUMNS, ROWS);
    for (const ring of rings.slice(1)) for (const dot of ring.dots) expect(at(grid, dot).ink).toBe("ink");
    for (const { text } of labels) expect(screenText(grid)).toContain(text);
    expect(inks(grid).has("green") || inks(grid).has("red") || inks(grid).has("spark")).toBe(false);
  });

  it("draws a dot for one Actor light (·) and a dot for many heavy (●)", () => {
    const grid = lastFrame([1, 3, 50_000], null);
    const { rings } = layoutRings([1, 3, 50_000], COLUMNS, ROWS);
    expect(rings[1]!.dots.map((d) => at(grid, d).char)).toEqual(["·", "·", "·"]);
    expect(new Set(rings[2]!.dots.map((d) => at(grid, d).char))).toEqual(new Set(["●"]));
  });

  it("weighs a dot by how many Actors it stands for", () => {
    const { rings } = layoutRings(BACON, COLUMNS, ROWS);
    const grid = lastFrame(BACON, null);
    for (const ring of rings.slice(1)) {
      for (const dot of ring.dots) expect(at(grid, dot).char).toBe(dot.size === 1 ? "·" : dot.size < 10 ? "•" : "●");
    }
  });

  it("draws the same picture on every run", () => {
    expect(lastFrame(BACON, null)).toEqual(lastFrame(BACON, null));
  });
});

describe("ringsScene, a chain", () => {
  it("starts with every ring already drawn and the picked Actor as @ in accent", () => {
    const scene = ringsScene(TINY, XIA);
    const grid = scene.frame(0, COLUMNS, ROWS);
    const { labels } = layoutRings(TINY, COLUMNS, ROWS);
    for (const { text } of labels) expect(screenText(grid)).toContain(text);
    expect(at(grid, chainCell(TINY, XIA, 2))).toEqual({ char: "@", ink: "accent" });
  });

  it("draws the chain back to the Center: the picked Actor's Link first, the Center reached last", () => {
    const all = frames(TINY, XIA);
    const greenAt = (i: number) => all.find(({ grid }) => at(grid, chainCell(TINY, XIA, i)).ink === "green")!.t;
    expect(greenAt(1)).toBeLessThan(greenAt(0));
    expect(greenAt(2)).toBeLessThanOrEqual(greenAt(1));
  });

  it("ends with the chain's Actors as green @ joined by solid green lines, then sparkles in gold", () => {
    const grid = lastFrame(TINY, XIA);
    for (let i = 0; i < XIA.length; i++) expect(at(grid, chainCell(TINY, XIA, i))).toEqual({ char: "@", ink: "green" });
    const green = grid.chars.filter((_, i) => grid.inks[i] === "green");
    expect(green.filter((c) => c !== "@").every((c) => SOLID.includes(c))).toBe(true);
    expect(green.length).toBeGreaterThan(XIA.length);
    expect(inks(grid).has("red")).toBe(false);
    const all = frames(TINY, XIA);
    const firstGold = all.find(({ grid }) => grid.inks.includes("spark"))!.t;
    const allGreen = all.find(({ grid }) => at(grid, chainCell(TINY, XIA, 0)).ink !== "accent")!.t;
    expect(firstGold).toBeGreaterThanOrEqual(allGreen);
  });

  it("draws the Center's own chain as the Center alone", () => {
    const grid = lastFrame(TINY, [0]);
    expect(at(grid, layoutRings(TINY, COLUMNS, ROWS).center)).toEqual({ char: "@", ink: "green" });
  });

  it("finds a chain Actor's dot on a crowded ring", () => {
    const chain = [0, 7, 9_000, 40_000];
    const grid = lastFrame(BACON, chain);
    for (let i = 0; i < chain.length; i++) expect(at(grid, chainCell(BACON, chain, i))).toEqual({ char: "@", ink: "green" });
  });
});
