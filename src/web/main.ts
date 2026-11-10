import {
  findActorAt,
  findChainToCenter,
  findCycle,
  findLargestPath,
  findLayers,
  findPath,
  findUnlinked,
  randomActors,
  searchActors,
} from "./api";
import { createCyclePanel } from "./cyclePanel";
import { showEnterScreen } from "./enter/enterScreen";
import { createPathPanel } from "./pathPanel";
import { createSixDegreesPanel } from "./sixDegreesPanel";
import { createStage } from "./stage/stage";
import { createTabs } from "./tabs";

const title = document.createElement("header");
title.textContent = "MOVIE STATISTICS";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
void showEnterScreen(document.body, reducedMotion).then(() =>
  document.body.append(
    title,
    createTabs([
      { name: "largest path", panel: createPathPanel({ searchActors, findPath, findLargestPath, randomActors }, createStage(reducedMotion)) },
      { name: "shortest cycle", panel: createCyclePanel({ searchActors, findCycle, randomActors }, createStage(reducedMotion)) },
      {
        name: "six degrees of bacon",
        panel: createSixDegreesPanel(
          searchActors,
          { findLayers, findChain: findChainToCenter, findActorAt, findUnlinked, randomActors },
          createStage(reducedMotion),
        ),
      },
    ]),
  ),
);
