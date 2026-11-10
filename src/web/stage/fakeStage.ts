/** Test helper: a stage that plays nothing. Each scene stays "playing" until the test calls `finish`. */
import type { Cell } from "./charGrid";
import type { Scene, Stage } from "./stage";

/** The grid size a fake stage's clicks report. */
export const FAKE_COLUMNS = 80;
export const FAKE_ROWS = 25;

export function fakeStage() {
  const scenes: Scene[] = [];
  let onPlaying: (playing: boolean) => void = () => {};
  let onClick: (cell: Cell, columns: number, rows: number) => void = () => {};
  const stage: Stage = {
    element: document.createElement("section"),
    play(scene, listener) {
      scenes.push(scene);
      onPlaying = listener;
      listener(true);
    },
    onCellClick(listener) {
      onClick = listener;
    },
  };
  return { stage, scenes, finish: () => onPlaying(false), click: (cell: Cell) => onClick(cell, FAKE_COLUMNS, FAKE_ROWS) };
}

/** The colors on a scene's last frame. */
export const endInks = (scene: Scene) => new Set(scene.frame(scene.duration, FAKE_COLUMNS, FAKE_ROWS).inks);
