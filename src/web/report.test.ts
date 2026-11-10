// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createReport } from "./report";

const ann = { id: "nm1", name: "Ann Ash", birthYear: 1950 };
const bea = { id: "nm2", name: "Bea Birch", birthYear: null };
const film = { id: "tt1", title: "First Film" };
const items = (element: HTMLElement) => [...element.querySelectorAll("li")].map((li) => [li.className, li.textContent]);

describe("report", () => {
  it("draws a chain as a graph: Actor nodes joined by Movie edges, with notes", () => {
    const report = createReport();
    report.show("distance 1", { actors: [ann, bea], movies: [film], movieNotes: ["7.2"] }, "answer");
    expect(report.element.querySelector(".result")!.textContent).toBe("distance 1");
    expect(items(report.element)).toEqual([
      ["chain-actor", "@Ann Ash1950"],
      ["chain-movie", "|First Film7.2"],
      ["chain-actor", "@Bea Birch"],
    ]);
  });

  it("closes a Cycle back on its first Actor", () => {
    const report = createReport();
    report.show("length 2", { actors: [ann, bea], movies: [film, film], closed: true }, "answer");
    expect(items(report.element).map(([, text]) => text)).toEqual(["@Ann Ash1950", "|First Film", "@Bea Birch", "|First Film", "@Ann Ashback to the start"]);
  });

  it("shows a headline alone, red when not possible, and clears the last chain", () => {
    const report = createReport();
    report.show("distance 1", { actors: [ann, bea], movies: [film] });
    report.show("no path", null, "not-possible");
    expect(items(report.element)).toEqual([]);
    expect(report.element.querySelector(".result")!.classList.contains("not-possible")).toBe(true);
  });
});
