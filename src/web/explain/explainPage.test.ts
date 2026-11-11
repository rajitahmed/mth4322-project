// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../../server/app";
import { loadDataset } from "../../server/dataset";
import { buildGraph } from "../../server/graph";
import { createOperations } from "../../server/operations";
import { apiAt } from "../api";
import { fakeStage } from "../stage/fakeStage";
import { createExplainPage } from "./explainPage";

/**
 * The real server over the tiny dataset, answering the page's fetches in process. Cycle requests are
 * only recorded and answered "different groups": the Cycle worker can't start under happy-dom, and the
 * server's own tests cover the Cycle route.
 */
const server = buildApp(createOperations(buildGraph(loadDataset("data/tiny"))));
const cycleRequests: string[] = [];
vi.stubGlobal("fetch", async (url: string) => {
  if (url.startsWith("/api/cycle")) {
    cycleRequests.push(url);
    return { ok: true, status: 200, json: async () => ({ outcome: "not-possible", reason: "different-groups" }) };
  }
  const response = await server.inject({ url });
  return { ok: response.statusCode < 400, status: response.statusCode, json: async () => response.json() };
});

function setup() {
  const stages = [fakeStage(), fakeStage(), fakeStage()];
  let next = 0;
  const page = createExplainPage(apiAt("/api"), () => stages[next++]!.stage);
  document.body.replaceChildren(page);
  const sections = [...page.querySelectorAll<HTMLElement>("section.algorithm")];
  const press = (section: number, label: string) => [...sections[section]!.querySelectorAll("button")].find((b) => b.textContent === label)!.click();
  const result = (section: number) => sections[section]!.querySelector(".result")!.textContent;
  const chain = (section: number) => [...sections[section]!.querySelectorAll(".chain li")].map((li) => li.textContent);
  return { page, sections, stages, press, result, chain };
}

describe("Algorithms Explained By Claude", () => {
  it("has one section per algorithm, each with its explanation, running time and cases, under the tiny dataset's picture", () => {
    const { page, sections } = setup();
    expect(page.querySelector("h1")!.textContent).toBe("Algorithms Explained By Claude");
    expect(page.querySelector(".tiny-picture")!.textContent).toContain("Pia Holt (nm08)");
    expect(sections.map((s) => s.querySelector("h2")!.textContent)).toEqual([
      "largest path: bidirectional BFS and iFUB",
      "shortest cycle: two checks, then IDA*",
      "six degrees: one BFS into layers, and the best-rated chain",
    ]);
    for (const section of sections) expect(section.querySelector(".running-time")!.textContent).toMatch(/^running time: /);
  });

  it("walks through Kevin Bacon → Dev Ennis, then shows distance 4", async () => {
    const { stages, press, result } = setup();
    press(0, "[Kevin Bacon → Dev Ennis]");
    await vi.waitFor(() => expect(stages[0]!.scenes).toHaveLength(1));
    expect(result(0)).toBe("walking through: Kevin Bacon and Dev Ennis");
    stages[0]!.finish();
    expect(result(0)).toBe("distance 4");
  });

  it("sends each cycle case's Chosen Actors, the right Sam Lee included, and shows the answer once it has played", async () => {
    const { stages, press, result } = setup();
    press(1, "[Tom, Uma, Sam Lee: one shared movie]");
    await vi.waitFor(() => expect(stages[1]!.scenes).toHaveLength(1));
    expect(cycleRequests.at(-1)).toBe("/api/cycle?actors=nm09&actors=nm10&actors=nm11");
    press(1, "[Kevin, Ada, Sam Lee (1988): different groups]");
    await vi.waitFor(() => expect(stages[1]!.scenes).toHaveLength(2));
    expect(cycleRequests.at(-1)).toBe("/api/cycle?actors=nm01&actors=nm02&actors=nm15");
    stages[1]!.finish();
    expect(result(1)).toBe("not possible: these actors share no chain of movies");
  });

  it("shows Xia Ortiz's best-rated chain, and that Gia Quinn can't be linked", async () => {
    const { stages, press, result, chain } = setup();
    press(2, "[Xia Ortiz: best-rated link]");
    await vi.waitFor(() => expect(stages[2]!.scenes).toHaveLength(1));
    stages[2]!.finish();
    expect(result(2)).toBe("layer 2 · rating 17.3, average 8.65");
    expect(chain(2)).toContain("|High Noon Redux");
    press(2, "[Gia Quinn: shortest link]");
    await vi.waitFor(() => expect(result(2)).toBe("can't be linked: Gia Quinn shares no chain of movies with Kevin Bacon"));
  });
});
