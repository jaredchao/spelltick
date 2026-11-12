import { useEffect, useRef, type Dispatch, type KeyboardEvent } from "react";
import type { PopupEvent } from "../core/popupMachine";
import { QUIZ_TYPE_NAMES, type Question } from "../core/question";
import { useSkin } from "../skin/SkinContext";
import styles from "./Card.module.css";
import { SpeakerIcon } from "./icons";
import { QuizPrompt } from "./QuizPrompt";
import { speak } from "./speech";

interface AnswerProps {
  readonly question: Question;
  readonly input: string;
  readonly hintLevel: number;
  readonly focusToken: number;
  readonly dispatch: Dispatch<PopupEvent>;
}

const isListening = (q: Question) =>
  q.quizType === "dictation" || q.quizType === "sentence_dictation";

export function Answer({ question, input, hintLevel, focusToken, dispatch }: AnswerProps) {
  const { copy } = useSkin();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the field whenever the window is asked to take focus.
  useEffect(() => {
    inputRef.current?.focus();
  }, [focusToken]);

  // Dictation types play the audio once when the question opens.
  useEffect(() => {
    if (isListening(question)) speak(question.item.term);
  }, [question]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      dispatch({ type: "submit", now: Date.now() });
    } else if (event.key === "Tab") {
      event.preventDefault();
      dispatch({ type: "hint" });
    } else if (event.key === "Escape") {
      event.preventDefault();
      dispatch({ type: "skip", now: Date.now() });
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.meta}>
          {question.item.deckName} · {QUIZ_TYPE_NAMES[question.quizType]}
        </span>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="播放发音"
          tabIndex={-1}
          onClick={() => speak(question.item.term)}
        >
          <SpeakerIcon />
        </button>
      </div>

      <QuizPrompt question={question} hintLevel={hintLevel} />

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
        <button
          type="button"
          className={styles.secondary}
          tabIndex={-1}
          onClick={() => dispatch({ type: "skip", now: Date.now() })}
        >
          {copy.skip}
        </button>
        <button
          type="button"
          className={styles.primary}
          tabIndex={-1}
          onClick={() => dispatch({ type: "submit", now: Date.now() })}
        >
          {copy.submit}
        </button>
      </div>
    </div>
  );
}
