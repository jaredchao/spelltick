import { ask, save, open } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { settingsApi } from "../settings/api";
import type { Settings, ShortcutStatus, SkinChoice } from "../settings/types";
import { skins, SKIN_IDS, type SkinId } from "../skin/skins";
import { Button, Check, Row, Section } from "./controls";
import { ShortcutRecorder } from "./ShortcutRecorder";
import styles from "./Settings.module.css";

interface Props {
  readonly settings: Settings;
  readonly update: (next: Settings) => Promise<ShortcutStatus | null>;
}

function SkinSwatch({ id }: { id: SkinId }) {
  const t = skins[id].tokens;
  return (
    <span className={styles.swatch} style={{ background: t["--bg-backdrop"] }}>
      <span
        className={styles.swatchCard}
        style={{ background: t["--bg-card"], borderColor: t["--border"], borderRadius: t["--radius-control"] }}
      >
        <span className={styles.swatchBar} style={{ background: t["--accent"] }} />
      </span>
    </span>
  );
}

const SKIN_OPTIONS: readonly { id: SkinChoice; name: string }[] = [
  ...SKIN_IDS.map((id) => ({ id, name: skins[id].name })),
  { id: "system", name: "跟随系统" },
];

export function GeneralTab({ settings, update }: Props) {
  const [status, setStatus] = useState<ShortcutStatus>({ summonError: null, addWordError: null });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    settingsApi.shortcutStatus().then(setStatus).catch(() => undefined);
  }, []);

  const setShortcut = async (key: "summonShortcut" | "addWordShortcut", value: string) => {
    const result = await update({ ...settings, [key]: value });
    if (result) setStatus(result);
  };

  const exportProgress = async () => {
    const path = await save({
      defaultPath: "english-spell-progress.json",
      filters: [{ name: "学习进度", extensions: ["json"] }],
    });
    if (!path) return;
    try {
      await settingsApi.exportProgress(path);
      setMessage("已导出");
    } catch (e) {
      setMessage(`导出失败：${String(e)}`);
    }
  };

  const importProgress = async () => {
    const path = await open({ multiple: false, filters: [{ name: "学习进度", extensions: ["json"] }] });
    if (typeof path !== "string") return;
    const ok = await ask("导入会覆盖当前的学习进度、自建词库和设置。确定导入吗？", {
      title: "导入学习进度",
      kind: "warning",
      okLabel: "覆盖并导入",
      cancelLabel: "取消",
    });
    if (!ok) return;
    try {
      await settingsApi.importProgress(path);
      setMessage("已导入");
    } catch (e) {
      setMessage(`导入失败：${String(e)}`);
    }
  };

  return (
    <>
      <Section title="皮肤">
        <div className={styles.skinGrid}>
          {SKIN_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={settings.skin === option.id}
              className={settings.skin === option.id ? styles.skinOn : styles.skinCard}
              onClick={() => void update({ ...settings, skin: option.id })}
            >
              {option.id === "system" ? (
                <span className={styles.swatchSplit}>
                  <SkinSwatch id="native" />
                  <SkinSwatch id="terminal" />
                </span>
              ) : (
                <SkinSwatch id={option.id} />
              )}
              <span>
                {option.name}
                {settings.skin === option.id ? " ✓" : ""}
              </span>
            </button>
          ))}
        </div>
        <div className={styles.hintText}>「跟随系统」：浅色用原生极简，深色用终端代码</div>
      </Section>

      <div className={styles.divider} />

      <Section title="快捷键">
        <Row label="唤出答题" error={status.summonError}>
          <ShortcutRecorder
            label="唤出答题快捷键"
            value={settings.summonShortcut}
            onChange={(v) => void setShortcut("summonShortcut", v)}
          />
        </Row>
        <Row label="选中文字加入生词本" error={status.addWordError}>
          <ShortcutRecorder
            label="加入生词快捷键"
            value={settings.addWordShortcut}
            onChange={(v) => void setShortcut("addWordShortcut", v)}
          />
        </Row>
      </Section>

      <div className={styles.divider} />

      <Section title="启动与数据">
        <Row label="开机自动启动">
          <Check
            label=""
            checked={settings.autostart}
            onChange={(autostart) => void update({ ...settings, autostart })}
          />
        </Row>
        <Row label="学习进度（换电脑时用）">
          <div className={styles.buttons}>
            <Button onClick={() => void importProgress()}>导入</Button>
            <Button onClick={() => void exportProgress()}>导出</Button>
          </div>
        </Row>
        {message && <div className={styles.hintText}>{message}</div>}
      </Section>
    </>
  );
}
