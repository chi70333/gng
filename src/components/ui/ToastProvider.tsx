'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastVariant = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  action?: {
    label: string;
    onClick: () => void;
  };
};

type ToastInput = Omit<Toast, 'id' | 'variant'> & {
  variant?: ToastVariant;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const iconByVariant = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ variant = 'info', ...toast }: ToastInput) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => [...current, { ...toast, variant, id }].slice(-3));
      window.setTimeout(() => removeToast(id), 4200);
    },
    [removeToast],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-4 z-50 flex flex-col gap-2 sm:left-auto sm:right-4 sm:w-96"
      >
        {toasts.map((toast) => {
          const Icon = iconByVariant[toast.variant];
          return (
            <div
              key={toast.id}
              className="pointer-events-auto flex min-h-14 items-start gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm shadow-lg shadow-neutral-900/10"
            >
              <Icon
                size={20}
                className={cn(
                  'mt-0.5 shrink-0',
                  toast.variant === 'success' && 'text-emerald-600',
                  toast.variant === 'error' && 'text-red-600',
                  toast.variant === 'info' && 'text-neutral-700',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-neutral-900">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 text-xs leading-5 text-neutral-500">{toast.description}</p>
                )}
                {toast.action && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick();
                      removeToast(toast.id);
                    }}
                    className="mt-2 inline-flex min-h-11 items-center text-xs font-semibold text-neutral-900 underline"
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                aria-label="알림 닫기"
                onClick={() => removeToast(toast.id)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider.');
  }
  return context;
}
