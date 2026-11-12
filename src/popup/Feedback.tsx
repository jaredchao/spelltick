import { useEffect } from "react";
import { formatDuration } from "../core/duration";
import { splitByTerm } from "../core/highlight";
import type { Outcome } from "../core/popupMachine";
import type { Question } from "../core/question";
import { spellingDiff } from "../core/spellingDiff";
import { fillTemplate } from "../core/template";
import { useSkin } from "../skin/SkinContext";
import styles from "./Card.module.css";
import { FeedbackSpelling } from "./FeedbackSpelling";
import { CheckIcon, CrossIcon } from "./icons";
import type { Explanation } from "./usePopupAi";

interface FeedbackProps {
  readonly question: Question;
  readonly outcome: Outcome;
  /** null hides the AI line entirely (not configured, turned off, or failed). */
  readonly explanation?: Explanation;
  readonly onContinue: () => void;
}

const AI_LABEL_CLASS = {
  highlight: styles.aiBadge,
  diff: styles.aiTag,
  card: styles.aiNote,
} as const;

const EXAMPLE_CLASS = {
  highlight: styles.example,
  diff: styles.exampleDiff,
  card: styles.exampleCard,
} as const;

export function Feedback({ question, outcome, explanation = null, onContinue }: FeedbackProps) {
  const { copy, layout } = useSkin();
  const { item } = question;
  const diff = outcome.correct ? null : spellingDiff(outcome.answer, item.term);
  const style = layout.feedbackStyle;

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
  const title = outcome.correct ? copy.rightTitle : copy.wrongTitle;

  return (
    <div className={`${styles.card} ${styles.feedbackCard}`} onClick={onContinue}>
      <div className={outcome.correct ? styles.titleRight : styles.titleWrong}>
        {style === "highlight" && (outcome.correct ? <CheckIcon /> : <CrossIcon />)}
        {title}
      </div>

      <FeedbackSpelling style={style} item={item} diff={diff} />
      {question.quizType !== "zh2en" && <div className={styles.compareLabel}>{item.meaning}</div>}

      {item.example && (
        <div className={EXAMPLE_CLASS[style]}>
          {splitByTerm(item.example, item.term).map((segment, index) =>
            segment.match ? <b key={index}>{segment.text}</b> : <span key={index}>{segment.text}</span>,
          )}
        </div>
      )}

      {explanation !== null && (
        <div className={styles.aiLine}>
          <span className={AI_LABEL_CLASS[style]}>{copy.aiLabel}</span>
          <span className={explanation === "loading" ? styles.aiLoading : undefined}>
            {explanation === "loading" ? "讲解生成中…" : explanation}
          </span>
        </div>
      )}

      <div className={style === "diff" ? styles.footerDiff : styles.footer}>
        <span>{fillTemplate(copy.nextReview, { time: nextIn })}</span>
        <span>{copy.continue}</span>
      </div>
    </div>
  );
}
