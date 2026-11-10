import { createActorField } from "./actorField";
import { searchActors } from "./api";
import { createTabs } from "./tabs";

/** One tab's panel: its row of actor fields. */
function panel(...labels: string[]): HTMLElement {
  const element = document.createElement("section");
  const fields = document.createElement("div");
  fields.className = "fields";
  fields.append(...labels.map((label) => createActorField(label, searchActors).element));
  element.append(fields);
  return element;
}

const title = document.createElement("header");
title.textContent = "MOVIE STATISTICS";

document.body.append(
  title,
  createTabs([
    { name: "largest path", panel: panel("actor a", "actor b") },
    { name: "shortest cycle", panel: panel("actor 1", "actor 2", "actor 3") },
    { name: "six degrees of bacon", panel: panel("center") },
  ]),
);
