import { useCallback, useState } from "react";
import { settingsApi } from "../settings/api";
import type { Settings, ShortcutStatus } from "../settings/types";
import { AboutTab } from "./AboutTab";
import { AiSection } from "./AiSection";
import { DecksTab } from "./DecksTab";
import { GeneralTab } from "./GeneralTab";
import { QuizTab } from "./QuizTab";
import styles from "./Settings.module.css";

type Tab = "general" | "quiz" | "decks" | "about";

const TABS: readonly { id: Tab; label: string }[] = [
  { id: "general", label: "通用" },
  { id: "quiz", label: "出题" },
  { id: "decks", label: "词库与 AI" },
  { id: "about", label: "关于" },
];

export function SettingsApp({ settings }: { settings: Settings }) {
  const [tab, setTab] = useState<Tab>("general");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Every change is saved immediately; the change event updates all windows.
  const update = useCallback(async (next: Settings): Promise<ShortcutStatus | null> => {
    try {
      setSaveError(null);
      return await settingsApi.set(next);
    } catch (e) {
      setSaveError(`保存失败：${String(e)}`);
      return null;
    }
  }, []);

  return (
    <div className={styles.root}>
      <nav className={styles.nav} aria-label="设置分页">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={tab === t.id ? "page" : undefined}
            className={tab === t.id ? styles.navOn : styles.navItem}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <main className={styles.content}>
        {saveError && <div className={styles.error}>{saveError}</div>}
        {tab === "general" && <GeneralTab settings={settings} update={update} />}
        {tab === "quiz" && <QuizTab settings={settings} update={update} />}
        {tab === "decks" && <DecksTab aiSection={<AiSection settings={settings} update={update} />} />}
        {tab === "about" && <AboutTab />}
      </main>
    </div>
  );
}
