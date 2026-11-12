#!/usr/bin/env node
// Convert scripts/programmer-deck.tsv into src-tauri/data/programmer.json.
// Usage: node scripts/build-programmer.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "scripts", "programmer-deck.tsv");
const OUT = join(ROOT, "src-tauri", "data", "programmer.json");

const orNull = (value) => (value && value.trim() !== "" ? value.trim() : null);

const seen = new Set();
const duplicates = [];
const items = [];
readFileSync(SRC, "utf8")
  .split("\n")
  .filter((line) => line.trim() !== "" && !line.startsWith("#"))
  .forEach((line, index) => {
    const [term, pos, phonetic, meaning, example] = line.split("\t");
    if (!term?.trim() || !meaning?.trim()) {
      throw new Error(`line ${index + 1}: missing term or meaning`);
    }
    const key = term.trim().toLowerCase();
    if (seen.has(key)) {
      duplicates.push(term.trim());
      return;
    }
    seen.add(key);
    items.push({
      term: term.trim(),
      meaning: meaning.trim(),
      phonetic: orNull(phonetic),
      pos: orNull(pos),
      example: orNull(example),
    });
  });

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify({ name: "程序员 / 职场英语", items }, null, 1)}\n`);
const sentences = items.filter((i) => /\s/.test(i.term)).length;
console.log(`wrote ${items.length} items (words ${items.length - sentences}, sentences ${sentences}) -> ${OUT}`);
if (duplicates.length > 0) console.log(`skipped duplicates: ${duplicates.join(", ")}`);
