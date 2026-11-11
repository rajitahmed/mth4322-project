import { describe, expect, it } from "vitest";
import type { Link } from "../../shared/types";
import { cycleScene } from "../cycle/cycleScene";
import type { CycleRun } from "../cycle/cycleRun";
import { found as foundLinking, notFound } from "../linking/fixtures";
import { linkingScene } from "../linking/linkingScene";
import { ringsScene } from "../rings/ringsScene";
import type { Scene } from "./stage";

const link = (from: string, to: string): Link => ({ from, movie: "tt", to });
const cycle: CycleRun = {
  outcome: "found",
  names: {},
  chosen: ["a", "b", "c"],
  circle: ["a", "b", "c"],
  movies: ["M", "M", "M"],
  rejected: [link("a", "p")],
  moreRejected: 0,
  cut: null,
};

/** Every scene, in each of its kinds: stepping needs every step at its own moment, inside the run. */
const scenes: [string, Scene][] = [
  ["linking, found", linkingScene(foundLinking)],
  ["linking, no path", linkingScene(notFound)],
  ["cycle, found", cycleScene(cycle)],
  ["cycle, found with nothing rejected", cycleScene({ ...cycle, rejected: [] })],
  ["cycle, no cycle", cycleScene({ ...cycle, outcome: "no-cycle", movies: null })],
  ["cycle, different groups", cycleScene({ ...cycle, outcome: "different-groups", movies: null, rejected: [] })],
  ["cycle, cut actor", cycleScene({ ...cycle, outcome: "cut-actor", movies: null, rejected: [], cut: { actor: "d", between: ["a", "c"] } })],
  ["rings", ringsScene({ center: "K", layerCounts: [1, 3, 4], unlinkedCount: 2, chain: null })],
  ["rings, a chain", ringsScene({ center: "K", layerCounts: [1, 3, 4], unlinkedCount: 2, chain: { positions: [0, 1, 2], names: ["K", "A", "B"], movies: ["M", "N"] } })],
  ["rings, the Center's own chain", ringsScene({ center: "K", layerCounts: [1, 3], unlinkedCount: 0, chain: { positions: [0], names: ["K"], movies: [] } })],
];

describe("scene steps", () => {
  it.each(scenes)("%s: start at 0, each at its own later moment, all within the run", (_, scene) => {
    const times = scene.steps.map((step) => step.at);
    expect(times[0]).toBe(0);
    times.slice(1).forEach((at, i) => expect(at).toBeGreaterThan(times[i]!));
    expect(times.at(-1)!).toBeLessThanOrEqual(scene.duration);
  });
});
