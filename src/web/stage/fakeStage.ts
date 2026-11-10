/** Test helper: a stage that plays nothing. Each scene stays "playing" until the test calls `finish`. */
import type { Scene, Stage } from "./stage";

export function fakeStage() {
  const scenes: Scene[] = [];
  let onPlaying: (playing: boolean) => void = () => {};
  const stage: Stage = {
    element: document.createElement("section"),
    play(scene, listener) {
      scenes.push(scene);
      onPlaying = listener;
      listener(true);
    },
  };
  return { stage, scenes, finish: () => onPlaying(false) };
}

/** The colors on a scene's last frame. */
export const endInks = (scene: Scene) => new Set(scene.frame(scene.duration, 80, 25).inks);
