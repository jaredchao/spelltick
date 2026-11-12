import { useEffect } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { EVENT_PEEK, EVENT_SUMMON } from "./bridge";

/** Subscribe to Rust-side triggers: hotkey / tray (summon) and debug peek. */
export function usePopupEvents(onSummon: () => void, onPeek: () => void): void {
  useEffect(() => {
    const win = getCurrentWebviewWindow();
    const pending = [win.listen(EVENT_SUMMON, onSummon), win.listen(EVENT_PEEK, onPeek)];
    return () => {
      pending.forEach((p) => void p.then((unlisten) => unlisten()));
    };
  }, [onSummon, onPeek]);
}
