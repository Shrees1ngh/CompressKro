// ============================================================
// CompressKro — useHistory Hook
// ============================================================

import { useState, useCallback } from 'react';
import type { HistoryEntry } from '../types';
import { StorageService } from '../services/storage.service';

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    StorageService.getHistory()
  );

  const refresh = useCallback(() => {
    setHistory(StorageService.getHistory());
  }, []);

  const addEntry = useCallback((entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
    StorageService.addHistoryEntry(entry);
    setHistory(StorageService.getHistory());
  }, []);

  const deleteEntry = useCallback((id: string) => {
    StorageService.deleteHistoryEntry(id);
    setHistory(prev => prev.filter(h => h.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    StorageService.clearHistory();
    setHistory([]);
  }, []);

  return { history, addEntry, deleteEntry, clearHistory, refresh };
}
