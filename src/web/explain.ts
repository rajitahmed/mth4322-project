import { apiAt } from "./api";
import { createExplainPage } from "./explain/explainPage";
import { setDocumentTitle } from "./heading";
import { createStage } from "./stage/stage";
import { createTopBar } from "./topBar";

/** The explainer page: every case runs on the tiny dataset's API (D29), on walkthrough stages. */
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
setDocumentTitle("Algorithms Explained By Claude");
document.body.classList.add("scrolling");
document.body.append(
  createTopBar({ text: "[back to movie statistics]", href: "./" }),
  createExplainPage(apiAt("/api/tiny"), () => createStage(reducedMotion, true)),
);
