// ============================================================
// CompressKro PDF Editor — Editor Toolbar Component
// ============================================================
// Main floating toolbar with tool buttons, undo/redo, and
// sub-toolbars for text/shape properties.
// ============================================================
import { useState, useRef, useEffect } from 'react';
import {
  MousePointerClick, Type, Eraser, Image as ImageIcon,
  PenTool, Square, Undo2, Redo2, Check, X, RefreshCw,
  Bold, Italic, Sparkles, ChevronDown, Highlighter,
  Underline as UnderlineIcon, Strikethrough, Pencil,
  Circle, MoveRight, Slash,
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
}

export function EditorToolbar({
  activeTool, setActiveTool,
  canUndo, canRedo, onUndo, onRedo,
  onApply, onReset, isProcessing, hasOperations,
  textColor, setTextColor, fontSize, setFontSize, fontName, setFontName,
  isBold, setIsBold, isItalic, setIsItalic,
  shapeColor, setShapeColor, shapeFill, setShapeFill, shapeStrokeWidth, setShapeStrokeWidth,
  onAddImage, onOpenSignature,
}: EditorToolbarProps) {
  const [activeDropdown, setActiveDropdown] = useState<'annotate' | 'shapes' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const isAnnotateActive = ['strikeout', 'highlight', 'underline', 'freehand-highlight', 'freehand'].includes(activeTool);
  const isShapesActive = ['shape', 'ellipse', 'line', 'arrow'].includes(activeTool);

  return (
    <div className="space-y-3" ref={dropdownRef}>
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-4 shadow-sm z-40">
        <div className="flex items-center gap-2 relative">
          
          {/* Select Button */}
          <button
            onClick={() => { setActiveTool('select'); setActiveDropdown(null); }}
            className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTool === 'select'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
            }`}
            title="Select / Move Elements"
          >
            <MousePointerClick className="w-4 h-4" />
            <span className="hidden sm:inline">Select</span>
          </button>

          {/* Text Button */}
          <button
            onClick={() => { setActiveTool('text'); setActiveDropdown(null); }}
            className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTool === 'text'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
            }`}
            title="Add or Edit Text"
          >
            <Type className="w-4 h-4" />
            <span className="hidden sm:inline">Text</span>
          </button>

          {/* Annotate Dropdown Button */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveDropdown(prev => prev === 'annotate' ? null : 'annotate');
              }}
              className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                isAnnotateActive
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
              }`}
              title="Highlight, underline, strikeout text, or draw freehand"
            >
              <Highlighter className="w-4 h-4" />
              <span className="hidden sm:inline">
                {activeTool === 'strikeout' ? 'Strike out' :
                 activeTool === 'highlight' ? 'Highlight' :
                 activeTool === 'underline' ? 'Underline' :
                 activeTool === 'freehand-highlight' ? 'Freehand Highlight' :
                 activeTool === 'freehand' ? 'Draw' : 'Annotate'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5" />
            </button>

            {activeDropdown === 'annotate' && (
              <div className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg p-1.5 min-w-[180px] z-50 space-y-0.5">
                <div className="px-2 py-1 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Text markup</div>
                <button
                  onClick={() => { setActiveTool('strikeout'); setActiveDropdown(null); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    activeTool === 'strikeout' ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Strikethrough className="w-3.5 h-3.5" />
                  <span>Strike out</span>
                </button>
                <button
                  onClick={() => { setActiveTool('highlight'); setActiveDropdown(null); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    activeTool === 'highlight' ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Highlighter className="w-3.5 h-3.5" />
                  <span>Highlight</span>
                </button>
                <button
                  onClick={() => { setActiveTool('underline'); setActiveDropdown(null); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    activeTool === 'underline' ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <UnderlineIcon className="w-3.5 h-3.5" />
                  <span>Underline</span>
                </button>
                
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                <div className="px-2 py-1 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Freehand</div>
                <button
                  onClick={() => { setActiveTool('freehand-highlight'); setActiveDropdown(null); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    activeTool === 'freehand-highlight' ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Highlighter className="w-3.5 h-3.5 animate-pulse" />
                  <span>Freehand Highlight</span>
                </button>
                <button
                  onClick={() => { setActiveTool('freehand'); setActiveDropdown(null); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    activeTool === 'freehand' ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Draw</span>
                </button>
              </div>
            )}
          </div>

          {/* Shapes Dropdown Button */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveDropdown(prev => prev === 'shapes' ? null : 'shapes');
              }}
              className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                isShapesActive
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
              }`}
              title="Draw geometric shapes (ellipse, rectangle, line, arrow)"
            >
              {activeTool === 'ellipse' ? <Circle className="w-4 h-4" /> :
               activeTool === 'line' ? <Slash className="w-4 h-4" /> :
               activeTool === 'arrow' ? <MoveRight className="w-4 h-4" /> :
               <Square className="w-4 h-4" />}
              <span className="hidden sm:inline">
                {activeTool === 'ellipse' ? 'Ellipse' :
                 activeTool === 'shape' ? 'Rectangle' :
                 activeTool === 'line' ? 'Line' :
                 activeTool === 'arrow' ? 'Arrow' : 'Shapes'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5" />
            </button>

            {activeDropdown === 'shapes' && (
              <div className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg p-1.5 min-w-[150px] z-50 space-y-0.5">
                <button
                  onClick={() => { setActiveTool('ellipse'); setActiveDropdown(null); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    activeTool === 'ellipse' ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Circle className="w-3.5 h-3.5" />
                  <span>Ellipse</span>
                </button>
                <button
                  onClick={() => { setActiveTool('shape'); setActiveDropdown(null); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    activeTool === 'shape' ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Rectangle</span>
                </button>
                <button
                  onClick={() => { setActiveTool('line'); setActiveDropdown(null); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    activeTool === 'line' ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Slash className="w-3.5 h-3.5" />
                  <span>Line</span>
                </button>
                <button
                  onClick={() => { setActiveTool('arrow'); setActiveDropdown(null); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    activeTool === 'arrow' ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <MoveRight className="w-3.5 h-3.5" />
                  <span>Arrow</span>
                </button>
              </div>
            )}
          </div>

          {/* Whiteout Button */}
          <button
            onClick={() => { setActiveTool('whiteout'); setActiveDropdown(null); }}
            className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTool === 'whiteout'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
            }`}
            title="Erase / Whiteout Rectangles"
          >
            <Eraser className="w-4 h-4" />
            <span className="hidden sm:inline">Whiteout</span>
          </button>

          {/* Images Button */}
          <button
            onClick={() => { setActiveTool('image'); onAddImage(); setActiveDropdown(null); }}
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

          {/* Sign Button */}
          <button
            onClick={() => { setActiveTool('signature'); onOpenSignature(); setActiveDropdown(null); }}
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

      {/* Shape/Annotation Sub-toolbar */}
      {['shape', 'ellipse', 'line', 'arrow', 'freehand', 'freehand-highlight', 'highlight', 'underline', 'strikeout'].includes(activeTool) && (
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
          
          {['shape', 'ellipse'].includes(activeTool) && (
            <label className="flex items-center gap-1.5 font-bold cursor-pointer select-none">
              <input
                type="checkbox" checked={shapeFill}
                onChange={(e) => setShapeFill(e.target.checked)}
                className="accent-pink-500 rounded"
              />
              <span>Filled</span>
            </label>
          )}

          {!['highlight'].includes(activeTool) && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold">
                {['shape', 'ellipse'].includes(activeTool) ? 'Border:' : 'Thickness:'}
              </span>
              <input
                type="number" min="1" max="20"
                value={shapeStrokeWidth}
                onChange={(e) => setShapeStrokeWidth(parseInt(e.target.value) || 2)}
                className="w-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 rounded text-center font-bold"
              />
              <span className="text-slate-400">px</span>
            </div>
          )}

          <span className="text-[10px] text-pink-650 dark:text-pink-400 font-bold bg-pink-500/5 px-2 py-1 rounded-lg border border-pink-500/10">
            {activeTool === 'highlight' ? '👉 Click and drag a box over the text area you want to highlight.' :
             activeTool === 'underline' ? '👉 Click and drag a box over the text area to underline it.' :
             activeTool === 'strikeout' ? '👉 Click and drag a box over the text area to strike it out.' :
             activeTool === 'freehand' ? '👉 Click and drag on the page to draw freehand lines.' :
             activeTool === 'freehand-highlight' ? '👉 Click and drag on the page to draw translucent freehand highlights.' :
             activeTool === 'shape' ? '👉 Click and drag on the page to draw a rectangle.' :
             activeTool === 'ellipse' ? '👉 Click and drag on the page to draw an ellipse/circle.' :
             activeTool === 'line' ? '👉 Click and drag on the page to draw a straight line.' :
             activeTool === 'arrow' ? '👉 Click and drag on the page to draw an arrow.' :
             '👉 Click and drag on the page to place the annotation.'}
          </span>
        </div>
      )}
    </div>
  );
}
