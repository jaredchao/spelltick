import { useSkin } from "../skin/SkinContext";
import styles from "./Card.module.css";
import { SpeakerIcon } from "./icons";

/** Deck / quiz label plus the speak button; a window title bar in skins with `titleBar`. */
export function CardHeader({ meta, onSpeak }: { meta: string; onSpeak: () => void }) {
  const { layout } = useSkin();
  const speak = (
    <button
      type="button"
      className={layout.titleBar ? styles.iconButtonSmall : styles.iconButton}
      aria-label="播放发音"
      tabIndex={-1}
      onClick={onSpeak}
    >
      <SpeakerIcon />
    </button>
  );

  if (layout.titleBar) {
    return (
      <div className={styles.titleBar}>
        <span className={styles.lights} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className={styles.titleText}>{meta}</span>
        {speak}
      </div>
    );
  }
  return (
    <div className={styles.header}>
      <span className={styles.meta}>{meta}</span>
      {speak}
    </div>
  );
}
