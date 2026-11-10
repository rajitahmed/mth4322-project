import { describe, expect, it } from "vitest";
import type { FoundPath } from "../../shared/types";
import { found, link, notFound } from "./fixtures";
import { layoutLinks, linkingOf } from "./linkLayout";

const [COLUMNS, ROWS] = [80, 25];

describe("layoutLinks", () => {
  it("puts the answer chain along the middle row, evenly spaced, the ends at the left and right edges", () => {
    const { at, middle } = layoutLinks(found, COLUMNS, ROWS);
    expect([at.get("ann"), at.get("cal"), at.get("bea")]).toEqual([
      { x: 2, y: middle },
      { x: 40, y: middle },
      { x: COLUMNS - 3, y: middle },
    ]);
  });

  it("keeps every other Actor off the middle row and its label rows, in its round's column", () => {
    const { at, middle, roundX } = layoutLinks(found, COLUMNS, ROWS);
    for (const id of ["dan", "eve", "fay"]) {
      const { x, y } = at.get(id)!;
      expect([middle - 2, middle - 1, middle, middle + 1]).not.toContain(y);
      expect(y).toBeGreaterThanOrEqual(2);
      expect(y).toBeLessThan(ROWS - 1);
      expect(x).toBe(id === "fay" ? roundX[1] : roundX[0]);
    }
  });

  it("orders a column by its parents' rows, so branches don't cross", () => {
    const twoRounds = {
      ...notFound,
      rounds: [
        { side: "a" as const, depth: 1, reached: 2, shown: [link("ann", "dan", "a"), link("ann", "eve", "a")] },
        { side: "a" as const, depth: 2, reached: 2, shown: [link("eve", "gus", "a"), link("dan", "hal", "a")] },
      ],
    };
    const { at } = layoutLinks(twoRounds, COLUMNS, ROWS);
    const [dan, eve] = [at.get("dan")!.y, at.get("eve")!.y];
    expect(Math.sign(at.get("hal")!.y - at.get("gus")!.y)).toBe(Math.sign(dan - eve));
  });

  it("keeps the two sides apart when there is no path", () => {
    const { at } = layoutLinks(notFound, COLUMNS, ROWS);
    expect(at.get("ann")!.x).toBeLessThan(at.get("dan")!.x);
    expect(at.get("dan")!.x).toBeLessThan(at.get("bea")!.x);
  });

  it("places every Actor on the grid, even on a tiny stage", () => {
    for (const cell of layoutLinks(found, 12, 4).at.values()) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.x).toBeLessThan(12);
      expect(Number.isInteger(cell.y)).toBe(true);
    }
  });
});

describe("linkingOf", () => {
  it("adds the chain's names and titles to the search's names", () => {
    const path: FoundPath = {
      found: true,
      distance: 1,
      actors: [
        { id: "nm1", name: "One", birthYear: null },
        { id: "nm2", name: "Two", birthYear: null },
      ],
      movies: [{ id: "tt1", title: "Film" }],
      rounds: [],
      names: {},
    };
    expect(linkingOf(path, null)).toEqual({
      ends: ["nm1", "nm2"],
      rounds: [],
      answer: ["nm1", "nm2"],
      answerMovies: ["tt1"],
      names: { nm1: "One", nm2: "Two", tt1: "Film" },
    });
  });

  it("searches between the two picked Actors when there is no path, and names them", () => {
    const one = { id: "nm1", name: "One", birthYear: null };
    const two = { id: "nm2", name: "Two", birthYear: null };
    expect(linkingOf({ found: false, rounds: [], names: {} }, [one, two])).toMatchObject({ ends: ["nm1", "nm2"], answer: [], names: { nm1: "One", nm2: "Two" } });
  });
});
