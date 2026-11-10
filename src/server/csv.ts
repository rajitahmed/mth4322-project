/**
 * Parses CSV text (RFC 4180: quoted fields, "" escapes, LF or CRLF) into one
 * object per row, keyed by the header row.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const [header, ...rows] = readRecords(text);
  if (!header) return [];
  return rows.map((fields, i) => {
    if (fields.length !== header.length) {
      throw new Error(`CSV line ${i + 2}: expected ${header.length} fields, got ${fields.length}`);
    }
    return Object.fromEntries(header.map((name, j) => [name, fields[j]!]));
  });
}

function readRecords(text: string): string[][] {
  const records: string[][] = [];
  let fields: string[] = [];
  let field = "";
  let quoted = false;

  const endField = () => {
    fields.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    records.push(fields);
    fields = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') field += text[++i];
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ",") endField();
    else if (c === "\n") endRecord();
    else if (c !== "\r") field += c;
  }
  if (field !== "" || fields.length > 0) endRecord();
  return records;
}

/** Formats rows as CSV text (RFC 4180, LF line ends), quoting only fields that need it. */
export function formatCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((fields) => fields.map(formatField).join(",") + "\n").join("");
}

function formatField(field: string): string {
  return /[",\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
