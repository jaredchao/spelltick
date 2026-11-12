import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { accuracyLabel, lastSeenLabel, nextReviewLabel, resultLabel } from "../core/historyFormat";
import { EVENT_DECKS_CHANGED, settingsApi, type HistoryFilter, type HistoryPage } from "../settings/api";
import { Section, Segmented } from "./controls";
import styles from "./Settings.module.css";

const LIMIT = 500;
const EMPTY: HistoryPage = { rows: [], counts: { all: 0, wrong: 0, due: 0 } };

/** Read-only list of every word or sentence answered at least once. */
export function HistoryTab() {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState<HistoryPage>(EMPTY);
  const [version, setVersion] = useState(0);
  const now = Date.now();

  // Refresh when decks change elsewhere, and whenever the window regains focus
  // (new answers are recorded from the popup while this window sits open).
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    const unlisten = listen(EVENT_DECKS_CHANGED, bump);
    window.addEventListener("focus", bump);
    return () => {
      void unlisten.then((fn) => fn());
      window.removeEventListener("focus", bump);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      settingsApi
        .historyList({ filter, search, now: Date.now(), limit: LIMIT })
        .then((p) => active && setPage(p))
        .catch((e: unknown) => console.error("[history] load failed", e));
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [filter, search, version]);

  const { counts, rows } = page;

  return (
    <Section title="学习记录" note={`练过 ${counts.all} 条`}>
      <div className={styles.historyBar}>
        <Segmented
          label="筛选"
          value={filter}
          options={[
            { value: "all", label: `全部 ${counts.all}` },
            { value: "wrong", label: `答错过 ${counts.wrong}` },
            { value: "due", label: `已到期 ${counts.due}` },
          ]}
          onChange={setFilter}
        />
        <input
          className={styles.text}
          type="search"
          placeholder="搜索英文或中文"
          aria-label="搜索英文或中文"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {rows.length === 0 ? (
        <div className={styles.hintText}>
          {counts.all === 0 ? "还没有答过题。按快捷键来一题吧。" : "没有符合条件的记录。"}
        </div>
      ) : (
        <div className={styles.historyTableWrap}>
          <table className={styles.historyTable}>
            <thead>
              <tr>
                <th>英文</th>
                <th>释义</th>
                <th>答对 / 作答</th>
                <th>最近一次</th>
                <th>下次复习</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.itemId}>
                  <td className={styles.historyTerm}>
                    {row.term}
                    <div className={styles.historyDeck}>{row.deckName}</div>
                  </td>
                  <td className={styles.historyMeaning}>{row.meaning}</td>
                  <td className={styles.historyNum}>{accuracyLabel(row.correct, row.attempts)}</td>
                  <td>
                    <span className={row.lastResult === "wrong" || row.lastResult === "skipped" ? styles.historyBad : undefined}>
                      {resultLabel(row.lastResult)}
                    </span>
                    <div className={styles.historyDeck}>{lastSeenLabel(row.lastAt, now)}</div>
                  </td>
                  <td className={row.dueAt !== null && row.dueAt <= now ? styles.historyDue : undefined}>
                    {nextReviewLabel(row.dueAt, now)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length >= LIMIT && <div className={styles.hintText}>只显示最近 {LIMIT} 条，可以用搜索缩小范围。</div>}
        </div>
      )}
    </Section>
  );
}
