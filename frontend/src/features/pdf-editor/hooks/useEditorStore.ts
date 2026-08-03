// ============================================================
// CompressKro PDF Editor — Editor Store (useReducer + Context)
// ============================================================
// Central state management for the PDF editor.
// Uses React's useReducer for predictable state transitions
// and Context for dependency injection into child components.
// ============================================================

import React, { createContext, useContext, useReducer, useRef, useCallback, useMemo } from 'react';
import type {
  EditorState,
  EditorAction,
  EditorObject,
  Bounds,
} from '../core/types';
import { HistoryEngine, InsertObjectsCommand, DeleteObjectsCommand, MoveObjectsCommand, ResizeObjectCommand, EditTextCommand } from '../history/HistoryEngine';
import type { Command } from '../history/HistoryEngine';

// ---- Initial State ----

const initialState: EditorState = {
  document: null,
  objects: new Map(),
  selection: new Set(),
  activeTool: 'select',
  zoom: 1.0,
  currentPageIndex: 0,
  isLoading: false,
  isExporting: false,
  progressMessage: '',
  editingTextId: null,
};

// ---- Reducer ----

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_DOCUMENT': {
      const doc = action.payload;
      // Populate objects map from parsed page data
      const objects = new Map<string, EditorObject>();
      for (const page of doc.pages) {
        for (const text of page.textObjects) {
          objects.set(text.id, text);
        }
        for (const img of page.imageObjects) {
          objects.set(img.id, img);
        }
      }
      return {
        ...state,
        document: doc,
        objects,
        selection: new Set(),
        currentPageIndex: 0,
        isLoading: false,
        progressMessage: '',
        editingTextId: null,
      };
    }

    case 'RESET':
      return { ...initialState };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload.isLoading,
        progressMessage: action.payload.message || '',
      };

    case 'SET_EXPORTING':
      return {
        ...state,
        isExporting: action.payload.isExporting,
        progressMessage: action.payload.message || '',
      };

    case 'SET_TOOL':
      return { ...state, activeTool: action.payload, editingTextId: null };

    case 'SET_ZOOM':
      return { ...state, zoom: action.payload };

    case 'SET_CURRENT_PAGE':
      return { ...state, currentPageIndex: action.payload };

    case 'SET_EDITING_TEXT':
      return { ...state, editingTextId: action.payload };

    case 'INSERT_OBJECT': {
      const next = new Map(state.objects);
      next.set(action.payload.id, action.payload);
      return { ...state, objects: next };
    }

    case 'INSERT_OBJECTS': {
      const next = new Map(state.objects);
      for (const obj of action.payload) {
        next.set(obj.id, obj);
      }
      return { ...state, objects: next };
    }

    case 'DELETE_OBJECT': {
      const next = new Map(state.objects);
      next.delete(action.payload);
      const sel = new Set(state.selection);
      sel.delete(action.payload);
      return { ...state, objects: next, selection: sel };
    }

    case 'DELETE_OBJECTS': {
      const next = new Map(state.objects);
      const sel = new Set(state.selection);
      for (const id of action.payload) {
        next.delete(id);
        sel.delete(id);
      }
      return { ...state, objects: next, selection: sel };
    }

    case 'UPDATE_OBJECT': {
      const { id, changes } = action.payload;
      const existing = state.objects.get(id);
      if (!existing) return state;
      const next = new Map(state.objects);
      next.set(id, { ...existing, ...changes } as EditorObject);
      return { ...state, objects: next };
    }

    case 'UPDATE_OBJECTS': {
      const next = new Map(state.objects);
      for (const { id, changes } of action.payload) {
        const existing = next.get(id);
        if (existing) {
          next.set(id, { ...existing, ...changes } as EditorObject);
        }
      }
      return { ...state, objects: next };
    }

    case 'SET_SELECTION':
      return { ...state, selection: action.payload };

    case 'ADD_TO_SELECTION': {
      const sel = new Set(state.selection);
      sel.add(action.payload);
      return { ...state, selection: sel };
    }

    case 'REMOVE_FROM_SELECTION': {
      const sel = new Set(state.selection);
      sel.delete(action.payload);
      return { ...state, selection: sel };
    }

    case 'CLEAR_SELECTION':
      return { ...state, selection: new Set(), editingTextId: null };

    case 'REPLACE_ALL_OBJECTS':
      return { ...state, objects: action.payload };

    default:
      return state;
  }
}

// ---- Context Types ----

interface EditorContextValue {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  /** History engine instance. */
  history: HistoryEngine;

  // ---- Convenience Actions ----
  /** Execute a command and push it to history. */
  executeCommand: (command: Command) => void;
  /** Undo the last command. */
  undo: () => void;
  /** Redo the last undone command. */
  redo: () => void;
  /** Insert object(s) with undo support. */
  insertObjects: (objects: EditorObject[]) => void;
  /** Delete selected objects with undo support. */
  deleteSelected: () => void;
  /** Delete specific objects with undo support. */
  deleteObjects: (ids: string[]) => void;
  /** Move objects with undo support. */
  moveObjects: (moves: Array<{ id: string; oldBounds: Bounds; newBounds: Bounds }>) => void;
  /** Resize an object with undo support. */
  resizeObject: (id: string, oldBounds: Bounds, newBounds: Bounds) => void;
  /** Edit text with undo support. */
  editText: (id: string, oldText: string, newText: string) => void;

  // ---- Selectors ----
  /** Get objects for a specific page. */
  getPageObjects: (pageIndex: number) => EditorObject[];
  /** Get the currently selected objects. */
  getSelectedObjects: () => EditorObject[];
}

const EditorContext = createContext<EditorContextValue | null>(null);

// ---- Provider ----

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, initialState);
  const historyRef = useRef(new HistoryEngine());

  const executeCommand = useCallback((command: Command) => {
    const newObjects = command.execute(state.objects);
    dispatch({ type: 'REPLACE_ALL_OBJECTS', payload: newObjects });
    historyRef.current.push(command);
  }, [state.objects]);

  const undo = useCallback(() => {
    const result = historyRef.current.undo(state.objects);
    if (result) {
      dispatch({ type: 'REPLACE_ALL_OBJECTS', payload: result });
      dispatch({ type: 'CLEAR_SELECTION' });
    }
  }, [state.objects]);

  const redo = useCallback(() => {
    const result = historyRef.current.redo(state.objects);
    if (result) {
      dispatch({ type: 'REPLACE_ALL_OBJECTS', payload: result });
      dispatch({ type: 'CLEAR_SELECTION' });
    }
  }, [state.objects]);

  const insertObjects = useCallback((objects: EditorObject[]) => {
    const cmd = new InsertObjectsCommand(objects);
    executeCommand(cmd);
  }, [executeCommand]);

  const deleteSelected = useCallback(() => {
    const selected = Array.from(state.selection)
      .map((id) => state.objects.get(id))
      .filter((obj): obj is EditorObject => obj !== undefined);
    if (selected.length === 0) return;
    const cmd = new DeleteObjectsCommand(selected);
    executeCommand(cmd);
    dispatch({ type: 'CLEAR_SELECTION' });
  }, [state.selection, state.objects, executeCommand]);

  const deleteObjects = useCallback((ids: string[]) => {
    const objects = ids
      .map((id) => state.objects.get(id))
      .filter((obj): obj is EditorObject => obj !== undefined);
    if (objects.length === 0) return;
    const cmd = new DeleteObjectsCommand(objects);
    executeCommand(cmd);
  }, [state.objects, executeCommand]);

  const moveObjects = useCallback((moves: Array<{ id: string; oldBounds: Bounds; newBounds: Bounds }>) => {
    const cmd = new MoveObjectsCommand(moves);
    executeCommand(cmd);
  }, [executeCommand]);

  const resizeObject = useCallback((id: string, oldBounds: Bounds, newBounds: Bounds) => {
    const cmd = new ResizeObjectCommand(id, oldBounds, newBounds);
    executeCommand(cmd);
  }, [executeCommand]);

  const editText = useCallback((id: string, oldText: string, newText: string) => {
    const cmd = new EditTextCommand(id, oldText, newText);
    executeCommand(cmd);
  }, [executeCommand]);

  // ---- Selectors ----

  const getPageObjects = useCallback((pageIndex: number): EditorObject[] => {
    const result: EditorObject[] = [];
    for (const obj of state.objects.values()) {
      if (obj.pageIndex === pageIndex) {
        result.push(obj);
      }
    }
    return result.sort((a, b) => a.zIndex - b.zIndex);
  }, [state.objects]);

  const getSelectedObjects = useCallback((): EditorObject[] => {
    return Array.from(state.selection)
      .map((id) => state.objects.get(id))
      .filter((obj): obj is EditorObject => obj !== undefined);
  }, [state.selection, state.objects]);

  const value = useMemo<EditorContextValue>(() => ({
    state,
    dispatch,
    history: historyRef.current,
    executeCommand,
    undo,
    redo,
    insertObjects,
    deleteSelected,
    deleteObjects,
    moveObjects,
    resizeObject,
    editText,
    getPageObjects,
    getSelectedObjects,
  }), [
    state,
    executeCommand,
    undo,
    redo,
    insertObjects,
    deleteSelected,
    deleteObjects,
    moveObjects,
    resizeObject,
    editText,
    getPageObjects,
    getSelectedObjects,
  ]);

  return React.createElement(EditorContext.Provider, { value }, children);
}

// ---- Hook ----

/**
 * Access the editor store from any child component.
 * Must be used within an <EditorProvider>.
 */
export function useEditorStore(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) {
    throw new Error('useEditorStore must be used within an EditorProvider');
  }
  return ctx;
}
