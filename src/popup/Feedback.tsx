import { useEffect } from "react";
import { formatDuration } from "../core/duration";
import { splitByTerm } from "../core/highlight";
import type { Outcome } from "../core/popupMachine";
import type { Question } from "../core/question";
import { spellingDiff, type DiffSegment } from "../core/spellingDiff";
import { fillTemplate } from "../core/template";
import { useSkin } from "../skin/SkinContext";
import styles from "./Card.module.css";
import { CheckIcon, CrossIcon } from "./icons";

interface FeedbackProps {
  readonly question: Question;
  readonly outcome: Outcome;
  readonly onContinue: () => void;
}

function Segments({ segments, changedClass }: { segments: readonly DiffSegment[]; changedClass: string }) {
  return (
    <>
      {segments.map((seg, index) =>
        seg.changed ? (
          <span key={index} className={changedClass}>
            {seg.text}
          </span>
        ) : (
          <span key={index}>{seg.text}</span>
        ),
      )}
    </>
  );
}

export function Feedback({ question, outcome, onContinue }: FeedbackProps) {
  const { copy } = useSkin();
  const { item } = question;
  const diff = outcome.correct ? null : spellingDiff(outcome.answer, item.term);

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

  const nextIn = formatDuration(outcome.review.dueAt - outcome.answeredAt);

  return (
    <div className={styles.card} onClick={onContinue}>
      <div className={outcome.correct ? styles.titleRight : styles.titleWrong}>
        {outcome.correct ? <CheckIcon /> : <CrossIcon />}
        {outcome.correct ? copy.rightTitle : copy.wrongTitle}
      </div>

      <div className={styles.compare}>
        {diff && (
          <>
            <div className={styles.compareLabel}>你的拼写</div>
            <div className={styles.spelling}>
              <Segments segments={diff.given} changedClass={styles.markWrong} />
            </div>
            <div className={styles.compareLabel}>正确</div>
          </>
        )}
        <div className={styles.spellingStrong}>
          {diff ? <Segments segments={diff.expected} changedClass={styles.markRight} /> : item.term}
          {item.phonetic && <span className={styles.phonetic}>{item.phonetic}</span>}
        </div>
        {question.quizType !== "zh2en" && <div className={styles.compareLabel}>{item.meaning}</div>}
      </div>

      {item.example && (
        <div className={styles.example}>
          {splitByTerm(item.example, item.term).map((segment, index) =>
            segment.match ? <b key={index}>{segment.text}</b> : <span key={index}>{segment.text}</span>,
          )}
        </div>
      )}

      <div className={styles.footer}>
        <span>{fillTemplate(copy.nextReview, { time: nextIn })}</span>
        <span>{copy.continue}</span>
      </div>
    </div>
  );
}
