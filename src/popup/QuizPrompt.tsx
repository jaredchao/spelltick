import { hintMask } from "../core/hint";
import type { Question } from "../core/question";
import { clozeText } from "../core/quizType";
import styles from "./Card.module.css";

function auxLine(question: Question): string {
  const { item } = question;
  if (item.kind === "sentence") {
    return `${item.term.trim().split(/\s+/).length} 个词`;
  }
  const letters = item.term.replace(/\s/g, "").length;
  return [item.pos, `${letters} 个字母`, `首字母 ${item.term.charAt(0)}`].filter(Boolean).join(" · ");
}

/** The question body; differs by quiz type (SPEC section 4). */
export function QuizPrompt({ question, hintLevel }: { question: Question; hintLevel: number }) {
  const { item, quizType } = question;
  return (
    <div className={styles.prompt}>
      {quizType === "zh2en" && <div className={styles.meaning}>{item.meaning}</div>}

      {quizType === "cloze" && (
        <>
          <div className={styles.cloze}>{clozeText(item)}</div>
          <div className={styles.clozeMeaning}>{item.meaning}</div>
        </>
      )}

      {(quizType === "dictation" || quizType === "sentence_dictation") && (
        <div className={styles.listen}>
          {quizType === "dictation" ? "听发音，拼写单词" : "听发音，写出整句"}
        </div>
      )}

      <div className={styles.aux}>{auxLine(question)}</div>
      {hintLevel > 0 && <div className={styles.hint}>{hintMask(item.term, hintLevel)}</div>}
    </div>
  );
}
