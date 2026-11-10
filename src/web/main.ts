import { findChainToCenter, findCycle, findLargestPath, findLayers, findPath, searchActors } from "./api";
import { createCyclePanel } from "./cyclePanel";
import { createPathPanel } from "./pathPanel";
import { createSixDegreesPanel } from "./sixDegreesPanel";
import { createTabs } from "./tabs";

const title = document.createElement("header");
title.textContent = "MOVIE STATISTICS";

document.body.append(
  title,
  createTabs([
    { name: "largest path", panel: createPathPanel(searchActors, findPath, findLargestPath) },
    { name: "shortest cycle", panel: createCyclePanel(searchActors, findCycle) },
    { name: "six degrees of bacon", panel: createSixDegreesPanel(searchActors, findLayers, findChainToCenter) },
  ]),
);
