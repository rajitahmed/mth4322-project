import { describe, expect, it } from "vitest";
import { bigText } from "./bigText";

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
