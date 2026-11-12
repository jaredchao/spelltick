import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { suggestMeaning } from "../ai/features";
import { useAiConfig } from "../ai/useAiConfig";
import type { Settings } from "../settings/types";
import styles from "./AddWord.module.css";

interface Pending {
  readonly term: string;
  readonly needsPermission: boolean;
}

const EVENT_OPEN = "addword://open";
const CLOSE_DELAY_MS = 700;

/** Small window for「加入生词」(SPEC 10). */
export function AddWordApp({ settings }: { settings: Settings }) {
  const ai = useAiConfig(settings.ai);
  const [pending, setPending] = useState<Pending>({ term: "", needsPermission: false });
  const [term, setTerm] = useState("");
  const [meaning, setMeaning] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const termRef = useRef<HTMLInputElement>(null);
  const meaningRef = useRef<HTMLInputElement>(null);

  const start = useCallback((p: Pending) => {
    setPending(p);
    setTerm(p.term);
    setMeaning("");
    setMessage(null);
    setRound((r) => r + 1);
  }, []);

  useEffect(() => {
    invoke<Pending>("addword_pending").then(start).catch(() => undefined);
    const unlisten = getCurrentWebviewWindow().listen<Pending>(EVENT_OPEN, (e) => start(e.payload));
    return () => void unlisten.then((fn) => fn());
  }, [start]);

  // Focus the first empty field each time the window opens.
  useEffect(() => {
    (pending.term ? meaningRef : termRef).current?.focus();
  }, [round, pending.term]);

  // With AI configured, fill in the meaning for the selected text.
  useEffect(() => {
    if (!ai || pending.term === "") return;
    let active = true;
    setAiBusy(true);
    suggestMeaning(ai, pending.term).then((m) => {
      if (!active) return;
      setAiBusy(false);
      if (m) setMeaning((current) => (current === "" ? m : current));
    });
    return () => {
      active = false;
    };
  }, [round, ai, pending.term]);

  const close = () => void invoke("addword_close");

  const save = async () => {
    if (term.trim() === "" || meaning.trim() === "") {
      setMessage("英文和中文释义都要填");
      return;
    }
    try {
      const added = await invoke<boolean>("addword_save", { term, meaning, example: null });
      setMessage(added ? "已加入「我的生词本」" : "生词本里已经有这个词了");
      window.setTimeout(close, CLOSE_DELAY_MS);
    } catch (e) {
      setMessage(String(e));
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      void save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  return (
    <div className={styles.root} onKeyDown={onKeyDown}>
      {pending.needsPermission && (
        <div className={styles.notice}>
          <div>读取选中的文字需要「辅助功能」权限。</div>
          <div>在系统设置里勾选「英语拼写」后，再按一次快捷键。现在也可以手动输入。</div>
          <button type="button" className={styles.link} onClick={() => void invoke("accessibility_open_settings")}>
            打开系统设置
          </button>
        </div>
      )}
      <label className={styles.field}>
        英文
        <input
          ref={termRef}
          className={styles.input}
          value={term}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setTerm(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>
          中文释义{ai && aiBusy && <span className={styles.muted}> · AI 生成中…</span>}
        </span>
        <input
          ref={meaningRef}
          className={styles.input}
          value={meaning}
          autoComplete="off"
          onChange={(e) => setMeaning(e.target.value)}
        />
      </label>
      <div className={styles.footer}>
        <span className={styles.muted}>{message ?? "Enter 保存 · Esc 取消"}</span>
        <div className={styles.buttons}>
          <button type="button" className={styles.secondary} onClick={close}>
            取消
          </button>
          <button type="button" className={styles.primary} onClick={() => void save()}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
