import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("reads rows keyed by the header", () => {
    expect(parseCsv("id,name\nnm1,Ann\nnm2,Bob\n")).toEqual([
      { id: "nm1", name: "Ann" },
      { id: "nm2", name: "Bob" },
    ]);
  });

  it("handles quoted commas, escaped quotes and CRLF line ends", () => {
    expect(parseCsv('id,title\r\ntt1,"Heat, Again"\r\ntt2,"Say ""Hi"""\r\n')).toEqual([
      { id: "tt1", title: "Heat, Again" },
      { id: "tt2", title: 'Say "Hi"' },
    ]);
  });

  it("keeps empty fields and works without a final newline", () => {
    expect(parseCsv("id,birth_year\nnm1,")).toEqual([{ id: "nm1", birth_year: "" }]);
  });

  it("rejects a row with the wrong number of fields", () => {
    expect(() => parseCsv("id,name\nnm1\n")).toThrow(/line 2/);
  });
});
