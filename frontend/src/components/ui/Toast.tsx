// ============================================================
// CompressKro — Toast Notification Component
// ============================================================

import React, { useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { Toast, ToastType } from '../../types';

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES: Record<ToastType, string> = {
  success: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/60',
  error: 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800/60',
  warning: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/60',
  info: 'bg-violet-50 border-violet-200 dark:bg-violet-950/40 dark:border-violet-800/60',
};

const ICON_STYLES: Record<ToastType, string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-violet-600 dark:text-violet-400',
};

const TITLE_STYLES: Record<ToastType, string> = {
  success: 'text-emerald-900 dark:text-emerald-100',
  error: 'text-red-900 dark:text-red-100',
  warning: 'text-amber-900 dark:text-amber-100',
  info: 'text-violet-900 dark:text-violet-100',
};

const MSG_STYLES: Record<ToastType, string> = {
  success: 'text-emerald-700 dark:text-emerald-300',
  error: 'text-red-700 dark:text-red-300',
  warning: 'text-amber-700 dark:text-amber-300',
  info: 'text-violet-700 dark:text-violet-300',
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const Icon = ICONS[toast.type];
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!progressRef.current || !toast.duration) return;
    const el = progressRef.current;
    el.style.transition = `width ${toast.duration}ms linear`;
    requestAnimationFrame(() => {
      el.style.width = '0%';
    });
  }, [toast.duration]);

  return (
    <div
      className={`relative flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-lg shadow-black/5 backdrop-blur-sm w-[340px] max-w-[90vw] overflow-hidden ${STYLES[toast.type]}`}
      style={{ animation: 'slideInToast 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}
    >
      {/* Progress bar */}
      {toast.duration && toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 h-[2px] bg-current opacity-20 w-full rounded-b-2xl">
          <div
            ref={progressRef}
            className="h-full bg-current opacity-60 rounded-b-2xl"
            style={{ width: '100%' }}
          />
        </div>
      )}

      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${ICON_STYLES[toast.type]}`} />

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-tight ${TITLE_STYLES[toast.type]}`}>
          {toast.title}
        </p>
        {toast.message && (
          <p className={`text-xs mt-0.5 leading-relaxed ${MSG_STYLES[toast.type]}`}>
            {toast.message}
          </p>
        )}
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        className={`flex-shrink-0 p-0.5 rounded-lg opacity-50 hover:opacity-100 transition-opacity ${ICON_STYLES[toast.type]}`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 items-end">
      <style>{`
        @keyframes slideInToast {
          from { opacity: 0; transform: translateX(100%) scale(0.9); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export default ToastContainer;
