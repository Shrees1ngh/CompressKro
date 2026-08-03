// ============================================================
// CompressKro PDF Editor — Page Canvas Component
// ============================================================
// Renders a single PDF page: the PDF.js canvas plus all
// interactive object overlays. Handles page-level pointer
// events for drawing tools.
// ============================================================

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import type {
  EditorObject,
  TextObject,
  ToolType,
  ResizeHandle,
  Bounds,
  ViewportRect,
  DrawInteraction,
} from '../core/types';
import { MIN_DRAW_DISTANCE } from '../core/constants';
import { pdfBoundsToViewportRect, viewportRectToPdfBounds, viewportPointToPdf } from '../utils/geometry';
import { generateId } from '../core/id';
import { ObjectOverlay } from './ObjectOverlay';
import { getStandardFontKey, getCssFontFamily } from '../utils/font';

interface PageCanvasProps {
  pageIndex: number;
  pdfjsDoc: any;
  zoom: number;
  pageWidthPts: number;
  pageHeightPts: number;
  /** All objects for this page, sorted by zIndex. */
  pageObjects: EditorObject[];
  activeTool: ToolType;
  selectedIds: Set<string>;
  editingTextId: string | null;
  // Tool settings
  textColor: string;
  fontSize: number;
  fontName: string;
  isBold: boolean;
  isItalic: boolean;
  shapeColor: string;
  shapeFill: boolean;
  shapeStrokeWidth: number;
  // Callbacks
  onSelect: (id: string) => void;
  onClearSelection: () => void;
  onStartDrag: (e: React.PointerEvent, id: string) => void;
  onStartResize: (e: React.PointerEvent, id: string, handle: ResizeHandle) => void;
  onDelete: (id: string) => void;
  onEditText: (id: string, newText: string) => void;
  onStartEditing: (id: string) => void;
  onStopEditing: () => void;
  onInsertObject: (obj: EditorObject) => void;
  onReplaceImage: (id: string) => void;
  onBecameVisible: () => void;
  onTextColorsExtracted?: (updates: Array<{ id: string; color: string }>) => void;
  /** Ref to store viewport for this page (needed by parent drag system). */
  viewportsRef: React.MutableRefObject<{ [key: number]: any }>;
}

export const PageCanvas = React.memo(function PageCanvas({
  pageIndex,
  pdfjsDoc,
  zoom,
  pageWidthPts,
  pageHeightPts,
  pageObjects,
  activeTool,
  selectedIds,
  editingTextId,
  textColor,
  fontSize,
  fontName,
  isBold,
  isItalic,
  shapeColor,
  shapeFill,
  shapeStrokeWidth,
  onSelect,
  onClearSelection,
  onStartDrag,
  onStartResize,
  onDelete,
  onEditText,
  onStartEditing,
  onStopEditing,
  onInsertObject,
  onReplaceImage,
  onBecameVisible,
  onTextColorsExtracted,
  viewportsRef,
}: PageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<any>(null);
  const [drawingState, setDrawingState] = useState<DrawInteraction | null>(null);

  const pageObjectsRef = useRef(pageObjects);
  useEffect(() => {
    pageObjectsRef.current = pageObjects;
  }, [pageObjects]);

  const onTextColorsExtractedRef = useRef(onTextColorsExtracted);
  useEffect(() => {
    onTextColorsExtractedRef.current = onTextColorsExtracted;
  }, [onTextColorsExtracted]);

  // ---- Render PDF page to canvas ----
  useEffect(() => {
    let renderTask: any = null;
    let cancelled = false;

    (async () => {
      if (!pdfjsDoc) return;
      try {
        const page = await pdfjsDoc.getPage(pageIndex + 1);
        const vp = page.getViewport({ scale: zoom });
        setViewport(vp);
        viewportsRef.current[pageIndex] = vp;

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        // High-DPI / Retina render support
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const renderVp = page.getViewport({ scale: zoom * dpr });

        // Set canvas coordinate size to the high-DPI viewport size
        canvas.width = Math.floor(renderVp.width);
        canvas.height = Math.floor(renderVp.height);
        // Set CSS size to match the standard viewport size
        canvas.style.width = `${vp.width}px`;
        canvas.style.height = `${vp.height}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx || cancelled) return;

        // Render at high-DPI scale
        renderTask = page.render({ canvasContext: ctx, viewport: renderVp });
        await renderTask.promise;

        // ---- CANVAS COLOR EXTRACTION ----
        if (!cancelled && onTextColorsExtractedRef.current) {
          const textObjectsToSample = pageObjectsRef.current.filter(
            (o): o is TextObject => o.type === 'text' && o.origin === 'extracted' && !o.colorExtracted
          );
          
          if (textObjectsToSample.length > 0) {
            const updates: Array<{ id: string; color: string }> = [];
            for (const obj of textObjectsToSample) {
              const color = extractTextColorFromCanvas(canvas, obj.bounds, renderVp);
              updates.push({ id: obj.id, color });
            }
            if (updates.length > 0) {
              onTextColorsExtractedRef.current(updates);
            }
          }
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException' && !cancelled) {
          console.warn(`Error rendering page ${pageIndex}:`, err);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (renderTask) {
        try { renderTask.cancel(); } catch (_) { /* ignore */ }
      }
    };
  }, [pdfjsDoc, pageIndex, zoom]);

  // ---- Visibility observer ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
            onBecameVisible();
          }
        }
      },
      { threshold: [0.1, 0.3, 0.5] }
    );

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [onBecameVisible]);

  // ---- Compute viewport rects for all objects ----
  const objectRects = useMemo(() => {
    if (!viewport) return new Map<string, ViewportRect>();
    const map = new Map<string, ViewportRect>();
    for (const obj of pageObjects) {
      map.set(obj.id, pdfBoundsToViewportRect(obj.bounds, viewport));
    }
    return map;
  }, [pageObjects, viewport]);

  // ---- Page interaction: drawing tools ----
  const handlePointerDown = useCallback((e: React.MouseEvent) => {
    // Only handle events initiated directly on the background canvas overlay,
    // not bubbling events from clicking child text runs or object overlays.
    if (e.target !== e.currentTarget) return;

    if (activeTool === 'select') {
      onClearSelection();
      return;
    }

    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || !viewport) return;
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;

    if (activeTool === 'text') {
      const pdfPt = viewportPointToPdf(vx, vy, viewport);
      const newObj: TextObject = {
        id: generateId('txt'),
        type: 'text',
        pageIndex,
        bounds: { x: pdfPt.x, y: pdfPt.y - fontSize, width: fontSize * 8, height: fontSize },
        rotation: 0,
        opacity: 1,
        zIndex: pageObjects.length,
        locked: false,
        origin: 'inserted',
        text: 'Type here...',
        originalText: '',
        fontSize,
        font: {
          pdfFontName: fontName,
          cssFontFamily: getCssFontFamily(fontName),
          standardFontKey: getStandardFontKey(fontName, isBold, isItalic),
          weight: isBold ? 'bold' : 'normal',
          style: isItalic ? 'italic' : 'normal',
        },
        color: textColor,
        letterSpacing: 0,
        lineHeight: 1.2,
        alignment: 'left',
        isModified: false,
      };
      onInsertObject(newObj);
      onStartEditing(newObj.id);
      return;
    }

    if (activeTool === 'whiteout' || activeTool === 'shape') {
      setDrawingState({ pageIndex, startX: vx, startY: vy, currentX: vx, currentY: vy });
    }
  }, [activeTool, viewport, pageIndex, fontSize, fontName, isBold, isItalic, textColor, pageObjects.length, onInsertObject, onStartEditing, onClearSelection]);

  const handlePointerMove = useCallback((e: React.MouseEvent) => {
    if (!drawingState) return;
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrawingState(prev => prev ? {
      ...prev,
      currentX: e.clientX - rect.left,
      currentY: e.clientY - rect.top,
    } : null);
  }, [drawingState]);

  const handlePointerUp = useCallback(() => {
    if (!drawingState || !viewport) {
      setDrawingState(null);
      return;
    }

    const dx = drawingState.currentX - drawingState.startX;
    const dy = drawingState.currentY - drawingState.startY;

    if (Math.abs(dx) > MIN_DRAW_DISTANCE && Math.abs(dy) > MIN_DRAW_DISTANCE) {
      const left = Math.min(drawingState.startX, drawingState.currentX);
      const top = Math.min(drawingState.startY, drawingState.currentY);
      const width = Math.abs(dx);
      const height = Math.abs(dy);

      const pdfBounds = viewportRectToPdfBounds(left, top, width, height, viewport);

      if (activeTool === 'whiteout') {
        onInsertObject({
          id: generateId('wht'),
          type: 'whiteout',
          pageIndex,
          bounds: pdfBounds,
          rotation: 0,
          opacity: 1,
          zIndex: pageObjects.length,
          locked: false,
        });
      } else if (activeTool === 'shape') {
        onInsertObject({
          id: generateId('shp'),
          type: 'shape',
          pageIndex,
          bounds: pdfBounds,
          rotation: 0,
          opacity: 1,
          zIndex: pageObjects.length,
          locked: false,
          shapeKind: 'rectangle',
          fillColor: shapeFill ? shapeColor : null,
          strokeColor: !shapeFill ? shapeColor : null,
          strokeWidth: shapeStrokeWidth,
        });
      }
    }

    setDrawingState(null);
  }, [drawingState, viewport, activeTool, pageIndex, shapeColor, shapeFill, shapeStrokeWidth, pageObjects.length, onInsertObject]);

  const vpWidth = viewport ? viewport.width : pageWidthPts * zoom;
  const vpHeight = viewport ? viewport.height : pageHeightPts * zoom;

  return (
    <div
      id={`page-wrapper-${pageIndex}`}
      className="pdf-page-wrapper relative border border-slate-200 dark:border-slate-800 shadow-md bg-white select-none mb-6 shrink-0"
      style={{ width: vpWidth, height: vpHeight }}
    >
      {/* PDF.js Rendered Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: vpWidth, height: vpHeight }}
      />

      {/* Loading overlay while viewport / page is being loaded */}
      {!viewport && (
        <div className="absolute inset-0 border border-dashed border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 rounded-xl flex items-center justify-center z-20">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      )}

      {/* Interaction Overlay */}
      {viewport && (
        <div
          ref={overlayRef}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          className="absolute inset-0 z-10"
          style={{
            cursor: activeTool === 'text' ? 'text'
              : activeTool === 'whiteout' || activeTool === 'shape' ? 'crosshair'
              : 'default',
          }}
        >
          {/* Object Overlays */}
          {pageObjects.map((obj) => {
            const vRect = objectRects.get(obj.id);
            if (!vRect) return null;

            return (
              <ObjectOverlay
                key={obj.id}
                object={obj}
                viewportRect={vRect}
                isSelected={selectedIds.has(obj.id)}
                isEditing={editingTextId === obj.id}
                viewportScale={zoom}
                onSelect={onSelect}
                onStartDrag={onStartDrag}
                onStartResize={onStartResize}
                onDelete={onDelete}
                onEditText={onEditText}
                onStartEditing={onStartEditing}
                onStopEditing={onStopEditing}
                onReplaceImage={onReplaceImage}
              />
            );
          })}

          {/* Drawing preview rectangle */}
          {drawingState && (
            <div
              className={`absolute border border-dashed z-50 pointer-events-none ${
                activeTool === 'whiteout' ? 'border-slate-400 bg-slate-100/40' : 'border-pink-500 bg-pink-500/15'
              }`}
              style={{
                left: Math.min(drawingState.startX, drawingState.currentX),
                top: Math.min(drawingState.startY, drawingState.currentY),
                width: Math.abs(drawingState.currentX - drawingState.startX),
                height: Math.abs(drawingState.currentY - drawingState.startY),
              }}
            />
          )}
        </div>
      )}
    </div>
  );
});

function extractTextColorFromCanvas(
  canvas: HTMLCanvasElement,
  bounds: Bounds,
  viewport: any
): string {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '#000000';

  const pt1 = viewport.convertToViewportPoint(bounds.x, bounds.y);
  const pt2 = viewport.convertToViewportPoint(bounds.x + bounds.width, bounds.y + bounds.height);

  const x = Math.floor(Math.min(pt1[0], pt2[0]));
  const y = Math.floor(Math.min(pt1[1], pt2[1]));
  const w = Math.floor(Math.abs(pt2[0] - pt1[0]));
  const h = Math.floor(Math.abs(pt2[1] - pt1[1]));

  if (w <= 0 || h <= 0) return '#000000';

  try {
    const imgData = ctx.getImageData(x, y, w, h);
    const data = imgData.data;

    const colorCounts: Record<string, number> = {};
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      const a = data[i+3];

      if (a < 50) continue;

      const binR = Math.floor(r / 16) * 16;
      const binG = Math.floor(g / 16) * 16;
      const binB = Math.floor(b / 16) * 16;
      const key = `${binR},${binG},${binB}`;
      colorCounts[key] = (colorCounts[key] || 0) + 1;
    }

    const sortedColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);

    if (sortedColors.length === 0) return '#000000';

    const bgKey = sortedColors[0][0];
    const [bgR, bgG, bgB] = bgKey.split(',').map(Number);

    for (let i = 1; i < sortedColors.length; i++) {
      const key = sortedColors[i][0];
      const [r, g, b] = key.split(',').map(Number);
      
      const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
      if (dist > 50) {
        const hex = '#' + [r, g, b].map(v => {
          const hexStr = v.toString(16);
          return hexStr.length === 1 ? '0' + hexStr : hexStr;
        }).join('');
        return hex;
      }
    }

    const bgLuminance = (0.299 * bgR + 0.587 * bgG + 0.114 * bgB) / 255;
    return bgLuminance > 0.5 ? '#000000' : '#ffffff';
  } catch (e) {
    console.error('Error extracting color:', e);
    return '#000000';
  }
}
