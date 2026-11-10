/** The enter screen: a turning ASCII icosahedron with MOVIE STATISTICS inside, over a halftone field. */
import type { Grid } from "../stage/charGrid";
import { composeFrame, isOnIcosahedron } from "./enterFrame";
import { type CanvasView, canvasFont, measureCanvas, paintGrid } from "../stage/paintGrid";

const DISSOLVE_MS = 800;

/**
 * Shows the enter screen in `parent` until the user clicks the icosahedron or presses Enter; it then
 * dissolves into dots and the promise resolves. With reduced motion it resolves at once and shows nothing.
 */
export function showEnterScreen(parent: HTMLElement, reducedMotion: boolean): Promise<void> {
  if (reducedMotion) return Promise.resolve();

  return new Promise((resolve) => {
    const screen = document.createElement("div");
    screen.className = "enter-screen";
    const button = document.createElement("button");
    button.setAttribute("aria-label", "[enter] movie statistics");
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    button.append(canvas);
    screen.append(button);
    parent.append(screen);
    button.focus();

    const measure = () => measureCanvas(canvas, window.innerWidth, window.innerHeight);
    let view: CanvasView | null = measure();
    let shown: Grid | null = null;
    let hover = false;
    let entering = false;
    let dissolveStart: number | null = null;
    let frame = 0;

    const aspect = () => (view ? view.cell.height / view.cell.width : 2);
    const onIcosahedron = (event: MouseEvent) =>
      view !== null &&
      isOnIcosahedron(view.columns, view.rows, aspect(), event.offsetX / view.cell.width, event.offsetY / view.cell.height);

    const resize = () => {
      view = measure();
      shown = null; // repaint every cell
    };
    const enter = () => {
      entering = true;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter") enter();
    };
    const onClick = (event: MouseEvent) => {
      // detail 0 is a keyboard press of the button; a mouse click must land on the icosahedron.
      if (event.detail === 0 || onIcosahedron(event)) enter();
    };
    const onMove = (event: MouseEvent) => {
      hover = onIcosahedron(event);
      screen.classList.toggle("hover", hover);
    };

    const finish = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("keydown", onKey);
      screen.remove();
      resolve();
    };

    const tick = (now: number) => {
      if (entering && dissolveStart === null) dissolveStart = now;
      const dissolve = dissolveStart === null ? 0 : (now - dissolveStart) / DISSOLVE_MS;
      if (dissolve >= 1) return finish();
      if (view) {
        const next = composeFrame(view.columns, view.rows, aspect(), now / 1000, hover, dissolve);
        paintGrid(view.ctx, view.cell, next, shown);
        shown = next;
      }
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("resize", resize);
    document.addEventListener("keydown", onKey);
    button.addEventListener("click", onClick);
    canvas.addEventListener("mousemove", onMove);
    // Nothing else on the page uses the font yet, so ask for it by name before measuring cells again.
    void document.fonts?.load(canvasFont()).then(resize);
    frame = requestAnimationFrame(tick);
  });
}
