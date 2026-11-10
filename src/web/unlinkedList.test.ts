// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type { ActorSummary, UnlinkedPage } from "../shared/types";
import { createUnlinkedList, UNLINKED_PAGE } from "./unlinkedList";

const kevin: ActorSummary = { id: "nm01", name: "Kevin Bacon", birthYear: 1958 };
/** 25 Actors who can't be linked: "Actor 0" … "Actor 24", born 1950 + i. */
const everyone: ActorSummary[] = Array.from({ length: 25 }, (_, i) => ({ id: `x${i}`, name: `Actor ${i}`, birthYear: 1950 + i }));

function setup() {
  const findUnlinked = vi.fn(async (_center: string, query: string, offset: number, limit: number): Promise<UnlinkedPage> => {
    const matches = everyone.filter((a) => a.name.includes(query));
    return { total: matches.length, actors: matches.slice(offset, offset + limit) };
  });
  const list = createUnlinkedList(findUnlinked);
  document.body.replaceChildren(list.element);
  const button = (text: string) => [...list.element.querySelectorAll("button")].find((b) => b.textContent === text)!;
  const names = () => [...list.element.querySelectorAll("li")].map((li) => li.textContent);
  const status = () => list.element.querySelector(".page")!.textContent;
  const input = list.element.querySelector("input")!;
  const search = (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event("input"));
  };
  return { list, findUnlinked, button, names, status, search };
}

describe("can't-be-linked list", () => {
  it("opens on the first page for the Center, each Actor with their birth year", async () => {
    const { list, findUnlinked, names, status } = setup();
    list.show(kevin);
    await vi.waitFor(() => expect(names()).toHaveLength(UNLINKED_PAGE));
    expect(findUnlinked).toHaveBeenCalledWith("nm01", "", 0, UNLINKED_PAGE);
    expect(names()[0]).toBe("Actor 0 (1950)");
    expect(status()).toBe(`1–${UNLINKED_PAGE} of 25`);
  });

  it("pages forward and back, with [previous] off on the first page and [next] off on the last", async () => {
    const { list, button, names, status } = setup();
    list.show(kevin);
    await vi.waitFor(() => expect(names()).toHaveLength(UNLINKED_PAGE));
    expect(button("[previous]").disabled).toBe(true);
    button("[next]").click();
    button("[next]").click(); // a second click before the answer arrives does nothing
    await vi.waitFor(() => expect(status()).toBe("11–20 of 25"));
    button("[next]").click();
    await vi.waitFor(() => expect(status()).toBe("21–25 of 25"));
    expect(names()).toEqual(["Actor 20 (1970)", "Actor 21 (1971)", "Actor 22 (1972)", "Actor 23 (1973)", "Actor 24 (1974)"]);
    expect(button("[next]").disabled).toBe(true);
    button("[previous]").click();
    await vi.waitFor(() => expect(status()).toBe("11–20 of 25"));
  });

  it("searches by name from the first page", async () => {
    const { list, findUnlinked, button, names, status, search } = setup();
    list.show(kevin);
    await vi.waitFor(() => expect(names()).toHaveLength(UNLINKED_PAGE));
    button("[next]").click();
    await vi.waitFor(() => expect(status()).toContain("11–20"));
    search("Actor 2");
    await vi.waitFor(() => expect(status()).toBe("1–6 of 6"));
    expect(findUnlinked).toHaveBeenLastCalledWith("nm01", "Actor 2", 0, UNLINKED_PAGE);
    expect(names()[0]).toBe("Actor 2 (1952)");
  });

  it("says when nobody matches, and when the request fails", async () => {
    const { list, findUnlinked, status, search } = setup();
    list.show(kevin);
    search("nobody");
    await vi.waitFor(() => expect(status()).toBe("none"));
    findUnlinked.mockRejectedValueOnce(new Error("500"));
    search("Actor");
    await vi.waitFor(() => expect(status()).toBe("search failed, try again"));
  });

  it("ignores an answer that arrives after a newer request", async () => {
    const { list, findUnlinked, names, search } = setup();
    let answerSlow: (page: UnlinkedPage) => void = () => {};
    findUnlinked.mockImplementationOnce(() => new Promise((resolve) => (answerSlow = resolve)));
    list.show(kevin);
    search("Actor 24");
    await vi.waitFor(() => expect(names()).toEqual(["Actor 24 (1974)"]));
    answerSlow({ total: 25, actors: everyone.slice(0, UNLINKED_PAGE) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(names()).toEqual(["Actor 24 (1974)"]);
  });

  it("starts again with an empty search when shown for another Center", async () => {
    const { list, findUnlinked, search } = setup();
    list.show(kevin);
    search("Actor 2");
    list.show({ id: "nm16", name: "Gus Price", birthYear: 1960 });
    expect(list.element.querySelector("input")!.value).toBe("");
    expect(findUnlinked).toHaveBeenLastCalledWith("nm16", "", 0, UNLINKED_PAGE);
  });
});
