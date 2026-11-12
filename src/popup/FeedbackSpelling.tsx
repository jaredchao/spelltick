import type { QuizItem } from "../core/question";
import type { DiffSegment, SpellingDiff } from "../core/spellingDiff";
import type { SkinLayout } from "../skin/skins";
import styles from "./Card.module.css";

function Segments({ segments, changedClass }: { segments: readonly DiffSegment[]; changedClass: string }) {
  return (
    <>
      {segments.map((seg, index) => (
        <span key={index} className={seg.changed ? changedClass : undefined}>
          {seg.text}
        </span>
      ))}
    </>
  );
}

function Phonetic({ item }: { item: QuizItem }) {
  return item.phonetic ? <span className={styles.phonetic}>{item.phonetic}</span> : null;
}

interface Props {
  readonly style: SkinLayout["feedbackStyle"];
  readonly item: QuizItem;
  readonly diff: SpellingDiff | null;
}

/** The "your spelling vs correct spelling" block, in the skin's feedback style. */
export function FeedbackSpelling({ style, item, diff }: Props) {
  if (style === "diff") {
    return (
      <div className={styles.diffLines}>
        {diff && (
          <div>
            <span className={styles.diffMinus}>- </span>
            <Segments segments={diff.given} changedClass={styles.markWrong} />
          </div>
        )}
        <div>
          <span className={styles.diffPlus}>{diff ? "+ " : ""}</span>
          {diff ? <Segments segments={diff.expected} changedClass={styles.markRight} /> : item.term}
          <Phonetic item={item} />
        </div>
      </div>
    );
  }

  if (style === "card") {
    return (
      <div className={styles.cardCompare}>
        <div className={styles.cardTermRow}>
          <span className={styles.cardTerm}>
            {diff ? <Segments segments={diff.expected} changedClass={styles.cardMark} /> : item.term}
          </span>
          <Phonetic item={item} />
        </div>
        {diff && (
          <div className={styles.cardGiven}>
            你写的是{" "}
            <span className={styles.cardGivenText}>
              <Segments segments={diff.given} changedClass={styles.cardStrike} />
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
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
        <Phonetic item={item} />
      </div>
    </div>
  );
}
