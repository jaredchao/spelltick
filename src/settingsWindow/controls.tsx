import { useEffect, useState, type ReactNode } from "react";
import styles from "./Settings.module.css";

export function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {title}
        {note && <span className={styles.sectionNote}>{note}</span>}
      </h2>
      {children}
    </section>
  );
}

export function Row({ label, children, error }: { label: ReactNode; children?: ReactNode; error?: string | null }) {
  return (
    <div className={styles.rowWrap}>
      <div className={styles.row}>
        <span className={styles.rowLabel}>{label}</span>
        {children}
      </div>
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}

export function Check({
  label,
  checked,
  onChange,
  boxed = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  boxed?: boolean;
}) {
  return (
    <label className={boxed ? styles.checkBoxed : styles.check}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className={styles.segmented}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          className={o.value === value ? styles.segmentOn : styles.segment}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Number field that commits on blur or Enter, clamped to [min, max]. */
export function NumberField({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const n = Math.round(Number(draft));
    if (!Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <input
      type="number"
      aria-label={label}
      className={styles.number}
      value={draft}
      min={min}
      max={max}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
    />
  );
}

export function Button({
  children,
  onClick,
  primary = false,
  danger = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const cls = primary ? styles.buttonPrimary : danger ? styles.buttonDanger : styles.button;
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
