// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGrid } from "./charGrid";
import { cellAtPoint, createStage, type Scene } from "./stage";

/** A 2-second scene with steps at 0 and 1 second that records the times it was asked to draw. */
function recordingScene(): Scene & { times: number[] } {
  const times: number[] = [];
  return {
    duration: 2,
    steps: [
      { at: 0, text: "first" },
      { at: 1, text: "second" },
    ],
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
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  /** happy-dom has no 2D canvas: a fake one 100 × 50 px, so the stage draws and scenes record their times. */
  const fakeCanvas = () => {
    const ctx = { scale() {}, measureText: () => ({ width: 10 }), fillRect() {}, fillText() {} };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(50);
  };

  const setup = (reducedMotion = false) => {
    fakeCanvas();
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

  it("hides every button before anything has played", () => {
    const { stage } = setup();
    expect([...stage.element.querySelectorAll("button")].every((b) => b.hidden)).toBe(true);
  });

  it("tells the step being played, numbered", async () => {
    const { stage, onPlaying } = setup();
    const caption = () => stage.element.querySelector(".caption")!.textContent;
    stage.play(recordingScene(), onPlaying);
    expect(caption()).toBe("1/2  first");
    await vi.advanceTimersByTimeAsync(1200);
    expect(caption()).toBe("2/2  second");
  });

  it("[step >] pauses on the next step, and the last [step >] ends the run", async () => {
    const { stage, playing, onPlaying, button } = setup();
    const scene = recordingScene();
    stage.play(scene, onPlaying);
    button("[step >]").click();
    expect(scene.times.at(-1)).toBe(1);
    expect(button("[play]").hidden).toBe(false);
    await vi.advanceTimersByTimeAsync(3000);
    expect(playing).toEqual([true]); // paused: time stands still
    button("[step >]").click();
    expect(playing).toEqual([true, false]);
  });

  it("[< step] goes back a step, even after the end, and the run picks up again", async () => {
    const { stage, playing, onPlaying, button } = setup();
    const scene = recordingScene();
    stage.play(scene, onPlaying);
    button("[skip]").click();
    button("[< step]").click();
    expect(scene.times.at(-1)).toBe(1);
    expect(playing).toEqual([true, false, true]);
    button("[play]").click();
    await vi.advanceTimersByTimeAsync(1500);
    expect(playing).toEqual([true, false, true, false]);
  });

  it("keeps drawing after the end, so the scene's idle motion plays on", async () => {
    const { stage, onPlaying } = setup();
    const scene = recordingScene();
    stage.play(scene, onPlaying);
    await vi.advanceTimersByTimeAsync(4000);
    expect(Math.max(...scene.times)).toBeGreaterThan(3);
  });

  it("holds a scene played while the stage is hidden, and starts it when the stage is shown", async () => {
    const { stage, playing, onPlaying, button } = setup();
    const panel = document.createElement("div");
    panel.hidden = true;
    panel.append(stage.element);
    document.body.append(panel);
    stage.play(recordingScene(), onPlaying);
    await vi.advanceTimersByTimeAsync(2500);
    expect(playing).toEqual([]);
    expect(button("[replay]").hidden).toBe(true);
    panel.hidden = false;
    await vi.advanceTimersByTimeAsync(0);
    expect(playing).toEqual([true]);
    await vi.advanceTimersByTimeAsync(2500);
    expect(playing).toEqual([true, false]);
  });
});

describe("cellAtPoint", () => {
  it("finds the character cell under a point on the canvas", () => {
    const cell = { width: 9.6, height: 19 };
    expect(cellAtPoint(0, 0, cell)).toEqual({ x: 0, y: 0 });
    expect(cellAtPoint(9.5, 18.9, cell)).toEqual({ x: 0, y: 0 });
    expect(cellAtPoint(96.1, 38, cell)).toEqual({ x: 10, y: 2 });
  });
});
