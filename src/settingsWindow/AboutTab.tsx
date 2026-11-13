import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { Section } from "./controls";
import styles from "./Settings.module.css";

export function AboutTab() {
  const [version, setVersion] = useState("");
  useEffect(() => {
    getVersion().then(setVersion).catch(() => undefined);
  }, []);

  return (
    <Section title="关于">
      <div className={styles.about}>
        <div className={styles.aboutName}>拼刻 Spelltick {version && <span className={styles.hintText}>v{version}</span>}</div>
        <p>办公时不定时弹出一张小卡片，拼一个英文单词或句子。</p>
        <p>所有数据只存在这台电脑上，不需要账号。</p>
        <p className={styles.hintText}>
          四六级词库来自 ECDICT（MIT 协议）。字体 Inter、JetBrains Mono、Source Serif 4 使用 SIL Open Font
          License。
        </p>
      </div>
    </Section>
  );
}
