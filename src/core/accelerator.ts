import type { Platform } from "./shortcut";

export interface KeyInfo {
  readonly code: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

function keyName(code: string): string | null {
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1];
  const digit = /^Digit([0-9])$/.exec(code);
  if (digit) return digit[1];
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;
  if (code === "Space") return "Space";
  return null;
}

/**
 * Build a Tauri accelerator such as "CommandOrControl+Shift+E" from a key event.
 * Requires ⌘ (macOS) / Ctrl (Windows) or Alt, plus a letter, digit, F-key or Space.
 * Returns null while only modifiers are held or for unsupported keys.
 */
export function acceleratorFromKey(key: KeyInfo, platform: Platform): string | null {
  const name = keyName(key.code);
  if (!name) return null;
  const primary = platform === "macos" ? key.metaKey : key.ctrlKey;
  const extraControl = platform === "macos" && key.ctrlKey;
  if (!primary && !key.altKey && !extraControl) return null;
  const parts = [
    primary ? "CommandOrControl" : null,
    extraControl ? "Control" : null,
    key.altKey ? "Alt" : null,
    key.shiftKey ? "Shift" : null,
    name,
  ];
  return parts.filter(Boolean).join("+");
}
