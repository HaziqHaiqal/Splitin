"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastInput = { message: string; action?: { label: string; onClick: () => void } };
type ToastState = ToastInput & { key: number };

const ToastContext = createContext<(toast: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((input: ToastInput) => {
    clearTimeout(timer.current);
    setToast({ ...input, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), input.action ? 6000 : 3000);
  }, []);

  return (
    <ToastContext value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[max(20px,env(safe-area-inset-bottom))]"
      >
        {toast ? (
          <div
            key={toast.key}
            className="pointer-events-auto flex w-full max-w-[358px] items-center justify-between rounded-[14px] bg-[#1c1f1d] px-[14px] py-3 text-[14px] text-white shadow-[0_8px_20px_rgba(0,0,0,0.25)]"
          >
            <span>{toast.message}</span>
            {toast.action ? (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
                className="h-8 bg-transparent px-[10px] text-[14px] font-extrabold text-[#7fe0ae]"
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ToastContext>
  );
}
