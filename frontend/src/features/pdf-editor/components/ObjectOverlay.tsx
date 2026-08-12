// ============================================================
// CompressKro PDF Editor — Object Overlay Component
// ============================================================
// Renders a single EditorObject as a positioned HTML overlay
// on top of the PDF canvas. Handles selection, drag, resize,
// inline text editing, and visual feedback.
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import { Trash2, ImageIcon, X } from 'lucide-react';
import type {
  EditorObject,
  TextObject,
  ImageObject,
  ShapeObject,
  WhiteoutObject,
  SignatureObject,
  FreehandObject,
  ViewportRect,
  ResizeHandle,
} from '../core/types';
import { ResizeHandles } from './ResizeHandles';

interface ObjectOverlayProps {
  object: EditorObject;
  viewportRect: ViewportRect;
  isSelected: boolean;
  isEditing: boolean;
  viewportScale: number;
  viewport?: any;
  onSelect: (id: string) => void;
  onStartDrag: (e: React.PointerEvent, id: string) => void;
  onStartResize: (e: React.PointerEvent, id: string, handle: ResizeHandle) => void;
  onDelete: (id: string) => void;
  onEditText: (id: string, newText: string) => void;
  onStartEditing: (id: string) => void;
  onStopEditing: () => void;
  onReplaceImage?: (id: string) => void;
}

export const ObjectOverlay = React.memo(function ObjectOverlay({
  object: obj,
  viewportRect: vRect,
  isSelected,
  isEditing,
  viewportScale,
  viewport,
  onSelect,
  onStartDrag,
  onStartResize,
  onDelete,
  onEditText,
  onStartEditing,
  onStopEditing,
  onReplaceImage,
}: ObjectOverlayProps) {
  switch (obj.type) {
    case 'text':
      return (
        <TextOverlay
          obj={obj as TextObject}
          vRect={vRect}
          isSelected={isSelected}
          isEditing={isEditing}
          viewportScale={viewportScale}
          onSelect={onSelect}
          onStartDrag={onStartDrag}
          onStartResize={onStartResize}
          onDelete={onDelete}
          onEditText={onEditText}
          onStartEditing={onStartEditing}
          onStopEditing={onStopEditing}
        />
      );
    case 'image':
      return (
        <ImageOverlay
          obj={obj as ImageObject}
          vRect={vRect}
          isSelected={isSelected}
          onSelect={onSelect}
          onStartDrag={onStartDrag}
          onStartResize={onStartResize}
          onDelete={onDelete}
          onReplaceImage={onReplaceImage}
        />
      );
    case 'whiteout':
      return (
        <WhiteoutOverlay
          obj={obj as WhiteoutObject}
          vRect={vRect}
          isSelected={isSelected}
          onSelect={onSelect}
          onStartDrag={onStartDrag}
          onStartResize={onStartResize}
          onDelete={onDelete}
        />
      );
    case 'shape':
      return (
        <ShapeOverlay
          obj={obj as ShapeObject}
          vRect={vRect}
          isSelected={isSelected}
          viewport={viewport}
          onSelect={onSelect}
          onStartDrag={onStartDrag}
          onStartResize={onStartResize}
          onDelete={onDelete}
        />
      );
    case 'signature':
      return (
        <SignatureImageOverlay
          obj={obj as SignatureObject}
          vRect={vRect}
          isSelected={isSelected}
          onSelect={onSelect}
          onStartDrag={onStartDrag}
          onStartResize={onStartResize}
          onDelete={onDelete}
        />
      );
    case 'freehand':
      return (
        <FreehandOverlay
          obj={obj as FreehandObject}
          vRect={vRect}
          isSelected={isSelected}
          viewport={viewport}
          onSelect={onSelect}
          onStartDrag={onStartDrag}
          onDelete={onDelete}
        />
      );
    default:
      return null;
  }
});

// ---- Delete Button ----

function DeleteButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      className="absolute -top-7 left-1/2 -translate-x-1/2 p-1 bg-red-600 rounded-full text-white shadow-md cursor-pointer hover:bg-red-700 z-50"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

// ---- Text Overlay ----

function TextOverlay({
  obj, vRect, isSelected, isEditing, viewportScale,
  onSelect, onStartDrag, onStartResize, onDelete, onEditText, onStartEditing, onStopEditing,
}: {
  obj: TextObject;
  vRect: ViewportRect;
  isSelected: boolean;
  isEditing: boolean;
  viewportScale: number;
  onSelect: (id: string) => void;
  onStartDrag: (e: React.PointerEvent, id: string) => void;
  onStartResize: (e: React.PointerEvent, id: string, handle: ResizeHandle) => void;
  onDelete: (id: string) => void;
  onEditText: (id: string, newText: string) => void;
  onStartEditing: (id: string) => void;
  onStopEditing: () => void;
}) {
  const [localText, setLocalText] = useState(obj.text);
  const inputRef = useRef<HTMLInputElement>(null);
  const commitRef = useRef(false);

  // Refs to track latest values for the cleanup effect
  const localTextRef = useRef(localText);
  useEffect(() => { localTextRef.current = localText; }, [localText]);

  const onEditTextRef = useRef(onEditText);
  useEffect(() => { onEditTextRef.current = onEditText; }, [onEditText]);

  const objTextRef = useRef(obj.text);
  useEffect(() => { objTextRef.current = obj.text; }, [obj.text]);

  // Sync local text when the object text changes externally (e.g. undo)
  useEffect(() => {
    if (!isEditing) {
      setLocalText(obj.text);
    }
  }, [obj.text, isEditing]);

  useEffect(() => {
    if (isEditing) {
      setLocalText(obj.text);
      commitRef.current = false;
      // Small delay to ensure the input is mounted
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isEditing, obj.text]);

  // Auto-commit text when editing stops (e.g. clicking away, selection change)
  // This handles the case where the input unmounts before onBlur fires.
  const prevEditingRef = useRef(isEditing);
  useEffect(() => {
    if (prevEditingRef.current && !isEditing) {
      // Editing just stopped — commit any pending changes
      if (!commitRef.current && localTextRef.current !== objTextRef.current) {
        onEditTextRef.current(obj.id, localTextRef.current);
      }
      commitRef.current = false;
    }
    prevEditingRef.current = isEditing;
  }, [isEditing, obj.id]);

  const commitEdit = () => {
    if (commitRef.current) return;
    commitRef.current = true;
    onEditText(obj.id, localText);
    onStopEditing();
  };

  // For extracted text that hasn't been modified yet, show it without
  // a solid background so the canvas text shows through
  const isUnmodifiedExtracted = obj.origin === 'extracted' && !obj.isModified && !isEditing;

  const fontSize = obj.fontSize * viewportScale;

  // When text is modified or being edited, expand bounds slightly
  // so the white background fully covers the original canvas text
  const needsCover = obj.isModified || obj.origin === 'inserted' || isEditing;
  const pad = needsCover ? 2 : 0;

  const style: React.CSSProperties = {
    left: vRect.left - pad,
    top: vRect.top - pad,
    width: vRect.width + pad * 2,
    height: vRect.height + pad * 2,
    fontFamily: obj.font.cssFontFamily,
    fontWeight: obj.font.weight === 'bold' ? 700 : 400,
    fontStyle: obj.font.style,
    fontSize: `${fontSize}px`,
    lineHeight: 1,
    color: obj.color,
    opacity: obj.opacity,
  };

  if (isUnmodifiedExtracted) {
    // Extracted text run hover highlight (looks exactly like Sejda)
    return (
      <div
        data-text={obj.text}
        className="absolute cursor-text z-20 hover:outline hover:outline-1 hover:outline-dashed hover:outline-blue-400 hover:bg-blue-50/15 rounded-sm transition-all duration-75"
        style={{ ...style, background: 'transparent' }}
        onClick={(e) => { e.stopPropagation(); onStartEditing(obj.id); }}
        title="Click to edit text"
      />
    );
  }

  return (
    <div
      className={`absolute z-30 rounded-sm select-none ${
        isEditing
          ? 'ring-1 ring-blue-500 shadow-sm'
          : isSelected
          ? 'ring-1 ring-pink-500'
          : ''
      } ${obj.origin === 'inserted' ? 'cursor-move' : 'cursor-text'}`}
      style={{
        ...style,
        background: obj.isModified || obj.origin === 'inserted' || isEditing ? '#ffffff' : 'transparent',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(obj.id);
        onStartEditing(obj.id);
      }}
      onPointerDown={(e) => { if (!isEditing && obj.origin === 'inserted') onStartDrag(e, obj.id); }}
      onDoubleClick={(e) => { e.stopPropagation(); onSelect(obj.id); onStartEditing(obj.id); }}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
            if (e.key === 'Escape') { e.preventDefault(); setLocalText(obj.text); onStopEditing(); }
            // Let formatting shortcuts (Ctrl+B, Ctrl+I, Ctrl+[, Ctrl+]) bubble
            // up to the window-level handler in PdfEditor so bold/italic/size
            // changes work while actively editing text.
            if ((e.ctrlKey || e.metaKey) && ['b', 'i', '[', ']'].includes(e.key.toLowerCase())) {
              return;
            }
            e.stopPropagation();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onBlur={commitEdit}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full h-full outline-none border-none p-0 m-0 bg-transparent focus:ring-0 focus:outline-none"
          style={{
            fontFamily: obj.font.cssFontFamily,
            fontWeight: obj.font.weight === 'bold' ? 700 : 400,
            fontStyle: obj.font.style,
            fontSize: `${fontSize}px`,
            lineHeight: 1,
            color: obj.color,
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center select-text overflow-hidden whitespace-nowrap px-0.5">
          {obj.text}
        </div>
      )}

      {isSelected && !isEditing && (
        <>
          <ResizeHandles
            onHandlePointerDown={(e, handle) => onStartResize(e, obj.id, handle)}
          />
          <DeleteButton onClick={() => onDelete(obj.id)} />
        </>
      )}
    </div>
  );
}

// ---- Image Overlay ----

function ImageOverlay({
  obj, vRect, isSelected,
  onSelect, onStartDrag, onStartResize, onDelete, onReplaceImage,
}: {
  obj: ImageObject;
  vRect: ViewportRect;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onStartDrag: (e: React.PointerEvent, id: string) => void;
  onStartResize: (e: React.PointerEvent, id: string, handle: ResizeHandle) => void;
  onDelete: (id: string) => void;
  onReplaceImage?: (id: string) => void;
}) {
  if (obj.deleted) {
    return (
      <div
        className="absolute z-30 border border-red-500 bg-white/90 flex items-center justify-center"
        style={{ left: vRect.left, top: vRect.top, width: vRect.width, height: vRect.height }}
      >
        <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Deleted</span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(obj.id); }}
          className="absolute -top-2 -right-2 p-0.5 bg-slate-900 rounded-full text-white hover:bg-slate-700 cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Show replacement image or the original image detection box
  const displayUrl = obj.replacementDataUrl || obj.dataUrl;
  const isExtracted = obj.origin === 'extracted' && !obj.replacementDataUrl;

  if (isExtracted) {
    // For extracted images without modifications, show a subtle hover overlay.
    // Use pointer-events:none + auto on controls so text beneath stays clickable.
    return (
      <div
        className="absolute border border-transparent hover:border-indigo-400/60 hover:bg-indigo-500/10 group flex flex-col justify-between p-1"
        style={{
          left: vRect.left, top: vRect.top, width: vRect.width, height: vRect.height,
          zIndex: 5, pointerEvents: 'none',
        }}
      >
        <div className="absolute top-1 left-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-900/80 px-1 rounded text-[8px] text-white">
          <span>Image</span>
        </div>
        <div
          className="flex gap-1 justify-center absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-900 p-0.5 rounded shadow"
          style={{ pointerEvents: 'auto' }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(obj.id); }}
            className="p-1 text-red-500 hover:bg-slate-100 rounded cursor-pointer"
            title="Delete Image"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          {onReplaceImage && (
            <button
              onClick={(e) => { e.stopPropagation(); onReplaceImage(obj.id); }}
              className="p-1 text-emerald-500 hover:bg-slate-100 rounded cursor-pointer"
              title="Replace Image"
            >
              <ImageIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`absolute cursor-move z-30 group select-none ${isSelected ? 'ring-2 ring-pink-500' : ''}`}
      style={{ left: vRect.left, top: vRect.top, width: vRect.width, height: vRect.height, opacity: obj.opacity }}
      onPointerDown={(e) => onStartDrag(e, obj.id)}
      onClick={(e) => { e.stopPropagation(); onSelect(obj.id); }}
    >
      {displayUrl && (
        <img src={displayUrl} alt="User content" className="w-full h-full object-fill pointer-events-none" />
      )}
      {obj.replacementDataUrl && (
        <div className="absolute top-1 left-1 bg-emerald-600 text-white rounded px-1 text-[8px] font-bold">Replaced</div>
      )}
      {isSelected && (
        <>
          <ResizeHandles onHandlePointerDown={(e, handle) => onStartResize(e, obj.id, handle)} />
          <DeleteButton onClick={() => onDelete(obj.id)} />
        </>
      )}
    </div>
  );
}

// ---- Whiteout Overlay ----

function WhiteoutOverlay({
  obj, vRect, isSelected,
  onSelect, onStartDrag, onStartResize, onDelete,
}: {
  obj: WhiteoutObject;
  vRect: ViewportRect;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onStartDrag: (e: React.PointerEvent, id: string) => void;
  onStartResize: (e: React.PointerEvent, id: string, handle: ResizeHandle) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={`absolute cursor-move border border-dashed border-slate-350 bg-white/95 z-30 flex items-center justify-center group ${
        isSelected ? 'ring-2 ring-pink-500' : ''
      }`}
      style={{ left: vRect.left, top: vRect.top, width: vRect.width, height: vRect.height }}
      onPointerDown={(e) => onStartDrag(e, obj.id)}
      onClick={(e) => { e.stopPropagation(); onSelect(obj.id); }}
      title="Whiteout area"
    >
      <span className="text-[7px] text-slate-300 select-none uppercase font-extrabold tracking-wider leading-none">
        Whiteout
      </span>
      {isSelected && (
        <>
          <ResizeHandles onHandlePointerDown={(e, handle) => onStartResize(e, obj.id, handle)} />
          <DeleteButton onClick={() => onDelete(obj.id)} />
        </>
      )}
    </div>
  );
}

// ---- Shape Overlay ----

function ShapeOverlay({
  obj, vRect, isSelected, viewport,
  onSelect, onStartDrag, onStartResize, onDelete,
}: {
  obj: ShapeObject;
  vRect: ViewportRect;
  isSelected: boolean;
  viewport: any;
  onSelect: (id: string) => void;
  onStartDrag: (e: React.PointerEvent, id: string) => void;
  onStartResize: (e: React.PointerEvent, id: string, handle: ResizeHandle) => void;
  onDelete: (id: string) => void;
}) {
  const isLineOrArrow = obj.shapeKind === 'line' || obj.shapeKind === 'arrow';

  return (
    <div
      className={`absolute cursor-move z-30 group ${isSelected ? 'ring-2 ring-pink-500' : ''}`}
      style={{
        left: vRect.left,
        top: vRect.top,
        width: vRect.width,
        height: vRect.height,
        opacity: obj.opacity,
        ...(isLineOrArrow ? {} : {
          border: obj.strokeColor ? `${obj.strokeWidth}px solid ${obj.strokeColor}` : 'none',
          backgroundColor: obj.fillColor || 'transparent',
          borderRadius: obj.shapeKind === 'circle' ? '50%' : 0,
        })
      }}
      onPointerDown={(e) => onStartDrag(e, obj.id)}
      onClick={(e) => { e.stopPropagation(); onSelect(obj.id); }}
    >
      {isLineOrArrow && viewport && (() => {
        let x1 = 0, y1 = 0, x2 = vRect.width, y2 = vRect.height;
        if (obj.startPoint && obj.endPoint) {
          const startPt = viewport.convertToViewportPoint(obj.startPoint.x, obj.startPoint.y);
          const endPt = viewport.convertToViewportPoint(obj.endPoint.x, obj.endPoint.y);
          
          x1 = startPt[0] - vRect.left;
          y1 = startPt[1] - vRect.top;
          x2 = endPt[0] - vRect.left;
          y2 = endPt[1] - vRect.top;
        }
        const arrowMarkerId = `arrow-marker-${obj.id}`;
        return (
          <svg className="w-full h-full overflow-visible pointer-events-none">
            {obj.shapeKind === 'arrow' && (
              <defs>
                <marker id={arrowMarkerId} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={obj.strokeColor || '#000'} />
                </marker>
              </defs>
            )}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={obj.strokeColor || '#000'}
              strokeWidth={obj.strokeWidth}
              markerEnd={obj.shapeKind === 'arrow' ? `url(#${arrowMarkerId})` : undefined}
            />
          </svg>
        );
      })()}

      {isSelected && (
        <>
          <ResizeHandles onHandlePointerDown={(e, handle) => onStartResize(e, obj.id, handle)} />
          <DeleteButton onClick={() => onDelete(obj.id)} />
        </>
      )}
    </div>
  );
}

// ---- Freehand Overlay ----

function FreehandOverlay({
  obj, vRect, isSelected, viewport,
  onSelect, onStartDrag, onDelete,
}: {
  obj: FreehandObject;
  vRect: ViewportRect;
  isSelected: boolean;
  viewport: any;
  onSelect: (id: string) => void;
  onStartDrag: (e: React.PointerEvent, id: string) => void;
  onDelete: (id: string) => void;
}) {
  const pathD = (() => {
    if (!obj.points || obj.points.length === 0 || !viewport) return '';
    const pts = obj.points.map(pt => {
      const vpPt = viewport.convertToViewportPoint(pt.x, pt.y);
      const lx = vpPt[0] - vRect.left;
      const ly = vpPt[1] - vRect.top;
      return `${lx},${ly}`;
    });
    return `M ${pts.join(' L ')}`;
  })();

  return (
    <div
      className={`absolute cursor-move z-30 group ${isSelected ? 'ring-2 ring-pink-500' : ''}`}
      style={{ left: vRect.left, top: vRect.top, width: vRect.width, height: vRect.height }}
      onPointerDown={(e) => onStartDrag(e, obj.id)}
      onClick={(e) => { e.stopPropagation(); onSelect(obj.id); }}
    >
      <svg className="w-full h-full pointer-events-none overflow-visible">
        <path
          d={pathD}
          fill="none"
          stroke={obj.strokeColor}
          strokeWidth={obj.strokeWidth}
          opacity={obj.opacity}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {isSelected && (
        <DeleteButton onClick={() => onDelete(obj.id)} />
      )}
    </div>
  );
}

// ---- Signature/Image Overlay (for inserted images and signatures) ----

function SignatureImageOverlay({
  obj, vRect, isSelected,
  onSelect, onStartDrag, onStartResize, onDelete,
}: {
  obj: SignatureObject;
  vRect: ViewportRect;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onStartDrag: (e: React.PointerEvent, id: string) => void;
  onStartResize: (e: React.PointerEvent, id: string, handle: ResizeHandle) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={`absolute cursor-move z-30 group select-none ${isSelected ? 'ring-2 ring-pink-500' : ''}`}
      style={{ left: vRect.left, top: vRect.top, width: vRect.width, height: vRect.height, opacity: obj.opacity }}
      onPointerDown={(e) => onStartDrag(e, obj.id)}
      onClick={(e) => { e.stopPropagation(); onSelect(obj.id); }}
    >
      <img src={obj.dataUrl} alt="Signature" className="w-full h-full object-contain pointer-events-none" />
      {isSelected && (
        <>
          <ResizeHandles onHandlePointerDown={(e, handle) => onStartResize(e, obj.id, handle)} />
          <DeleteButton onClick={() => onDelete(obj.id)} />
        </>
      )}
    </div>
  );
}
