#!/usr/bin/env node
// Build the built-in CET4/CET6 deck from ECDICT (MIT, https://github.com/skywind3000/ECDICT).
//
// Usage: node scripts/build-ecdict.mjs
// Downloads ecdict.csv into .cache/ (git-ignored) on first run, then writes
// src-tauri/data/cet.json. Only the generated JSON is committed.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "ecdict.csv");
const OUT = join(ROOT, "src-tauri", "data", "cet.json");
const SOURCE_URL = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv";
const MAX_SENSES = 2;

async function ensureSource() {
  if (existsSync(CACHE)) return;
  mkdirSync(dirname(CACHE), { recursive: true });
  console.log(`downloading ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  writeFileSync(CACHE, Buffer.from(await res.arrayBuffer()));
}

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, newlines inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const POS_RE = /^([a-z]+\.)(?:\s*&\s*[a-z]+\.)?\s*/i;

/** Remove bracketed notes: (…) （…） […] 【…】 <…>. */
function stripNotes(text) {
  let prev;
  let out = text;
  do {
    prev = out;
    out = out
      .replace(/\([^()]*\)/g, "")
      .replace(/（[^（）]*）/g, "")
      .replace(/\[[^[\]]*\]/g, "")
      .replace(/【[^【】]*】/g, "")
      .replace(/<[^<>]*>/g, "");
  } while (out !== prev);
  return out;
}

// ECDICT `pos` column letters -> translation line prefixes.
const POS_PREFIXES = {
  n: ["n."],
  v: ["v.", "vt.", "vi."],
  j: ["a.", "adj.", "s."],
  r: ["adv.", "ad."],
  p: ["pron."],
  i: ["prep."],
  c: ["conj."],
};

/** "n:46/v:54" -> "v" (the most frequent part of speech), or null. */
function dominantPos(rawPos) {
  const entries = rawPos
    .split("/")
    .map((part) => part.split(":"))
    .filter(([k, v]) => k && v)
    .map(([k, v]) => [k, Number(v)]);
  if (entries.length === 0) return null;
  return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}

function preferLine(lines, rawPos) {
  const key = dominantPos(rawPos ?? "");
  const prefixes = key ? POS_PREFIXES[key] : undefined;
  if (!prefixes) return lines;
  const index = lines.findIndex((line) => prefixes.some((p) => line.toLowerCase().startsWith(p)));
  if (index <= 0) return lines;
  return [lines[index], ...lines.slice(0, index), ...lines.slice(index + 1)];
}

/** "v. 展开, 配置\nn. 部署" -> { pos: "v.", meaning: "展开；配置" } */
export function cleanTranslation(raw, rawPos = "") {
  const allLines = raw
    .split("\\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("["));
  const lines = preferLine(allLines, rawPos);
  for (const line of lines) {
    const posMatch = line.match(POS_RE);
    const pos = posMatch ? posMatch[1].toLowerCase() : null;
    const body = stripNotes(posMatch ? line.slice(posMatch[0].length) : line);
    const senses = body
      .split(/[，,；;]/)
      .map((s) =>
        s
          .trim()
          .replace(/^([a-z]+\.\s*)+/i, "")
          .replace(/\.{3}|…+/g, "…")
          .replace(/^[的地]$/, ""),
      )
      .filter((s) => s !== "" && /[一-鿿]/.test(s));
    const unique = [...new Set(senses)].slice(0, MAX_SENSES);
    if (unique.length > 0) return { pos, meaning: unique.join("；") };
  }
  return null;
}

function cleanPhonetic(raw) {
  const p = raw.trim();
  return p === "" ? null : `/${p}/`;
}

async function main() {
  await ensureSource();
  const rows = parseCsv(readFileSync(CACHE, "utf8"));
  const header = rows[0];
  const col = (name) => header.indexOf(name);
  const [iWord, iPhon, iTrans, iTag, iPos] = ["word", "phonetic", "translation", "tag", "pos"].map(col);

  const seen = new Set();
  const items = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const tags = (r[iTag] ?? "").split(/\s+/);
    if (!tags.includes("cet4") && !tags.includes("cet6")) continue;
    const word = (r[iWord] ?? "").trim();
    if (!/^[a-z]+(-[a-z]+)?$/.test(word) || seen.has(word)) continue;
    const cleaned = cleanTranslation(r[iTrans] ?? "", r[iPos] ?? "");
    if (!cleaned) {
      skipped++;
      continue;
    }
    seen.add(word);
    items.push({
      term: word,
      meaning: cleaned.meaning,
      phonetic: cleanPhonetic(r[iPhon] ?? ""),
      pos: cleaned.pos,
      level: tags.includes("cet4") ? "cet4" : "cet6",
    });
  }
  items.sort((a, b) => a.term.localeCompare(b.term));

  mkdirSync(dirname(OUT), { recursive: true });
  const deck = { name: "四六级核心词", source: "ECDICT (MIT)", items };
  writeFileSync(OUT, `${JSON.stringify(deck, null, 0)}\n`);
  const cet4 = items.filter((i) => i.level === "cet4").length;
  console.log(`wrote ${items.length} words (cet4 ${cet4}, cet6-only ${items.length - cet4}), skipped ${skipped} -> ${OUT}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
