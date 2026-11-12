import { useEffect } from "react";
import { splitByTerm } from "../core/highlight";
import type { Outcome } from "../core/popupMachine";
import type { Question } from "../core/question";
import { fillTemplate } from "../core/template";
import { useSkin } from "../skin/SkinContext";
import styles from "./Card.module.css";
import { CheckIcon, CrossIcon } from "./icons";

interface FeedbackProps {
  readonly question: Question;
  readonly outcome: Outcome;
  readonly onContinue: () => void;
}

// M1 placeholder intervals. M2 computes them with SM-2.
function fakeNextReview(outcome: Outcome): string {
  return outcome.correct ? "1 天" : "10 分钟";
}

export function Feedback({ question, outcome, onContinue }: FeedbackProps) {
  const { copy } = useSkin();

  useEffect(() => {
    // The Enter that submitted the answer may still be bubbling to `window`
    // when this listener is attached; ignore anything older than the mount.
    const mountedAt = performance.now();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.isComposing || event.timeStamp <= mountedAt) return;
      onContinue();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onContinue]);

  return (
    <div className={styles.card} onClick={onContinue}>
      <div className={outcome.correct ? styles.titleRight : styles.titleWrong}>
        {outcome.correct ? <CheckIcon /> : <CrossIcon />}
        {outcome.correct ? copy.rightTitle : copy.wrongTitle}
      </div>

      <div className={styles.compare}>
        {!outcome.correct && (
          <>
            <div className={styles.compareLabel}>你的拼写</div>
            {/* TODO(M2): character-level diff highlight. */}
            <div className={styles.spelling}>{outcome.answer.trim()}</div>
            <div className={styles.compareLabel}>正确</div>
          </>
        )}
        <div className={styles.spellingStrong}>
          {question.term}
          {question.phonetic && <span className={styles.phonetic}>{question.phonetic}</span>}
        </div>
      </div>

      {question.example && (
        <div className={styles.example}>
          {splitByTerm(question.example, question.term).map((segment, index) =>
            segment.match ? <b key={index}>{segment.text}</b> : <span key={index}>{segment.text}</span>,
          )}
        </div>
      )}

      <div className={styles.footer}>
        <span>{fillTemplate(copy.nextReview, { time: fakeNextReview(outcome) })}</span>
        <span>{copy.continue}</span>
      </div>
    </div>
  );
}
