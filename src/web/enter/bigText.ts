/** Big ASCII letters (FIGlet "standard" style), 5 rows tall, for the letters of MOVIE STATISTICS. */
const LETTERS: Record<string, string[]> = {
  A: ["    _    ", "   / \\   ", "  / _ \\  ", " / ___ \\ ", "/_/   \\_\\"],
  C: ["  ____ ", " / ___|", "| |    ", "| |___ ", " \\____|"],
  E: [" _____ ", "| ____|", "|  _|  ", "| |___ ", "|_____|"],
  I: [" ___ ", "|_ _|", " | | ", " | | ", "|___|"],
  M: [" __  __ ", "|  \\/  |", "| |\\/| |", "| |  | |", "|_|  |_|"],
  O: ["  ___  ", " / _ \\ ", "| | | |", "| |_| |", " \\___/ "],
  S: [" ____  ", "/ ___| ", "\\___ \\ ", " ___) |", "|____/ "],
  T: [" _____ ", "|_   _|", "  | |  ", "  | |  ", "  |_|  "],
  V: ["__     __", "\\ \\   / /", " \\ \\ / / ", "  \\ V /  ", "   \\_/   "],
};
const HEIGHT = 5;

function word(text: string): string[] {
  return Array.from({ length: HEIGHT }, (_, row) => [...text].map((c) => LETTERS[c]![row]).join(""));
}

/** The words set one under another with a blank row between, centred, every row the same width. */
export function bigText(words: string[]): string[] {
  const blocks = words.map(word);
  const width = Math.max(...blocks.map((b) => b[0]!.length));
  const centre = (row: string) => row.padStart(Math.floor((width + row.length) / 2)).padEnd(width);
  return blocks.flatMap((block, i) => [...(i > 0 ? [""] : []), ...block].map(centre));
}

/** The same letters as a 5 × 7 dot font (`#` a dot), for screens where the title can be larger than bigText's. */
const DOTS: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
};

/** The words in the dot font, one under another with two blank rows between, centred: `#` a dot, `.` none. */
export function dotText(words: string[]): string[] {
  const lines = words.map((w) => Array.from({ length: 7 }, (_, row) => [...w].map((c) => DOTS[c]![row]).join(".")));
  const width = Math.max(...lines.map((l) => l[0]!.length));
  const centre = (row: string) => row.padStart(Math.floor((width + row.length) / 2), ".").padEnd(width, ".");
  return lines.flatMap((line, i) => [...(i > 0 ? [".", "."] : []), ...line].map(centre));
}

/**
 * `dots` drawn `scale` rows per dot (and `scale` × `aspect` columns, so dots stay square), each dot
 * as a `●`: the marquee lights of a cinema sign. Nearest-neighbour, so any scale works.
 */
export function scaleDots(dots: string[], scale: number, aspect: number): string[] {
  const [rows, columns] = [Math.round(dots.length * scale), Math.round(dots[0]!.length * scale * aspect)];
  return Array.from({ length: rows }, (_, y) =>
    Array.from({ length: columns }, (_, x) => (dots[Math.floor(y / scale)]![Math.floor(x / (scale * aspect))] === "#" ? "●" : " ")).join(""),
  );
}
