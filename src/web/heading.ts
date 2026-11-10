/** The name every page title ends with: the only all-caps text (design.md § Type). */
const SITE = "MOVIE STATISTICS";

/** Names the browser tab after the tab shown, e.g. "largest path · MOVIE STATISTICS". */
export function setDocumentTitle(title: string): void {
  document.title = `${title} · ${SITE}`;
}

export interface Heading {
  element: HTMLElement;
  /** Changes the title; the browser tab follows when this tab is the one shown. */
  set(title: string): void;
}

/** A tab's title, and one line on what it shows. */
export function createHeading(title: string, blurb: string): Heading {
  const element = document.createElement("hgroup");
  element.className = "heading";
  const h1 = document.createElement("h1");
  const p = document.createElement("p");
  p.textContent = blurb;
  element.append(h1, p);
  const set = (text: string) => {
    h1.textContent = text;
    if (element.isConnected && !element.closest("[hidden]")) setDocumentTitle(text);
  };
  set(title);
  return { element, set };
}
