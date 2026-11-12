import { maxHintLevel } from "./hint";
import type { Question } from "./question";

export type Phase = "hidden" | "peek" | "answer" | "feedback";

export interface Outcome {
  readonly correct: boolean;
  readonly answer: string;
  readonly usedHint: boolean;
}

export interface PopupState {
  readonly phase: Phase;
  readonly question: Question | null;
  readonly input: string;
  readonly hintLevel: number;
  readonly outcome: Outcome | null;
  /** Bumped every time the window must (re)take focus, even within `answer`. */
  readonly focusToken: number;
}

export type PopupEvent =
  | { readonly type: "peek"; readonly question: Question }
  | { readonly type: "summon"; readonly question: Question }
  | { readonly type: "clickPeek" }
  | { readonly type: "input"; readonly value: string }
  | { readonly type: "hint" }
  | { readonly type: "submit" }
  | { readonly type: "skip" }
  | { readonly type: "timeout" }
  | { readonly type: "continue" };

export const initialPopupState: PopupState = {
  phase: "hidden",
  question: null,
  input: "",
  hintLevel: 0,
  outcome: null,
  focusToken: 0,
};

/**
 * Placeholder judge for M1: trim + case-insensitive.
 * M2 replaces it with the full rules in `src/core/judge.ts`.
 */
function isCorrect(answer: string, term: string): boolean {
  return answer.trim().toLowerCase() === term.trim().toLowerCase();
}

function startQuestion(state: PopupState, phase: Phase, question: Question): PopupState {
  return {
    ...initialPopupState,
    focusToken: state.focusToken + (phase === "answer" ? 1 : 0),
    phase,
    question,
  };
}

export function popupReducer(state: PopupState, event: PopupEvent): PopupState {
  switch (event.type) {
    case "peek":
      return state.phase === "hidden" ? startQuestion(state, "peek", event.question) : state;

    case "summon":
      if (state.phase === "hidden") return startQuestion(state, "answer", event.question);
      if (state.phase === "peek" || state.phase === "answer") {
        return { ...state, phase: "answer", focusToken: state.focusToken + 1 };
      }
      return state;

    case "clickPeek":
      return state.phase === "peek"
        ? { ...state, phase: "answer", focusToken: state.focusToken + 1 }
        : state;

    case "input":
      return state.phase === "answer" ? { ...state, input: event.value } : state;

    case "hint": {
      if (state.phase !== "answer" || !state.question) return state;
      const max = maxHintLevel(state.question.term);
      return { ...state, hintLevel: Math.min(state.hintLevel + 1, max) };
    }

    case "submit": {
      if (state.phase !== "answer" || !state.question) return state;
      if (state.input.trim() === "") return state;
      const outcome: Outcome = {
        correct: isCorrect(state.input, state.question.term),
        answer: state.input,
        usedHint: state.hintLevel > 0,
      };
      return { ...state, phase: "feedback", outcome };
    }

    case "skip":
      return state.phase === "answer" ? { ...state, phase: "hidden" } : state;

    case "timeout":
      return state.phase === "peek" || state.phase === "feedback"
        ? { ...state, phase: "hidden" }
        : state;

    case "continue":
      return state.phase === "feedback" ? { ...state, phase: "hidden" } : state;
  }
}
