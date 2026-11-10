import { describe, expect, it } from "vitest";
import { createGrid, setCell } from "./charGrid";
import { halftoneGlyph, overHalftone } from "./halftone";

const cells = (t: number) => {
  const out: string[] = [];
  for (let y = 0; y < 40; y++) for (let x = 0; x < 120; x++) out.push(halftoneGlyph(x, y, t));
  return out;
};

describe("halftone", () => {
  it("uses only the light-to-dark ramp, and mostly leaves the page empty", () => {
    const field = cells(3);
    expect(new Set(field)).toEqual(new Set([" ", "·", "•", "●"]));
    expect(field.filter((c) => c === " ").length).toBeGreaterThan(field.length / 2);
  });

  it("drifts slowly: one 60 fps frame changes only a few cells", () => {
    const a = cells(5);
    const b = cells(5 + 1 / 60);
    const changed = a.filter((c, i) => c !== b[i]).length;
    expect(changed).toBeLessThan(a.length * 0.03);
    expect(cells(5)).toEqual(a);
  });
});

describe("overHalftone", () => {
  it("keeps the front cells and their inks, and shows the halftone in ink-dim through empty ones", () => {
    const front = createGrid(120, 40, "");
    setCell(front, 3, 2, "@", "green");
    const grid = overHalftone(front, 3);
    expect(grid.chars[2 * 120 + 3]).toBe("@");
    expect(grid.inks[2 * 120 + 3]).toBe("green");
    expect(grid.chars.filter((c, i) => i !== 2 * 120 + 3)).toEqual(cells(3).filter((_, i) => i !== 2 * 120 + 3));
    expect(new Set(grid.inks.filter((_, i) => i !== 2 * 120 + 3))).toEqual(new Set(["ink-dim"]));
  });
});
