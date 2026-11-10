// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type { ActorSummary } from "../shared/types";
import { createActorField } from "./actorField";

const samLees: ActorSummary[] = [
  { id: "nm11", name: "Sam Lee", birthYear: 1970 },
  { id: "nm15", name: "Sam Lee", birthYear: 1988 },
];

function setup(search = vi.fn(async (_query: string) => samLees)) {
  const field = createActorField("actor", search);
  document.body.replaceChildren(field.element);
  const input = field.element.querySelector("input")!;
  const options = () => [...field.element.querySelectorAll('[role="option"]')];
  const type = async (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event("input"));
    await vi.waitFor(() => expect(search).toHaveBeenLastCalledWith(text));
    await Promise.resolve();
  };
  const key = (k: string) => input.dispatchEvent(new KeyboardEvent("keydown", { key: k }));
  return { field, input, options, type, key, search };
}

describe("actor field", () => {
  it("suggests Actors as you type, telling same-name Actors apart by birth year", async () => {
    const { options, type } = setup();
    await type("sam");
    expect(options().map((o) => o.textContent)).toEqual(["Sam Lee (1970)", "Sam Lee (1988)"]);
  });

  it("shows an unknown birth year", async () => {
    const { options, type } = setup(vi.fn(async () => [{ id: "nm10", name: "Uma Jones", birthYear: null }]));
    await type("uma");
    expect(options()[0]!.textContent).toBe("Uma Jones (born ?)");
  });

  it("accepts an Actor picked from the list", async () => {
    const { field, input, options, type } = setup();
    await type("sam");
    options()[1]!.dispatchEvent(new MouseEvent("mousedown"));
    expect(field.selected()).toEqual(samLees[1]);
    expect(input.value).toBe("Sam Lee (1988)");
    expect(options()).toHaveLength(0);
  });

  it("picks with the arrow keys and Enter", async () => {
    const { field, type, key } = setup();
    await type("sam");
    key("ArrowDown");
    key("ArrowDown");
    key("Enter");
    expect(field.selected()).toEqual(samLees[1]);
  });

  it("does not accept typed text that was not picked", async () => {
    const { field, input, type } = setup();
    await type("sam");
    expect(field.selected()).toBeNull();
    input.dispatchEvent(new Event("blur"));
    expect(input.value).toBe("");
  });

  it("forgets the pick when the text is edited", async () => {
    const { field, options, type } = setup();
    await type("sam");
    options()[0]!.dispatchEvent(new MouseEvent("mousedown"));
    await type("sam l");
    expect(field.selected()).toBeNull();
  });

  it("shows no suggestions when the search fails", async () => {
    const { options, type } = setup(vi.fn(async () => Promise.reject(new Error("offline"))));
    await type("sam");
    await Promise.resolve();
    expect(options()).toHaveLength(0);
  });

  it("ignores an older answer that arrives after a newer one", async () => {
    let answerFirst!: (actors: ActorSummary[]) => void;
    const search = vi
      .fn<(query: string) => Promise<ActorSummary[]>>()
      .mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce([samLees[0]!]);
    const { options, type } = setup(search);
    const input = document.querySelector("input")!;
    input.value = "s";
    input.dispatchEvent(new Event("input"));
    await type("sam");
    answerFirst(samLees);
    await Promise.resolve();
    expect(options().map((o) => o.textContent)).toEqual(["Sam Lee (1970)"]);
  });
});
