import type { QuizItem } from "./question";

/** Test helper: build a QuizItem with sensible defaults. */
export function makeItem(overrides: Partial<QuizItem> = {}): QuizItem {
  return {
    id: 1,
    deckId: 1,
    deckName: "程序员英语",
    kind: "word",
    term: "deploy",
    meaning: "部署；展开",
    phonetic: "/dɪˈplɔɪ/",
    pos: "v.",
    example: "We deploy to production every Friday.",
    review: null,
    ...overrides,
  };
}
