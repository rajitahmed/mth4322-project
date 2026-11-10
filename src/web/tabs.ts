import { setDocumentTitle } from "./heading";

export interface Tab {
  name: string;
  panel: HTMLElement;
}

/** A row of `[ name ]` tabs; exactly one panel is visible at a time, and the browser tab takes its title (its heading, or its name). */
export function createTabs(tabs: Tab[]): HTMLElement {
  const element = document.createElement("div");
  element.className = "app";
  const bar = document.createElement("nav");
  bar.setAttribute("role", "tablist");
  bar.className = "tabs";

  const buttons = tabs.map(({ name, panel }, i) => {
    const button = document.createElement("button");
    button.setAttribute("role", "tab");
    button.textContent = `[ ${name} ]`;
    button.addEventListener("click", () => select(i));
    panel.setAttribute("role", "tabpanel");
    return button;
  });

  const select = (index: number) => {
    buttons.forEach((button, i) => button.setAttribute("aria-selected", String(i === index)));
    tabs.forEach(({ panel }, i) => (panel.hidden = i !== index));
    setDocumentTitle(tabs[index]!.panel.querySelector("h1")?.textContent || tabs[index]!.name);
  };

  bar.append(...buttons);
  element.append(bar, ...tabs.map((t) => t.panel));
  select(0);
  return element;
}
