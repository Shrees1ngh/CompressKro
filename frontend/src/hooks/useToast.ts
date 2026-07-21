// ============================================================
// CompressKro — useToast Hook
// Beautiful toast notification system replacing browser alert()
// ============================================================

import { useState, useCallback } from 'react';
import type { Toast, ToastType } from '../types';

let toastIdCounter = 0;
const nextId = () => `toast-${++toastIdCounter}-${Date.now()}`;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback(
    (type: ToastType, title: string, message?: string, duration = 4500) => {
      const id = nextId();
      const toast: Toast = { id, type, title, message, duration };
      setToasts(prev => [...prev.slice(-4), toast]); // Keep max 5 toasts

      if (duration > 0) {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
      }
      return id;
    },
    []
  );

  const showSuccess = useCallback(
    (title: string, message?: string) => show('success', title, message),
    [show]
  );

  const showError = useCallback(
    (title: string, message?: string) => show('error', title, message, 6000),
    [show]
  );

  const showWarning = useCallback(
    (title: string, message?: string) => show('warning', title, message),
    [show]
  );

  const showInfo = useCallback(
    (title: string, message?: string) => show('info', title, message),
    [show]
  );

  const dismissAll = useCallback(() => setToasts([]), []);

  return { toasts, showSuccess, showError, showWarning, showInfo, dismiss, dismissAll };
}
