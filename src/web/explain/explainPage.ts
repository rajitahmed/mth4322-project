/**
 * Algorithms Explained By Claude (D29): one section per algorithm, each with a plain-words explanation,
 * its running time, and friendly cases on the tiny dataset (17 Actors) to walk through step by step on
 * a walkthrough stage, with the answer in a report beside it.
 */
import type { ActorSummary, ChainMode } from "../../shared/types";
import type { Api } from "../api";
import { button } from "../button";
import { cycleRunOf } from "../cycle/cycleRun";
import { cycleScene } from "../cycle/cycleScene";
import { showCycle } from "../cyclePanel";
import { linkingOf } from "../linking/linkLayout";
import { linkingScene } from "../linking/linkingScene";
import { showPath } from "../pathPanel";
import { createReport, type Report } from "../report";
import { ringsRunOf, ringsScene } from "../rings/ringsScene";
import { showChain } from "../sixDegreesPanel";
import type { Stage } from "../stage/stage";
import answers from "../../../data/tiny/ANSWERS.md?raw";

/** A friendly case: a button label, and what it plays on the section's stage and shows in its report. */
interface Case {
  label: string;
  run(api: Api, stage: Stage, report: Report): Promise<void>;
}

interface Section {
  title: string;
  /** What the algorithm does, in plain words, one paragraph each. */
  explanation: string[];
  runningTime: string;
  cases: Case[];
}

/** A tiny-dataset Actor by name (and birth year, for the two Sam Lees), looked up through the API. */
interface Named {
  name: string;
  birthYear?: number;
}
async function actorNamed(api: Api, { name, birthYear }: Named): Promise<ActorSummary> {
  const found = (await api.searchActors(name)).find((a) => a.name === name && (birthYear === undefined || a.birthYear === birthYear));
  if (!found) throw new Error(`No Actor named ${name}`);
  return found;
}
const actors = (api: Api, named: Named[]) => Promise.all(named.map((n) => actorNamed(api, n)));

/** The friendly dataset's picture, from data/tiny/ANSWERS.md (its first code block). */
const TINY_PICTURE = answers.split("```")[1]!.trim();

/** Plays `scene`, telling the report what is on while it plays, then `done` fills it. */
const playing = (report: Report, text: string, done: () => void) => (now: boolean) => (now ? report.show(text) : done());

const pathCase = (from: string, to: string): Case => ({
  label: `${from} → ${to}`,
  async run(api, stage, report) {
    const [a, b] = await Promise.all([actorNamed(api, { name: from }), actorNamed(api, { name: to })]);
    const path = await api.findPath(a.id, b.id);
    stage.play(linkingScene(linkingOf(path, [a, b])), playing(report, `walking through: ${from} and ${to}`, () => showPath(report, path)));
  },
});

const largestCase: Case = {
  label: "the largest path",
  async run(api, stage, report) {
    const path = await api.findLargestPath();
    stage.play(linkingScene(linkingOf(path, null)), playing(report, "walking through: the farthest pair", () => showPath(report, path)));
  },
};

const cycleCase = (label: string, named: Named[]): Case => ({
  label,
  async run(api, stage, report) {
    const chosen = await actors(api, named);
    const cycle = await api.findCycle(chosen.map((a) => a.id));
    stage.play(cycleScene(cycleRunOf(cycle, chosen)), playing(report, `walking through: ${label}`, () => showCycle(report, cycle)));
  },
});

const KEVIN = "Kevin Bacon";

const layersCase: Case = {
  label: `${KEVIN}'s layers`,
  async run(api, stage, report) {
    const around = await api.findLayers((await actorNamed(api, { name: KEVIN })).id);
    const counts = around.layerCounts.map((n, i) => `${n} in layer ${i}`).join(", ");
    stage.play(ringsScene(ringsRunOf(around, null)), playing(report, "walking through: the layers", () => report.show(`${counts}; ${around.unlinkedCount} can't be linked`)));
  },
};

const chainCase = (to: string, mode: ChainMode): Case => ({
  label: `${to}: ${mode === "shortest" ? "shortest link" : "best-rated link"}`,
  async run(api, stage, report) {
    const [center, picked] = await Promise.all([actorNamed(api, { name: KEVIN }), actorNamed(api, { name: to })]);
    const around = await api.findLayers(center.id);
    const chain = await api.findChain(center.id, picked.id, mode);
    if (!chain.found) return showChain(report, chain, picked, center);
    stage.play(ringsScene(ringsRunOf(around, chain)), playing(report, `walking through: ${to}`, () => showChain(report, chain, picked, center)));
  },
});

const SECTIONS: Section[] = [
  {
    title: "largest path: bidirectional BFS and iFUB",
    explanation: [
      "Two actors are linked when they were in the same movie, and the distance between two actors is the fewest links on any chain between them. Breadth-first search (BFS) finds it: start at one actor, reach every co-star (1 link away), then every co-star of those (2 links away), and so on, never visiting anyone twice.",
      "Between two picked actors the search runs from both ends at once (bidirectional BFS). Each round, the side with fewer actors waiting reaches one link further. When the two sides touch, the chain through the meeting actor is a shortest one. Two small searches are far cheaper than one big one.",
      "The largest path is the biggest distance between any two actors who can be linked at all. Trying every pair would mean one BFS per actor. iFUB avoids that: it picks a central actor, sorts everyone by distance from it, and runs BFS from the farthest actors first. Every BFS raises a lower bound on the answer, and the distance of the layer it is working on caps what is left, so it stops as soon as the two meet, usually after a few hundred searches instead of 119,458.",
    ],
    runningTime: "One BFS is O(A + M + C) for A actors, M movies and C credits. iFUB is O(k · (A + M + C)) for its k searches (about 430 on the real data).",
    cases: [pathCase(KEVIN, "Dev Ennis"), pathCase(KEVIN, "Gia Quinn"), largestCase],
  },
  {
    title: "shortest cycle: two checks, then IDA*",
    explanation: [
      "A cycle is a closed chain of links that visits every chosen actor and never repeats an actor (a movie may be used more than once). Before searching, two quick checks often answer at once.",
      "Check 1: are all the chosen actors in one group (linked at all)? If not, no cycle exists. Check 2: does one actor split them? A cycle always stays inside one block, a part of the graph that no single actor's removal can split. If no block holds them all, some actor (the cut actor) sits on every route between two of them, and a cycle would have to pass through it twice.",
      "Otherwise IDA* searches inside that block. It sets a length limit and runs a depth-first search from the first chosen actor, giving up on a branch (rejected) as soon as the length so far plus a lower bound for what is left goes over the limit. The bound is the shortest tour of the remaining chosen actors using BFS distances (Held–Karp), and it never overestimates, so no short cycle is missed. If a pass finds nothing, the limit grows by 1, so the first cycle found is a shortest one.",
    ],
    runningTime: "The checks take O(k) per request, after O(A + M + C) once at startup for groups and blocks. IDA* is exponential in the worst case (the problem is NP-hard), but the bound prunes most branches.",
    cases: [
      cycleCase("Tom, Uma, Sam Lee: one shared movie", [{ name: "Tom Irwin" }, { name: "Uma Jones" }, { name: "Sam Lee", birthYear: 1970 }]),
      cycleCase("Kevin, Sid, Xia: a cycle of 4", [{ name: KEVIN }, { name: "Sid Moss" }, { name: "Xia Ortiz" }]),
      cycleCase("the ring of six", ["Ada Hart", "Ben Cole", "Cara Diaz", "Dev Ennis", "Eve Ford", "Finn Gray"].map((name) => ({ name }))),
      cycleCase("Pia, Dev, Ada: a cut actor", [{ name: "Pia Holt" }, { name: "Dev Ennis" }, { name: "Ada Hart" }]),
      cycleCase("Kevin, Ada, Sam Lee (1988): different groups", [{ name: KEVIN }, { name: "Ada Hart" }, { name: "Sam Lee", birthYear: 1988 }]),
    ],
  },
  {
    title: "six degrees: one BFS into layers, and the best-rated chain",
    explanation: [
      "One BFS from the center sorts every actor into layers: layer 1 shared a movie with the center, layer 2 shared one with someone in layer 1, and so on. Actors the BFS never reaches are in another group: they can't be linked.",
      "Any actor's chain back to the center follows the BFS one layer at a time. The shortest-link chain takes the first co-star found in each layer.",
      "The best-rated chain is the shortest chain whose movies have the highest average rating. All shortest chains have the same length, so that is the highest total. Dynamic programming finds it layer by layer: each actor's best total is the best total of a co-star one layer closer plus the rating of the movie they share.",
    ],
    runningTime: "One BFS, O(A + M + C), gives every layer; the best-rated totals take one more pass over the same links, O(A + M + C).",
    cases: [layersCase, chainCase("Xia Ortiz", "shortest"), chainCase("Xia Ortiz", "best-rated"), chainCase("Gia Quinn", "shortest")],
  },
];

/** The page's body: its heading, the tiny dataset's picture, then one section per algorithm. */
export function createExplainPage(api: Api, newStage: () => Stage): HTMLElement {
  const main = document.createElement("main");
  main.className = "explain";
  const h1 = document.createElement("h1");
  h1.textContent = "Algorithms Explained By Claude";
  const intro = paragraph(
    "Each algorithm below runs on a friendly dataset of 17 actors and 16 movies, drawn here, instead of the real 119,458 actors. Pick a case, then press [step >] to walk through it one step at a time, or click any step in the list.",
  );
  const picture = document.createElement("pre");
  picture.className = "tiny-picture";
  picture.textContent = TINY_PICTURE;
  main.append(h1, intro, picture, ...SECTIONS.map((section) => createSection(section, api, newStage())));
  return main;
}

function createSection({ title, explanation, runningTime, cases }: Section, api: Api, stage: Stage): HTMLElement {
  const section = document.createElement("section");
  section.className = "algorithm";
  const h2 = document.createElement("h2");
  h2.textContent = title;
  const time = paragraph(`running time: ${runningTime}`);
  time.className = "running-time";
  const report = createReport();
  report.show("pick a case");
  const buttons = document.createElement("div");
  buttons.className = "fields";
  buttons.append(
    ...cases.map((c) => {
      const b = button(`[${c.label}]`);
      b.addEventListener("click", () => c.run(api, stage, report).catch(() => report.show("search failed, try again")));
      return b;
    }),
  );
  const workspace = document.createElement("div");
  workspace.className = "workspace";
  workspace.append(stage.element, report.element);
  section.append(h2, ...explanation.map(paragraph), time, buttons, workspace);
  return section;
}

function paragraph(text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.textContent = text;
  return p;
}
