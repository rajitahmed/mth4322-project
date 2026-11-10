import { describe, expect, it } from "vitest";
import { bigText, dotText, scaleDots } from "./bigText";

describe("bigText", () => {
  it("sets MOVIE over STATISTICS, centred, in rows of equal width", () => {
    const rows = bigText(["MOVIE", "STATISTICS"]);
    expect(rows.length).toBe(11); // two 5-row lines and one blank row between them
    const width = rows[0]!.length;
    rows.forEach((r) => expect(r.length).toBe(width));
    expect(rows[5]!.trim()).toBe("");
    // The shorter word is centred: equal margins, give or take one column.
    const margins = (r: string) => [r.length - r.trimStart().length, r.length - r.trimEnd().length];
    const [left, right] = margins(rows[1]!);
    expect(Math.abs(left! - right!)).toBeLessThanOrEqual(1);
  });

  it("uses plain ASCII line characters only", () => {
    expect(bigText(["MOVIE", "STATISTICS"]).join("")).toMatch(/^[ _|/\\()V]*$/);
  });
});

describe("dot font", () => {
  it("sets the words in 7-row dots with two blank rows between, centred", () => {
    const rows = dotText(["MOVIE", "STATISTICS"]);
    expect(rows).toHaveLength(16);
    expect(rows[0]!.length).toBe(59); // 10 letters of 5, 9 gaps
    expect(rows[7]).toBe(".".repeat(59));
  });

  it("scales the dots to any size, keeping them square on cells twice as tall as wide", () => {
    const scaled = scaleDots(["#.", ".#"], 1.5, 2);
    expect(scaled).toEqual(["●●●   ", "●●●   ", "   ●●●"]);
  });
});
