import { useEffect, useRef, useState } from "react";

interface Props {
  id?: string;
  name?: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIso(s: string): boolean {
  if (!ISO_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00");
  return !Number.isNaN(d.getTime()) && s === d.toISOString().slice(0, 10);
}

export function DateInput({ id, name, value, onChange, className = "", disabled, placeholder }: Props) {
  const wrapperCls = className.replace(/\bfocus:/g, "focus-within:");
  const [text, setText] = useState(value);
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(value);
  }, [value]);

  function handleTextChange(v: string) {
    setText(v);
    if (v === "") onChange("");
    else if (isValidIso(v)) onChange(v);
  }

  function handleBlur() {
    if (text !== "" && !isValidIso(text)) setText(value);
  }

  function openPicker() {
    if (disabled) return;
    const el = pickerRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try { el.showPicker(); return; } catch { /* fallthrough */ }
    }
    el.focus();
    el.click();
  }

  return (
    <div className={`relative ${wrapperCls} flex items-center gap-2`}>
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        tabIndex={-1}
        aria-label="Open date picker"
        className="text-bluegray-400 hover:text-bluegray-600 cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder || "yyyy-mm-dd"}
        style={{ border: 0, outline: "none", boxShadow: "none", background: "transparent", padding: 0, margin: 0 }}
        className="flex-1 min-w-0 text-sm text-bluegray-800 placeholder:text-bluegray-400 disabled:cursor-not-allowed"
      />

      <input
        ref={pickerRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only pointer-events-none absolute right-0 bottom-0 w-0 h-0 opacity-0"
      />
    </div>
  );
}
