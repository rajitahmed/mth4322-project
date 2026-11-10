import { describe, expect, it } from "vitest";
import { rowText } from "../stage/charGrid";
import { composeFrame, isOnIcosahedron, stageLayout } from "./enterFrame";

const W = 160;
const H = 50;
const ASPECT = 2; // cells are twice as tall as they are wide
const frame = (t: number, options: { hover?: boolean; dissolve?: number } = {}) =>
  composeFrame(W, H, ASPECT, t, options.hover ?? false, options.dissolve ?? 0);
const text = (grid: ReturnType<typeof frame>) => Array.from({ length: H }, (_, y) => rowText(grid, y)).join("\n");

describe("enter frame", () => {
  it("draws MOVIE STATISTICS in the middle, inside the icosahedron, over the halftone field", () => {
    const grid = frame(1);
    const screen = text(grid);
    expect(screen).toContain("|____/   |_|  /_/   \\_\\");
    expect(screen).toMatch(/[·•●]/);
    expect(screen).toMatch(/[:.']/); // hidden edges, dotted
    const { cx, cy } = stageLayout(W, H, ASPECT);
    const titleRow = rowText(grid, Math.round(cy));
    expect(titleRow.slice(cx - 10, cx + 10).trim()).toBe(""); // the blank row between the two words
  });

  it("colors the edges ink, hidden edges and dots ink-dim, and the title accent on hover", () => {
    const inks = (grid: ReturnType<typeof frame>, glyph: string) =>
      new Set(grid.inks.filter((_, i) => grid.chars[i] === glyph));
    expect(inks(frame(1), "●")).toEqual(new Set(["ink-dim"]));
    expect(inks(frame(1), "V")).toEqual(new Set(["ink"]));
    expect(inks(frame(1, { hover: true }), "V")).toEqual(new Set(["accent"]));
  });

  it("turns the icosahedron at 30 fps: frames inside the same 1/30 s look the same", () => {
    const solid = (grid: ReturnType<typeof frame>) => grid.chars.map((c) => (/[-|/\\]/.test(c) ? c : " ")).join("");
    expect(solid(frame(2 + 0.001))).toBe(solid(frame(2 + 0.03)));
    expect(solid(frame(2 + 0.001))).not.toBe(solid(frame(2.5)));
  });

  it("dissolves the icosahedron and title into dots, leaving only the halftone field", () => {
    const halfway = text(frame(1, { dissolve: 0.6 }));
    expect(halfway).toMatch(/[-|/\\]/);
    const done = text(frame(1, { dissolve: 1 }));
    expect(done).toMatch(/^[ ·•●\n]*$/);
    expect(done).toBe(text(composeFrame(W, H, ASPECT, 1, false, 1)));
  });

  it("knows whether a cell is on the icosahedron", () => {
    const { cx, cy, radius } = stageLayout(W, H, ASPECT);
    expect(isOnIcosahedron(W, H, ASPECT, cx, cy)).toBe(true);
    expect(isOnIcosahedron(W, H, ASPECT, cx, cy - radius + 1)).toBe(true);
    expect(isOnIcosahedron(W, H, ASPECT, 0, 0)).toBe(false);
  });
});
