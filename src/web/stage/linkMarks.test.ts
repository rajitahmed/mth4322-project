import { describe, expect, it } from "vitest";
import { createGrid, fitText, rowText, writeLabel } from "./charGrid";
import { drawPulse } from "./linkMarks";

describe("drawPulse", () => {
  const sparks = (t: number, closed = false) => {
    const grid = createGrid(10, 1);
    drawPulse(grid, [{ x: 0, y: 0 }, { x: 9, y: 0 }], t, closed);
    return rowText(grid, 0);
  };

  it("moves a spark with a short tail along the path", () => {
    expect(sparks(0)).toBe(" *        ");
    expect(sparks(3 / 18)).toBe("  .+*     ");
  });

  it("runs off an open path's end, and loops around a closed one", () => {
    expect(sparks(10 / 18)).toBe("         .");
    expect(sparks(1 / 18, true).trim()).not.toBe("");
  });
});

describe("labels", () => {
  it("cuts a long text with …", () => {
    expect(fitText("Kevin Bacon", 20)).toBe("Kevin Bacon");
    expect(fitText("Kevin Bacon", 6)).toBe("Kevin…");
    expect(fitText("Kevin Bacon", 0)).toBe("");
  });

  it("writes a label from, around or up to a column, kept on the grid", () => {
    const row = (x: number, align: "start" | "center" | "end") => {
      const grid = createGrid(12, 1);
      writeLabel(grid, x, 0, "abcd", "ink", 10, align);
      return rowText(grid, 0);
    };
    expect(row(2, "start")).toBe("  abcd      ");
    expect(row(5, "center")).toBe("   abcd     ");
    expect(row(5, "end")).toBe("  abcd      ");
    expect(row(11, "start")).toBe("        abcd");
  });
});
