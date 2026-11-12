// Dev-only visual preview of the popup states and the settings window in
// every skin, with the Tauri backend mocked. Open /preview.html?skin=paper
// while `npm run dev` is running. Not part of the production build.
import React, { type Dispatch } from "react";
import ReactDOM from "react-dom/client";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { Outcome, PopupEvent } from "../core/popupMachine";
import type { Question } from "../core/question";
import { DAY_MS, MINUTE_MS, newReview } from "../core/sm2";
import { makeItem } from "../core/testItems";
import { Answer } from "../popup/Answer";
import { Feedback } from "../popup/Feedback";
import { Peek } from "../popup/Peek";
import { SettingsApp } from "../settingsWindow/SettingsApp";
import { AddWordApp } from "../addWord/AddWordApp";
import { DEFAULT_SETTINGS, type Settings, type SkinChoice } from "../settings/types";
import { SkinProvider } from "../skin/SkinContext";
import "../styles/fonts.css";
import "../styles/global.css";

const params = new URLSearchParams(location.search);
const skin = (params.get("skin") ?? "native") as SkinChoice;
const view = params.get("view") ?? "popup";
const tab = params.get("tab") ?? "general";
const settings: Settings = { ...DEFAULT_SETTINGS, skin };

mockWindows(view === "addword" ? "addword" : "settings");
mockIPC((cmd) => {
  switch (cmd) {
    case "settings_get":
      return settings;
    case "shortcut_status":
      return { summonError: null, addWordError: "注册失败，可能已被其他应用占用" };
    case "addword_pending":
      return { term: "idempotent", needsPermission: true };
    case "ai_key_has":
      return true;
    case "history_list": {
      const now = Date.now();
      const row = (itemId: number, term: string, meaning: string, deckName: string, attempts: number, correct: number, lastAgoMin: number, lastResult: string, dueInMin: number) => ({
        itemId, term, meaning, kind: term.includes(" ") ? "sentence" : "word", deckName, attempts, correct,
        lastAt: now - lastAgoMin * 60_000, lastResult, dueAt: now + dueInMin * 60_000,
      });
      return {
        rows: [
          row(1, "gap", "缺口；差距", "四六级核心词", 1, 0, 3, "wrong", 7),
          row(2, "kingdom", "王国；领域", "四六级核心词", 2, 1, 40, "right", 1440),
          row(3, "Let's take this offline.", "这个我们会后单独聊。", "程序员 / 职场英语", 3, 2, 60 * 26, "hinted", -5),
          row(4, "cumulative", "累积的", "四六级核心词", 1, 1, 60 * 24 * 9, "skipped", 4320),
        ],
        counts: { all: 4, wrong: 2, due: 1 },
      };
    }
    case "decks_list":
      return [
        { id: 1, name: "四六级核心词", source: "builtin", enabled: true, learned: 312, total: 5751 },
        { id: 2, name: "程序员 / 职场英语", source: "builtin", enabled: true, learned: 86, total: 301 },
        { id: 3, name: "我的生词本", source: "user", enabled: true, learned: 9, total: 37 },
      ];
    default:
      return null;
  }
});

const noop: Dispatch<PopupEvent> = () => undefined;
const item = makeItem();
const zh2en: Question = { item, quizType: "zh2en" };
const NOW = Date.now();
const wrong: Outcome = {
  correct: false,
  answer: "deplyo",
  usedHint: false,
  result: "wrong",
  review: { ...newReview(NOW), dueAt: NOW + 10 * MINUTE_MS },
  answeredAt: NOW,
};
const right: Outcome = { ...wrong, correct: true, answer: "deploy", result: "right", review: { ...wrong.review, dueAt: NOW + DAY_MS } };

const page: React.CSSProperties = {
  display: "flex",
  gap: 24,
  alignItems: "flex-start",
  padding: 24,
  minHeight: "100vh",
  background: "var(--bg-backdrop)",
  overflow: "auto",
};

function PopupPreview() {
  return (
    <div style={page}>
      <Peek shortcut={settings.summonShortcut} onOpen={() => undefined} />
      <Answer question={zh2en} input="dep" hintLevel={5} focusToken={0} showFirstLetter soundEnabled={false} dispatch={noop} />
      <Answer
        question={{
          item: makeItem({ id: 9, kind: "sentence", term: "Let's take this offline.", meaning: "这个我们会后单独聊。", phonetic: null, example: null }),
          quizType: "zh2en",
        }}
        input="Let's ta"
        hintLevel={0}
        focusToken={0}
        showFirstLetter
        soundEnabled={false}
        dispatch={noop}
      />
      <Feedback
        question={zh2en}
        outcome={wrong}
        explanation="-oy 结尾同 employ、destroy，记成「de + ploy」。"
        onContinue={() => undefined}
      />
      <Feedback question={{ item, quizType: "cloze" }} outcome={right} onContinue={() => undefined} />
    </div>
  );
}

function SettingsPreview() {
  React.useEffect(() => {
    const target = Array.from(document.querySelectorAll("nav button")).find(
      (b) => b.textContent === { general: "通用", quiz: "出题", decks: "词库与 AI", history: "学习记录", about: "关于" }[tab],
    ) as HTMLButtonElement | undefined;
    target?.click();
  }, []);
  return (
    <div style={{ width: 820, height: 624, border: "1px solid #888", overflow: "hidden" }}>
      <SettingsApp settings={settings} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SkinProvider choice={skin}>
      {view === "settings" && <SettingsPreview />}
      {view === "addword" && (
        <div style={{ width: 400, height: 360, border: "1px solid #888", overflow: "hidden" }}>
          <AddWordApp settings={settings} />
        </div>
      )}
      {view === "popup" && <PopupPreview />}
    </SkinProvider>
  </React.StrictMode>,
);
