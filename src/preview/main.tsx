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
import { DEFAULT_SETTINGS, type Settings, type SkinChoice } from "../settings/types";
import { SkinProvider } from "../skin/SkinContext";
import "../styles/fonts.css";
import "../styles/global.css";

const params = new URLSearchParams(location.search);
const skin = (params.get("skin") ?? "native") as SkinChoice;
const view = params.get("view") ?? "popup";
const tab = params.get("tab") ?? "general";
const settings: Settings = { ...DEFAULT_SETTINGS, skin };

mockWindows("settings");
mockIPC((cmd) => {
  switch (cmd) {
    case "settings_get":
      return settings;
    case "shortcut_status":
      return { summonError: null, addWordError: "注册失败，可能已被其他应用占用" };
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
      <Answer question={zh2en} input="deplo" hintLevel={2} focusToken={0} showFirstLetter dispatch={noop} />
      <Feedback question={zh2en} outcome={wrong} onContinue={() => undefined} />
      <Feedback question={{ item, quizType: "cloze" }} outcome={right} onContinue={() => undefined} />
    </div>
  );
}

function SettingsPreview() {
  React.useEffect(() => {
    const target = Array.from(document.querySelectorAll("nav button")).find(
      (b) => b.textContent === { general: "通用", quiz: "出题", decks: "词库与 AI", about: "关于" }[tab],
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
    <SkinProvider choice={skin}>{view === "settings" ? <SettingsPreview /> : <PopupPreview />}</SkinProvider>
  </React.StrictMode>,
);
