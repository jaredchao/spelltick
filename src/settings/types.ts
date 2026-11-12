import type { QuizType } from "../core/question";

/** Mirrors Rust `settings::Settings` (camelCase JSON). */
export type SkinChoice = "native" | "terminal" | "paper" | "system";

export interface ScheduleSettings {
  readonly mode: "random" | "fixed";
  readonly minMinutes: number;
  readonly maxMinutes: number;
  readonly fixedMinutes: number;
  readonly workHoursEnabled: boolean;
  readonly workStart: string;
  readonly workEnd: string;
  readonly skipFullscreen: boolean;
  readonly deferWhenTyping: boolean;
}

export interface QuizSettings {
  readonly wordRatio: number;
  readonly sentenceRatio: number;
  readonly enabledTypes: readonly QuizType[];
  readonly dailyNewLimit: number;
  readonly showFirstLetter: boolean;
}

export interface AiSettings {
  readonly baseUrl: string;
  readonly model: string;
  readonly generateExamples: boolean;
  readonly explainMistakes: boolean;
  readonly newClozeFromMistakes: boolean;
}

export interface Settings {
  readonly skin: SkinChoice;
  readonly summonShortcut: string;
  readonly addWordShortcut: string;
  readonly autostart: boolean;
  readonly soundEnabled: boolean;
  readonly schedule: ScheduleSettings;
  readonly quiz: QuizSettings;
  readonly ai: AiSettings;
}

export interface ShortcutStatus {
  readonly summonError: string | null;
  readonly addWordError: string | null;
}

export interface DeckSummary {
  readonly id: number;
  readonly name: string;
  readonly source: "builtin" | "imported" | "user";
  readonly enabled: boolean;
  readonly learned: number;
  readonly total: number;
}

/** SPEC section 11 defaults; used until the saved settings load. */
export const DEFAULT_SETTINGS: Settings = {
  skin: "native",
  summonShortcut: "CommandOrControl+Shift+E",
  addWordShortcut: "CommandOrControl+Shift+A",
  autostart: true,
  soundEnabled: true,
  schedule: {
    mode: "random",
    minMinutes: 15,
    maxMinutes: 45,
    fixedMinutes: 30,
    workHoursEnabled: true,
    workStart: "09:00",
    workEnd: "18:00",
    skipFullscreen: true,
    deferWhenTyping: true,
  },
  quiz: {
    wordRatio: 7,
    sentenceRatio: 3,
    enabledTypes: ["zh2en", "dictation", "cloze"],
    dailyNewLimit: 20,
    showFirstLetter: true,
  },
  ai: {
    baseUrl: "",
    model: "",
    generateExamples: true,
    explainMistakes: true,
    newClozeFromMistakes: false,
  },
};
