import { describe, expect, it } from "vitest";
import type { Link } from "../../shared/types";
import { layoutCycle } from "./cycleLayout";
import type { CycleRun } from "./cycleRun";

const link = (from: string, to: string): Link => ({ from, movie: "tt", to });
const [COLUMNS, ROWS] = [80, 25];
const center = { x: (COLUMNS - 1) / 2, y: (ROWS - 1) / 2 };
/** Distance from the stage's center, in rows (a cell is about twice as tall as it is wide). */
const reach = ({ x, y }: { x: number; y: number }) => Math.hypot((x - center.x) / 2, y - center.y);

/** a, x, b, c on the Cycle (a, b, c chosen); p, q, r are rejected branches, s an off-circle Actor they came from. */
const found: CycleRun = {
  chosen: ["a", "b", "c"],
  circle: ["a", "x", "b", "c"],
  movies: ["Heat", "Heat", "Ring One", "Heat"],
  rejected: [link("a", "p"), link("x", "q"), link("s", "r")],
  moreRejected: 0,
  cut: null,
};

describe("layoutCycle", () => {
  it("spreads the circle's Actors evenly around the center, in order, the first at the top", () => {
    const { at } = layoutCycle(found, COLUMNS, ROWS);
    const cells = found.circle.map((id) => at.get(id)!);
    expect(cells[0]!.y).toBe(Math.min(...cells.map((c) => c.y)));
    const radii = cells.map(reach);
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1.5);
    const angles = cells.map(({ x, y }) => Math.atan2(y - center.y, (x - center.x) / 2));
    const turns = angles.map((angle, k) => (angle - angles[0]! + 4 * Math.PI) % (2 * Math.PI));
    expect([...turns].sort((p, q) => p - q)).toEqual(turns); // clockwise, in Cycle order
  });

  it("puts the rejected branches' Actors outside the circle, near the Actor they branched from", () => {
    const { at } = layoutCycle(found, COLUMNS, ROWS);
    const ringReach = Math.max(...found.circle.map((id) => reach(at.get(id)!)));
    for (const id of ["p", "q", "r", "s"]) expect(reach(at.get(id)!)).toBeGreaterThan(ringReach + 2);
    const dist = (u: string, v: string) => Math.hypot((at.get(u)!.x - at.get(v)!.x) / 2, at.get(u)!.y - at.get(v)!.y);
    expect(dist("a", "p")).toBeLessThan(dist("a", "q"));
    expect(dist("x", "q")).toBeLessThan(dist("x", "p"));
  });

  it("keeps every Actor and label on the grid", () => {
    const many: CycleRun = { ...found, rejected: Array.from({ length: 300 }, (_, i) => link(found.circle[i % 4]!, `n${i}`)) };
    const { at, labels } = layoutCycle(many, COLUMNS, ROWS);
    for (const { x, y } of at.values()) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(COLUMNS);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(ROWS);
    }
    for (const { x, y, text } of labels) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + text.length).toBeLessThanOrEqual(COLUMNS);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(ROWS);
    }
  });

  it("labels every Link of a Cycle with its Movie, shortening long titles", () => {
    const long = "The Lord of the Rings: The Fellowship of the circle";
    const { labels } = layoutCycle({ ...found, movies: ["Heat", "Heat", long, "Heat"] }, COLUMNS, ROWS);
    expect(labels.map((l) => l.text)).toEqual(["Heat", "Heat", "The Lord of the Ri…", "Heat"]);
    expect(layoutCycle({ ...found, movies: null }, COLUMNS, ROWS).labels).toEqual([]);
  });

  it("puts a cut actor off the circle in the center, and leaves one on the circle where it is", () => {
    const off: CycleRun = { ...found, circle: ["a", "b", "c"], movies: null, rejected: [], cut: { actor: "d", between: ["a", "c"] } };
    expect(layoutCycle(off, COLUMNS, ROWS).at.get("d")).toEqual({ x: Math.round(center.x), y: Math.round(center.y) });
    const on: CycleRun = { ...off, cut: { actor: "b", between: ["a", "c"] } };
    expect(layoutCycle(on, COLUMNS, ROWS).at.get("b")).toEqual(layoutCycle({ ...on, cut: null }, COLUMNS, ROWS).at.get("b"));
  });

  it("keeps the labels of a long Cycle from overlapping", () => {
    const circle = Array.from({ length: 20 }, (_, i) => `r${i}`);
    const run: CycleRun = { ...found, circle, movies: circle.map((_, i) => `Movie Number ${i} Long Title`), rejected: [] };
    const { labels } = layoutCycle(run, COLUMNS, ROWS);
    expect(labels).toHaveLength(20);
    for (const [i, p] of labels.entries()) {
      for (const q of labels.slice(i + 1)) expect(p.y === q.y && p.x <= q.x + q.text.length && q.x <= p.x + p.text.length).toBe(false);
    }
  });
});
