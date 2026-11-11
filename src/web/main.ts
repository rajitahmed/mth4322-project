import { apiAt } from "./api";
import { createCyclePanel } from "./cyclePanel";
import { showEnterScreen } from "./enter/enterScreen";
import { createPathPanel } from "./pathPanel";
import { createSixDegreesPanel } from "./sixDegreesPanel";
import { createStage } from "./stage/stage";
import { createTabs } from "./tabs";
import { createTopBar } from "./topBar";

const api = apiAt("/api");

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
void showEnterScreen(document.body, reducedMotion).then(() =>
  document.body.append(
    createTopBar({ text: "[algorithms explained by Claude]", href: "./explain.html" }),
    createTabs([
      { name: "largest path", panel: createPathPanel(api, createStage(reducedMotion)) },
      { name: "shortest cycle", panel: createCyclePanel(api, createStage(reducedMotion)) },
      { name: "six degrees of bacon", panel: createSixDegreesPanel(api.searchActors, api, createStage(reducedMotion)) },
    ]),
  ),
);
