// ============================================================
// CompressKro — Before/After Comparison Slider
// Professional image comparison with drag divider, zoom, pan
// ============================================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface ComparisonSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
}

const ZOOM_LEVELS = [50, 75, 100, 150, 200];

export function ComparisonSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Before',
  afterLabel = 'After',
}: ComparisonSliderProps) {
  const [sliderPos, setSliderPos] = useState(50); // % from left
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const getSliderFromEvent = useCallback((e: React.MouseEvent | MouseEvent | React.TouchEvent | TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const pos = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, pos)));
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    getSliderFromEvent(e);
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => getSliderFromEvent(e);
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, getSliderFromEvent]);

  // Touch support
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    getSliderFromEvent(e);
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: TouchEvent) => getSliderFromEvent(e);
    const onEnd = () => setIsDragging(false);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isDragging, getSliderFromEvent]);

  // Pan when zoomed
  const handlePanStart = (e: React.MouseEvent) => {
    if (zoom <= 100) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, px: panX, py: panY };
  };

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPanX(panStart.current.px + dx);
      setPanY(panStart.current.py + dy);
    };
    const onUp = () => setIsPanning(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPanning, panX, panY]);

  const handleZoomIn = () => {
    const idx = ZOOM_LEVELS.indexOf(zoom);
    if (idx < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[idx + 1]);
  };

  const handleZoomOut = () => {
    const idx = ZOOM_LEVELS.indexOf(zoom);
    if (idx > 0) {
      setZoom(ZOOM_LEVELS[idx - 1]);
      if (ZOOM_LEVELS[idx - 1] <= 100) { setPanX(0); setPanY(0); }
    }
  };

  const handleFit = () => { setZoom(100); setPanX(0); setPanY(0); };

  const imageStyle: React.CSSProperties = {
    transform: `translate(${panX}px, ${panY}px) scale(${zoom / 100})`,
    transformOrigin: 'center center',
    userSelect: 'none',
    cursor: zoom > 100 ? (isPanning ? 'grabbing' : 'grab') : 'default',
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    transition: isPanning || isDragging ? 'none' : 'transform 0.1s ease',
  };

  return (
    <div className="space-y-3">
      {/* Zoom Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= ZOOM_LEVELS[0]}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-all"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 w-10 text-center">
            {zoom}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-all"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleFit}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all ml-1"
            title="Fit to view"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-[10px] text-slate-400 dark:text-slate-500 flex gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-slate-500 inline-block" />
            {beforeLabel}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-violet-500 inline-block" />
            {afterLabel}
          </span>
        </div>
      </div>

      {/* Comparison Container */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-[repeating-conic-gradient(#f0f0f0_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] dark:bg-[repeating-conic-gradient(#1e293b_0%_25%,transparent_0%_50%)] dark:bg-[length:20px_20px] select-none"
        style={{ height: '300px' }}
        onMouseDown={zoom > 100 ? handlePanStart : undefined}
      >
        {/* AFTER image (right / full width) */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={afterUrl}
            alt="After optimization"
            style={imageStyle}
            draggable={false}
          />
        </div>

        {/* BEFORE image (clipped to left of slider) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          <img
            src={beforeUrl}
            alt="Before optimization"
            style={imageStyle}
            draggable={false}
          />
        </div>

        {/* Slider handle */}
        <div
          className="absolute top-0 bottom-0 flex flex-col items-center"
          style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)', zIndex: 10, cursor: 'ew-resize' }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Divider line */}
          <div className="w-0.5 h-full bg-white shadow-lg" />

          {/* Handle knob */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-xl border-2 border-violet-500 flex items-center justify-center"
            style={{ cursor: 'ew-resize' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M5 8L2 5m0 0l3-3M2 5h12m0 0l-3 3m3-3l-3-3" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Labels */}
        <div className="absolute top-2 left-3 px-2 py-0.5 rounded-md bg-black/50 text-white text-[10px] font-bold tracking-wide pointer-events-none">
          {beforeLabel}
        </div>
        <div className="absolute top-2 right-3 px-2 py-0.5 rounded-md bg-violet-600/80 text-white text-[10px] font-bold tracking-wide pointer-events-none">
          {afterLabel}
        </div>
      </div>
    </div>
  );
}

export default ComparisonSlider;
