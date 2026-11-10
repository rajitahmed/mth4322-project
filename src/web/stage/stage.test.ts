// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGrid } from "./charGrid";
import { createStage, type Scene } from "./stage";

/** A 2-second scene that records the times it was asked to draw. */
function recordingScene(): Scene & { times: number[] } {
  const times: number[] = [];
  return {
    duration: 2,
    times,
    frame(t, columns, rows) {
      times.push(t);
      return createGrid(columns, rows);
    },
  };
}

describe("stage", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  const setup = (reducedMotion = false) => {
    const stage = createStage(reducedMotion);
    document.body.append(stage.element);
    const playing: boolean[] = [];
    const button = (text: string) => [...stage.element.querySelectorAll("button")].find((b) => b.textContent === text)!;
    return { stage, playing, onPlaying: (p: boolean) => playing.push(p), button };
  };

  it("plays a scene to its end, then says it stopped", async () => {
    const { stage, playing, onPlaying } = setup();
    stage.play(recordingScene(), onPlaying);
    expect(playing).toEqual([true]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(playing).toEqual([true]);
    await vi.advanceTimersByTimeAsync(1500);
    expect(playing).toEqual([true, false]);
  });

  it("shows [skip] while playing and [replay] once stopped", async () => {
    const { stage, onPlaying, button } = setup();
    stage.play(recordingScene(), onPlaying);
    expect(button("[skip]").hidden).toBe(false);
    expect(button("[replay]").hidden).toBe(true);
    await vi.advanceTimersByTimeAsync(2500);
    expect(button("[skip]").hidden).toBe(true);
    expect(button("[replay]").hidden).toBe(false);
  });

  it("[skip] jumps to the end at once", () => {
    const { stage, playing, onPlaying, button } = setup();
    stage.play(recordingScene(), onPlaying);
    button("[skip]").click();
    expect(playing).toEqual([true, false]);
  });

  it("[replay] runs the same scene again from the start", async () => {
    const { stage, playing, onPlaying, button } = setup();
    stage.play(recordingScene(), onPlaying);
    await vi.advanceTimersByTimeAsync(2500);
    button("[replay]").click();
    expect(playing).toEqual([true, false, true]);
    await vi.advanceTimersByTimeAsync(2500);
    expect(playing).toEqual([true, false, true, false]);
  });

  it("a new scene replaces the one playing", async () => {
    const { stage, playing, onPlaying } = setup();
    stage.play(recordingScene(), onPlaying);
    await vi.advanceTimersByTimeAsync(1000);
    stage.play(recordingScene(), onPlaying);
    await vi.advanceTimersByTimeAsync(1500);
    expect(playing).toEqual([true, true]); // the first scene never reports an end
    await vi.advanceTimersByTimeAsync(1000);
    expect(playing).toEqual([true, true, false]);
  });

  it("with reduced motion, skips straight to the end", () => {
    const { stage, playing, onPlaying, button } = setup(true);
    stage.play(recordingScene(), onPlaying);
    expect(playing).toEqual([false]);
    expect(button("[skip]").hidden).toBe(true);
  });

  it("hides both buttons before anything has played", () => {
    const { button } = setup();
    expect(button("[skip]").hidden).toBe(true);
    expect(button("[replay]").hidden).toBe(true);
  });
});
