import { forwardRef, useState, type ChangeEvent, type KeyboardEvent, type SyntheticEvent } from "react";
import { buildSlots, slotDisplay } from "../core/slots";
import type { QuizItem } from "../core/question";
import styles from "./SlotInput.module.css";

interface Props {
  readonly item: QuizItem;
  readonly value: string;
  readonly hintLevel: number;
  readonly centered: boolean;
  readonly onChange: (value: string) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * One underline per word, drawn from a transparent real <input> that keeps
 * focus, IME composition and the keyboard handling.
 */
export const SlotInput = forwardRef<HTMLInputElement, Props>(function SlotInput(
  { item, value, hintLevel, centered, onChange, onKeyDown },
  ref,
) {
  const [focused, setFocused] = useState(false);

  // The drawn caret is always at the end, so keep the real one there too
  // (arrow keys, clicks and selections would otherwise edit mid-word unseen).
  const pinCaret = (event: SyntheticEvent<HTMLInputElement>) => {
    const el = event.currentTarget;
    const end = el.value.length;
    if (el.selectionStart !== end || el.selectionEnd !== end) el.setSelectionRange(end, end);
  };
  const slots = buildSlots(item.term, value, hintLevel);
  // Only words carry phonetics; sentences have none per word.
  const phonetic = item.kind === "word" ? item.phonetic : null;

  return (
    <div className={`${styles.wrap} ${centered ? styles.centered : ""}`}>
      <div className={styles.row} aria-hidden="true">
        {slots.map((slot, index) => (
          <div key={index} className={styles.slot}>
            {phonetic && index === 0 && <div className={styles.phonetic}>{phonetic}</div>}
            <div
              className={`${styles.line} ${slot.active && focused ? styles.lineActive : ""}`}
              style={{ minWidth: `${slot.width * 1.15 + 0.4}ch` }}
            >
              {slotDisplay(slot).map((c, i) => (
                <span key={i} className={c.hinted ? styles.hinted : undefined}>
                  {c.char}
                </span>
              ))}
              {slot.active && focused && <span className={styles.caret} />}
            </div>
          </div>
        ))}
      </div>
      <input
        ref={ref}
        className={styles.input}
        value={value}
        aria-label="输入拼写"
        autoFocus
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSelect={pinCaret}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
});
