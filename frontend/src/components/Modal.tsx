import { useEffect, type ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "lg";
}

export function Modal({ open, onClose, title, children, size = "md" }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:items-center sm:pt-4">
      <div className="absolute inset-0 bg-bluegray-900/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative bg-white rounded-3xl shadow-2xl w-full ${size === "lg" ? "max-w-lg" : "max-w-md"}`}>
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-bluegray-100">
          <h2 className="text-base font-bold text-bluegray-800">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-bluegray-400 hover:text-bluegray-700 hover:bg-bluegray-50 cursor-pointer transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-7 py-6 overflow-y-auto max-h-[calc(100vh-10rem)]">{children}</div>
      </div>
    </div>
  );
}
