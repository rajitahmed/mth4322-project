import { describe, expect, it } from "vitest";
import { changedCells, createGrid, drawLine, rowText, writeText } from "./charGrid";

describe("charGrid", () => {
  it("draws solid lines with a glyph for their slope", () => {
    const grid = createGrid(7, 7);
    drawLine(grid, 0, 0, 6, 0, "ink", false);
    drawLine(grid, 0, 2, 0, 6, "ink", false);
    drawLine(grid, 2, 6, 6, 2, "ink", false);
    drawLine(grid, 2, 2, 5, 5, "ink", false);
    expect(rowText(grid, 0)).toBe("-------");
    expect(rowText(grid, 3)).toBe("|  \\ / ");
    expect(rowText(grid, 6)).toBe("| /    ");
  });

  it("draws dotted lines on every other cell with dotted glyphs", () => {
    const grid = createGrid(7, 7);
    drawLine(grid, 0, 0, 6, 0, "ink-dim", true);
    drawLine(grid, 0, 2, 0, 6, "ink-dim", true);
    expect(rowText(grid, 0)).toBe(". . . .");
    expect([2, 3, 4, 5, 6].map((y) => rowText(grid, y)[0]).join("")).toBe(": : :");
  });

  it("writes text and lists only the cells that changed", () => {
    const before = createGrid(5, 2);
    const after = createGrid(5, 2);
    writeText(after, 1, 1, "ab", "accent");
    expect(rowText(after, 1)).toBe(" ab  ");
    expect(changedCells(before, after)).toEqual([6, 7]);
    expect(changedCells(after, after)).toEqual([]);
  });

  it("ignores anything outside the grid", () => {
    const grid = createGrid(3, 3);
    drawLine(grid, -5, 1, 10, 1, "ink", false);
    writeText(grid, 2, 2, "xyz", "ink");
    expect(rowText(grid, 1)).toBe("---");
    expect(rowText(grid, 2)).toBe("  x");
  });
});
