// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createHeading } from "./heading";

describe("heading", () => {
  it("renames the browser tab only while its tab is shown", () => {
    document.title = "before";
    const panel = document.createElement("section");
    const heading = createHeading("six degrees of Kevin Bacon", "how far every actor is from the center");
    panel.append(heading.element);
    document.body.replaceChildren(panel);
    heading.set("six degrees of Meryl Streep");
    expect(heading.element.querySelector("h1")!.textContent).toBe("six degrees of Meryl Streep");
    expect(document.title).toBe("six degrees of Meryl Streep · MOVIE STATISTICS");
    panel.hidden = true;
    heading.set("six degrees of Tom Hanks");
    expect(document.title).toBe("six degrees of Meryl Streep · MOVIE STATISTICS");
  });
});
