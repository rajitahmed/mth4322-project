// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createTabs } from "./tabs";

describe("tabs", () => {
  const panel = (text: string) => Object.assign(document.createElement("div"), { textContent: text });

  it("shows the first tab, and another tab's panel when it is clicked", () => {
    const element = createTabs([
      { name: "largest path", panel: panel("one") },
      { name: "shortest cycle", panel: panel("two") },
      { name: "six degrees of bacon", panel: panel("three") },
    ]);
    const tabs = [...element.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const visible = () => [...element.querySelectorAll<HTMLElement>('[role="tabpanel"]')].filter((p) => !p.hidden);

    expect(tabs.map((t) => t.textContent)).toEqual(["[ largest path ]", "[ shortest cycle ]", "[ six degrees of bacon ]"]);
    expect(visible().map((p) => p.textContent)).toEqual(["one"]);

    tabs[2]!.click();
    expect(visible().map((p) => p.textContent)).toEqual(["three"]);
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "false", "true"]);
  });
});
