import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmContextValue = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ ...opts, resolve });
    });
  }, []);

  function handle(result: boolean) {
    resolveRef.current?.(result);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-bluegray-900/30 backdrop-blur-[2px]"
            onClick={() => handle(false)}
          />
          <div className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm">
            {state.title && (
              <h3 className="text-base font-bold text-bluegray-800 mb-2">{state.title}</h3>
            )}
            <p className="text-sm text-bluegray-600 leading-relaxed mb-7">{state.message}</p>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => handle(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-bluegray-600 border border-bluegray-200 hover:bg-bluegray-50 cursor-pointer transition-colors"
              >
                {state.cancelLabel ?? t("common.cancel")}
              </button>
              <button
                onClick={() => handle(true)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer transition-colors ${
                  state.danger
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-cyan-500 hover:bg-cyan-600"
                }`}
              >
                {state.confirmLabel ?? t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
