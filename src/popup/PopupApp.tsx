import { useCallback, useReducer, useRef } from "react";
import { initialPopupState, popupReducer } from "../core/popupMachine";
import { Answer } from "./Answer";
import { Feedback } from "./Feedback";
import { Peek } from "./Peek";
import { POPUP_INSET } from "./bridge";
import { FAKE_QUESTION } from "./fakeQuestion";
import { usePopupEvents } from "./usePopupEvents";
import { usePopupTimers } from "./usePopupTimers";
import { usePopupWindow } from "./usePopupWindow";

export function PopupApp() {
  const [state, dispatch] = useReducer(popupReducer, initialPopupState);
  const contentRef = useRef<HTMLDivElement>(null);

  const onSummon = useCallback(() => dispatch({ type: "summon", question: FAKE_QUESTION }), []);
  const onPeek = useCallback(() => dispatch({ type: "peek", question: FAKE_QUESTION }), []);
  const onTimeout = useCallback(() => dispatch({ type: "timeout" }), []);

  usePopupEvents(onSummon, onPeek);
  usePopupTimers(state.phase, onTimeout);
  usePopupWindow(state.phase, state.focusToken, contentRef);

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
