export type Platform = "macos" | "windows";

const MAC_SYMBOLS: Readonly<Record<string, string>> = {
  CommandOrControl: "⌘",
  Shift: "⇧",
  Alt: "⌥",
  Control: "⌃",
};

const WINDOWS_NAMES: Readonly<Record<string, string>> = {
  CommandOrControl: "Ctrl",
  Control: "Ctrl",
};

/**
 * Convert a Tauri accelerator (e.g. "CommandOrControl+Shift+E")
 * into a display label: "⌘⇧E" on macOS, "Ctrl+Shift+E" on Windows.
 */
export function formatShortcut(accelerator: string, platform: Platform): string {
  const parts = accelerator
    .split("+")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (platform === "macos") {
    return parts.map((part) => MAC_SYMBOLS[part] ?? part.toUpperCase()).join("");
  }
  return parts.map((part) => WINDOWS_NAMES[part] ?? part).join("+");
}
