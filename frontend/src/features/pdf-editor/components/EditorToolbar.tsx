// ============================================================
// CompressKro PDF Editor — Editor Toolbar Component
// ============================================================
// Main floating toolbar with tool buttons, undo/redo, and
// sub-toolbars for text/shape properties.
// ============================================================

import {
  MousePointerClick, Type, Eraser, Image as ImageIcon,
  PenTool, Square, Undo2, Redo2, Check, X, RefreshCw,
  Bold, Italic, Sparkles,
} from 'lucide-react';
import type { ToolType } from '../core/types';
import { TEXT_COLOR_PRESETS, SHAPE_COLOR_PRESETS } from '../core/constants';

interface EditorToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onApply: () => void;
  onReset: () => void;
  isProcessing: boolean;
  hasOperations: boolean;
  // Text tool properties
  textColor: string;
  setTextColor: (c: string) => void;
  fontSize: number;
  setFontSize: (s: number) => void;
  fontName: string;
  setFontName: (f: string) => void;
  isBold: boolean;
  setIsBold: (b: boolean) => void;
  isItalic: boolean;
  setIsItalic: (i: boolean) => void;
  // Shape tool properties
  shapeColor: string;
  setShapeColor: (c: string) => void;
  shapeFill: boolean;
  setShapeFill: (f: boolean) => void;
  shapeStrokeWidth: number;
  setShapeStrokeWidth: (w: number) => void;
  // Image/Sign actions
  onAddImage: () => void;
  onOpenSignature: () => void;
  // OCR actions
  doOcr: boolean;
  setDoOcr: (val: boolean) => void;
}

const tools: Array<{ id: ToolType; icon: any; label: string; title: string }> = [
  { id: 'select', icon: MousePointerClick, label: 'Select', title: 'Select / Move Elements' },
  { id: 'text', icon: Type, label: 'Text', title: 'Add or Edit Text' },
  { id: 'whiteout', icon: Eraser, label: 'Whiteout', title: 'Erase / Whiteout Rectangles' },
  { id: 'shape', icon: Square, label: 'Shapes', title: 'Draw Rectangular Shape' },
];

export function EditorToolbar({
  activeTool, setActiveTool,
  canUndo, canRedo, onUndo, onRedo,
  onApply, onReset, isProcessing, hasOperations,
  textColor, setTextColor, fontSize, setFontSize, fontName, setFontName,
  isBold, setIsBold, isItalic, setIsItalic,
  shapeColor, setShapeColor, shapeFill, setShapeFill, shapeStrokeWidth, setShapeStrokeWidth,
  onAddImage, onOpenSignature,
  doOcr, setDoOcr,
}: EditorToolbarProps) {
  return (
    <div className="space-y-3">
      {/* Main Toolbar */}
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 glass-panel flex flex-wrap items-center justify-between gap-4 sticky top-4 z-40 shadow-md">
        <div className="flex items-center gap-2">
          {tools.map(({ id, icon: Icon, label, title }) => (
            <button
              key={id}
              onClick={() => setActiveTool(id)}
              className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                activeTool === id
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
              }`}
              title={title}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}

          <button
            onClick={() => { setActiveTool('image'); onAddImage(); }}
            className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTool === 'image'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
            }`}
            title="Insert or Replace Images"
          >
            <ImageIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Images</span>
          </button>

          <button
            onClick={() => { setActiveTool('signature'); onOpenSignature(); }}
            className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTool === 'signature'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
            }`}
            title="Add Hand-drawn Signature"
          >
            <PenTool className="w-4 h-4" />
            <span className="hidden sm:inline">Sign</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onUndo} disabled={!canUndo}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 disabled:opacity-40 text-slate-700 dark:text-slate-300 cursor-pointer"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo} disabled={!canRedo}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 disabled:opacity-40 text-slate-700 dark:text-slate-300 cursor-pointer"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

          <button
            onClick={onApply}
            disabled={isProcessing || !hasOperations}
            className="px-4 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-pink-600 to-rose-600 hover:opacity-90 disabled:opacity-50 transition-all rounded-xl flex items-center gap-2 cursor-pointer shadow-sm"
          >
            {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>Apply changes</span>
          </button>

          <button
            onClick={onReset}
            className="p-2 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-950/40 cursor-pointer"
            title="Reset / Close File"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Privacy Warning Note & OCR Checkbox */}
      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium px-4 py-2 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-slate-200/55 dark:border-slate-800/55 flex flex-col gap-2 shadow-sm">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-pink-500 shrink-0" />
          <span>Exported PDF is flattened for privacy — text will not be selectable or searchable in the output.</span>
        </div>
        <div className="flex flex-col gap-1 border-t border-slate-200/40 dark:border-slate-800/40 pt-2">
          <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={doOcr}
              onChange={(e) => setDoOcr(e.target.checked)}
              className="accent-pink-500 rounded"
            />
            <span>Add searchable text layer (OCR)</span>
          </label>
          <span className="text-[9px] text-slate-405 pl-5">
            Note: OCR is processed client-side. Accuracy is not perfect and may misread some characters/fonts.
          </span>
        </div>
      </div>

      {/* Text Sub-toolbar */}
      {activeTool === 'text' && (
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 text-xs flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold">Font:</span>
            <select
              value={fontName}
              onChange={(e) => setFontName(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 rounded font-bold"
            >
              <option value="Helvetica">Helvetica</option>
              <option value="TimesRoman">Times Roman</option>
              <option value="Courier">Courier</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold">Size:</span>
            <input
              type="number" min="6" max="96"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value) || 12)}
              className="w-14 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 rounded text-center font-bold"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setIsBold(!isBold)}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                isBold
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-350 hover:bg-slate-250 dark:hover:bg-slate-700'
              }`}
              title="Bold (Ctrl+B)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsItalic(!isItalic)}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                isItalic
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-350 hover:bg-slate-250 dark:hover:bg-slate-700'
              }`}
              title="Italic (Ctrl+I)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold">Color:</span>
            <div className="flex gap-1">
              {TEXT_COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => setTextColor(c)}
                  className={`w-5 h-5 rounded-full border border-slate-300 cursor-pointer ${textColor === c ? 'ring-2 ring-pink-500' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <span className="text-[10px] text-slate-400 italic">
            Click existing text to edit, or click empty space to insert new text.
          </span>
        </div>
      )}

      {/* Shape Sub-toolbar */}
      {activeTool === 'shape' && (
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 text-xs flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold">Color:</span>
            <div className="flex gap-1">
              {SHAPE_COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => setShapeColor(c)}
                  className={`w-5 h-5 rounded-full border border-slate-300 cursor-pointer ${shapeColor === c ? 'ring-2 ring-pink-500' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <label className="flex items-center gap-1.5 font-bold cursor-pointer select-none">
            <input
              type="checkbox" checked={shapeFill}
              onChange={(e) => setShapeFill(e.target.checked)}
              className="accent-pink-500 rounded"
            />
            <span>Filled</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold">Border:</span>
            <input
              type="number" min="1" max="20"
              value={shapeStrokeWidth}
              onChange={(e) => setShapeStrokeWidth(parseInt(e.target.value) || 2)}
              className="w-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 rounded text-center font-bold"
            />
            <span className="text-slate-400">px</span>
          </div>
          <span className="text-[10px] text-slate-400 italic">
            Click and drag on a page to draw a shape.
          </span>
        </div>
      )}
    </div>
  );
}
