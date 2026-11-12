import { describe, expect, it } from "vitest";
import { acceleratorFromKey, type KeyInfo } from "./accelerator";

const key = (code: string, mods: Partial<KeyInfo> = {}): KeyInfo => ({
  code,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("acceleratorFromKey", () => {
  it("maps ⌘⇧E on macOS", () => {
    expect(acceleratorFromKey(key("KeyE", { metaKey: true, shiftKey: true }), "macos")).toBe(
      "CommandOrControl+Shift+E",
    );
  });

  it("maps Ctrl+Shift+A on Windows", () => {
    expect(acceleratorFromKey(key("KeyA", { ctrlKey: true, shiftKey: true }), "windows")).toBe(
      "CommandOrControl+Shift+A",
    );
  });

  it("allows Alt combinations", () => {
    expect(acceleratorFromKey(key("Digit1", { altKey: true }), "windows")).toBe("Alt+1");
  });

  it("keeps Control as a separate modifier on macOS", () => {
    expect(acceleratorFromKey(key("KeyK", { ctrlKey: true }), "macos")).toBe("Control+K");
  });

  it("rejects keys without a modifier", () => {
    expect(acceleratorFromKey(key("KeyE"), "macos")).toBeNull();
    expect(acceleratorFromKey(key("KeyE", { shiftKey: true }), "macos")).toBeNull();
  });

  it("waits while only modifiers are pressed", () => {
    expect(acceleratorFromKey(key("ShiftLeft", { shiftKey: true, metaKey: true }), "macos")).toBeNull();
  });

  it("supports function keys", () => {
    expect(acceleratorFromKey(key("F9", { altKey: true }), "macos")).toBe("Alt+F9");
  });
});
