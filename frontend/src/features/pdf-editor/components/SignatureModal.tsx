// ============================================================
// CompressKro PDF Editor — Signature & Sign Modal Component
// ============================================================
// Modal with options to draw signature freehand or upload
// a signature image from device.
// ============================================================

import React, { useRef, useState, useCallback } from 'react';
import { X, Upload, Edit3 } from 'lucide-react';
import { SIGNATURE_PEN_COLORS } from '../core/constants';

interface SignatureModalProps {
  onClose: () => void;
  onAdd: (dataUrl: string, blob: Blob) => void;
}

export function SignatureModal({ onClose, onAdd }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'draw' | 'upload'>('draw');
  
  // Drawing states
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#000000');

  // Upload states
  const [uploadedImage, setUploadedImage] = useState<{ url: string; file: File } | null>(null);

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setUploadedImage({ url, file });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirm = useCallback(() => {
    if (activeTab === 'draw') {
      if (!canvasRef.current || !hasDrawing) return;
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          onAdd(url, blob);
        }
      }, 'image/png');
    } else {
      if (!uploadedImage) return;
      onAdd(uploadedImage.url, uploadedImage.file);
    }
  }, [activeTab, hasDrawing, uploadedImage, onAdd]);

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
        {/* Title */}
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
            Add Signature
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 pb-px">
          <button
            onClick={() => setActiveTab('draw')}
            className={`flex-1 pb-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'draw'
                ? 'border-pink-500 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Draw Signature</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 pb-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'border-pink-500 text-pink-600 dark:text-pink-400'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'draw' ? (
          <div className="space-y-3">
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
            
            <div className="flex justify-start">
              <button
                onClick={clearCanvas}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:border-red-500 text-slate-650 dark:text-slate-400 hover:text-red-500 text-[10px] font-bold rounded-lg cursor-pointer"
              >
                Clear Pad
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full min-h-[160px] border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:border-pink-500 hover:bg-slate-100/10 transition-all"
            >
              {uploadedImage ? (
                <div className="relative max-h-32 flex flex-col items-center gap-1.5">
                  <img
                    src={uploadedImage.url}
                    alt="Uploaded signature"
                    className="max-h-24 object-contain shadow-sm rounded p-1 bg-white"
                  />
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold truncate max-w-[220px]">
                    {uploadedImage.file.name}
                  </span>
                </div>
              ) : (
                <>
                  <Upload className="w-7 h-7 text-slate-400 mb-2" />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-350">
                    Upload Signature Image
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 leading-normal font-semibold max-w-[240px]">
                    Supports PNG, JPG, or SVG. Transparent PNG works best.
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={activeTab === 'draw' ? !hasDrawing : !uploadedImage}
            className="px-4 py-2 text-xs font-bold text-white bg-pink-600 hover:bg-pink-700 disabled:opacity-40 rounded-xl cursor-pointer shadow-sm"
          >
            Add to Page
          </button>
        </div>
      </div>
    </div>
  );
}
