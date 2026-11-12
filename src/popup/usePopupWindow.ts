import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { Phase } from "../core/popupMachine";
import { popupWindow } from "./bridge";

function measure(el: HTMLElement): { width: number; height: number } {
  const rect = el.getBoundingClientRect();
  return { width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
}

/**
 * Drive the native popup window from the UI phase:
 * size + anchor it to the content, and show / focus / hide it.
 * Focus is only requested in `answer`, and again whenever `focusToken` changes.
 */
export function usePopupWindow(
  phase: Phase,
  focusToken: number,
  contentRef: RefObject<HTMLElement | null>,
): void {
  const prevPhase = useRef<Phase>("hidden");

  useLayoutEffect(() => {
    const previous = prevPhase.current;
    prevPhase.current = phase;
    const el = contentRef.current;

    const placeToContent = async () => {
      if (!el) return;
      const { width, height } = measure(el);
      await popupWindow.place(width, height);
    };

    const sync = async () => {
      switch (phase) {
        case "hidden":
          if (previous !== "hidden") await popupWindow.hide();
          return;
        case "peek":
          await placeToContent();
          await popupWindow.showPeek();
          return;
        case "answer":
          await placeToContent();
          await popupWindow.focus();
          return;
        case "feedback":
          await placeToContent();
          return;
      }
    };

    void sync();
  }, [phase, focusToken, contentRef]);

  // Keep the window fitted when content changes size within a phase (e.g. hint line).
  useEffect(() => {
    const el = contentRef.current;
    if (!el || phase === "hidden") return;
    const observer = new ResizeObserver(() => {
      // Content is unmounted on the way to `hidden`; don't shrink the window to padding only.
      if (el.childElementCount === 0) return;
      const { width, height } = measure(el);
      void popupWindow.place(width, height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [phase, contentRef]);
}
