// ============================================================
// CompressKro PDF Editor — Keyboard Shortcuts Hook
// ============================================================
// Global keyboard event handler for the PDF editor.
// Handles Ctrl+Z, Ctrl+Shift+Z, Delete, arrow nudging, etc.
// ============================================================

import { useEffect, useCallback } from 'react';
import { useEditorStore } from './useEditorStore';

/**
 * Registers global keyboard shortcuts for the PDF editor.
 * Must be called within an EditorProvider.
 */
export function useKeyboardShortcuts(): void {
  const {
    state,
    dispatch,
    undo,
    redo,
    deleteSelected,
    moveObjects,
  } = useEditorStore();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTextInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // ---- Undo: Ctrl+Z ----
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // ---- Redo: Ctrl+Shift+Z or Ctrl+Y ----
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y') && (e.shiftKey || e.key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }

      // The following shortcuts are disabled when editing text in an input
      if (isTextInput) return;

      // ---- Delete/Backspace: Remove selected objects ----
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selection.size > 0) {
          e.preventDefault();
          deleteSelected();
        }
        return;
      }

      // ---- Escape: Clear selection ----
      if (e.key === 'Escape') {
        dispatch({ type: 'CLEAR_SELECTION' });
        dispatch({ type: 'SET_EDITING_TEXT', payload: null });
        return;
      }

      // ---- Arrow keys: Nudge selected objects ----
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (state.selection.size === 0) return;

        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const moves: Array<{ id: string; oldBounds: any; newBounds: any }> = [];

        for (const id of state.selection) {
          const obj = state.objects.get(id);
          if (!obj) continue;

          const oldBounds = { ...obj.bounds };
          let dx = 0;
          let dy = 0;

          switch (e.key) {
            case 'ArrowLeft':
              dx = -step;
              break;
            case 'ArrowRight':
              dx = step;
              break;
            case 'ArrowUp':
              dy = step; // PDF Y-up
              break;
            case 'ArrowDown':
              dy = -step; // PDF Y-up
              break;
          }

          const newBounds = {
            ...oldBounds,
            x: oldBounds.x + dx,
            y: oldBounds.y + dy,
          };

          moves.push({ id, oldBounds, newBounds });
        }

        if (moves.length > 0) {
          moveObjects(moves);
        }
        return;
      }

      // ---- Select All: Ctrl+A ----
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        // Select all user-created objects on the current page
        const pageObjects = Array.from(state.objects.values()).filter(
          (obj) =>
            obj.pageIndex === state.currentPageIndex &&
            (obj.type !== 'text' || (obj as any).origin !== 'extracted' || (obj as any).isModified) &&
            (obj.type !== 'image' || (obj as any).origin !== 'extracted')
        );
        dispatch({
          type: 'SET_SELECTION',
          payload: new Set(pageObjects.map((o) => o.id)),
        });
        return;
      }
    },
    [state.selection, state.objects, state.currentPageIndex, undo, redo, deleteSelected, moveObjects, dispatch]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
