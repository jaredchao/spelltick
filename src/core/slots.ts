import { revealedPrefix } from "./hint";

export interface Slot {
  /** The answer word for this slot ("" for extra words typed past the answer). */
  readonly expected: string;
  /** What the user typed into this slot. */
  readonly typed: string;
  /** Letters revealed by hints for this slot. */
  readonly hint: string;
  /** Width in characters, never shorter than the answer word. */
  readonly width: number;
  /** The slot the caret is in. */
  readonly active: boolean;
}

function tokens(text: string): string[] {
  const trimmed = text.replace(/^\s+/, "");
  return trimmed === "" ? [""] : trimmed.split(/\s+/);
}

/**
 * Split the answer and the user's input into one slot per word.
 * A space moves the caret to the next slot; extra words get extra slots.
 */
export function buildSlots(term: string, input: string, hintLevel: number): readonly Slot[] {
  const answer = term.trim().split(/\s+/);
  const typed = tokens(input);
  const hints = hintLevel > 0 ? tokens(revealedPrefix(term, hintLevel)) : [];
  const count = Math.max(answer.length, typed.length);
  const active = typed.length - 1;

  return Array.from({ length: count }, (_, i) => {
    const expected = answer[i] ?? "";
    const t = typed[i] ?? "";
    return {
      expected,
      typed: t,
      hint: hints[i] ?? "",
      width: Math.max(expected.length, t.length, 1),
      active: i === active,
    };
  });
}

/** Characters to draw in a slot: typed letters, then any hinted letters still untyped. */
export function slotDisplay(slot: Slot): readonly { readonly char: string; readonly hinted: boolean }[] {
  const typed = Array.from(slot.typed).map((char) => ({ char, hinted: false }));
  const rest = Array.from(slot.hint)
    .slice(typed.length)
    .map((char) => ({ char, hinted: true }));
  return [...typed, ...rest];
}
