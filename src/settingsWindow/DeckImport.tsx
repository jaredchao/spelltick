import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { deckNameFromPath, parseDeckFile, type ImportPreview } from "../core/deckImport";
import { settingsApi } from "../settings/api";
import { Button } from "./controls";
import styles from "./Settings.module.css";

interface Pending {
  readonly name: string;
  readonly preview: ImportPreview;
}

const MAX_ERRORS_SHOWN = 20;

function summary(p: ImportPreview): string {
  const lines = p.errors.map((e) => e.line);
  const shown = lines.slice(0, MAX_ERRORS_SHOWN).join("、");
  const more = lines.length > MAX_ERRORS_SHOWN ? " 等" : "";
  const errorText = lines.length > 0 ? `，有 ${lines.length} 行格式错误（第 ${shown}${more} 行）` : "，没有格式错误";
  return `共 ${p.items.length} 条，其中单词 ${p.words}、句子 ${p.sentences}${errorText}`;
}

/** CSV / TXT import with preview and error line numbers (SPEC 7.2). */
export function DeckImport({ onDone }: { onDone: () => void }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const choose = async () => {
    setMessage(null);
    const path = await open({ multiple: false, filters: [{ name: "词库", extensions: ["csv", "txt"] }] });
    if (typeof path !== "string") return;
    try {
      const text = await settingsApi.readTextFile(path);
      setPending({ name: deckNameFromPath(path), preview: parseDeckFile(text) });
    } catch (e) {
      setMessage(String(e));
    }
  };

  const confirm = async () => {
    if (!pending) return;
    try {
      const inserted = await settingsApi.importDeck(pending.name, pending.preview.items);
      setMessage(`已导入 ${inserted} 条到「${pending.name.trim()}」`);
      setPending(null);
      onDone();
    } catch (e) {
      setMessage(`导入失败：${String(e)}`);
    }
  };

  if (!pending) {
    return (
      <div className={styles.importRow}>
        <Button onClick={() => void choose()}>导入 .csv / .txt</Button>
        <span className={styles.hintText}>每行：英文, 中文释义, 例句(可选)</span>
        {message && <span className={styles.hintText}>{message}</span>}
      </div>
    );
  }

  const { preview } = pending;
  return (
    <div className={styles.importPanel}>
      <div>{summary(preview)}</div>
      {preview.duplicates.length > 0 && (
        <div className={styles.hintText}>另有 {preview.duplicates.length} 行与前面重复，已忽略</div>
      )}
      {preview.errors.length > 0 && (
        <ul className={styles.errorList}>
          {preview.errors.slice(0, MAX_ERRORS_SHOWN).map((e) => (
            <li key={`${e.line}-${e.reason}`}>
              第 {e.line} 行：{e.reason}
            </li>
          ))}
        </ul>
      )}
      <label className={styles.importName}>
        词库名
        <input
          className={styles.text}
          value={pending.name}
          onChange={(e) => setPending({ ...pending, name: e.target.value })}
        />
      </label>
      <div className={styles.buttons}>
        <Button primary disabled={preview.items.length === 0 || pending.name.trim() === ""} onClick={() => void confirm()}>
          确认导入
        </Button>
        <Button onClick={() => setPending(null)}>取消</Button>
      </div>
    </div>
  );
}
