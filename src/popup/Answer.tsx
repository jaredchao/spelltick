import { useEffect, useRef, type Dispatch, type KeyboardEvent } from "react";
import { hintMask } from "../core/hint";
import type { PopupEvent } from "../core/popupMachine";
import { QUIZ_TYPE_NAMES, type Question } from "../core/question";
import { useSkin } from "../skin/SkinContext";
import styles from "./Card.module.css";
import { SpeakerIcon } from "./icons";
import { speak } from "./speech";

interface AnswerProps {
  readonly question: Question;
  readonly input: string;
  readonly hintLevel: number;
  readonly focusToken: number;
  readonly dispatch: Dispatch<PopupEvent>;
}

function auxLine(question: Question): string {
  const letters = question.term.replace(/\s/g, "").length;
  const parts = [
    question.pos,
    question.kind === "word" ? `${letters} 个字母` : `${question.term.split(/\s+/).length} 个词`,
    question.kind === "word" ? `首字母 ${question.term.charAt(0)}` : undefined,
  ];
  return parts.filter(Boolean).join(" · ");
}

export function Answer({ question, input, hintLevel, focusToken, dispatch }: AnswerProps) {
  const { copy } = useSkin();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the field whenever the window is asked to take focus.
  useEffect(() => {
    inputRef.current?.focus();
  }, [focusToken]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      dispatch({ type: "submit" });
    } else if (event.key === "Tab") {
      event.preventDefault();
      dispatch({ type: "hint" });
    } else if (event.key === "Escape") {
      event.preventDefault();
      dispatch({ type: "skip" });
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.meta}>
          {question.deckName} · {QUIZ_TYPE_NAMES[question.quizType]}
        </span>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="播放发音"
          tabIndex={-1}
          onClick={() => speak(question.term)}
        >
          <SpeakerIcon />
        </button>
      </div>

      <div className={styles.prompt}>
        <div className={styles.meaning}>{question.meaning}</div>
        <div className={styles.aux}>{auxLine(question)}</div>
        {hintLevel > 0 && <div className={styles.hint}>{hintMask(question.term, hintLevel)}</div>}
      </div>

      <label className={styles.field}>
        输入拼写
        <input
          ref={inputRef}
          className={styles.input}
          value={input}
          autoFocus
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          onChange={(event) => dispatch({ type: "input", value: event.target.value })}
          onKeyDown={onKeyDown}
        />
      </label>

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} tabIndex={-1} onClick={() => dispatch({ type: "hint" })}>
          {copy.hint}
        </button>
        <button type="button" className={styles.secondary} tabIndex={-1} onClick={() => dispatch({ type: "skip" })}>
          {copy.skip}
        </button>
        <button type="button" className={styles.primary} tabIndex={-1} onClick={() => dispatch({ type: "submit" })}>
          {copy.submit}
        </button>
      </div>
    </div>
  );
}
