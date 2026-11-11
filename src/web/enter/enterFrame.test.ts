import { describe, expect, it } from "vitest";
import { rowText } from "../stage/charGrid";
import { bigText } from "./bigText";
import { composeFrame, isOnIcosahedron, stageLayout, titleRows } from "./enterFrame";

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
    // The FIGlet letters, centred; near edges may run over a few of them.
    const title = bigText(["MOVIE", "STATISTICS"]);
    const { cx, cy } = stageLayout(W, H, ASPECT);
    const [top, left] = [cy - Math.floor(title.length / 2), cx - Math.floor(title[0]!.length / 2)];
    const letters = title.flatMap((row, i) => [...row].flatMap((c, j) => (c === " " ? [] : [{ c, i: (top + i) * W + left + j }])));
    expect(letters.filter(({ c, i }) => grid.chars[i] === c).length / letters.length).toBeGreaterThan(0.9);
    expect(screen).toMatch(/[·•●]/);
    expect(screen).toMatch(/[:.']/); // hidden edges, dotted
  });

  it("colors the edges ink, hidden edges and dots ink-dim, and the title accent on hover", () => {
    const inks = (grid: ReturnType<typeof frame>, glyph: string) =>
      new Set(grid.inks.filter((_, i) => grid.chars[i] === glyph));
    expect(inks(frame(1), "●")).toEqual(new Set(["ink-dim"]));
    expect(inks(frame(1, { hover: true }), "V")).toEqual(new Set(["accent"]));
  });

  it("leaves the title see-through: dim letters with a moving shine, and the halftone between them", () => {
    const { cx, cy } = stageLayout(W, H, ASPECT);
    const inTitle = (i: number) => Math.abs((i % W) - cx) < 30 && Math.abs(Math.floor(i / W) - cy) < 5;
    const vInks = (t: number) => {
      const grid = frame(t);
      return grid.inks.flatMap((ink, i) => (inTitle(i) && grid.chars[i] === "V" ? [ink] : []));
    };
    expect(vInks(1).filter((ink) => ink === "ink-dim").length).toBeGreaterThan(0); // resting letters are dim
    const litAt = (t: number) => vInks(t).join();
    expect(new Set([0.4, 1.2, 2, 2.8].map(litAt)).size).toBeGreaterThan(1); // the shine moves
    expect(frame(1).chars.some((c, i) => inTitle(i) && "·•●".includes(c))).toBe(true); // halftone shows through
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

  it("sizes the title to the icosahedron: marquee dots on a big screen, FIGlet letters on a laptop, plain text when small", () => {
    const fits = (width: number, height: number) => {
      const rows = titleRows(width, height, ASPECT);
      const { radius } = stageLayout(width, height, ASPECT);
      expect(Math.max(...rows.map((r) => r.length))).toBeLessThanOrEqual(2 * radius * ASPECT);
      expect(rows.length).toBeLessThanOrEqual(2 * radius);
      return rows;
    };
    const big = fits(420, 130);
    expect(big.join("")).toMatch(/^[● ]+$/);
    expect(big.length).toBeGreaterThan(16);
    expect(fits(400, 120).length).toBeLessThan(big.length); // a smaller screen, a smaller title
    expect(fits(W, H)).toEqual(bigText(["MOVIE", "STATISTICS"]));
    expect(fits(50, 16)).toEqual(["MOVIE STATISTICS"]);
    expect(fits(30, 10)).toEqual(["MOVIE", "STATISTICS"]);
  });

  it("knows whether a cell is on the icosahedron", () => {
    const { cx, cy, radius } = stageLayout(W, H, ASPECT);
    expect(isOnIcosahedron(W, H, ASPECT, cx, cy)).toBe(true);
    expect(isOnIcosahedron(W, H, ASPECT, cx, cy - radius + 1)).toBe(true);
    expect(isOnIcosahedron(W, H, ASPECT, 0, 0)).toBe(false);
  });
});
