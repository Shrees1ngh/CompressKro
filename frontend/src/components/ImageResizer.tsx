import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Maximize2, 
  Settings, 
  Download, 
  HelpCircle, 
  RefreshCw, 
  Link as LinkIcon, 
  Link2Off,
  CheckCircle2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useToast } from '../hooks/useToast';
import { useObjectURL } from '../hooks/useObjectURL';
import { StorageService } from '../services/storage.service';
import { HistoryService } from '../services/history.service';
import { ToastContainer } from './ui/Toast';
import { buildResizedFilename, downloadBlob } from '../utils/download';

interface ImageResizerProps {
  initialFile?: File | null;
  clearInitialFile?: () => void;
  presetConfig?: { width?: number; height?: number } | null;
}

export default function ImageResizer({ initialFile, clearInitialFile, presetConfig }: ImageResizerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [originalWidth, setOriginalWidth] = useState<number>(0);
  const [originalHeight, setOriginalHeight] = useState<number>(0);
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true);
  const [scaleFactor, setScaleFactor] = useState<number>(100);

  useEffect(() => {
    if (presetConfig?.width && presetConfig?.height) {
      setWidth(presetConfig.width);
      setHeight(presetConfig.height);
      setLockAspectRatio(false);
      setAspectRatio(presetConfig.width / presetConfig.height);
    }
  }, [presetConfig]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [resizedUrl, setResizedUrl] = useState<string>('');
  const [resizedBlob, setResizedBlob] = useState<Blob | null>(null);
  const [resizedDimensions, setResizedDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toasts, showSuccess, showError, dismiss } = useToast();
  const { createURL, revokeURL } = useObjectURL();

  useEffect(() => {
    if (initialFile) {
      handleFileSetup(initialFile);
      if (clearInitialFile) clearInitialFile();
    }
  }, [initialFile, clearInitialFile]);

  const handleFileSetup = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setResizedUrl('');
    setResizedBlob(null);

    const img = new Image();
    img.onload = () => {
      setOriginalWidth(img.width);
      setOriginalHeight(img.height);
      setWidth(img.width);
      setHeight(img.height);
      setAspectRatio(img.width / img.height);
      setScaleFactor(100);
    };
    img.src = URL.createObjectURL(uploadedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSetup(e.target.files[0]);
    }
  };

  const handleWidthChange = (val: number) => {
    setWidth(val);
    if (lockAspectRatio && val > 0) {
      setHeight(Math.round(val / aspectRatio));
    }
  };

  const handleHeightChange = (val: number) => {
    setHeight(val);
    if (lockAspectRatio && val > 0) {
      setWidth(Math.round(val * aspectRatio));
    }
  };

  const handleScaleChange = (scale: number) => {
    setScaleFactor(scale);
    setWidth(Math.round(originalWidth * (scale / 100)));
    setHeight(Math.round(originalHeight * (scale / 100)));
  };

  const applyPreset = (w: number, h: number, shouldLock: boolean = false) => {
    setLockAspectRatio(shouldLock);
    setWidth(w);
    setHeight(h);
    if (originalWidth > 0 && originalHeight > 0) {
      setAspectRatio(w / h);
    }
  };

  const presets = [
    { name: 'Passport Photo', width: 350, height: 450, lock: false },
    { name: 'Aadhaar Card', width: 160, height: 200, lock: false },
    { name: 'PAN Card', width: 200, height: 230, lock: false },
    { name: 'Instagram Square', width: 1080, height: 1080, lock: true },
    { name: 'Instagram Story', width: 1080, height: 1920, lock: true },
    { name: 'LinkedIn Banner', width: 1584, height: 396, lock: true },
    { name: 'Facebook Cover', width: 820, height: 312, lock: true }
  ];

  const handleResize = async () => {
    if (!file) return;
    setIsProcessing(true);

    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((resolve) => (img.onload = resolve));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // Draw and resize
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = file.type || 'image/jpeg';
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), mimeType, 0.9);
      });

      if (blob) {
        if (resizedUrl) revokeURL(resizedUrl);
        const newUrl = createURL(blob);
        setResizedBlob(blob);
        setResizedUrl(newUrl);
        setResizedDimensions({ width, height });

        StorageService.updateStats(1, 0);
        HistoryService.addResizeEntry({
          originalName: file.name,
          originalSize: file.size,
          resizedSize: blob.size,
          resizedUrl: newUrl,
          resizedBlob: blob,
          dimensions: { width, height },
          originalDimensions: { width: originalWidth, height: originalHeight },
        });

        showSuccess('Image resized!', `Output: ${width}×${height} px`);
        confetti({ particleCount: 50, spread: 40, origin: { y: 0.8 } });
      }
    } catch (e: any) {
      console.error(e);
      showError('Resize failed', e?.message ?? 'Ensure the file is a valid image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resizedBlob || !file) return;
    downloadBlob(resizedBlob, buildResizedFilename(file.name));
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Image Resizer</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Scale dimensions or crop to standard passport, government, or social card sizes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Control Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
            <h3 className="text-md font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Settings className="w-4 h-4 text-violet-500" />
              <span>Resizer Config</span>
            </h3>

            {/* Input Selection */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-violet-800 rounded-xl p-6 text-center cursor-pointer transition-colors"
            >
              <input 
                type="file" 
                ref={fileInputRef}
                accept="image/*"
                className="hidden" 
                onChange={handleFileChange}
              />
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {file ? file.name : 'Select Image'}
              </div>
              <span className="text-[10px] text-slate-400">Drag/click to choose image</span>
            </div>

            {file && (
              <div className="space-y-4">
                {/* Manual Dimension Inputs */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500">Width (px)</label>
                    <input 
                      type="number" 
                      value={width || ''}
                      onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500">Height (px)</label>
                    <input 
                      type="number" 
                      value={height || ''}
                      onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                </div>

                {/* Aspect Ratio Lock Toggle */}
                <button 
                  onClick={() => {
                    setLockAspectRatio(!lockAspectRatio);
                    if (!lockAspectRatio && width > 0) {
                      setAspectRatio(width / height);
                    }
                  }}
                  className={`w-full py-2 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                    lockAspectRatio 
                      ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-800' 
                      : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
                  }`}
                >
                  {lockAspectRatio ? (
                    <>
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span>Lock Aspect Ratio ({aspectRatio.toFixed(2)})</span>
                    </>
                  ) : (
                    <>
                      <Link2Off className="w-3.5 h-3.5" />
                      <span>Unlock Aspect Ratio</span>
                    </>
                  )}
                </button>

                {/* Percentage Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-500">
                    <span>Scale Percentage</span>
                    <span className="text-violet-600 font-bold">{scaleFactor}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="200" 
                    value={scaleFactor}
                    onChange={(e) => handleScaleChange(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  />
                </div>

                {/* Preset List */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">Apply Preset Size</label>
                  <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                    {presets.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => applyPreset(p.width, p.height, p.lock)}
                        className="py-2 px-2 border border-slate-200 dark:border-slate-800 text-[11px] font-medium rounded-lg text-slate-600 hover:border-violet-400 hover:text-violet-600 dark:text-slate-400 dark:hover:border-violet-800 dark:hover:text-violet-400 bg-white/10 text-left truncate"
                      >
                        {p.name}
                        <span className="block text-[9px] text-slate-400 mt-0.5">{p.width}×{p.height} px</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleResize}
                  disabled={isProcessing}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-600/10"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Resizing...</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-4 h-4" />
                      <span>Resize Image</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Display Canvas Preview */}
        <div className="lg:col-span-8">
          {resizedUrl ? (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-md font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Output Preview</span>
                </h3>
                <button 
                  onClick={handleDownload}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-violet-600 hover:bg-violet-750 text-white shadow-md shadow-violet-500/10 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Output</span>
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-950/30 flex items-center justify-center h-[350px]">
                <img 
                  src={resizedUrl} 
                  alt="Resized output" 
                  className="max-w-full max-h-full object-contain"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50 text-center md:text-left">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">New Size</div>
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">
                    {resizedDimensions.width} × {resizedDimensions.height} px
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Original Size</div>
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">
                    {originalWidth} × {originalHeight} px
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Aspect Ratio</div>
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">
                    {(resizedDimensions.width / resizedDimensions.height).toFixed(2)} : 1
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Processing Location</div>
                  <div className="text-[11px] font-bold text-violet-600 mt-1">
                    Client Browser (Safe & Private)
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[380px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/20 dark:bg-slate-900/20 glass-panel flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-4">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Resized preview is empty</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
                Upload a picture, configure dimensions or choose a portal preset, and click "Resize Image".
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
