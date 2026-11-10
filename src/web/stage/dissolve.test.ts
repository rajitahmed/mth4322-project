import { describe, expect, it } from "vitest";
import { dissolved } from "./dissolve";

describe("dissolved", () => {
  const cells = Array.from({ length: 500 }, (_, i) => i);

  it("leaves every cell whole at 0 and gone at 1", () => {
    expect(cells.map((i) => dissolved("-", i, 0))).toEqual(cells.map(() => "-"));
    expect(cells.map((i) => dissolved("-", i, 1))).toEqual(cells.map(() => ""));
  });

  it("fades each cell through the halftone dots, at its own moment", () => {
    const halfway = cells.map((i) => dissolved("-", i, 0.5));
    expect(new Set(halfway)).toEqual(new Set(["-", "●", "•", "·", ""]));
  });
});
