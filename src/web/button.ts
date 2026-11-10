/** A `[text]` button. */
export function button(text: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.textContent = text;
  return element;
}
