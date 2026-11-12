import type { Platform } from "./core/shortcut";

export function currentPlatform(): Platform {
  return /Mac/i.test(navigator.userAgent) ? "macos" : "windows";
}
