import { invoke } from "@tauri-apps/api/core";
import type { DeckSummary, Settings, ShortcutStatus } from "./types";
import type { ImportItem } from "../core/deckImport";

export const EVENT_SETTINGS_CHANGED = "settings://changed";
export const EVENT_DECKS_CHANGED = "decks://changed";

export type HistoryFilter = "all" | "wrong" | "due";

export interface HistoryRow {
  readonly itemId: number;
  readonly term: string;
  readonly meaning: string;
  readonly kind: "word" | "sentence";
  readonly deckName: string;
  readonly attempts: number;
  readonly correct: number;
  readonly lastAt: number;
  readonly lastResult: string | null;
  readonly dueAt: number | null;
}

export interface HistoryPage {
  readonly rows: readonly HistoryRow[];
  readonly counts: { readonly all: number; readonly wrong: number; readonly due: number };
}

export const settingsApi = {
  get: () => invoke<Settings>("settings_get"),
  set: (settings: Settings) => invoke<ShortcutStatus>("settings_set", { settings }),
  shortcutStatus: () => invoke<ShortcutStatus>("shortcut_status"),
  listDecks: () => invoke<DeckSummary[]>("decks_list"),
  setDeckEnabled: (id: number, enabled: boolean) => invoke<void>("decks_set_enabled", { id, enabled }),
  deleteDeck: (id: number) => invoke<boolean>("decks_delete", { id }),
  importDeck: (name: string, items: readonly ImportItem[]) =>
    invoke<number>("decks_import", {
      name,
      items: items.map(({ term, meaning, example }) => ({ term, meaning, example })),
    }),
  readTextFile: (path: string) => invoke<string>("read_text_file", { path }),
  exportProgress: (path: string) => invoke<void>("progress_export", { path }),
  importProgress: (path: string) => invoke<void>("progress_import", { path }),
  historyList: (query: { filter: HistoryFilter; search: string; now: number; limit: number }) =>
    invoke<HistoryPage>("history_list", { query }),
};
