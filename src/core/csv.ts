export interface CsvRow {
  /** 1-based line number where the row starts in the source text. */
  readonly line: number;
  readonly fields: readonly string[];
}

export interface CsvResult {
  readonly rows: readonly CsvRow[];
  /** Line number of an unterminated quoted field, if any. */
  readonly unterminatedAt: number | null;
}

/**
 * RFC 4180 parser: comma separators, double-quoted fields, doubled quotes,
 * newlines inside quotes. Accepts \n and \r\n. Strips a UTF-8 BOM.
 */
export function parseCsv(input: string): CsvResult {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: CsvRow[] = [];
  let fields: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;
  let rowStart = 1;
  let quoteStart = 0;

  const endField = () => {
    fields.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push({ line: rowStart, fields });
    fields = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        if (c === "\n") line++;
        field += c;
      }
      continue;
    }
    if (c === '"' && field.trim() === "") {
      quoted = true;
      quoteStart = line;
      field = "";
    } else if (c === ",") {
      endField();
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endRow();
      line++;
      rowStart = line;
    } else {
      field += c;
    }
  }
  if (quoted) {
    return { rows, unterminatedAt: quoteStart };
  }
  if (field !== "" || fields.length > 0) endRow();
  return { rows, unterminatedAt: null };
}
