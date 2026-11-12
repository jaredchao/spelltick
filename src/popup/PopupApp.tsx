import { useCallback, useEffect, useReducer, useRef } from "react";
import { initialPopupState, popupReducer } from "../core/popupMachine";
import { Answer } from "./Answer";
import { Feedback } from "./Feedback";
import { Peek } from "./Peek";
import { POPUP_INSET } from "./bridge";
import { loadNextQuestion, loadQuestionFor, recordAttempt, reportClosed } from "./questionSource";
import { usePopupEvents } from "./usePopupEvents";
import { usePopupTimers } from "./usePopupTimers";
import { usePopupWindow } from "./usePopupWindow";
import type { Settings } from "../settings/types";
import { useAiConfig } from "../ai/useAiConfig";
import { usePopupAi } from "./usePopupAi";
import { playFailure, playSuccess } from "./sound";
import type { AiQuizOptions } from "./questionSource";

export function PopupApp({ settings }: { settings: Settings }) {
  const [state, dispatch] = useReducer(popupReducer, initialPopupState);
  const contentRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const quizRef = useRef(settings.quiz);
  quizRef.current = settings.quiz;
  const aiConfig = useAiConfig(settings.ai);
  const aiRef = useRef<AiQuizOptions | null>(null);
  aiRef.current = aiConfig
    ? { config: aiConfig, newClozeFromMistakes: settings.ai.newClozeFromMistakes }
    : null;
  const lastItemId = () => stateRef.current.question?.item.id ?? null;

  const onSummon = useCallback(async () => {
    // Only a hidden popup needs a new question; otherwise just refocus.
    const question = stateRef.current.phase === "hidden" ? await loadNextQuestion(quizRef.current, lastItemId(), aiRef.current) : null;
    dispatch({ type: "summon", question });
  }, []);

  const onPeek = useCallback(async (itemId: number | null) => {
    if (stateRef.current.phase !== "hidden") return;
    const question =
      itemId === null
        ? await loadNextQuestion(quizRef.current, lastItemId(), aiRef.current)
        : await loadQuestionFor(quizRef.current, itemId, lastItemId());
    if (question) dispatch({ type: "peek", question });
  }, []);

  const onTimeout = useCallback(() => dispatch({ type: "timeout" }), []);

  usePopupEvents(onSummon, onPeek);
  usePopupTimers(state.phase, onTimeout);
  usePopupWindow(state.phase, state.focusToken, contentRef);
  const explanation = usePopupAi(state, settings.ai, aiConfig);

  // Persist each new attempt exactly once.
  const savedSeq = useRef(0);
  useEffect(() => {
    const { attempt } = state;
    if (!attempt || attempt.seq === savedSeq.current) return;
    savedSeq.current = attempt.seq;
    void recordAttempt(attempt);
    // Submitted answers get a sound; skips (no outcome shown) stay silent.
    if (settings.soundEnabled && state.phase === "feedback") {
      if (attempt.correct) playSuccess();
      else playFailure();
    }
  }, [state.attempt]);

  // Tell the scheduler when and why the popup closed, exactly once per close.
  const reportedClose = useRef(0);
  useEffect(() => {
    const { lastClose } = state;
    if (!lastClose || lastClose.seq === reportedClose.current) return;
    reportedClose.current = lastClose.seq;
    void reportClosed(lastClose);
  }, [state.lastClose]);

  const { phase, question } = state;

  return (
    <div ref={contentRef} style={{ display: "inline-block", padding: POPUP_INSET }}>
      {phase === "peek" && (
        <Peek shortcut={settings.summonShortcut} onOpen={() => dispatch({ type: "clickPeek" })} />
      )}
      {phase === "answer" && question && (
        <Answer
          question={question}
          input={state.input}
          hintLevel={state.hintLevel}
          focusToken={state.focusToken}
          showFirstLetter={settings.quiz.showFirstLetter}
          soundEnabled={settings.soundEnabled}
          dispatch={dispatch}
        />
      )}
      {phase === "feedback" && question && state.outcome && (
        <Feedback
          question={question}
          outcome={state.outcome}
          explanation={explanation}
          onContinue={() => dispatch({ type: "continue" })}
        />
      )}
    </div>
  );
}
