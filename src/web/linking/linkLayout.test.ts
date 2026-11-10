import { describe, expect, it } from "vitest";
import type { ExploredLink } from "../../shared/types";
import { layoutLinks } from "./linkLayout";

const link = (from: string, to: string, side: "a" | "b"): ExploredLink => ({ from, movie: "tt", to, side });

/** a — x — y — b, met at y; p, q, r are rejected side branches. */
const found = {
  ends: ["a", "b"] as [string, string],
  tried: [link("a", "x", "a"), link("a", "p", "a"), link("b", "y", "b"), link("b", "q", "b"), link("x", "y", "a"), link("x", "r", "a")],
  answer: ["a", "x", "y", "b"],
};

/** Two Groups: a's side runs two Links deep, b's one. */
const notPossible = {
  ends: ["a", "b"] as [string, string],
  tried: [link("a", "p", "a"), link("b", "q", "b"), link("p", "r", "a")],
  answer: [],
};

const [COLUMNS, ROWS] = [60, 21];
const MIDDLE = 10;

describe("layoutLinks", () => {
  it("puts the two ends on the middle row, at the left and right edges", () => {
    for (const input of [found, notPossible]) {
      const at = layoutLinks(input, COLUMNS, ROWS);
      expect(at.get("a")!.y).toBe(MIDDLE);
      expect(at.get("b")!.y).toBe(MIDDLE);
      expect(at.get("a")!.x).toBeLessThan(4);
      expect(at.get("b")!.x).toBeGreaterThan(COLUMNS - 5);
    }
  });

  it("lays the answer chain out left to right along the middle row, evenly spaced", () => {
    const at = layoutLinks(found, COLUMNS, ROWS);
    const xs = found.answer.map((id) => at.get(id)!.x);
    expect(found.answer.map((id) => at.get(id)!.y)).toEqual([MIDDLE, MIDDLE, MIDDLE, MIDDLE]);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]!);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
    expect(Math.min(...gaps)).toBeGreaterThan(10);
  });

  it("keeps rejected Actors off the middle row, a column further from their own end per Link", () => {
    const at = layoutLinks(notPossible, COLUMNS, ROWS);
    expect(["p", "q", "r"].map((id) => at.get(id)!.y)).not.toContain(MIDDLE);
    expect(at.get("a")!.x).toBeLessThan(at.get("p")!.x);
    expect(at.get("p")!.x).toBeLessThan(at.get("r")!.x);
    expect(at.get("q")!.x).toBeLessThan(at.get("b")!.x);
    expect(at.get("r")!.x).toBeLessThan(at.get("q")!.x); // the two sides never cross in a "no path"
  });

  it("places every Actor on the grid, with whole cell coordinates, even when there are far more Actors than rows", () => {
    const many = { ...notPossible, tried: Array.from({ length: 500 }, (_, i) => link("a", `n${i}`, "a")) };
    for (const input of [found, notPossible, many]) {
      for (const { x, y } of layoutLinks(input, COLUMNS, ROWS).values()) {
        expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
        expect(x >= 0 && x < COLUMNS && y >= 0 && y < ROWS).toBe(true);
      }
    }
  });

  it("spreads one Link's worth of Actors over the rows", () => {
    const many = { ...notPossible, tried: Array.from({ length: 40 }, (_, i) => link("a", `n${i}`, "a")) };
    const rows = new Set([...layoutLinks(many, COLUMNS, ROWS).entries()].filter(([id]) => id.startsWith("n")).map(([, at]) => at.y));
    expect(rows.size).toBeGreaterThan(ROWS - 4);
  });

  it("orders each column by its parents' rows, so branches don't cross", () => {
    const tree = {
      ...notPossible,
      tried: [link("a", "p1", "a"), link("a", "p2", "a"), link("p2", "c1", "a"), link("p1", "c2", "a")],
    };
    const at = layoutLinks(tree, COLUMNS, ROWS);
    expect(at.get("p1")!.y).toBeLessThan(at.get("p2")!.y);
    expect(at.get("c2")!.y).toBeLessThan(at.get("c1")!.y); // c2's parent p1 sits above c1's parent p2
  });

  it("keeps the two sides apart where they share a column: side a above, side b below", () => {
    const at = layoutLinks(found, COLUMNS, ROWS);
    expect(at.get("r")!.x).toBe(at.get("q")!.x); // two Links from a, one from b: the same column
    expect(at.get("r")!.y).toBeLessThan(MIDDLE);
    expect(at.get("q")!.y).toBeGreaterThan(MIDDLE);
  });
});
