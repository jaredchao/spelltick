import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { deckNameFromPath, parseDeckFile } from "./deckImport";

describe("parseCsv", () => {
  it("handles quotes, doubled quotes and commas inside quotes", () => {
    const { rows } = parseCsv('a,"b, c","say ""hi"""\n');
    expect(rows).toEqual([{ line: 1, fields: ["a", "b, c", 'say "hi"'] }]);
  });

  it("keeps line numbers across multi-line quoted fields and CRLF", () => {
    const { rows } = parseCsv('x,"line1\nline2"\r\ny,z');
    expect(rows.map((r) => r.line)).toEqual([1, 3]);
  });

  it("strips a BOM", () => {
    expect(parseCsv("\ufeffdeploy,部署").rows[0].fields[0]).toBe("deploy");
  });

  it("reports an unterminated quote", () => {
    expect(parseCsv('a,"open\nb,c').unterminatedAt).toBe(1);
  });
});

describe("parseDeckFile", () => {
  it("counts words and sentences and keeps optional examples", () => {
    const p = parseDeckFile("deploy, 部署, We deploy daily.\nShip it., 发布吧\n");
    expect(p.words).toBe(1);
    expect(p.sentences).toBe(1);
    expect(p.items[0]).toEqual({
      term: "deploy",
      meaning: "部署",
      example: "We deploy daily.",
      kind: "word",
    });
    expect(p.items[1].example).toBeNull();
    expect(p.errors).toEqual([]);
  });

  it("reports bad lines with their line numbers", () => {
    const text = ["deploy,部署", "merge", "", ",合并", "部署,deploy", "a,b,c,d", 'x,"y, z",ok'].join("\n");
    const p = parseDeckFile(text);
    expect(p.errors.map((e) => e.line)).toEqual([2, 4, 5, 6]);
    expect(p.items.map((i) => i.term)).toEqual(["deploy", "x"]);
  });

  it("skips a header row", () => {
    const p = parseDeckFile("英文,中文释义,例句\ndeploy,部署");
    expect(p.items).toHaveLength(1);
    expect(p.errors).toEqual([]);
  });

  it("skips duplicate terms case-insensitively", () => {
    const p = parseDeckFile("deploy,部署\nDeploy,展开");
    expect(p.items).toHaveLength(1);
    expect(p.duplicates).toEqual([2]);
  });

  it("reports an unterminated quote as an error", () => {
    const p = parseDeckFile('deploy,"部署');
    expect(p.errors).toEqual([{ line: 1, reason: "双引号没有闭合" }]);
  });
});

describe("deckNameFromPath", () => {
  it("uses the file name without extension", () => {
    expect(deckNameFromPath("/Users/me/Downloads/会议用语.csv")).toBe("会议用语");
    expect(deckNameFromPath("C:\\words\\list.txt")).toBe("list");
  });
});
