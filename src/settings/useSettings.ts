import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { EVENT_SETTINGS_CHANGED, settingsApi } from "./api";
import { DEFAULT_SETTINGS, type Settings } from "./types";

/** Current settings, kept in sync across windows through the change event. */
export function useSettings(): Settings {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;
    settingsApi
      .get()
      .then((s) => active && setSettings(s))
      .catch((e: unknown) => console.error("[settings] load failed", e));
    const unlisten = listen<Settings>(EVENT_SETTINGS_CHANGED, (event) => setSettings(event.payload));
    return () => {
      active = false;
      void unlisten.then((fn) => fn());
    };
  }, []);

  return settings;
}
