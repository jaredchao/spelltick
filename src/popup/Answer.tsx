import { useEffect, useRef, type Dispatch, type KeyboardEvent } from "react";
import type { PopupEvent } from "../core/popupMachine";
import { QUIZ_TYPE_NAMES, type Question } from "../core/question";
import { useSkin } from "../skin/SkinContext";
import styles from "./Card.module.css";
import { CardHeader } from "./CardHeader";
import { QuizPrompt } from "./QuizPrompt";
import { SlotInput } from "./SlotInput";
import { playKey } from "./sound";
import { speak } from "./speech";

interface AnswerProps {
  readonly question: Question;
  readonly input: string;
  readonly hintLevel: number;
  readonly focusToken: number;
  readonly showFirstLetter: boolean;
  readonly soundEnabled: boolean;
  readonly dispatch: Dispatch<PopupEvent>;
}

const isListening = (q: Question) =>
  q.quizType === "dictation" || q.quizType === "sentence_dictation";

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

export function Answer({
  question,
  input,
  hintLevel,
  focusToken,
  showFirstLetter,
  soundEnabled,
  dispatch,
}: AnswerProps) {
  const { copy, layout } = useSkin();
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

  const onInput = (value: string) => {
    if (soundEnabled && value !== input) playKey(value.length < input.length);
    dispatch({ type: "input", value });
  };

  const textButtons = layout.shortcutHintsInButtons;
  const secondary = textButtons ? styles.textButton : styles.secondary;
  const primary = textButtons ? styles.textButtonPrimary : styles.primary;

  return (
    <div className={cx(styles.card, layout.titleBar && styles.cardTitled)}>
      <CardHeader
        meta={`${question.item.deckName} · ${QUIZ_TYPE_NAMES[question.quizType]}`}
        onSpeak={() => speak(question.item.term)}
      />
      <div className={cx(styles.body, layout.contentAlign === "center" && styles.centered)}>
        <QuizPrompt question={question} showFirstLetter={showFirstLetter} />

        <SlotInput
          ref={inputRef}
          item={question.item}
          value={input}
          hintLevel={hintLevel}
          centered={layout.contentAlign === "center"}
          onChange={onInput}
          onKeyDown={onKeyDown}
        />

        <div className={textButtons ? styles.textActions : styles.actions}>
          <button type="button" className={secondary} tabIndex={-1} onClick={() => dispatch({ type: "hint" })}>
            {copy.hint}
          </button>
          <button
            type="button"
            className={secondary}
            tabIndex={-1}
            onClick={() => dispatch({ type: "skip", now: Date.now() })}
          >
            {copy.skip}
          </button>
          <button
            type="button"
            className={primary}
            tabIndex={-1}
            onClick={() => dispatch({ type: "submit", now: Date.now() })}
          >
            {copy.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
