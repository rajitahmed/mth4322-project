/**
 * The animation engine (design.md § Rendering): a canvas drawn as a grid of character cells, one
 * animation loop, only changed cells redrawn, with `[replay]` and `[skip]`. It plays any Scene and
 * knows nothing about what the Scene shows.
 */
import { button } from "../button";
import type { Cell, Grid } from "./charGrid";
import { type CanvasView, canvasFont, type CellSize, measureCanvas, paintGrid } from "./paintGrid";

/** An animation: what the stage shows `t` seconds in (0 to `duration`), on a grid of `columns` × `rows` cells. */
export interface Scene {
  duration: number;
  frame(t: number, columns: number, rows: number): Grid;
}

export interface Stage {
  element: HTMLElement;
  /**
   * Plays `scene` from the start, replacing any scene playing. `onPlaying` hears true when a run starts and false when it ends.
   * A scene played while the stage is hidden (its tab not shown) starts when the stage is shown.
   */
  play(scene: Scene, onPlaying: (playing: boolean) => void): void;
  /** Calls `listener` with the cell clicked, and the grid's size then. */
  onCellClick(listener: (cell: Cell, columns: number, rows: number) => void): void;
}

/** The character cell under the point (`px`, `py`) in CSS px from the canvas's top left. */
export function cellAtPoint(px: number, py: number, cell: CellSize): Cell {
  return { x: Math.floor(px / cell.width), y: Math.floor(py / cell.height) };
}

/** Calls `callback` now if `element` is shown, else once no element around it is hidden; returns a way to stop waiting. */
function whenShown(element: HTMLElement, callback: () => void): () => void {
  if (!element.closest("[hidden]")) {
    callback();
    return () => {};
  }
  const observer = new MutationObserver(() => {
    if (element.closest("[hidden]")) return;
    observer.disconnect();
    callback();
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ["hidden"], subtree: true });
  return () => observer.disconnect();
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
  // The canvas's own size, not the window's: it changes when the stage is shown again after being hidden.
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(refit).observe(canvas);
  else window.addEventListener("resize", refit);
  void document.fonts?.load(canvasFont()).then(refit);

  let stopWaiting = () => {};
  return {
    element,
    play(next, listener) {
      stopWaiting();
      cancelAnimationFrame(frame);
      scene = next;
      onPlaying = listener;
      stopWaiting = whenShown(element, run);
    },
    onCellClick(listener) {
      canvas.addEventListener("click", (event) => {
        if (view) listener(cellAtPoint(event.offsetX, event.offsetY, view.cell), view.columns, view.rows);
      });
    },
  };
}
