import { useState, type KeyboardEvent } from "react";
import { acceleratorFromKey } from "../core/accelerator";
import { formatShortcut } from "../core/shortcut";
import { currentPlatform } from "../platform";
import styles from "./Settings.module.css";

/** Click, then press the new combination. Esc cancels. */
export function ShortcutRecorder({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (accelerator: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const platform = currentPlatform();

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!recording) return;
    event.preventDefault();
    if (event.key === "Escape") {
      setRecording(false);
      return;
    }
    const accelerator = acceleratorFromKey(event, platform);
    if (accelerator) {
      setRecording(false);
      if (accelerator !== value) onChange(accelerator);
    }
  };

  return (
    <button
      type="button"
      aria-label={label}
      className={recording ? styles.kbdRecording : styles.kbd}
      onClick={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={onKeyDown}
    >
      {recording ? "按下新的组合键…" : formatShortcut(value, platform)}
    </button>
  );
}
