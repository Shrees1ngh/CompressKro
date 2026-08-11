// ============================================================
// CompressKro — Storage Service
// Centralized localStorage abstraction. All reads/writes go
// through here — no scattered calls across components.
// ============================================================

import { STORAGE_KEYS, HISTORY_LIMIT } from '../constants';
import type { HistoryEntry, AppStats } from '../types';
import { bytesToMB } from '../utils/format';

class StorageServiceClass {
  // ---- History ----

  getHistory(): HistoryEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): void {
    try {
      const history = this.getHistory();
      const newEntry: HistoryEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
      };
      history.unshift(newEntry);
      localStorage.setItem(
        STORAGE_KEYS.HISTORY,
        JSON.stringify(history.slice(0, HISTORY_LIMIT))
      );
    } catch (e) {
      console.warn('[StorageService] Failed to write history:', e);
    }
  }

  deleteHistoryEntry(id: string): void {
    try {
      const history = this.getHistory().filter(h => h.id !== id);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch (e) {
      console.warn('[StorageService] Failed to delete history entry:', e);
    }
  }

  clearHistory(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
    } catch (e) {
      console.warn('[StorageService] Failed to clear history:', e);
    }
  }

  // ---- Statistics ----

  getStats(): AppStats {
    try {
      const filesProcessed = parseInt(
        localStorage.getItem(STORAGE_KEYS.STATS_FILES_PROCESSED) ?? '0'
      ) || 0;
      const mbSaved = parseFloat(
        localStorage.getItem(STORAGE_KEYS.STATS_MB_SAVED) ?? '0'
      ) || 0;
      return {
        filesProcessed,
        mbSaved,
        privacyScore: '100%',
      };
    } catch {
      return { filesProcessed: 0, mbSaved: 0, privacyScore: '100%' };
    }
  }

  updateStats(filesCount: number, savedBytes: number): void {
    try {
      const current = this.getStats();
      localStorage.setItem(
        STORAGE_KEYS.STATS_FILES_PROCESSED,
        (current.filesProcessed + filesCount).toString()
      );
      localStorage.setItem(
        STORAGE_KEYS.STATS_MB_SAVED,
        (current.mbSaved + bytesToMB(savedBytes)).toFixed(4)
      );
    } catch (e) {
      console.warn('[StorageService] Failed to update stats:', e);
    }
  }

  resetStats(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.STATS_FILES_PROCESSED);
      localStorage.removeItem(STORAGE_KEYS.STATS_MB_SAVED);
    } catch (e) {
      console.warn('[StorageService] Failed to reset stats:', e);
    }
  }

  // ---- Theme ----

  getTheme(): 'dark' | 'light' {
    try {
      return (localStorage.getItem(STORAGE_KEYS.THEME) as 'dark' | 'light') ?? 'light';
    } catch {
      return 'light';
    }
  }

  setTheme(theme: 'dark' | 'light'): void {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch (e) {
      console.warn('[StorageService] Failed to save theme:', e);
    }
  }
}

/** Singleton instance */
export const StorageService = new StorageServiceClass();
