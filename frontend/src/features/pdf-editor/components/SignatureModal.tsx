// ============================================================
// CompressKro PDF Editor — Signature Draw Modal Component
// ============================================================
// Modal with a freehand drawing canvas for signatures.
// Supports pen color selection, clear, and confirm.
// ============================================================

import React, { useRef, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { SIGNATURE_PEN_COLORS } from '../core/constants';

interface SignatureModalProps {
  onClose: () => void;
  onAdd: (dataUrl: string, blob: Blob) => void;
}

export function SignatureModal({ onClose, onAdd }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#000000');

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setHasDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [penColor]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing]);

  const stopDrawing = useCallback(() => setIsDrawing(false), []);

  const clearCanvas = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    setHasDrawing(false);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!canvasRef.current || !hasDrawing) return;
    canvasRef.current.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        onAdd(url, blob);
      }
    }, 'image/png');
  }, [hasDrawing, onAdd]);

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
            Draw Your Signature
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <div className="flex gap-2">
          {SIGNATURE_PEN_COLORS.map(color => (
            <button
              key={color}
              onClick={() => setPenColor(color)}
              className={`w-6 h-6 rounded-full cursor-pointer border ${penColor === color ? 'ring-2 ring-pink-500' : ''}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <div className="relative border border-slate-250 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl overflow-hidden shadow-inner">
          <canvas
            ref={canvasRef}
            width={400}
            height={160}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full cursor-crosshair touch-none"
          />
        </div>

        <div className="flex justify-between items-center gap-3">
          <button
            onClick={clearCanvas}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:border-red-500 text-slate-600 dark:text-slate-400 hover:text-red-500 text-xs font-bold rounded-xl cursor-pointer"
          >
            Clear Pad
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!hasDrawing}
              className="px-4 py-2 text-xs font-bold text-white bg-pink-600 hover:bg-pink-700 disabled:opacity-40 rounded-xl cursor-pointer shadow-sm"
            >
              Add to Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
