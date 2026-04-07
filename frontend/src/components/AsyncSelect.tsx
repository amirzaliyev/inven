import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export interface SelectOption {
  value: number;
  label: string;
}

interface Props {
  value: number | "";
  onChange: (value: number | "") => void;
  fetchOptions: (search: string) => Promise<SelectOption[]>;
  placeholder?: string;
  /** Label for the currently selected value — needed when the parent knows it */
  displayValue?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
}

export function AsyncSelect({
  value,
  onChange,
  fetchOptions,
  placeholder,
  displayValue,
  className = "",
  disabled = false,
  clearable = true,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Keep fetchOptions stable inside effects without requiring parent to memoize
  const fetchRef = useRef(fetchOptions);
  fetchRef.current = fetchOptions;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function doFetch(q: string) {
    setLoading(true);
    try {
      const results = await fetchRef.current(q);
      setOptions(results);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }

  // On open: load initial options and auto-focus search
  useEffect(() => {
    if (!open) return;
    setSearch("");
    doFetch("");
    // Small timeout so the element is rendered before focusing
    setTimeout(() => searchRef.current?.focus(), 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleSearch(q: string) {
    setSearch(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doFetch(q), 280);
  }

  function handleSelect(opt: SelectOption) {
    onChange(opt.value);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Derive label for current value from loaded options if displayValue not given
  const selectedLabel =
    displayValue ??
    (value !== "" ? options.find((o) => o.value === value)?.label : undefined);

  const ph = placeholder ?? t("common.select");

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`flex items-center justify-between gap-2 text-left w-full cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      >
        <span className={`truncate text-sm ${selectedLabel ? "text-bluegray-800" : "text-bluegray-400"}`}>
          {selectedLabel ?? ph}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {clearable && value !== "" && (
            <span
              role="button"
              onClick={handleClear}
              className="text-bluegray-300 hover:text-bluegray-600 cursor-pointer leading-none"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
          <svg
            className={`w-4 h-4 text-bluegray-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 left-0 right-0 min-w-[200px] bg-white rounded-2xl shadow-xl border border-bluegray-100 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-bluegray-100">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={t("common.search") + "..."}
              className="w-full px-3 py-1.5 text-sm border border-bluegray-200 rounded-xl outline-none focus:border-cyan-400 bg-white"
            />
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-5 text-center text-xs text-bluegray-400">{t("common.loading")}</div>
            ) : options.length === 0 ? (
              <div className="px-3 py-5 text-center text-xs text-bluegray-400">{t("common.noResults")}</div>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={`w-full px-4 py-2 text-left text-sm cursor-pointer transition-colors ${
                    opt.value === value
                      ? "bg-cyan-50 text-cyan-700 font-medium"
                      : "text-bluegray-700 hover:bg-bluegray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
