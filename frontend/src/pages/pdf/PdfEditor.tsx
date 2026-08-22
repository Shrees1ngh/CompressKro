// ============================================================
// CompressKro — PDF Editor Page (Refactored Thin Shell)
// ============================================================
// This is the page-level component that orchestrates all editor
// modules. It is intentionally thin — all logic lives in the
// feature modules under features/pdf-editor/.
// ============================================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Upload, RefreshCw, PenTool, Sparkles, ShieldCheck, GripVertical, ChevronUp, ChevronDown, X, AlertTriangle,
  ZoomIn, ZoomOut, Maximize2,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { usePdfWorkspace } from '../../context/PdfWorkspaceContext';
import { PdfTaskCompleted } from '../../components/PdfWorkspaceShell/PdfTaskCompleted';
import { HowToUse } from '../../components/ui/HowToUse';

// PDF Editor feature modules
import type {
  ParsedDocument,
  EditorObject,
  TextObject,
  ImageObject,
  ShapeObject,
  FreehandObject,
  ToolType,
  ResizeHandle,
  Bounds,
  Point,
} from '../../features/pdf-editor/core/types';
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_TEXT_COLOR,
  DEFAULT_SHAPE_STROKE_COLOR,
  DEFAULT_SHAPE_STROKE_WIDTH,
} from '../../features/pdf-editor/core/constants';
import { generateId } from '../../features/pdf-editor/core/id';
import { parsePdf } from '../../features/pdf-editor/parser/PdfParser';
import { exportPdf } from '../../features/pdf-editor/exporter/PdfExporter';
import {
  HistoryEngine,
  InsertObjectsCommand,
  DeleteObjectsCommand,
  MoveObjectsCommand,
  EditTextCommand,
  EditPropertyCommand,
} from '../../features/pdf-editor/history/HistoryEngine';
import { viewportRectToPdfBounds } from '../../features/pdf-editor/utils/geometry';
import { PageCanvas } from '../../features/pdf-editor/components/PageCanvas';
import { EditorToolbar } from '../../features/pdf-editor/components/EditorToolbar';
import { SignatureModal } from '../../features/pdf-editor/components/SignatureModal';
import { getStandardFontKey, getCssFontFamily } from '../../features/pdf-editor/utils/font';
import type { FontProperties } from '../../features/pdf-editor/core/types';

// ============================================================
// PdfEditor Page Component
// ============================================================

export function PdfEditor() {
  const { activeFile, activeFileName, activeFileSize, chainOutput } = usePdfWorkspace();
  // ---- Document State ----
  const [document, setDocument] = useState<ParsedDocument | null>(null);
  const [objects, setObjects] = useState<Map<string, EditorObject>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [editorLoadedFile, setEditorLoadedFile] = useState<File | Blob | null>(null);

  // ---- Selection & Editing ----
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // ---- Tool Properties ----
  const [textColor, setTextColor] = useState(DEFAULT_TEXT_COLOR);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [fontName, setFontName] = useState('Helvetica');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [shapeColor, setShapeColor] = useState(DEFAULT_SHAPE_STROKE_COLOR);
  const [shapeFill, setShapeFill] = useState(false);
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState(DEFAULT_SHAPE_STROKE_WIDTH);

  // ---- Modals ----
  const [signModalOpen, setSignModalOpen] = useState(false);

  // ---- Output ----
  const [outputUrl, setOutputUrl] = useState('');
  const [outputSize, setOutputSize] = useState(0);
  const [outputName, setOutputName] = useState('');
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  // ---- OCR Option (Phase 4) ----
  const [doOcr, setDoOcr] = useState(true);
  const [showOcrWarning, setShowOcrWarning] = useState(false);
  const [dontShowOcrWarningAgain, setDontShowOcrWarningAgain] = useState(false);

  // ---- History ----
  const historyRef = useRef(new HistoryEngine());

  // ---- Refs ----
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const viewportsRef = useRef<{ [key: number]: any }>({});
  const objectsRef = useRef(objects);
  const [replacingOpId, setReplacingOpId] = useState<string | null>(null);

  // Keep objects ref in sync for event listeners
  useEffect(() => { objectsRef.current = objects; }, [objects]);

  // Synchronize toolbar formatting states with selected TextObject (if any)
  useEffect(() => {
    if (selection.size === 1) {
      const selectedId = Array.from(selection)[0];
      const obj = objects.get(selectedId);
      if (obj && obj.type === 'text') {
        const textObj = obj as TextObject;
        setTextColor(textObj.color);
        setFontSize(textObj.fontSize);
        setFontName(textObj.font.standardFontKey.startsWith('Times') ? 'TimesRoman'
          : textObj.font.standardFontKey.startsWith('Courier') ? 'Courier'
          : 'Helvetica');
        setIsBold(textObj.font.weight === 'bold');
        setIsItalic(textObj.font.style === 'italic');
      }
    }
  }, [selection, objects]);

  const { showSuccess, showError } = useToast();

  // ---- Zoom & Sizing ----
  const [zoom, setZoom] = useState(1.0);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const fitToWidth = useCallback(() => {
    if (document && document.pages.length > 0 && canvasContainerRef.current) {
      const containerWidth = canvasContainerRef.current.clientWidth;
      const firstPageWidth = document.pages[0].widthPts;
      if (containerWidth && firstPageWidth) {
        const fitZoom = (containerWidth - 48) / firstPageWidth;
        const initialZoom = Math.max(0.3, Math.min(3.0, fitZoom));
        setZoom(parseFloat(initialZoom.toFixed(2)));
      }
    }
  }, [document]);

  useEffect(() => {
    if (document) {
      fitToWidth();
      window.addEventListener('resize', fitToWidth);
      return () => window.removeEventListener('resize', fitToWidth);
    }
  }, [document, fitToWidth]);

  // ---- Helpers ----
  const clearOutputs = () => { setOutputUrl(''); setOutputSize(0); setOutputName(''); };

  const resetAll = () => {
    setDocument(null);
    setObjects(new Map());
    setSelection(new Set());
    setEditingTextId(null);
    setActiveTool('select');
    setCurrentPageIndex(0);
    clearOutputs();
    setOutputBlob(null);
    historyRef.current.clear();
    setShowOcrWarning(false);
  };

  /** Check if there are any user modifications. */
  const hasModifications = useCallback((): boolean => {
    for (const obj of objects.values()) {
      if (obj.type === 'text' && (obj as TextObject).origin === 'inserted') return true;
      if (obj.type === 'text' && (obj as TextObject).isModified) return true;
      if (obj.type === 'image' && (obj as ImageObject).origin === 'inserted') return true;
      if (obj.type === 'image' && (obj as ImageObject).deleted) return true;
      if (obj.type === 'image' && (obj as ImageObject).replacementFile) return true;
      if (obj.type === 'whiteout' || obj.type === 'shape' || obj.type === 'signature' || obj.type === 'freehand') return true;
    }
    return false;
  }, [objects]);

  // ---- Command Execution ----
  const executeCommand = useCallback((cmd: any) => {
    const newObjects = cmd.execute(objects);
    setObjects(newObjects);
    historyRef.current.push(cmd);
    clearOutputs();
  }, [objects]);

  const handleUndo = useCallback(() => {
    const result = historyRef.current.undo(objects);
    if (result) {
      setObjects(result);
      setSelection(new Set());
      setEditingTextId(null);
      clearOutputs();
    }
  }, [objects]);

  const handleRedo = useCallback(() => {
    const result = historyRef.current.redo(objects);
    if (result) {
      setObjects(result);
      setSelection(new Set());
      setEditingTextId(null);
      clearOutputs();
    }
  }, [objects]);

  // ---- Object Operations ----
  const handleInsertObject = useCallback((obj: EditorObject) => {
    const cmd = new InsertObjectsCommand([obj]);
    executeCommand(cmd);
    setSelection(new Set([obj.id]));
  }, [executeCommand]);

  const handleDelete = useCallback((id: string) => {
    const obj = objects.get(id);
    if (!obj) return;

    // For extracted images, mark as deleted instead of removing
    if (obj.type === 'image' && (obj as ImageObject).origin === 'extracted') {
      const updated = new Map(objects);
      updated.set(id, { ...obj, deleted: true } as EditorObject);
      setObjects(updated);
      // Push a custom delete command
      const cmd = new DeleteObjectsCommand([obj]);
      historyRef.current.push(cmd);
    } else {
      const cmd = new DeleteObjectsCommand([obj]);
      executeCommand(cmd);
    }
    setSelection(new Set());
    clearOutputs();
  }, [objects, executeCommand]);

  const handleSelect = useCallback((id: string) => {
    setSelection(new Set([id]));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelection(new Set());
    setEditingTextId(null);
  }, []);

  const handleStartEditing = useCallback((id: string) => {
    const obj = objects.get(id);
    if (!obj || obj.type !== 'text') return;

    const textObj = obj as TextObject;

    // For extracted text that hasn't been edited yet, create a modified copy
    if (textObj.origin === 'extracted' && !textObj.isModified) {
      const updated = new Map(objects);
      updated.set(id, { ...textObj, isModified: true } as EditorObject);
      setObjects(updated);
    }

    setEditingTextId(id);
    setSelection(new Set([id]));
    setActiveTool('select');
  }, [objects]);

  const handleStopEditing = useCallback(() => {
    setEditingTextId(null);
  }, []);

  const handleEditText = useCallback((id: string, newText: string) => {
    const obj = objects.get(id);
    if (!obj || obj.type !== 'text') return;
    const textObj = obj as TextObject;
    const cmd = new EditTextCommand(id, textObj.text, newText);
    executeCommand(cmd);
  }, [objects, executeCommand]);

  const handleTextColorChange = useCallback((color: string) => {
    setTextColor(color);
    if (selection.size === 1) {
      const id = Array.from(selection)[0];
      const obj = objects.get(id);
      if (obj && obj.type === 'text') {
        const cmd = new EditPropertyCommand(id, 'color' as any, obj.color, color);
        executeCommand(cmd);
      }
    }
  }, [selection, objects, executeCommand]);

  const handleShapeColorChange = useCallback((color: string) => {
    setShapeColor(color);
    if (selection.size === 1) {
      const id = Array.from(selection)[0];
      const obj = objects.get(id);
      if (obj && obj.type === 'shape') {
        const shapeObj = obj as ShapeObject;
        if (shapeObj.shapeKind === 'rectangle' && shapeObj.strokeWidth === 0) {
          const cmd = new EditPropertyCommand(id, 'fillColor' as any, shapeObj.fillColor, color);
          executeCommand(cmd);
        } else if (shapeObj.shapeKind === 'line' || shapeObj.shapeKind === 'arrow') {
          const cmd = new EditPropertyCommand(id, 'strokeColor' as any, shapeObj.strokeColor, color);
          executeCommand(cmd);
        } else {
          if (shapeObj.fillColor) {
            const cmd = new EditPropertyCommand(id, 'fillColor' as any, shapeObj.fillColor, color);
            executeCommand(cmd);
          } else {
            const cmd = new EditPropertyCommand(id, 'strokeColor' as any, shapeObj.strokeColor, color);
            executeCommand(cmd);
          }
        }
      } else if (obj && obj.type === 'freehand') {
        const freeObj = obj as FreehandObject;
        const cmd = new EditPropertyCommand(id, 'strokeColor' as any, freeObj.strokeColor, color);
        executeCommand(cmd);
      }
    }
  }, [selection, objects, executeCommand]);

  const handleFontSizeChange = useCallback((size: number) => {
    setFontSize(size);
    if (selection.size === 1) {
      const id = Array.from(selection)[0];
      const obj = objects.get(id);
      if (obj && obj.type === 'text') {
        const cmd = new EditPropertyCommand(id, 'fontSize' as any, (obj as TextObject).fontSize, size);
        executeCommand(cmd);
      }
    }
  }, [selection, objects, executeCommand]);

  const handleFontChange = useCallback((newFontName: string, newIsBold: boolean, newIsItalic: boolean) => {
    setFontName(newFontName);
    setIsBold(newIsBold);
    setIsItalic(newIsItalic);

    if (selection.size === 1) {
      const id = Array.from(selection)[0];
      const obj = objects.get(id);
      if (obj && obj.type === 'text') {
        const textObj = obj as TextObject;
        const newFont: FontProperties = {
          pdfFontName: newFontName,
          cssFontFamily: getCssFontFamily(newFontName),
          standardFontKey: getStandardFontKey(newFontName, newIsBold, newIsItalic),
          weight: newIsBold ? 'bold' : 'normal',
          style: newIsItalic ? 'italic' : 'normal',
        };
        const cmd = new EditPropertyCommand(id, 'font' as any, textObj.font, newFont);
        executeCommand(cmd);
      }
    }
  }, [selection, objects, executeCommand]);

  const toggleBold = useCallback(() => {
    if (selection.size === 1) {
      const id = Array.from(selection)[0];
      const obj = objects.get(id);
      if (obj && obj.type === 'text') {
        const textObj = obj as TextObject;
        const nextBold = textObj.font.weight !== 'bold';
        setIsBold(nextBold);
        handleFontChange(
          textObj.font.standardFontKey.startsWith('Times') ? 'TimesRoman'
            : textObj.font.standardFontKey.startsWith('Courier') ? 'Courier'
            : 'Helvetica',
          nextBold,
          textObj.font.style === 'italic'
        );
      }
    } else {
      setIsBold(prev => !prev);
    }
  }, [selection, objects, handleFontChange]);

  const toggleItalic = useCallback(() => {
    if (selection.size === 1) {
      const id = Array.from(selection)[0];
      const obj = objects.get(id);
      if (obj && obj.type === 'text') {
        const textObj = obj as TextObject;
        const nextItalic = textObj.font.style !== 'italic';
        setIsItalic(nextItalic);
        handleFontChange(
          textObj.font.standardFontKey.startsWith('Times') ? 'TimesRoman'
            : textObj.font.standardFontKey.startsWith('Courier') ? 'Courier'
            : 'Helvetica',
          textObj.font.weight === 'bold',
          nextItalic
        );
      }
    } else {
      setIsItalic(prev => !prev);
    }
  }, [selection, objects, handleFontChange]);

  const adjustFontSize = useCallback((amount: number) => {
    if (selection.size === 1) {
      const id = Array.from(selection)[0];
      const obj = objects.get(id);
      if (obj && obj.type === 'text') {
        const textObj = obj as TextObject;
        const nextSize = Math.max(6, Math.min(96, textObj.fontSize + amount));
        handleFontSizeChange(nextSize);
      }
    } else {
      setFontSize(prev => Math.max(6, Math.min(96, prev + amount)));
    }
  }, [selection, objects, handleFontSizeChange]);

  const handleTextColorsExtracted = useCallback((updates: Array<{ id: string; color: string }>) => {
    setObjects(prev => {
      const next = new Map(prev);
      let changed = false;
      for (const { id, color } of updates) {
        const obj = next.get(id);
        if (obj && obj.type === 'text' && !(obj as TextObject).colorExtracted) {
          next.set(id, { ...obj, color, colorExtracted: true } as EditorObject);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  // ---- Drag & Resize (window-level for smooth interaction) ----
  const [dragState, setDragState] = useState<{
    id: string; type: 'drag' | 'resize'; handle?: ResizeHandle;
    startX: number; startY: number; startBounds: Bounds;
    startPoints?: Point[];
  } | null>(null);

  const handleStartDrag = useCallback((e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const obj = objects.get(id);
    if (!obj) return;
    setDragState({
      id, type: 'drag',
      startX: e.clientX, startY: e.clientY,
      startBounds: { ...obj.bounds },
      startPoints: obj.type === 'freehand'
        ? [...(obj as FreehandObject).points]
        : (obj.type === 'shape' && ((obj as ShapeObject).shapeKind === 'line' || (obj as ShapeObject).shapeKind === 'arrow'))
          ? [(obj as ShapeObject).startPoint!, (obj as ShapeObject).endPoint!]
          : undefined,
    });
  }, [objects]);

  const handleStartResize = useCallback((e: React.PointerEvent, id: string, handle: ResizeHandle) => {
    e.stopPropagation();
    e.preventDefault();
    const obj = objects.get(id);
    if (!obj) return;
    setDragState({
      id, type: 'resize', handle,
      startX: e.clientX, startY: e.clientY,
      startBounds: { ...obj.bounds },
      startPoints: obj.type === 'freehand'
        ? [...(obj as FreehandObject).points]
        : (obj.type === 'shape' && ((obj as ShapeObject).shapeKind === 'line' || (obj as ShapeObject).shapeKind === 'arrow'))
          ? [(obj as ShapeObject).startPoint!, (obj as ShapeObject).endPoint!]
          : undefined,
    });
  }, [objects]);

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e: PointerEvent) => {
      const currentObjects = objectsRef.current;
      const obj = currentObjects.get(dragState.id);
      if (!obj) return;

      const viewport = viewportsRef.current[obj.pageIndex];
      if (!viewport) return;

      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;

      if (dragState.type === 'drag') {
        const dxPdf = dx / zoom;
        const dyPdf = -dy / zoom;
        const updated = new Map(currentObjects);
        
        const changes: any = {
          bounds: {
            ...obj.bounds,
            x: dragState.startBounds.x + dxPdf,
            y: dragState.startBounds.y + dyPdf,
          }
        };

        if (obj.type === 'freehand' && dragState.startPoints) {
          changes.points = dragState.startPoints.map(pt => ({
            x: pt.x + dxPdf,
            y: pt.y + dyPdf
          }));
        } else if (obj.type === 'shape' && ((obj as ShapeObject).shapeKind === 'line' || (obj as ShapeObject).shapeKind === 'arrow')) {
          if (dragState.startPoints && dragState.startPoints.length >= 2) {
            changes.startPoint = {
              x: dragState.startPoints[0].x + dxPdf,
              y: dragState.startPoints[0].y + dyPdf
            };
            changes.endPoint = {
              x: dragState.startPoints[1].x + dxPdf,
              y: dragState.startPoints[1].y + dyPdf
            };
          }
        }

        updated.set(obj.id, {
          ...obj,
          ...changes
        } as EditorObject);
        setObjects(updated);
      } else if (dragState.type === 'resize' && dragState.handle) {
        const pt1 = viewport.convertToViewportPoint(dragState.startBounds.x, dragState.startBounds.y);
        const pt2 = viewport.convertToViewportPoint(
          dragState.startBounds.x + dragState.startBounds.width,
          dragState.startBounds.y + dragState.startBounds.height
        );
        let vLeft = Math.min(pt1[0], pt2[0]);
        let vTop = Math.min(pt1[1], pt2[1]);
        let vWidth = Math.abs(pt2[0] - pt1[0]);
        let vHeight = Math.abs(pt2[1] - pt1[1]);

        const h = dragState.handle;
        if (h.includes('r')) vWidth = Math.max(10, vWidth + dx);
        if (h.includes('l')) { vLeft += dx; vWidth = Math.max(10, vWidth - dx); }
        if (h.includes('b')) vHeight = Math.max(10, vHeight + dy);
        if (h.includes('t')) { vTop += dy; vHeight = Math.max(10, vHeight - dy); }

        const pdfBounds = viewportRectToPdfBounds(vLeft, vTop, vWidth, vHeight, viewport);
        const updated = new Map(currentObjects);

        const changes: any = { bounds: pdfBounds };

        if (obj.type === 'freehand' && dragState.startPoints) {
          const scaleX = pdfBounds.width / dragState.startBounds.width;
          const scaleY = pdfBounds.height / dragState.startBounds.height;
          changes.points = dragState.startPoints.map(pt => ({
            x: pdfBounds.x + (pt.x - dragState.startBounds.x) * scaleX,
            y: pdfBounds.y + (pt.y - dragState.startBounds.y) * scaleY
          }));
        } else if (obj.type === 'shape' && ((obj as ShapeObject).shapeKind === 'line' || (obj as ShapeObject).shapeKind === 'arrow')) {
          if (dragState.startPoints && dragState.startPoints.length >= 2) {
            const scaleX = pdfBounds.width / dragState.startBounds.width;
            const scaleY = pdfBounds.height / dragState.startBounds.height;
            changes.startPoint = {
              x: pdfBounds.x + (dragState.startPoints[0].x - dragState.startBounds.x) * scaleX,
              y: pdfBounds.y + (dragState.startPoints[0].y - dragState.startBounds.y) * scaleY
            };
            changes.endPoint = {
              x: pdfBounds.x + (dragState.startPoints[1].x - dragState.startBounds.x) * scaleX,
              y: pdfBounds.y + (dragState.startPoints[1].y - dragState.startBounds.y) * scaleY
            };
          }
        }

        updated.set(obj.id, { ...obj, ...changes } as EditorObject);
        setObjects(updated);
      }
    };

    const handlePointerUp = () => {
      // Commit the final position to history
      const obj = objectsRef.current.get(dragState.id);
      if (obj) {
        const cmd = new MoveObjectsCommand([{
          id: dragState.id,
          oldBounds: dragState.startBounds,
          newBounds: obj.bounds,
        }]);
        historyRef.current.push(cmd);
        clearOutputs();
      }
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, zoom]);

  // ---- Keyboard Shortcuts ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTextInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Bold (Ctrl+B)
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleBold();
        return;
      }
      // Italic (Ctrl+I)
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        toggleItalic();
        return;
      }
      // Font size decrease (Ctrl+[)
      if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        e.preventDefault();
        adjustFontSize(-1);
        return;
      }
      // Font size increase (Ctrl+])
      if ((e.ctrlKey || e.metaKey) && e.key === ']') {
        e.preventDefault();
        adjustFontSize(1);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); handleUndo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && ((e.key === 'Z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault(); handleRedo(); return;
      }
      if (isTextInput) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.size > 0) {
        e.preventDefault();
        for (const id of selection) handleDelete(id);
        return;
      }
      if (e.key === 'Escape') {
        handleClearSelection(); return;
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && selection.size > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const moves: Array<{ id: string; oldBounds: Bounds; newBounds: Bounds }> = [];
        for (const id of selection) {
          const obj = objects.get(id);
          if (!obj) continue;
          const oldBounds = { ...obj.bounds };
          let dx = 0, dy = 0;
          if (e.key === 'ArrowLeft') dx = -step;
          if (e.key === 'ArrowRight') dx = step;
          if (e.key === 'ArrowUp') dy = step;
          if (e.key === 'ArrowDown') dy = -step;
          moves.push({ id, oldBounds, newBounds: { ...oldBounds, x: oldBounds.x + dx, y: oldBounds.y + dy } });
        }
        if (moves.length > 0) {
          const cmd = new MoveObjectsCommand(moves);
          executeCommand(cmd);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, objects, handleUndo, handleRedo, handleDelete, handleClearSelection, executeCommand, toggleBold, toggleItalic, adjustFontSize]);

  const loadEditorDocument = async (file: File | Blob) => {
    setIsLoading(true);
    setProgressMsg('Parsing PDF structure...');
    try {
      const parsed = await parsePdf(file as File, (msg, _progress) => {
        setProgressMsg(msg);
      });
      setDocument(parsed);

      // Populate objects map from parsed data
      const objs = new Map<string, EditorObject>();
      for (const page of parsed.pages) {
        for (const t of page.textObjects) objs.set(t.id, t);
        for (const i of page.imageObjects) objs.set(i.id, i);
      }
      setObjects(objs);
      historyRef.current.clear();
      showSuccess('PDF loaded!', `${file instanceof File ? file.name : 'document.pdf'} — ${parsed.numPages} pages analyzed.`);

      // Check if it's a scanned PDF (0 text objects)
      const totalExtractedTextObjects = parsed.pages.reduce((acc, p) => acc + p.textObjects.length, 0);
      const isScannedPdf = totalExtractedTextObjects === 0;
      const hideOcrWarningPref = localStorage.getItem('ck-hide-ocr-warning') === 'true';
      if (isScannedPdf && !hideOcrWarningPref) {
        setShowOcrWarning(true);
        setDontShowOcrWarningAgain(false);
      } else {
        setShowOcrWarning(false);
      }
    } catch (err) {
      console.error(err);
      showError('PDF Parse Error', 'Could not parse this document.');
      resetAll();
    } finally {
      setIsLoading(false);
      setProgressMsg('');
    }
  };

  const dismissOcrWarning = () => {
    if (dontShowOcrWarningAgain) {
      localStorage.setItem('ck-hide-ocr-warning', 'true');
    }
    setShowOcrWarning(false);
  };

  // Auto-load file from workspace context
  useEffect(() => {
    if (activeFile) {
      if (activeFile !== editorLoadedFile) {
        setEditorLoadedFile(activeFile);
        const fileToProcess = activeFile instanceof File
          ? activeFile
          : new File([activeFile], activeFileName || 'document.pdf', { type: 'application/pdf' });
        loadEditorDocument(fileToProcess);
      }
    } else {
      setEditorLoadedFile(null);
      resetAll();
    }
  }, [activeFile, editorLoadedFile]);

  // ---- File Upload ----
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    loadEditorDocument(e.target.files[0]);
  };

  // ---- Image Insertion ----
  const triggerAddImage = () => imageInputRef.current?.click();

  const handleAddImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !document) return;
    const f = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const page = document.pages[currentPageIndex];
      const w = 120, h = 120;
      const x = (page.widthPts - w) / 2;
      const y = (page.heightPts - h) / 2;

      handleInsertObject({
        id: generateId('img'),
        type: 'image',
        pageIndex: currentPageIndex,
        bounds: { x, y, width: w, height: h },
        rotation: 0, opacity: 1, zIndex: objects.size, locked: false,
        origin: 'inserted',
        xObjectName: null,
        dataUrl: url,
        file: f,
        originalTransform: null,
        deleted: false,
        replacementFile: null,
        replacementDataUrl: null,
      });
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  };

  // ---- Image Replacement ----
  const handleReplaceImage = useCallback((id: string) => {
    setReplacingOpId(id);
    replaceImageInputRef.current?.click();
  }, []);

  const handleReplaceImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !replacingOpId) return;
    const f = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const updated = new Map(objects);
      const obj = updated.get(replacingOpId);
      if (obj && obj.type === 'image') {
        updated.set(replacingOpId, {
          ...obj,
          replacementFile: f,
          replacementDataUrl: url,
        } as EditorObject);
        setObjects(updated);
        clearOutputs();
      }
      setReplacingOpId(null);
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  };

  // ---- Signature ----
  const handleSignatureAdd = (dataUrl: string, blob: Blob) => {
    if (!document) return;
    const page = document.pages[currentPageIndex];
    const w = 160, h = 70;
    const x = (page.widthPts - w) / 2;
    const y = (page.heightPts - h) / 2;
    const file = new File([blob], 'signature.png', { type: 'image/png' });

    handleInsertObject({
      id: generateId('sig'),
      type: 'signature',
      pageIndex: currentPageIndex,
      bounds: { x, y, width: w, height: h },
      rotation: 0, opacity: 1, zIndex: objects.size, locked: false,
      dataUrl,
      file,
    });
    setSignModalOpen(false);
  };

  // ---- Export ----
  const handleApply = async () => {
    if (!document) return;
    setIsLoading(true);

    try {
      const bytes = await exportPdf(document, objects, (msg) => setProgressMsg(msg), { doOcr });
      const blob = new Blob([bytes as any], { type: 'application/pdf' });
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(`edited_${document.file.name}`);
      setOutputBlob(blob);
      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Edit PDF', `edited_${document.file.name}`, blob.size);

      showSuccess('PDF ready!', `edited_${document.file.name} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err) {
      console.error(err);
      showError('Export failed', 'Could not compile your edits.');
    } finally {
      setIsLoading(false);
      setProgressMsg('');
    }
  };

  // ---- Page Navigation ----
  const scrollToPage = (idx: number) => {
    setCurrentPageIndex(idx);
    window.document.getElementById(`page-wrapper-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ---- Page Objects Selector ----
  const getPageObjects = useCallback((pageIndex: number): EditorObject[] => {
    const result: EditorObject[] = [];
    for (const obj of objects.values()) {
      if (obj.pageIndex === pageIndex) result.push(obj);
    }
    return result.sort((a, b) => a.zIndex - b.zIndex);
  }, [objects]);



  // ---- Page Reordering ----
  const movePage = (currentIndex: number, direction: 'up' | 'down') => {
    if (!document) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= document.numPages) return;

    const reorderedPages = [...document.pages];
    const [removed] = reorderedPages.splice(currentIndex, 1);
    reorderedPages.splice(targetIndex, 0, removed);

    setDocument({
      ...document,
      pages: reorderedPages,
    });
    
    setCurrentPageIndex(targetIndex);
    clearOutputs();
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!document) return;
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const reorderedPages = [...document.pages];
    const [removed] = reorderedPages.splice(sourceIndex, 1);
    reorderedPages.splice(targetIndex, 0, removed);

    setDocument({
      ...document,
      pages: reorderedPages,
    });

    setCurrentPageIndex(targetIndex);
    clearOutputs();
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[var(--ck-bg-cream)]">
      {!document ? (
        <div className="flex flex-col lg:flex-row w-full h-full min-h-0 overflow-hidden">
          {/* Center: Upload Drop Zone */}
          <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" className="hidden" />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-md min-h-[280px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-8 text-center cursor-pointer border-[var(--ck-border)] bg-[var(--ck-bg-card)] hover:border-[var(--ck-border-hover)] transition-all"
            >
              <div className="p-4 rounded-full bg-pink-50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400 mb-4">
                <Upload className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-[var(--ck-text-primary)] text-sm">
                Drag & Drop PDF here
              </h3>
              <p className="text-xs text-[var(--ck-text-muted)] mt-1.5 max-w-[280px] leading-relaxed font-semibold">
                or click to browse your files. Upload a PDF to start annotating, drawing, or typing text.
              </p>
            </div>
            {isLoading && (
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-3">
                <RefreshCw className="w-4 h-4 animate-spin text-pink-500" />
                <span>{progressMsg}</span>
              </div>
            )}
          </div>
          
          {/* Right: How to use & Privacy */}
          <div className="w-full lg:w-[320px] bg-[var(--ck-bg-card)] border-t lg:border-t-0 lg:border-l border-[var(--ck-border)] flex flex-col min-h-[250px] lg:min-h-0 overflow-y-auto thin-scrollbar flex-shrink-0 p-5 justify-between">
            <div className="flex-1 pb-5">
              <HowToUse
                title="PDF Editor"
                icon={PenTool}
                steps={[
                  'Upload your PDF document in the center canvas.',
                  'Use the toolbar to choose tools: Add Text, Draw shapes, insert Images, or Draw Signatures.',
                  'Drag objects to move them, and resize them using boundary handles.',
                  'Click "Apply & Export PDF" on the toolbar to build and download the output.'
                ]}
                warning="Note: Editing or flattening the PDF may increase the output file size. Selecting or searching text in the edited regions might have minor discrepancies."
              />
            </div>
            <div className="flex gap-2 p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 mt-auto flex-shrink-0">
              <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-left">
                <h4 className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Privacy Guaranteed</h4>
                <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400 leading-normal font-semibold">
                  Processing runs 100% locally inside your browser. Your documents never upload to any servers.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ---- Editor Workspace ---- */
        <div className="flex-1 flex flex-col p-6 overflow-hidden gap-4 min-h-0 relative">
          <EditorToolbar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            canUndo={historyRef.current.canUndo}
            canRedo={historyRef.current.canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onApply={handleApply}
            onReset={resetAll}
            isProcessing={isLoading}
            hasOperations={hasModifications()}
            textColor={textColor} setTextColor={handleTextColorChange}
            fontSize={fontSize} setFontSize={handleFontSizeChange}
            fontName={fontName} setFontName={(name) => handleFontChange(name, isBold, isItalic)}
            isBold={isBold} setIsBold={(b) => handleFontChange(fontName, b, isItalic)}
            isItalic={isItalic} setIsItalic={(i) => handleFontChange(fontName, isBold, i)}
            shapeColor={shapeColor} setShapeColor={handleShapeColorChange}
            shapeFill={shapeFill} setShapeFill={setShapeFill}
            shapeStrokeWidth={shapeStrokeWidth} setShapeStrokeWidth={setShapeStrokeWidth}
            onAddImage={triggerAddImage}
            onOpenSignature={() => setSignModalOpen(true)}
          />

          {/* Scanned/Non-OCR PDF Warning Banner */}
          {showOcrWarning && (
            <div className="w-full bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4 flex flex-col gap-3 relative animate-fade-in select-none">
              {/* Close Button */}
              <button
                onClick={dismissOcrWarning}
                className="absolute top-4 right-4 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 pr-6">
                  <h4 className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                    Scanned documents are not supported
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-350 leading-relaxed font-semibold mt-1">
                    <strong>Editing scanned documents is not supported.</strong> Changing existing text within scanned documents is not supported. However, you can still use other features such as adding new text, images, and annotations.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-1 pt-2 border-t border-amber-200/50 dark:border-amber-900/20">
                <label className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-350 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={dontShowOcrWarningAgain}
                    onChange={(e) => setDontShowOcrWarningAgain(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-amber-300 dark:border-amber-800 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span>Don't show anymore</span>
                </label>
                <button
                  onClick={() => {
                    // Navigate to OCR PDF tool
                    window.open('/ocr-pdf', '_blank');
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-800 dark:text-amber-350 text-xs font-bold transition-all cursor-pointer"
                >
                  Learn more
                </button>
              </div>
            </div>
          )}

          {/* Split Workspace */}
          <div className={`flex-1 grid grid-cols-1 gap-6 min-h-0 overflow-hidden ${
            outputUrl && outputBlob ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
          }`}>
            {/* Thumbnail Sidebar */}
            <div className="lg:col-span-1 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-4 h-full overflow-y-auto">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Pages ({document.numPages})
              </h4>
              <div className="grid grid-cols-3 lg:grid-cols-1 gap-3">
                {document.pages.map((page, idx) => (
                  <div
                    key={page.pageIndex}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, idx)}
                    className={`p-2.5 rounded-xl border transition-all flex flex-col items-center gap-1.5 relative group ${
                      currentPageIndex === idx
                        ? 'border-pink-500 bg-pink-500/10 dark:bg-pink-500/5 ring-2 ring-pink-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-white/60 dark:bg-slate-950/20'
                    }`}
                  >
                    {/* Header: Page Index & Reordering Arrows */}
                    <div className="w-full flex items-center justify-between gap-1 text-[10px] font-extrabold text-slate-650 dark:text-slate-400">
                      <div className="flex items-center gap-1 min-w-0">
                        <GripVertical className="w-3.5 h-3.5 text-slate-450 cursor-grab active:cursor-grabbing shrink-0" />
                        <span className="truncate">Page {idx + 1}</span>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 opacity-80 hover:opacity-100">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={(e) => { e.stopPropagation(); movePage(idx, 'up'); }}
                          className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-20 text-slate-500 dark:text-slate-450 cursor-pointer"
                          title="Move Page Up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === document.pages.length - 1}
                          onClick={(e) => { e.stopPropagation(); movePage(idx, 'down'); }}
                          className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-20 text-slate-500 dark:text-slate-450 cursor-pointer"
                          title="Move Page Down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Body: Thumbnail Box */}
                    <div
                      onClick={() => scrollToPage(idx)}
                      className="w-full h-20 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-sm cursor-pointer hover:border-pink-300 dark:hover:border-pink-850 transition-colors"
                    >
                      <span className="text-[9px] text-slate-400 font-bold">
                        {Math.round(page.widthPts)}×{Math.round(page.heightPts)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Canvas Center Wrapper with Floating Zoom Controls */}
            <div className={`relative flex flex-col h-full min-h-0 ${
              outputUrl && outputBlob ? 'lg:col-span-3' : 'lg:col-span-3'
            }`}>
              {/* Zoom controls */}
              <div className="absolute top-4 right-4 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-850 backdrop-blur-md rounded-full shadow-lg px-3 py-1.5 flex items-center gap-3 z-30 select-none">
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.max(0.3, prev - 0.1))}
                  disabled={zoom <= 0.3}
                  className="p-1 rounded-full text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-350 font-mono w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.min(3.0, prev + 0.1))}
                  disabled={zoom >= 3.0}
                  className="p-1 rounded-full text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={fitToWidth}
                  className="p-1 rounded-full text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-l border-slate-200 dark:border-slate-800 pl-2 ml-0.5 transition-colors"
                  title="Fit to Width"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Canvas Area */}
              <div
                ref={canvasContainerRef}
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) {
                    handleClearSelection();
                  }
                }}
                className="w-full h-full space-y-8 flex flex-col items-center overflow-x-auto overflow-y-auto border border-slate-200/50 dark:border-slate-800/50 rounded-2xl bg-slate-950/5 p-4 shadow-inner"
              >
                {document.pages.map((page, idx) => (
                  <PageCanvas
                    key={page.pageIndex}
                    pageIndex={page.pageIndex}
                    pdfjsDoc={document.pdfjsDocument}
                    zoom={zoom}
                    pageWidthPts={page.widthPts}
                    pageHeightPts={page.heightPts}
                    pageObjects={getPageObjects(page.pageIndex)}
                    activeTool={activeTool}
                    selectedIds={selection}
                    editingTextId={editingTextId}
                    textColor={textColor}
                    fontSize={fontSize}
                    fontName={fontName}
                    isBold={isBold}
                    isItalic={isItalic}
                    shapeColor={shapeColor}
                    shapeFill={shapeFill}
                    shapeStrokeWidth={shapeStrokeWidth}
                    onSelect={handleSelect}
                    onClearSelection={handleClearSelection}
                    onStartDrag={handleStartDrag}
                    onStartResize={handleStartResize}
                    onDelete={handleDelete}
                    onEditText={handleEditText}
                    onStartEditing={handleStartEditing}
                    onStopEditing={handleStopEditing}
                    onInsertObject={handleInsertObject}
                    onReplaceImage={handleReplaceImage}
                    onBecameVisible={() => {
                      if (currentPageIndex !== idx) setCurrentPageIndex(idx);
                    }}
                    onTextColorsExtracted={handleTextColorsExtracted}
                    viewportsRef={viewportsRef}
                  />
                ))}
              </div>
            </div>

            {/* Task Completed Panel on the right */}
            {outputUrl && outputBlob && (
              <div className="lg:col-span-1 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm h-full overflow-y-auto thin-scrollbar">
                <PdfTaskCompleted
                  fileName={outputName}
                  fileSize={outputSize}
                  originalSize={document ? document.file.size : undefined}
                  outputBlob={outputBlob}
                  onReset={resetAll}
                  onContinueEditing={() => {
                    setOutputUrl('');
                    setOutputBlob(null);
                    setOutputSize(0);
                    setOutputName('');
                  }}
                />
              </div>
            )}
          </div>
          
          {/* Loader overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-slate-950/20 dark:bg-slate-950/40 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-3 z-50 animate-fade-in">
              <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/60 dark:border-slate-800/60 flex flex-col items-center gap-3 max-w-xs text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-pink-500" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Processing PDF</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium px-4">{progressMsg}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden file inputs */}
      <input type="file" ref={imageInputRef} onChange={handleAddImageFile} accept="image/png, image/jpeg" className="hidden" />
      <input type="file" ref={replaceImageInputRef} onChange={handleReplaceImageFile} accept="image/png, image/jpeg" className="hidden" />

      {/* Signature Modal */}
      {signModalOpen && (
        <SignatureModal
          onClose={() => setSignModalOpen(false)}
          onAdd={handleSignatureAdd}
        />
      )}
    </div>
  );
}
