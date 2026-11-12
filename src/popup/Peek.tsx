import { formatShortcut } from "../core/shortcut";
import { currentPlatform } from "../platform";
import { useSkin } from "../skin/SkinContext";
import styles from "./Peek.module.css";

function Marker({ kind }: { kind: "dot" | "chevron" | "tile" }) {
  if (kind === "chevron") return <span className={styles.chevron}>❯</span>;
  if (kind === "tile") return <span className={styles.tile}>A</span>;
  return <span className={styles.dot} />;
}

export function Peek({ shortcut, onOpen }: { shortcut: string; onOpen: () => void }) {
  const { copy, layout } = useSkin();
  return (
    <button type="button" className={styles.peek} onClick={onOpen}>
      <span aria-hidden="true" className={styles.markerWrap}>
        <Marker kind={layout.peekMarker} />
      </span>
      <span className={styles.label}>{copy.peek}</span>
      <kbd className={styles.kbd}>{formatShortcut(shortcut, currentPlatform())}</kbd>
    </button>
  );
}
