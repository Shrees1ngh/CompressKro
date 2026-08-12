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

    onClearSelection();
    if (activeTool === 'select') {
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

    if (activeTool === 'whiteout' || activeTool === 'shape' || activeTool === 'ellipse' || activeTool === 'line' || activeTool === 'arrow' || activeTool === 'highlight' || activeTool === 'underline' || activeTool === 'strikeout') {
      setDrawingState({ pageIndex, startX: vx, startY: vy, currentX: vx, currentY: vy });
    }

    if (activeTool === 'freehand' || activeTool === 'freehand-highlight') {
      const pdfPt = viewportPointToPdf(vx, vy, viewport);
      setDrawingState({
        pageIndex,
        startX: vx,
        startY: vy,
        currentX: vx,
        currentY: vy,
        points: [{ x: pdfPt.x, y: pdfPt.y }]
      });
    }
  }, [activeTool, viewport, pageIndex, fontSize, fontName, isBold, isItalic, textColor, pageObjects.length, onInsertObject, onStartEditing, onClearSelection]);

  const handlePointerMove = useCallback((e: React.MouseEvent) => {
    if (!drawingState) return;
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || !viewport) return;
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;

    setDrawingState(prev => {
      if (!prev) return null;
      const base = {
        ...prev,
        currentX: vx,
        currentY: vy,
      };
      if (activeTool === 'freehand' || activeTool === 'freehand-highlight') {
        const pdfPt = viewportPointToPdf(vx, vy, viewport);
        base.points = [...(prev.points || []), { x: pdfPt.x, y: pdfPt.y }];
      }
      return base;
    });
  }, [drawingState, activeTool, viewport]);

  const handlePointerUp = useCallback(() => {
    if (!drawingState || !viewport) {
      setDrawingState(null);
      return;
    }

    const dx = drawingState.currentX - drawingState.startX;
    const dy = drawingState.currentY - drawingState.startY;

    if (activeTool === 'freehand' || activeTool === 'freehand-highlight') {
      if (drawingState.points && drawingState.points.length >= 2) {
        const xs = drawingState.points.map(pt => pt.x);
        const ys = drawingState.points.map(pt => pt.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const pdfBounds = {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY
        };

        onInsertObject({
          id: generateId('frh'),
          type: 'freehand',
          pageIndex,
          bounds: pdfBounds,
          rotation: 0,
          opacity: activeTool === 'freehand-highlight' ? 0.45 : 1,
          zIndex: pageObjects.length,
          locked: false,
          points: drawingState.points,
          strokeColor: shapeColor,
          strokeWidth: activeTool === 'freehand-highlight' ? shapeStrokeWidth * 3.5 : shapeStrokeWidth,
        });
      }
    } else if (Math.abs(dx) > MIN_DRAW_DISTANCE && Math.abs(dy) > MIN_DRAW_DISTANCE) {
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
      } else if (activeTool === 'shape' || activeTool === 'ellipse' || activeTool === 'line' || activeTool === 'arrow') {
        const shapeKind = 
          activeTool === 'ellipse' ? 'circle' :
          activeTool === 'line' ? 'line' :
          activeTool === 'arrow' ? 'arrow' : 'rectangle';

        const startPt = viewportPointToPdf(drawingState.startX, drawingState.startY, viewport);
        const endPt = viewportPointToPdf(drawingState.currentX, drawingState.currentY, viewport);

        onInsertObject({
          id: generateId('shp'),
          type: 'shape',
          pageIndex,
          bounds: pdfBounds,
          rotation: 0,
          opacity: 1,
          zIndex: pageObjects.length,
          locked: false,
          shapeKind,
          fillColor: (shapeKind === 'rectangle' || shapeKind === 'circle') && shapeFill ? shapeColor : null,
          strokeColor: (!(shapeKind === 'rectangle' || shapeKind === 'circle') || !shapeFill) ? shapeColor : null,
          strokeWidth: shapeStrokeWidth,
          startPoint: { x: startPt.x, y: startPt.y },
          endPoint: { x: endPt.x, y: endPt.y }
        });
      } else if (activeTool === 'highlight') {
        onInsertObject({
          id: generateId('shp'),
          type: 'shape',
          pageIndex,
          bounds: pdfBounds,
          rotation: 0,
          opacity: 0.35,
          zIndex: pageObjects.length,
          locked: false,
          shapeKind: 'rectangle',
          fillColor: shapeColor,
          strokeColor: null,
          strokeWidth: 0,
        });
      } else if (activeTool === 'underline') {
        onInsertObject({
          id: generateId('shp'),
          type: 'shape',
          pageIndex,
          bounds: pdfBounds,
          rotation: 0,
          opacity: 1,
          zIndex: pageObjects.length,
          locked: false,
          shapeKind: 'line',
          fillColor: null,
          strokeColor: shapeColor,
          strokeWidth: shapeStrokeWidth,
          startPoint: { x: pdfBounds.x, y: pdfBounds.y },
          endPoint: { x: pdfBounds.x + pdfBounds.width, y: pdfBounds.y }
        });
      } else if (activeTool === 'strikeout') {
        onInsertObject({
          id: generateId('shp'),
          type: 'shape',
          pageIndex,
          bounds: pdfBounds,
          rotation: 0,
          opacity: 1,
          zIndex: pageObjects.length,
          locked: false,
          shapeKind: 'line',
          fillColor: null,
          strokeColor: shapeColor,
          strokeWidth: shapeStrokeWidth,
          startPoint: { x: pdfBounds.x, y: pdfBounds.y + pdfBounds.height / 2 },
          endPoint: { x: pdfBounds.x + pdfBounds.width, y: pdfBounds.y + pdfBounds.height / 2 }
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
              : activeTool === 'whiteout' || activeTool === 'shape' || activeTool === 'ellipse' || activeTool === 'line' || activeTool === 'arrow' || activeTool === 'highlight' || activeTool === 'underline' || activeTool === 'strikeout' || activeTool === 'freehand' || activeTool === 'freehand-highlight' ? 'crosshair'
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
                viewport={viewport}
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

          {/* Drawing preview shape/rect */}
          {drawingState && (() => {
            const left = Math.min(drawingState.startX, drawingState.currentX);
            const top = Math.min(drawingState.startY, drawingState.currentY);
            const width = Math.max(1, Math.abs(drawingState.currentX - drawingState.startX));
            const height = Math.max(1, Math.abs(drawingState.currentY - drawingState.startY));

            if (activeTool === 'freehand' || activeTool === 'freehand-highlight') {
              if (!drawingState.points || drawingState.points.length === 0) return null;
              const pts = drawingState.points.map(pt => {
                const vpPt = viewport.convertToViewportPoint(pt.x, pt.y);
                return `${vpPt[0]},${vpPt[1]}`;
              });
              return (
                <svg className="absolute inset-0 z-50 pointer-events-none w-full h-full">
                  <path
                    d={`M ${pts.join(' L ')}`}
                    fill="none"
                    stroke={shapeColor}
                    strokeWidth={activeTool === 'freehand-highlight' ? shapeStrokeWidth * 3.5 : shapeStrokeWidth}
                    opacity={activeTool === 'freehand-highlight' ? 0.45 : 1}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              );
            }

            if (activeTool === 'whiteout') {
              return (
                <div
                  className="absolute border border-dashed border-slate-400 bg-white/80 z-50 pointer-events-none"
                  style={{ left, top, width, height }}
                />
              );
            }

            if (activeTool === 'shape' || activeTool === 'highlight') {
              return (
                <div
                  className="absolute border border-dashed border-pink-500 z-50 pointer-events-none"
                  style={{
                    left, top, width, height,
                    backgroundColor: activeTool === 'highlight' ? shapeColor : (shapeFill ? shapeColor : 'transparent'),
                    borderColor: activeTool === 'highlight' ? 'transparent' : shapeColor,
                    opacity: activeTool === 'highlight' ? 0.35 : 1,
                  }}
                />
              );
            }

            if (activeTool === 'ellipse') {
              return (
                <div
                  className="absolute border border-dashed border-pink-500 rounded-full z-50 pointer-events-none"
                  style={{
                    left, top, width, height,
                    borderColor: shapeColor,
                    backgroundColor: shapeFill ? shapeColor : 'transparent',
                  }}
                />
              );
            }

            if (activeTool === 'line' || activeTool === 'arrow' || activeTool === 'underline' || activeTool === 'strikeout') {
              let x1 = 0, y1 = 0, x2 = width, y2 = height;
              if (activeTool === 'underline') {
                y1 = height;
                y2 = height;
              } else if (activeTool === 'strikeout') {
                y1 = height / 2;
                y2 = height / 2;
              } else {
                const isSlopeUp = (drawingState.currentX - drawingState.startX) * (drawingState.currentY - drawingState.startY) < 0;
                if (isSlopeUp) {
                  y1 = height;
                  y2 = 0;
                }
              }

              return (
                <svg
                  className="absolute z-50 pointer-events-none"
                  style={{ left, top, width, height }}
                >
                  {activeTool === 'arrow' && (
                    <defs>
                      <marker id="preview-arrow-marker" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill={shapeColor} />
                      </marker>
                    </defs>
                  )}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={shapeColor}
                    strokeWidth={shapeStrokeWidth}
                    markerEnd={activeTool === 'arrow' ? 'url(#preview-arrow-marker)' : undefined}
                  />
                </svg>
              );
            }

            return null;
          })()}
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
