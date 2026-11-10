/**
 * The animation engine (design.md § Rendering): a canvas drawn as a grid of character cells, one
 * animation loop, only changed cells redrawn, with `[replay]` and `[skip]`. It plays any Scene and
 * knows nothing about what the Scene shows.
 */
import { button } from "../button";
import type { Grid } from "./charGrid";
import { type CanvasView, canvasFont, measureCanvas, paintGrid } from "./paintGrid";

/** An animation: what the stage shows `t` seconds in (0 to `duration`), on a grid of `columns` × `rows` cells. */
export interface Scene {
  duration: number;
  frame(t: number, columns: number, rows: number): Grid;
}

export interface Stage {
  element: HTMLElement;
  /** Plays `scene` from the start, replacing any scene playing. `onPlaying` hears true when a run starts and false when it ends. */
  play(scene: Scene, onPlaying: (playing: boolean) => void): void;
}

/** A stage; with `reducedMotion` every run skips straight to the scene's last frame. */
export function createStage(reducedMotion: boolean): Stage {
  const element = document.createElement("section");
  element.className = "stage";
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  const replay = button("[replay]");
  const skip = button("[skip]");
  const controls = document.createElement("div");
  controls.className = "stage-controls";
  controls.append(replay, skip);
  element.append(canvas, controls);
  replay.hidden = skip.hidden = true;

  let scene: Scene | null = null;
  let onPlaying: (playing: boolean) => void = () => {};
  let view: CanvasView | null = null;
  let shown: Grid | null = null;
  let playing = false;
  let start: number | null = null;
  let frame = 0;

  const measure = () => {
    view = measureCanvas(canvas, canvas.clientWidth, canvas.clientHeight);
    shown = null; // repaint every cell
  };
  const draw = (t: number) => {
    if (!scene || !view || view.columns === 0 || view.rows === 0) return;
    const next = scene.frame(t, view.columns, view.rows);
    paintGrid(view.ctx, view.cell, next, shown);
    shown = next;
  };
  const setPlaying = (now: boolean) => {
    playing = now;
    skip.hidden = !now;
    replay.hidden = now;
    onPlaying(now);
  };

  const end = () => {
    cancelAnimationFrame(frame);
    draw(scene!.duration);
    setPlaying(false);
  };
  const tick = (now: number) => {
    start ??= now;
    const t = (now - start) / 1000;
    if (t >= scene!.duration) return end();
    draw(t);
    frame = requestAnimationFrame(tick);
  };
  const run = () => {
    cancelAnimationFrame(frame);
    measure(); // the stage may have been hidden, or the window resized, since the last run
    if (reducedMotion) return end();
    start = null;
    setPlaying(true);
    frame = requestAnimationFrame(tick);
  };

  replay.addEventListener("click", run);
  skip.addEventListener("click", end);
  /** Fits the grid to the canvas again; when stopped, repaints the finished picture. */
  const refit = () => {
    measure();
    if (scene && !playing) draw(scene.duration);
  };
  window.addEventListener("resize", refit);
  void document.fonts?.load(canvasFont()).then(refit);

  return {
    element,
    play(next, listener) {
      scene = next;
      onPlaying = listener;
      run();
    },
  };
}
