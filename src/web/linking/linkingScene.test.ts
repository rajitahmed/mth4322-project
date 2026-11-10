import { describe, expect, it } from "vitest";
import { type Grid, rowText } from "../stage/charGrid";
import { found, notFound } from "./fixtures";
import { layoutLinks } from "./linkLayout";
import { linkingScene } from "./linkingScene";

const [COLUMNS, ROWS] = [80, 25];
const text = (grid: Grid) => Array.from({ length: grid.height }, (_, y) => rowText(grid, y)).join("\n");

describe("linkingScene", () => {
  it("runs 5 to 15 seconds", () => {
    expect(linkingScene(found).duration).toBeGreaterThanOrEqual(5);
    expect(linkingScene(found).duration).toBeLessThanOrEqual(15);
  });

  it("names the two ends from the start, each as `@` in accent", () => {
    const grid = linkingScene(found).frame(0, COLUMNS, ROWS);
    expect(text(grid)).toContain("Ann Ash");
    expect(text(grid)).toContain("Bea Birch");
    const { x, y } = layoutLinks(found, COLUMNS, ROWS).at.get("ann")!;
    expect(grid.chars[y * COLUMNS + x]).toBe("@");
    expect(grid.inks[y * COLUMNS + x]).toBe("accent");
  });

  it("tells one step per round, with its count and the names it reached, then the meeting and the chain", () => {
    const steps = linkingScene(found).steps.map((s) => s.text);
    expect(steps).toHaveLength(5);
    expect(steps[1]).toBe(
      "round 1: from Ann Ash's side, 40 new actors 1 link away: Cal Cole (First Film), Dan Dee (Some Film), Eve Elm (Some Film), … 37 more",
    );
    expect(steps[3]).toBe("the two sides meet at Cal Cole: distance 2");
    expect(steps[4]).toBe("shortest chain: Ann Ash → First Film → Cal Cole → Second Film → Bea Birch");
  });

  it("names a round's Actors while it is told, and puts its count over its column", () => {
    const scene = linkingScene(found);
    const during = text(scene.frame(scene.steps[2]!.at + 0.9, COLUMNS, ROWS));
    expect(during).toContain("Fay");
    expect(during).toContain("+7");
    expect(during).not.toContain("Dan Dee");
  });

  it("ends with the chain green and named, and the rest faded away", () => {
    const scene = linkingScene(found);
    const end = scene.frame(scene.duration, COLUMNS, ROWS);
    expect(new Set(end.inks)).toContain("green");
    expect(new Set(end.inks)).not.toContain("red");
    expect(text(end)).toContain("Cal Cole");
  });

  it("plays a 'no path' fully red: nothing green, no sparkles", () => {
    const scene = linkingScene(notFound);
    const end = scene.frame(scene.duration + 3, COLUMNS, ROWS);
    expect(new Set(end.inks)).toContain("red");
    expect(new Set(end.inks)).not.toContain("green");
    expect(new Set(end.inks)).not.toContain("spark");
    expect(scene.steps.at(-1)!.text).toBe("no one new to reach: no chain of movies joins Ann Ash and Bea Birch");
  });

  it("keeps a spark running along the chain once the run is over", () => {
    const scene = linkingScene(found);
    const sparks = (t: number) => scene.frame(t, COLUMNS, ROWS).inks.flatMap((ink, i) => (ink === "spark" ? [i] : []));
    expect(sparks(scene.duration + 0.5)).not.toEqual([]);
    expect(sparks(scene.duration + 0.5)).not.toEqual(sparks(scene.duration + 1));
  });

  it("draws no halftone: an empty stage is blank", () => {
    const grid = linkingScene(found).frame(0, COLUMNS, ROWS);
    expect(grid.chars.filter((c) => "·•●".includes(c))).toEqual([]);
  });
});
