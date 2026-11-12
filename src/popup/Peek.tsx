import { formatShortcut } from "../core/shortcut";
import { currentPlatform } from "../platform";
import { useSkin } from "../skin/SkinContext";
import styles from "./Peek.module.css";

const SUMMON_ACCELERATOR = "CommandOrControl+Shift+E";

export function Peek({ onOpen }: { onOpen: () => void }) {
  const { copy } = useSkin();
  return (
    <button type="button" className={styles.peek} onClick={onOpen}>
      <span className={styles.marker} aria-hidden="true" />
      <span className={styles.label}>{copy.peek}</span>
      <kbd className={styles.kbd}>{formatShortcut(SUMMON_ACCELERATOR, currentPlatform())}</kbd>
    </button>
  );
}
