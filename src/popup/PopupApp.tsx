import { useCallback, useEffect, useReducer, useRef } from "react";
import { initialPopupState, popupReducer } from "../core/popupMachine";
import { Answer } from "./Answer";
import { Feedback } from "./Feedback";
import { Peek } from "./Peek";
import { POPUP_INSET } from "./bridge";
import { loadNextQuestion, recordAttempt } from "./questionSource";
import { usePopupEvents } from "./usePopupEvents";
import { usePopupTimers } from "./usePopupTimers";
import { usePopupWindow } from "./usePopupWindow";

export function PopupApp() {
  const [state, dispatch] = useReducer(popupReducer, initialPopupState);
  const contentRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const lastItemId = () => stateRef.current.question?.item.id ?? null;

  const onSummon = useCallback(async () => {
    // Only a hidden popup needs a new question; otherwise just refocus.
    const question = stateRef.current.phase === "hidden" ? await loadNextQuestion(lastItemId()) : null;
    dispatch({ type: "summon", question });
  }, []);

  const onPeek = useCallback(async () => {
    if (stateRef.current.phase !== "hidden") return;
    const question = await loadNextQuestion(lastItemId());
    if (question) dispatch({ type: "peek", question });
  }, []);

  const onTimeout = useCallback(() => dispatch({ type: "timeout" }), []);

  usePopupEvents(onSummon, onPeek);
  usePopupTimers(state.phase, onTimeout);
  usePopupWindow(state.phase, state.focusToken, contentRef);

  // Persist each new attempt exactly once.
  const savedSeq = useRef(0);
  useEffect(() => {
    const { attempt } = state;
    if (!attempt || attempt.seq === savedSeq.current) return;
    savedSeq.current = attempt.seq;
    void recordAttempt(attempt);
  }, [state.attempt]);

  const { phase, question } = state;

  return (
    <div ref={contentRef} style={{ display: "inline-block", padding: POPUP_INSET }}>
      {phase === "peek" && <Peek onOpen={() => dispatch({ type: "clickPeek" })} />}
      {phase === "answer" && question && (
        <Answer
          question={question}
          input={state.input}
          hintLevel={state.hintLevel}
          focusToken={state.focusToken}
          dispatch={dispatch}
        />
      )}
      {phase === "feedback" && question && state.outcome && (
        <Feedback
          question={question}
          outcome={state.outcome}
          onContinue={() => dispatch({ type: "continue" })}
        />
      )}
    </div>
  );
}
