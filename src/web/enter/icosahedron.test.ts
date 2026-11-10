import { describe, expect, it } from "vitest";
import { EDGES, FACES, VERTICES, viewEdges } from "./icosahedron";

const length = ([x, y, z]: readonly number[]) => Math.hypot(x!, y!, z!);

describe("icosahedron", () => {
  it("has 12 vertices on the unit sphere, 30 equal edges and 20 faces", () => {
    expect(VERTICES).toHaveLength(12);
    VERTICES.forEach((v) => expect(length(v)).toBeCloseTo(1));
    expect(EDGES).toHaveLength(30);
    const lengths = EDGES.map(([a, b]) => length(VERTICES[a]!.map((c, i) => c - VERTICES[b]![i]!)));
    lengths.forEach((l) => expect(l).toBeCloseTo(lengths[0]!));
    expect(FACES).toHaveLength(20);
  });

  it("dots an edge only when both of its faces point away from the viewer", () => {
    for (const angle of [0, 0.4, 1.3, 2.9]) {
      const edges = viewEdges(angle);
      expect(edges).toHaveLength(30);
      const hidden = edges.filter((e) => e.hidden).length;
      // A convex solid seen from far away hides some edges but never most of them.
      expect(hidden).toBeGreaterThan(0);
      expect(hidden).toBeLessThan(15);
    }
  });

  it("projects onto the unit disc and comes back to the start after a full turn", () => {
    const start = viewEdges(0.7);
    const turned = viewEdges(0.7 + 2 * Math.PI);
    start.forEach((e, i) => {
      for (const [x, y] of [e.from, e.to]) expect(Math.hypot(x, y)).toBeLessThanOrEqual(1 + 1e-9);
      expect(turned[i]!.from[0]).toBeCloseTo(e.from[0]);
      expect(turned[i]!.hidden).toBe(e.hidden);
    });
  });
});
