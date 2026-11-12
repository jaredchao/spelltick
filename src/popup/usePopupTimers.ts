import { useEffect } from "react";
import type { Phase } from "../core/popupMachine";

export const PEEK_TIMEOUT_MS = 30_000;
export const FEEDBACK_TIMEOUT_MS = 8_000;

/**
 * Auto-close peek after 30 s and feedback after 8 s. While `paused` (mouse
 * over the card) nothing closes; the full time starts again when it leaves.
 */
export function usePopupTimers(phase: Phase, onTimeout: () => void, paused: boolean): void {
  useEffect(() => {
    if (paused) return;
    const delay =
      phase === "peek" ? PEEK_TIMEOUT_MS : phase === "feedback" ? FEEDBACK_TIMEOUT_MS : null;
    if (delay === null) return;
    const id = window.setTimeout(onTimeout, delay);
    return () => window.clearTimeout(id);
  }, [phase, onTimeout, paused]);
}
