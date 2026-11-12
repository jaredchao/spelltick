import { useEffect } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { EVENT_PEEK, EVENT_SUMMON } from "./bridge";

interface PeekPayload {
  readonly itemId?: number | null;
}

/** Subscribe to Rust-side triggers: hotkey / tray (summon) and scheduler peek. */
export function usePopupEvents(
  onSummon: () => void,
  onPeek: (itemId: number | null) => void,
): void {
  useEffect(() => {
    const win = getCurrentWebviewWindow();
    const pending = [
      win.listen(EVENT_SUMMON, onSummon),
      win.listen<PeekPayload | null>(EVENT_PEEK, (event) => onPeek(event.payload?.itemId ?? null)),
    ];
    return () => {
      pending.forEach((p) => void p.then((unlisten) => unlisten()));
    };
  }, [onSummon, onPeek]);
}
