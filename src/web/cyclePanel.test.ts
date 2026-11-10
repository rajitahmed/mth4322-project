// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type { ActorSummary, ShortestCycle } from "../shared/types";
import { createCyclePanel } from "./cyclePanel";
import { endInks, fakeStage } from "./stage/fakeStage";

const names = ["Ada Hart", "Ben Cole", "Cara Diaz", "Dev Ennis", "Eve Ford", "Finn Gray", "Pia Holt"];
const actors: ActorSummary[] = names.map((name, i) => ({ id: `nm${i}`, name, birthYear: 1970 + i }));
const [ada, ben, cara, dev, , , pia] = actors;
const heat = { id: "tt1", title: "Heat" };
const found: ShortestCycle = {
  outcome: "found",
  length: 3,
  actors: [ada!, ben!, cara!],
  movies: [heat, heat, heat],
  rejected: [],
  moreRejected: 0,
  names: {},
};

function setup(check: ShortestCycle | Error | Promise<ShortestCycle>, random = () => 0) {
  const search = vi.fn(async (query: string) => actors.filter((a) => a.name.toLowerCase().startsWith(query)));
  const findCycle = vi.fn(async (_ids: string[]) => {
    if (check instanceof Error) throw check;
    return check;
  });
  const randomActors = vi.fn(async (count: number) => actors.slice(0, count));
  const { stage, scenes, finish } = fakeStage();
  const panel = createCyclePanel({ searchActors: search, findCycle, randomActors }, stage, random);
  document.body.replaceChildren(panel);
  const inputs = () => [...panel.querySelectorAll("input")];
  const options = () => [...panel.querySelectorAll('[role="option"]')].map((o) => o.textContent);
  const type = async (field: number, text: string) => {
    inputs()[field]!.value = text;
    inputs()[field]!.dispatchEvent(new Event("input"));
    await vi.waitFor(() => expect(search).toHaveBeenLastCalledWith(text));
    await Promise.resolve();
  };
  const pick = async (field: number, text: string) => {
    await type(field, text);
    await vi.waitFor(() => expect(panel.querySelector('[role="option"]')).not.toBeNull());
    panel.querySelector('[role="option"]')!.dispatchEvent(new MouseEvent("mousedown"));
  };
  const button = (text: string) => [...panel.querySelectorAll("button")].find((b) => b.textContent === text)!;
  const result = () => panel.querySelector<HTMLElement>(".result")!;
  const chain = () => [...panel.querySelectorAll(".chain li")].map((li) => li.textContent);
  /** Presses a button ([enter] by default), waits for the answer, and lets the animation finish. */
  const enter = async (text = "[enter]") => {
    button(text).click();
    await vi.waitFor(() => expect(result().textContent).not.toMatch(/^pick|^searching…/));
    finish();
  };
  const pickThree = async () => {
    await pick(0, "ada");
    await pick(1, "ben");
    await pick(2, "cara");
  };
  return { panel, inputs, options, type, pick, pickThree, button, result, chain, enter, findCycle, randomActors, scenes, finish };
}

describe("shortest cycle panel", () => {
  it("is headed 'shortest cycle'", () => {
    expect(setup(found).panel.querySelector("h1")!.textContent).toBe("shortest cycle");
  });

  it("starts with 3 actor fields and adds one per [add actor], up to 6", () => {
    const { inputs, button } = setup(found);
    expect(inputs()).toHaveLength(3);
    for (let i = 0; i < 5; i++) button("[add actor]").click();
    expect(inputs()).toHaveLength(6);
    expect(button("[add actor]").disabled).toBe(true);
  });

  it("removes the last field per [remove actor], down to 3", () => {
    const { inputs, button } = setup(found);
    expect(button("[remove actor]").disabled).toBe(true);
    button("[add actor]").click();
    button("[add actor]").click();
    button("[remove actor]").click();
    expect(inputs()).toHaveLength(4);
    button("[remove actor]").click();
    expect(inputs()).toHaveLength(3);
    expect(button("[remove actor]").disabled).toBe(true);
    expect(button("[add actor]").disabled).toBe(false);
  });

  it("[random] picks a random number of random Actors, fills that many fields, and searches at once", async () => {
    const { inputs, enter, randomActors, findCycle } = setup(found, () => 0.99);
    await enter("[random]");
    expect(randomActors).toHaveBeenCalledWith(6);
    expect(inputs().map((i) => i.value)).toEqual(actors.slice(0, 6).map((a) => `${a.name} (${a.birthYear})`));
    expect(findCycle).toHaveBeenCalledWith(["nm0", "nm1", "nm2", "nm3", "nm4", "nm5"]);
  });

  it("[random] can take as few as 3, removing extra fields", async () => {
    const { inputs, button, enter, randomActors } = setup(found, () => 0);
    button("[add actor]").click();
    await enter("[random]");
    expect(randomActors).toHaveBeenCalledWith(3);
    expect(inputs()).toHaveLength(3);
  });

  it("does not suggest an Actor already picked in another field", async () => {
    const { pick, type, options } = setup(found);
    await pick(0, "ada");
    await type(1, "ada");
    expect(options()).toEqual([]);
    await type(1, "ben");
    await vi.waitFor(() => expect(options()).toEqual(["Ben Cole (1971)"]));
  });

  it("does nothing until every field has an Actor", async () => {
    const { pick, button, result, findCycle } = setup(found);
    await pick(0, "ada");
    await pick(1, "ben");
    button("[enter]").click();
    expect(findCycle).not.toHaveBeenCalled();
    expect(result().textContent).toBe("pick 3 to 6 actors, or try [random]");
  });

  it("shows a fully red reason when the Actors are in different Groups", async () => {
    const { pick, enter, result, findCycle } = setup({ outcome: "not-possible", reason: "different-groups" });
    await pick(0, "ada");
    await pick(1, "ben");
    await pick(2, "cara");
    await enter();
    expect(findCycle).toHaveBeenCalledWith(["nm0", "nm1", "nm2"]);
    expect(result().textContent).toBe("not possible: these actors share no chain of movies");
    expect(result().classList.contains("not-possible")).toBe(true);
  });

  it("names the cut actor every route passes through, fully red", async () => {
    const { pick, enter, result } = setup({ outcome: "not-possible", reason: "cut-actor", cutActor: dev!, between: [pia!, ada!] });
    await pick(0, "pia");
    await pick(1, "dev");
    await pick(2, "ada");
    await enter();
    expect(result().textContent).toBe("not possible: every route from Pia Holt to Ada Hart passes through Dev Ennis");
    expect(result().classList.contains("not-possible")).toBe(true);
  });

  it("shows the Cycle as a graph with the Movie for each Link, closing back to the first Actor, sending every added field", async () => {
    const { pick, button, enter, result, chain, findCycle } = setup(found);
    button("[add actor]").click();
    await pick(0, "ada");
    await pick(1, "ben");
    await pick(2, "cara");
    await pick(3, "dev");
    await enter();
    expect(findCycle).toHaveBeenCalledWith(["nm0", "nm1", "nm2", "nm3"]);
    expect(result().textContent).toBe("length 3");
    expect(chain()).toEqual(["@Ada Hart1970", "|Heat", "@Ben Cole1971", "|Heat", "@Cara Diaz1972", "|Heat", "@Ada Hartback to the start"]);
    expect(result().classList.contains("not-possible")).toBe(false);
  });

  it("shows searching… while the search runs", async () => {
    let answer: (cycle: ShortestCycle) => void = () => {};
    const { pick, button, result, scenes, finish } = setup(new Promise((resolve) => (answer = resolve)));
    await pick(0, "ada");
    await pick(1, "ben");
    await pick(2, "cara");
    button("[enter]").click();
    expect(result().textContent).toBe("searching… (no time limit)");
    answer(found);
    await vi.waitFor(() => expect(scenes).toHaveLength(1));
    finish();
    expect(result().textContent).toBe("length 3");
  });

  it("says no cycle exists, fully red, when the search runs out", async () => {
    const { pick, enter, result } = setup({ outcome: "not-possible", reason: "no-cycle", rejected: [], moreRejected: 0, names: {} });
    await pick(0, "ada");
    await pick(1, "ben");
    await pick(2, "cara");
    await enter();
    expect(result().textContent).toBe("not possible: no cycle through all of them exists without repeating an actor");
    expect(result().classList.contains("not-possible")).toBe(true);
  });

  it("says the search failed, in plain ink, when the request fails", async () => {
    const { pick, enter, result } = setup(new Error("Cycle failed: 500"));
    await pick(0, "ada");
    await pick(1, "ben");
    await pick(2, "cara");
    await enter();
    expect(result().textContent).toBe("search failed, try again");
    expect(result().classList.contains("not-possible")).toBe(false);
  });

  it("plays the search on the stage, naming the Chosen Actors, and shows the answer only once the animation ends", async () => {
    const { pickThree, button, result, scenes, finish } = setup({ ...found, rejected: [{ from: "nm0", movie: "tt9", to: "nm9" }], moreRejected: 2, names: {} });
    await pickThree();
    button("[enter]").click();
    await vi.waitFor(() => expect(scenes).toHaveLength(1));
    expect(result().textContent).toBe("searching: Ada Hart, Ben Cole, Cara Diaz");
    finish();
    expect(result().textContent).toBe("length 3");
    expect(endInks(scenes[0]!).has("green")).toBe(true);
  });

  const notPossible: ShortestCycle[] = [
    { outcome: "not-possible", reason: "different-groups" },
    { outcome: "not-possible", reason: "cut-actor", cutActor: dev!, between: [ada!, cara!] },
    { outcome: "not-possible", reason: "no-cycle", rejected: [{ from: "nm0", movie: "tt9", to: "nm9" }], moreRejected: 0, names: {} },
  ];
  for (const cycle of notPossible) {
    it(`plays a not-possible result fully red (${cycle.outcome === "not-possible" && cycle.reason})`, async () => {
      const { pickThree, enter, scenes } = setup(cycle);
      await pickThree();
      await enter();
      const inks = endInks(scenes[0]!);
      expect(inks.has("red")).toBe(true);
      expect(inks.has("green")).toBe(false);
    });
  }

  it("plays nothing when the request fails", async () => {
    const { pickThree, enter, result, scenes } = setup(new Error("Cycle failed: 500"));
    await pickThree();
    await enter();
    expect(scenes).toHaveLength(0);
    expect(result().textContent).toBe("search failed, try again");
  });
});
