import { describe, expect, it } from "vitest";
import { CELL_ASPECT } from "../stage/charGrid";
import { dotOf, layoutRings, nearestDot } from "./ringsLayout";

const [COLUMNS, ROWS] = [100, 30];
/** The tiny dataset around Kevin Bacon. */
const TINY = [1, 3, 4, 4, 1, 1];
/** Kevin Bacon on the real data. */
const BACON = [1, 320, 13_060, 51_640, 39_764, 8_067, 786, 140];

/** How far a cell is from the center, in rows (a cell is CELL_ASPECT times taller than wide). */
const reach = (x: number, y: number, cx: number, cy: number) => Math.hypot((x - cx) / CELL_ASPECT, y - cy);

describe("layoutRings", () => {
  it("puts the Center alone in Layer 0, in the middle of the space the rings use", () => {
    const { rings, center } = layoutRings(TINY, COLUMNS, ROWS);
    expect(rings[0]!.dots).toEqual([{ x: center.x, y: center.y, first: 0, size: 1 }]);
    expect(center.y).toBe(Math.round((ROWS - 1) / 2));
  });

  it("gives each ring one dot per Actor while they fit, splitting its Actors in order", () => {
    const { rings } = layoutRings(TINY, COLUMNS, ROWS);
    rings.forEach((ring, layer) => {
      expect(ring.count).toBe(TINY[layer]);
      expect(ring.dots.map((d) => d.first)).toEqual([...Array(TINY[layer]).keys()]);
      expect(ring.dots.every((d) => d.size === 1)).toBe(true);
    });
  });

  it("lets one dot stand for several Actors when a ring has more Actors than cells, covering each Actor once", () => {
    const { rings } = layoutRings(BACON, COLUMNS, ROWS);
    for (const ring of rings.slice(1)) {
      let next = 0;
      for (const dot of ring.dots) {
        expect(dot.first).toBe(next);
        expect(dot.size).toBeGreaterThan(0);
        next += dot.size;
      }
      expect(next).toBe(ring.count);
    }
    const crowded = rings[3]!;
    expect(crowded.dots.length).toBeLessThan(crowded.count);
    expect(new Set(crowded.dots.map((d) => `${d.x},${d.y}`)).size).toBe(crowded.dots.length);
  });

  it("puts each Layer on a larger ring than the one inside it, round on screen", () => {
    const { rings, center } = layoutRings(BACON, COLUMNS, ROWS);
    const radii = rings.map((ring) => ring.dots.map((d) => reach(d.x, d.y, center.x, center.y)));
    for (let layer = 1; layer < rings.length; layer++) {
      expect(Math.min(...radii[layer]!)).toBeGreaterThan(Math.max(...radii[layer - 1]!));
      expect(Math.max(...radii[layer]!) - Math.min(...radii[layer]!)).toBeLessThan(1.5);
    }
  });

  it("keeps every dot and every count on the grid, the counts to the right of the rings", () => {
    const { rings, labels } = layoutRings(BACON, COLUMNS, ROWS);
    const dots = rings.flatMap((r) => r.dots);
    for (const { x, y } of dots) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(COLUMNS);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(ROWS);
    }
    const rightmost = Math.max(...dots.map((d) => d.x));
    for (const { x, y, text } of labels) {
      expect(x).toBeGreaterThan(rightmost);
      expect(x + text.length).toBeLessThanOrEqual(COLUMNS);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(ROWS);
    }
  });

  it("writes one count per Layer outside the Center, in Layer order, one per row", () => {
    const { labels } = layoutRings(BACON, COLUMNS, ROWS);
    expect(labels.map((l) => l.text)).toEqual([
      "layer 1: 320",
      "layer 2: 13,060",
      "layer 3: 51,640",
      "layer 4: 39,764",
      "layer 5: 8,067",
      "layer 6: 786",
      "layer 7: 140",
    ]);
    labels.slice(1).forEach((label, i) => expect(label.y).toBe(labels[i]!.y + 1));
  });

  it("has no rings for a Center with no co-stars", () => {
    const { rings, labels } = layoutRings([1], COLUMNS, ROWS);
    expect(rings).toHaveLength(1);
    expect(labels).toEqual([]);
  });
});

describe("dotOf", () => {
  it("finds the dot that stands for each Actor of a ring", () => {
    for (const ring of layoutRings(BACON, COLUMNS, ROWS).rings) {
      for (const position of [0, 1, Math.floor(ring.count / 2), ring.count - 1]) {
        if (position >= ring.count) continue;
        const dot = dotOf(ring, position);
        expect(position).toBeGreaterThanOrEqual(dot.first);
        expect(position).toBeLessThan(dot.first + dot.size);
      }
    }
  });
});

describe("nearestDot", () => {
  it("picks the dot under the cell, or the closest one a cell away, with its Layer and first Actor", () => {
    const layout = layoutRings(TINY, COLUMNS, ROWS);
    const dot = layout.rings[2]!.dots[3]!;
    expect(nearestDot(layout, { x: dot.x, y: dot.y })).toEqual({ layer: 2, position: 3 });
    expect(nearestDot(layout, { x: dot.x + 1, y: dot.y })).toEqual({ layer: 2, position: 3 });
    expect(nearestDot(layout, layout.center)).toEqual({ layer: 0, position: 0 });
  });

  it("picks nothing far from every dot", () => {
    const layout = layoutRings(TINY, COLUMNS, ROWS);
    expect(nearestDot(layout, { x: 0, y: 0 })).toBeNull();
  });
});
