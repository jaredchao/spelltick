import { useEffect, useRef, useState, type MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Pointer travel (px) before a press becomes a drag instead of a click. */
const DRAG_THRESHOLD = 4;

/**
 * Drag the popup by pressing anywhere on the card and moving; a press without
 * movement stays a normal click. Also reports whether the mouse is over the
 * card, so auto-close timers can pause.
 */
export function useCardPointer() {
  const [hovered, setHovered] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0) return;
    const startX = event.screenX;
    const startY = event.screenY;

    const swallowClick = (e: globalThis.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
    };
    const onMove = (e: globalThis.MouseEvent) => {
      if ((e.buttons & 1) === 0) {
        stop();
        return;
      }
      if (Math.hypot(e.screenX - startX, e.screenY - startY) < DRAG_THRESHOLD) return;
      stop();
      // A drag must not also count as a click on whatever was pressed.
      window.addEventListener("click", swallowClick, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", swallowClick, { capture: true }), 300);
      void getCurrentWindow()
        .startDragging()
        .catch((err: unknown) => console.error("[popup] drag failed", err));
    };
    const stop = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", stop);
      cleanup.current = null;
    };

    cleanup.current?.();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stop);
    cleanup.current = stop;
  };

  return {
    hovered,
    handlers: {
      onMouseDown,
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
    },
  };
}
