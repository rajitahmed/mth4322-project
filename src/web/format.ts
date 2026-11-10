/** Numbers as the page writes them. */

/** 12,345 */
export const count = (n: number) => n.toLocaleString("en-US");

/** 950, 1.2k, 35k: short enough for a column header on the stage. */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  const thousands = n / 1000;
  return `${thousands < 10 ? +thousands.toFixed(1) : Math.round(thousands)}k`;
}

/** "1 link", "3 links" */
export const links = (n: number) => `${n} link${n === 1 ? "" : "s"}`;
