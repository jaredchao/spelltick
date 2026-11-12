import { useCallback, useEffect, useState, type ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import { EVENT_DECKS_CHANGED, settingsApi } from "../settings/api";
import type { DeckSummary } from "../settings/types";
import { Button, Section } from "./controls";
import { DeckImport } from "./DeckImport";
import styles from "./Settings.module.css";

const SOURCE_NAMES: Record<DeckSummary["source"], string> = {
  builtin: "内置",
  imported: "导入",
  user: "生词本",
};

export function DecksTab({ aiSection }: { aiSection?: ReactNode }) {
  const [decks, setDecks] = useState<readonly DeckSummary[]>([]);

  const refresh = useCallback(() => {
    settingsApi.listDecks().then(setDecks).catch((e: unknown) => console.error("[decks] load failed", e));
  }, []);

  useEffect(() => {
    refresh();
    const unlisten = listen(EVENT_DECKS_CHANGED, refresh);
    return () => void unlisten.then((fn) => fn());
  }, [refresh]);

  const remove = async (deck: DeckSummary) => {
    const ok = await ask(`删除「${deck.name}」和它的学习记录？`, {
      title: "删除词库",
      kind: "warning",
      okLabel: "删除",
      cancelLabel: "取消",
    });
    if (ok) await settingsApi.deleteDeck(deck.id);
  };

  return (
    <>
      <Section title="词库">
        <div className={styles.deckList}>
          {decks.map((deck) => (
            <div key={deck.id} className={styles.deckRow}>
              <input
                type="checkbox"
                aria-label={`启用${deck.name}`}
                checked={deck.enabled}
                onChange={(e) => void settingsApi.setDeckEnabled(deck.id, e.target.checked)}
              />
              <span className={styles.deckName}>
                {deck.name}
                <span className={styles.deckSource}> · {SOURCE_NAMES[deck.source]}</span>
              </span>
              <span className={styles.deckCount}>
                {deck.learned.toLocaleString()} / {deck.total.toLocaleString()}
              </span>
              {deck.source !== "builtin" ? (
                <Button danger onClick={() => void remove(deck)}>
                  删除
                </Button>
              ) : (
                <span className={styles.deckActionSpacer} />
              )}
            </div>
          ))}
        </div>
        <DeckImport onDone={refresh} />
      </Section>
      {aiSection}
    </>
  );
}
