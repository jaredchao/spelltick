import { describe, expect, it } from "vitest";
import { formatShortcut } from "./shortcut";

describe("formatShortcut", () => {
  it("uses symbols on macOS", () => {
    expect(formatShortcut("CommandOrControl+Shift+E", "macos")).toBe("⌘⇧E");
  });

  it("uses Ctrl names on Windows", () => {
    expect(formatShortcut("CommandOrControl+Shift+A", "windows")).toBe("Ctrl+Shift+A");
  });

  it("handles the settings shortcut", () => {
    expect(formatShortcut("CommandOrControl+,", "macos")).toBe("⌘,");
    expect(formatShortcut("CommandOrControl+,", "windows")).toBe("Ctrl+,");
  });

  it("ignores stray whitespace", () => {
    expect(formatShortcut(" CommandOrControl + Shift + e ", "macos")).toBe("⌘⇧E");
  });
});
