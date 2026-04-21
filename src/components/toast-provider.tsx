import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn';

type ToastTone = 'success' | 'error' | 'warning' | 'info';

type ToastItem = {
  id: number;
  tone: ToastTone;
  text: string;
};

type ToastApi = {
  success: (text: string) => void;
  error: (text: string) => void;
  warning: (text: string) => void;
  info: (text: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((tone: ToastTone, text: string) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, tone, text }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (text) => push('success', text),
      error: (text) => push('error', text),
      warning: (text) => push('warning', text),
      info: (text) => push('info', text),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined'
        ? createPortal(
            <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-full max-w-sm flex-col gap-3">
              {toasts.map((toast) => (
                <div
                  key={toast.id}
                  className={cn(
                    'pointer-events-auto rounded-md border px-4 py-3 text-sm font-medium shadow-[0_16px_40px_rgba(15,23,42,0.16)] backdrop-blur',
                    toast.tone === 'success' && 'border-emerald-200 bg-emerald-50/95 text-emerald-700',
                    toast.tone === 'error' && 'border-red-200 bg-red-50/95 text-red-700',
                    toast.tone === 'warning' && 'border-amber-200 bg-amber-50/95 text-amber-700',
                    toast.tone === 'info' && 'border-slate-200 bg-white/95 text-slate-700',
                  )}
                >
                  {toast.text}
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);

  if (!value) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return value;
}
