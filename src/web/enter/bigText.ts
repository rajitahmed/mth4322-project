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
