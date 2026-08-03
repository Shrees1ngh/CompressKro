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
  Upload, RefreshCw, PenTool, Sparkles,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { CompiledOutputView } from '../../components/CompiledOutputView';

// PDF Editor feature modules
import type {
  ParsedDocument,
  EditorObject,
  TextObject,
  ImageObject,
  ToolType,
  ResizeHandle,
  Bounds,
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
  // ---- Document State ----
  const [document, setDocument] = useState<ParsedDocument | null>(null);
  const [objects, setObjects] = useState<Map<string, EditorObject>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

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
  // ---- OCR Option (Phase 4) ----
  const [doOcr, setDoOcr] = useState(false);

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

  // ---- Zoom (constant for now; will be wired to ZoomControls later) ----
  const zoom = 1.3;

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
    historyRef.current.clear();
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
        updated.set(obj.id, {
          ...obj,
          bounds: {
            ...obj.bounds,
            x: dragState.startBounds.x + dxPdf,
            y: dragState.startBounds.y + dyPdf,
          },
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
        updated.set(obj.id, { ...obj, bounds: pdfBounds } as EditorObject);
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

  // ---- File Upload ----
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setIsLoading(true);

    try {
      const parsed = await parsePdf(file, (msg, _progress) => {
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
      showSuccess('PDF loaded!', `${file.name} — ${parsed.numPages} pages analyzed.`);
    } catch (err) {
      console.error(err);
      showError('PDF Parse Error', 'Could not parse this document.');
      resetAll();
    } finally {
      setIsLoading(false);
      setProgressMsg('');
    }
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

  // ---- SEO Content ----
  const steps: StepItem[] = [
    { step: 1, text: 'Upload your PDF document to load its layout client-side.' },
    { step: 2, text: 'Click text blocks to edit them inline, or draw shapes, whiteouts, and add images.' },
    { step: 3, text: 'Click "Apply & Save PDF" to generate and download your edited PDF.' },
  ];
  const benefits: BenefitItem[] = [
    { title: 'Privacy First', desc: 'No files are ever uploaded. All edits are compiled within your browser.' },
    { title: 'Direct Text Editing', desc: 'Select existing text blocks to modify them natively.' },
    { title: 'Interactive Toolbox', desc: 'Whiteout, draw shapes, sign, or upload custom images.' },
  ];
  const faqs: FAQItem[] = [
    { question: 'Why is some text not editable?', answer: 'This tool extracts text layers from native PDFs. Scanned PDFs need OCR first.' },
    { question: 'Can I replace images?', answer: 'Yes! Select the Images tool, hover over detected images, and click Replace.' },
    { question: 'How do I erase details?', answer: 'Select Whiteout, then click and drag a box over any area.' },
  ];
  const relatedTools: RelatedToolItem[] = [
    { name: 'Sign PDF', desc: 'Embed signatures on sheets.', path: '/sign-pdf', icon: PenTool },
    { name: 'OCR PDF', desc: 'Render flat text layers.', path: '/ocr-pdf', icon: Sparkles },
    { name: 'Rotate & Order', desc: 'Rearrange page slots.', path: '/rotate-pdf', icon: RefreshCw },
  ];

  return (
    <ToolPageLayout
      title="Edit PDF Online"
      subtitle="Modify existing text, insert shapes, replace images, and whiteout details in your PDF."
      breadcrumbName="Edit PDF"
      seoTitle="Edit PDF Online Free - Edit Text & Replace Images | CompressKro"
      seoDescription="Edit PDF text online for free. Delete or replace images, draw rectangles, apply whiteouts, and sign documents client-side."
      canonicalPath="/edit-pdf"
      steps={steps} benefits={benefits} faqs={faqs} relatedTools={relatedTools}
      maxWidthClass="max-w-7xl"
    >
      <div className="space-y-6">
        {outputUrl ? (
          <CompiledOutputView
            outputUrl={outputUrl} outputSize={outputSize}
            outputName={outputName} onClear={resetAll}
          />
        ) : (
          <div className="space-y-6">
            {!document ? (
              /* ---- Upload Area ---- */
              <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-pink-500" />
                  <span>Upload Document to Edit</span>
                </h3>
                <div className="space-y-4">
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" className="hidden" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-8 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-pink-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer"
                  >
                    <div className="p-3 bg-pink-50 dark:bg-pink-950/40 rounded-full">
                      <Upload className="w-6 h-6 text-pink-600" />
                    </div>
                    <span className="text-sm">Click to select PDF document</span>
                    <span className="text-slate-400 font-medium text-[10px]">Max file size: 100MB</span>
                  </button>
                  {isLoading && (
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-pink-500" />
                      <span>{progressMsg}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ---- Editor Workspace ---- */
              <div className="flex flex-col gap-4 relative">
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
                  shapeColor={shapeColor} setShapeColor={setShapeColor}
                  shapeFill={shapeFill} setShapeFill={setShapeFill}
                  shapeStrokeWidth={shapeStrokeWidth} setShapeStrokeWidth={setShapeStrokeWidth}
                  onAddImage={triggerAddImage}
                  onOpenSignature={() => setSignModalOpen(true)}
                  doOcr={doOcr}
                  setDoOcr={setDoOcr}
                />

                {/* Split Workspace */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                  {/* Thumbnail Sidebar */}
                  <div className="lg:col-span-1 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-4 max-h-[640px] overflow-y-auto lg:sticky lg:top-24">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Pages ({document.numPages})
                    </h4>
                    <div className="grid grid-cols-3 lg:grid-cols-1 gap-3">
                      {document.pages.map((page, idx) => (
                        <button
                          key={idx}
                          onClick={() => scrollToPage(idx)}
                          className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                            currentPageIndex === idx
                              ? 'border-pink-500 bg-pink-500/10 dark:bg-pink-500/5 ring-2 ring-pink-500/20'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-white/60 dark:bg-slate-950/20'
                          }`}
                        >
                          <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-400">
                            Page {idx + 1}
                          </span>
                          <div className="w-16 h-20 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-sm">
                            <span className="text-[9px] text-slate-400 font-bold">
                              {Math.round(page.widthPts)}×{Math.round(page.heightPts)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Canvas Center */}
                  <div className="lg:col-span-3 space-y-8 flex flex-col items-center overflow-x-auto max-h-[80vh] overflow-y-auto border border-slate-200/50 dark:border-slate-850/50 rounded-2xl bg-slate-950/5 p-4 shadow-inner">
                    {document.pages.map((page, idx) => (
                      <PageCanvas
                        key={idx}
                        pageIndex={idx}
                        pdfjsDoc={document.pdfjsDocument}
                        zoom={zoom}
                        pageWidthPts={page.widthPts}
                        pageHeightPts={page.heightPts}
                        pageObjects={getPageObjects(idx)}
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
          </div>
        )}
      </div>

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
    </ToolPageLayout>
  );
}
