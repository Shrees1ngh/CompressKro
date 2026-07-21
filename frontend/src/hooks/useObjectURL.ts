// ============================================================
// CompressKro — useObjectURL Hook
// Manages object URLs with automatic cleanup on unmount.
// Prevents memory leaks from forgotten URL.revokeObjectURL() calls.
// ============================================================

import { useRef, useCallback, useEffect } from 'react';

export function useObjectURL() {
  const urls = useRef<Set<string>>(new Set());

  /** Creates an object URL and tracks it for cleanup */
  const createURL = useCallback((blob: Blob | MediaSource): string => {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return url;
  }, []);

  /** Revokes a specific object URL and removes it from tracking */
  const revokeURL = useCallback((url: string) => {
    if (url && urls.current.has(url)) {
      URL.revokeObjectURL(url);
      urls.current.delete(url);
    }
  }, []);

  /** Revokes all tracked object URLs */
  const revokeAll = useCallback(() => {
    urls.current.forEach(url => URL.revokeObjectURL(url));
    urls.current.clear();
  }, []);

  /** Auto-cleanup on component unmount */
  useEffect(() => {
    return () => {
      urls.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  return { createURL, revokeURL, revokeAll };
}
