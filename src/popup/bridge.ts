import { invoke } from "@tauri-apps/api/core";

/** Transparent padding around the card inside the popup window (logical px). */
export const POPUP_INSET = 24;

export const EVENT_SUMMON = "popup://summon";
export const EVENT_PEEK = "popup://peek";

function call(command: string, args?: Record<string, unknown>): Promise<void> {
  return invoke<void>(command, args).catch((error: unknown) => {
    console.error(`[popup] ${command} failed`, error);
  });
}

export const popupWindow = {
  place: (width: number, height: number) =>
    call("popup_place", { width, height, inset: POPUP_INSET }),
  showPeek: () => call("popup_show_peek"),
  focus: () => call("popup_focus"),
  hide: () => call("popup_hide"),
};
