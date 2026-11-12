import { maxHintLevel } from "./hint";
import { isCorrect } from "./judge";
import type { Question, QuizType } from "./question";
import { nextReview, type AnswerResult, type ReviewRecord } from "./sm2";

export type Phase = "hidden" | "peek" | "answer" | "feedback";

export interface Outcome {
  readonly correct: boolean;
  readonly answer: string;
  readonly usedHint: boolean;
  readonly result: AnswerResult;
  readonly review: ReviewRecord;
  readonly answeredAt: number;
}

/** An answer to persist. `seq` changes for every new attempt. */
export interface Attempt {
  readonly seq: number;
  readonly itemId: number;
  readonly quizType: QuizType;
  readonly answer: string;
  readonly correct: boolean;
  readonly usedHint: boolean;
  readonly at: number;
  readonly review: ReviewRecord;
}

export type CloseReason = "timeout" | "done";

/** Why the popup last closed; `seq` changes on every close. */
export interface Close {
  readonly seq: number;
  readonly reason: CloseReason;
  readonly itemId: number | null;
}

export interface PopupState {
  readonly phase: Phase;
  readonly question: Question | null;
  readonly input: string;
  readonly hintLevel: number;
  readonly outcome: Outcome | null;
  /** Bumped every time the window must (re)take focus, even within `answer`. */
  readonly focusToken: number;
  readonly attempt: Attempt | null;
  readonly lastClose: Close | null;
}

export type PopupEvent =
  | { readonly type: "peek"; readonly question: Question }
  | { readonly type: "summon"; readonly question: Question | null }
  | { readonly type: "clickPeek" }
  | { readonly type: "input"; readonly value: string }
  | { readonly type: "hint" }
  | { readonly type: "submit"; readonly now: number }
  | { readonly type: "skip"; readonly now: number }
  | { readonly type: "timeout" }
  | { readonly type: "continue" };

export const initialPopupState: PopupState = {
  phase: "hidden",
  question: null,
  input: "",
  hintLevel: 0,
  outcome: null,
  focusToken: 0,
  attempt: null,
  lastClose: null,
};

function startQuestion(state: PopupState, phase: Phase, question: Question): PopupState {
  return {
    ...initialPopupState,
    focusToken: state.focusToken + (phase === "answer" ? 1 : 0),
    attempt: state.attempt,
    lastClose: state.lastClose,
    phase,
    question,
  };
}

function hide(state: PopupState, reason: CloseReason): PopupState {
  return {
    ...state,
    phase: "hidden",
    lastClose: {
      seq: (state.lastClose?.seq ?? 0) + 1,
      reason,
      itemId: state.question?.item.id ?? null,
    },
  };
}

function resultOf(correct: boolean, usedHint: boolean): AnswerResult {
  if (!correct) return "wrong";
  return usedHint ? "hinted" : "right";
}

function makeAttempt(
  state: PopupState,
  question: Question,
  answer: string,
  correct: boolean,
  review: ReviewRecord,
  at: number,
): Attempt {
  return {
    seq: (state.attempt?.seq ?? 0) + 1,
    itemId: question.item.id,
    quizType: question.quizType,
    answer,
    correct,
    usedHint: state.hintLevel > 0,
    at,
    review,
  };
}

export function popupReducer(state: PopupState, event: PopupEvent): PopupState {
  switch (event.type) {
    case "peek":
      return state.phase === "hidden" ? startQuestion(state, "peek", event.question) : state;

    case "summon":
      if (state.phase === "hidden") {
        return event.question ? startQuestion(state, "answer", event.question) : state;
      }
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
      const max = maxHintLevel(state.question.item.term);
      return { ...state, hintLevel: Math.min(state.hintLevel + 1, max) };
    }

    case "submit": {
      const { question } = state;
      if (state.phase !== "answer" || !question) return state;
      if (state.input.trim() === "") return state;
      const { item } = question;
      const correct = isCorrect(state.input, item.term, item.kind);
      const usedHint = state.hintLevel > 0;
      const result = resultOf(correct, usedHint);
      const review = nextReview(item.review, result, event.now);
      return {
        ...state,
        phase: "feedback",
        outcome: { correct, answer: state.input, usedHint, result, review, answeredAt: event.now },
        attempt: makeAttempt(state, question, state.input, correct, review, event.now),
      };
    }

    case "skip": {
      const { question } = state;
      if (state.phase !== "answer" || !question) return state;
      const review = nextReview(question.item.review, "skipped", event.now);
      return {
        ...hide(state, "done"),
        attempt: makeAttempt(state, question, state.input, false, review, event.now),
      };
    }

    case "timeout":
      if (state.phase === "peek") return hide(state, "timeout");
      if (state.phase === "feedback") return hide(state, "done");
      return state;

    case "continue":
      return state.phase === "feedback" ? hide(state, "done") : state;
  }
}
