/**
 * The animation engine (design.md § Rendering): a canvas drawn as a grid of character cells, one
 * animation loop, only changed cells redrawn. Above the canvas, a caption tells what the algorithm is
 * doing, with `[< step]` `[pause]` `[step >]` to walk through it, `[skip]` and `[replay]`. Once a run is
 * over the loop keeps going, so the scene's idle motion plays on (D27). It knows nothing about what a
 * Scene shows.
 */
import { button } from "../button";
import type { Cell, Grid } from "./charGrid";
import { type CanvasView, canvasFont, type CellSize, measureCanvas, paintGrid } from "./paintGrid";
import { nextStepTime, previousStepTime, type Step, stepIndexAt } from "./steps";

/**
 * An animation: what the stage shows `t` seconds in, on a grid of `columns` × `rows` cells. The run
 * lasts `duration`; after that the scene shows its finished picture with some idle motion. `steps`
 * narrate the run, in time order.
 */
export interface Scene {
  duration: number;
  frame(t: number, columns: number, rows: number): Grid;
  steps: Step[];
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

/** A stage; with `reducedMotion` every run skips straight to the scene's finished picture, and nothing moves. */
export function createStage(reducedMotion: boolean): Stage {
  const element = document.createElement("section");
  element.className = "stage";
  const caption = document.createElement("p");
  caption.className = "caption";
  caption.setAttribute("aria-live", "polite");
  const back = button("[< step]");
  const pause = button("[pause]");
  const forward = button("[step >]");
  const skip = button("[skip]");
  const replay = button("[replay]");
  const controls = document.createElement("div");
  controls.className = "stage-controls";
  controls.append(back, pause, forward, skip, replay);
  const bar = document.createElement("div");
  bar.className = "stage-bar";
  bar.append(caption, controls);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  element.append(bar, canvas);
  for (const b of [back, pause, forward, skip, replay]) b.hidden = true;

  let scene: Scene | null = null;
  let onPlaying: (playing: boolean) => void = () => {};
  let view: CanvasView | null = null;
  let shown: Grid | null = null;
  let playing = false;
  let paused = false;
  /** Seconds into the run, and the animation-frame time it was last set at (null: set it on the next frame). */
  let t = 0;
  let since: number | null = null;
  let frame = 0;

  const measure = () => {
    view = measureCanvas(canvas, canvas.clientWidth, canvas.clientHeight);
    shown = null; // repaint every cell
  };
  const draw = () => {
    if (!scene || !view || view.columns === 0 || view.rows === 0) return;
    const next = scene.frame(t, view.columns, view.rows);
    paintGrid(view.ctx, view.cell, next, shown);
    shown = next;
  };
  const tell = () => {
    if (!scene) return;
    const index = stepIndexAt(scene.steps, t);
    const text = index >= 0 ? `${index + 1}/${scene.steps.length}  ${scene.steps[index]!.text}` : "";
    if (caption.textContent !== text) caption.textContent = text;
  };
  const showControls = () => {
    const any = scene !== null;
    back.hidden = !any || reducedMotion;
    forward.hidden = pause.hidden = skip.hidden = !playing || reducedMotion;
    replay.hidden = !any || playing;
    pause.textContent = paused ? "[play]" : "[pause]";
  };
  const setPlaying = (now: boolean) => {
    playing = now;
    onPlaying(now);
  };
  /** Moves the run to `at`: draws it, tells its step, and starts or ends the run to match (`starting`: a new run, always reported). */
  const seek = (at: number, starting = false) => {
    t = at;
    since = null;
    if (scene && t >= scene.duration) {
      paused = false; // the idle motion after the end always plays
      if (playing || starting) setPlaying(false);
    } else if (!playing) setPlaying(true);
    draw();
    tell();
    showControls();
  };

  const tick = (now: number) => {
    if (!paused && scene) {
      if (since === null) since = now - t * 1000;
      t = (now - since) / 1000;
      if (playing && t >= scene.duration) {
        setPlaying(false);
        showControls();
      }
      // A hidden stage (its tab not shown) keeps time but draws nothing.
      if (!element.closest("[hidden]")) {
        draw();
        tell();
      }
    }
    frame = requestAnimationFrame(tick);
  };
  const run = () => {
    cancelAnimationFrame(frame);
    measure(); // the stage may have been hidden, or the window resized, since the last run
    playing = false;
    paused = false;
    seek(reducedMotion ? scene!.duration : 0, true);
    if (!reducedMotion) frame = requestAnimationFrame(tick);
  };

  replay.addEventListener("click", run);
  skip.addEventListener("click", () => seek(scene!.duration));
  pause.addEventListener("click", () => {
    paused = !paused;
    since = null;
    showControls();
  });
  forward.addEventListener("click", () => {
    paused = true;
    seek(nextStepTime(scene!.steps, t, scene!.duration));
  });
  back.addEventListener("click", () => {
    paused = true;
    seek(previousStepTime(scene!.steps, Math.min(t, scene!.duration)));
  });

  /** Fits the grid to the canvas again and repaints. */
  const refit = () => {
    measure();
    draw();
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
