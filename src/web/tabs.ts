export interface Tab {
  name: string;
  panel: HTMLElement;
}

/** A row of `[ name ]` tabs; exactly one panel is visible at a time. */
export function createTabs(tabs: Tab[]): HTMLElement {
  const element = document.createElement("div");
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
  };

  bar.append(...buttons);
  element.append(bar, ...tabs.map((t) => t.panel));
  select(0);
  return element;
}
