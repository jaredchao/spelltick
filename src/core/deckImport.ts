import { parseCsv } from "./csv";
import type { ItemKind } from "./question";

export interface ImportItem {
  readonly term: string;
  readonly meaning: string;
  readonly example: string | null;
  readonly kind: ItemKind;
}

export interface ImportError {
  readonly line: number;
  readonly reason: string;
}

export interface ImportPreview {
  readonly items: readonly ImportItem[];
  readonly words: number;
  readonly sentences: number;
  readonly errors: readonly ImportError[];
  /** Lines skipped because the same term appeared earlier in the file. */
  readonly duplicates: readonly number[];
}

const HEADER_TERMS = new Set(["英文", "term", "word", "english"]);
const HAS_LATIN = /[A-Za-z]/;
const HAS_CJK = /[㐀-鿿]/;

export function kindOfTerm(term: string): ItemKind {
  return /\s/.test(term.trim()) ? "sentence" : "word";
}

/**
 * Parse a `.csv` / `.txt` deck (SPEC 7.2): each line is
 * `英文, 中文释义, 例句(可选)`. Blank lines are ignored; a header row whose
 * first cell is 英文 / term / word / english is skipped.
 */
export function parseDeckFile(text: string): ImportPreview {
  const { rows, unterminatedAt } = parseCsv(text);
  const items: ImportItem[] = [];
  const errors: ImportError[] = [];
  const duplicates: number[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const fields = row.fields.map((f) => f.trim());
    if (fields.every((f) => f === "")) return;
    if (index === 0 && HEADER_TERMS.has(fields[0].toLowerCase())) return;

    const [term = "", meaning = "", example = ""] = fields;
    const reason =
      fields.length < 2
        ? "缺少中文释义"
        : fields.length > 3
          ? "字段多于 3 个（含逗号的字段要用双引号包起来）"
          : term === ""
            ? "英文为空"
            : meaning === ""
              ? "中文释义为空"
              : !HAS_LATIN.test(term) || HAS_CJK.test(term)
                ? "第一列应该是英文"
                : null;
    if (reason) {
      errors.push({ line: row.line, reason });
      return;
    }
    const key = term.toLowerCase();
    if (seen.has(key)) {
      duplicates.push(row.line);
      return;
    }
    seen.add(key);
    items.push({ term, meaning, example: example === "" ? null : example, kind: kindOfTerm(term) });
  });

  if (unterminatedAt !== null) {
    errors.push({ line: unterminatedAt, reason: "双引号没有闭合" });
  }

  const sentences = items.filter((i) => i.kind === "sentence").length;
  return {
    items,
    words: items.length - sentences,
    sentences,
    errors: [...errors].sort((a, b) => a.line - b.line),
    duplicates,
  };
}

/** Default deck name from a file path: the file name without extension. */
export function deckNameFromPath(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? path;
  const dot = base.lastIndexOf(".");
  return (dot > 0 ? base.slice(0, dot) : base).trim();
}
