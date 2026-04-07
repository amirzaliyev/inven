interface Props {
  id?: string;
  name?: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function DateInput({ id, name, value, onChange, className = "", disabled, placeholder }: Props) {
  // Replace `focus:` with `focus-within:` so wrapper reacts to the hidden input's focus
  const wrapperCls = className.replace(/\bfocus:/g, "focus-within:");

  return (
    <div className={`relative flex items-center gap-2 cursor-pointer ${wrapperCls}`}>
      {/* Calendar icon */}
      <svg
        className="w-3.5 h-3.5 text-bluegray-400 flex-shrink-0 pointer-events-none"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>

      {/* Displayed value */}
      <span
        className={`text-sm pointer-events-none select-none ${value ? "text-bluegray-800" : "text-bluegray-400"}`}
      >
        {value || placeholder || "yyyy-mm-dd"}
      </span>

      {/* Native input — invisible, covers the entire wrapper */}
      <input
        id={id}
        name={name}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="date-overlay absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
    </div>
  );
}
