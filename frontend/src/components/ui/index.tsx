import { useEffect, type ReactNode, type ButtonHTMLAttributes } from "react";

/* ───────────── PageHead ───────────── */
export function PageHead({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="page-head-text">
        <h1>{title}</h1>
        {subtitle && <p className="sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </div>
  );
}

/* ───────────── Button ───────────── */
type BtnVariant = "primary" | "outline" | "ghost" | "danger" | "success" | "warn";
type BtnSize = "sm" | "md" | "lg";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }) {
  const cls = `btn btn-${variant}${size !== "md" ? ` btn-${size}` : ""} ${className}`.trim();
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

/* ───────────── Searchbar ───────────── */
export function Searchbar({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`searchbar ${className}`}>
      <svg className="w-[18px] h-[18px] text-bluegray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear"
          onClick={() => onChange("")}
          className="text-bluegray-400 hover:text-bluegray-700 cursor-pointer"
          style={{ background: "none", border: "none", padding: 0 }}
        >
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ───────────── FilterChip ───────────── */
export function FilterChip({
  active,
  count,
  children,
  onClick,
}: {
  active?: boolean;
  count?: number;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className={`chip${active ? " active" : ""}`} onClick={onClick}>
      {children}
      {typeof count === "number" && <span className="count">{count}</span>}
    </button>
  );
}

/* ───────────── ListRow ───────────── */
export function ListRow({
  avatar,
  title,
  subtitle,
  metric,
  onClick,
  trailing,
}: {
  avatar?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  metric?: { value: ReactNode; unit?: ReactNode };
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`row ${onClick ? "" : "row-static"}`}
      onClick={onClick as never}
    >
      {avatar && <div className="row-avatar">{avatar}</div>}
      <div className="row-body">
        <div className="row-title">{title}</div>
        {subtitle && <div className="row-sub">{subtitle}</div>}
      </div>
      {metric && (
        <div className="row-metric">
          <div className="num">{metric.value}</div>
          {metric.unit && <div className="unit">{metric.unit}</div>}
        </div>
      )}
      {trailing}
    </Tag>
  );
}

/* ───────────── EmptyState ───────────── */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon && <div className="illo">{icon}</div>}
      <div className="empty-title">{title}</div>
      {description && <div className="empty-sub">{description}</div>}
      {action}
    </div>
  );
}

/* ───────────── StatusPill ───────────── */
export type StatusVariant = "success" | "warn" | "info" | "danger" | "neutral";
export function StatusPill({ variant = "neutral", children }: { variant?: StatusVariant; children: ReactNode }) {
  return (
    <span className={`status-pill ${variant}`}>
      <span className="dot" />
      {children}
    </span>
  );
}

/* ───────────── BottomSheet ───────────── */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`sheet-scrim${open ? " open" : ""}`} onClick={onClose} />
      <div className={`sheet${open ? " open" : ""}`} role="dialog" aria-modal="true">
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="sheet-grabber" />
        {title && <h3 className="sheet-title">{title}</h3>}
        {children}
      </div>
    </>
  );
}

/* ───────────── Modal (centered) ───────────── */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-body" onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="modal-head">
            <h2>{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer text-bluegray-400 hover:text-bluegray-700"
              style={{ background: "none", border: "none", padding: 4 }}
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="px-5 py-5">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ───────────── FAB ───────────── */
export function FAB({
  onClick,
  label,
  icon,
}: {
  onClick: () => void;
  label?: string;
  icon?: ReactNode;
}) {
  const defaultIcon = (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
  return (
    <button
      type="button"
      onClick={onClick}
      className={`fab${label ? " extended" : ""} md:hidden`}
      aria-label={label ?? "Add"}
    >
      {icon ?? defaultIcon}
      {label && <span>{label}</span>}
    </button>
  );
}

/* ───────────── SegmentedControl ───────────── */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`segmented-item${value === o.value ? " active" : ""}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────── ListCard wrapper ───────────── */
export function ListCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`list-card ${className}`.trim()}>{children}</div>;
}

/* ───────────── SectionHead ───────────── */
export function SectionHead({
  title,
  action,
}: {
  title: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

/* ───────────── Initials avatar helper ───────────── */
export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/* ───────────── Currency / number formatting ───────────── */
export const fmtNum = (n: number | string) =>
  Number(n).toLocaleString("en-US");
export const fmtMoney = (n: number | string) =>
  Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
