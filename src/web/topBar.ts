/** The top bar (design.md § Layout): MOVIE STATISTICS on the left, a link to the other page on the right. */
export function createTopBar(link: { text: string; href: string }): HTMLElement {
  const header = document.createElement("header");
  header.className = "top-bar";
  const name = document.createElement("span");
  name.textContent = "MOVIE STATISTICS";
  const a = document.createElement("a");
  a.href = link.href;
  a.textContent = link.text;
  header.append(name, a);
  return header;
}
