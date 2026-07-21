import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Download, 
  HelpCircle, 
  RefreshCw, 
  UserCheck, 
  Sliders, 
  Sun,
  Contrast,
  RotateCw,
  Eye,
  Grid3x3
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useToast } from '../hooks/useToast';
import { useObjectURL } from '../hooks/useObjectURL';
import { StorageService } from '../services/storage.service';
import { HistoryService } from '../services/history.service';
import { ToastContainer } from './ui/Toast';
import { downloadBlob } from '../utils/download';
import { getFriendlySize } from '../utils/format';

interface PassportMakerProps {
  initialFile?: File | null;
  clearInitialFile?: () => void;
}

export default function PassportMaker({ initialFile, clearInitialFile }: PassportMakerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [imgSrc, setImgSrc] = useState<string>('');
  
  // Crop & Adjust State
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [targetSizeKB, setTargetSizeKB] = useState<number>(50);
  const [format, setFormat] = useState<string>('jpg');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { toasts, showSuccess, showError, dismiss } = useToast();
  const { createURL, revokeURL } = useObjectURL();
  
  // Dragging parameters
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (initialFile) {
      handleFileSetup(initialFile);
      if (clearInitialFile) clearInitialFile();
    }
  }, [initialFile, clearInitialFile]);

  const handleFileSetup = (uploadedFile: File) => {
    setFile(uploadedFile);
    setOutputUrl('');
    setOutputSize(0);
    setZoom(100);
    setRotation(0);
    setOffsetX(0);
    setOffsetY(0);
    setBrightness(100);
    setContrast(100);

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImgSrc(e.target.result as string);
      }
    };
    reader.readAsDataURL(uploadedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSetup(e.target.files[0]);
    }
  };

  // Drag to position handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!file) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { x: offsetX, y: offsetY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffsetX(offsetStart.current.x + dx);
    setOffsetY(offsetStart.current.y + dy);
  };

  const handleMouseUp = () => { setIsDragging(false); };

  // Touch support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!file) return;
    const touch = e.touches[0];
    setIsDragging(true);
    dragStart.current = { x: touch.clientX, y: touch.clientY };
    offsetStart.current = { x: offsetX, y: offsetY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStart.current.x;
    const dy = touch.clientY - dragStart.current.y;
    setOffsetX(offsetStart.current.x + dx);
    setOffsetY(offsetStart.current.y + dy);
  };

  const handleTouchEnd = () => { setIsDragging(false); };

  const handleResetPosition = () => {
    setOffsetX(0);
    setOffsetY(0);
    setZoom(100);
    setRotation(0);
    setBrightness(100);
    setContrast(100);
  };

  const handleGenerate = async () => {
    if (!file || !imgSrc) return;
    setIsProcessing(true);

    try {
      const img = new Image();
      img.src = imgSrc;
      await new Promise((resolve) => (img.onload = resolve));

      // Passport standard dimensions: 350 x 450 px (roughly 3.5 x 4.5 cm)
      const passportW = 350;
      const passportH = 450;
      
      const canvas = document.createElement('canvas');
      canvas.width = passportW;
      canvas.height = passportH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas render failed');

      // 1. Draw solid white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, passportW, passportH);

      // 2. Setup transformation matrix
      ctx.save();
      ctx.translate(passportW / 2 + offsetX, passportH / 2 + offsetY);
      ctx.rotate((rotation * Math.PI) / 180);
      
      // Calculate drawing dimensions based on zoom
      const baseScale = Math.min(passportW / img.width, passportH / img.height);
      const drawWidth = img.width * baseScale * (zoom / 100);
      const drawHeight = img.height * baseScale * (zoom / 100);

      // Apply brightness/contrast filter inside canvas context if supported
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
      
      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();

      // 3. Binary Search for Target File Size
      const targetBytes = targetSizeKB * 1024;
      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      
      let lowQ = 0.01;
      let highQ = 0.99;
      let midQ = 0.8;
      let bestBlob: Blob | null = null;

      for (let step = 0; step < 8; step++) {
        midQ = (lowQ + highQ) / 2;
        const tempBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), mime, midQ);
        });

        if (tempBlob) {
          if (tempBlob.size <= targetBytes) {
            bestBlob = tempBlob;
            lowQ = midQ;
          } else {
            highQ = midQ;
          }
        }
      }

      const outputBlob = bestBlob || await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), mime, 0.01);
      });

      if (outputBlob) {
        if (outputUrl) revokeURL(outputUrl);
        const newUrl = createURL(outputBlob);
        setOutputBlob(outputBlob);
        setOutputUrl(newUrl);
        setOutputSize(outputBlob.size);

        StorageService.updateStats(1, 0);
        HistoryService.addPassportEntry(file.name, outputBlob.size, format);

        showSuccess('Passport photo ready!', `${getFriendlySize(outputBlob.size)} · ${format.toUpperCase()}`);
        confetti({ particleCount: 60, spread: 40, origin: { y: 0.8 } });
      }
    } catch (e: any) {
      console.error(e);
      showError('Generation failed', e?.message ?? 'Ensure the image is a valid portrait photo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!outputBlob || !file) return;
    downloadBlob(outputBlob, `passport_photo_${Date.now()}.${format}`);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Passport Photo Maker</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Position, align with overlays, adjust contrast to clear background, and limit output KB sizes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Control and adjusting workspace */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
            <h3 className="text-md font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-violet-500" />
              <span>Workspace Parameters</span>
            </h3>

            {/* Selector */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-violet-800 rounded-xl p-4 text-center cursor-pointer transition-colors"
            >
              <input 
                type="file" 
                ref={fileInputRef}
                accept="image/*"
                className="hidden" 
                onChange={handleFileChange}
              />
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {file ? file.name : 'Upload Portrait'}
              </div>
              <span className="text-[10px] text-slate-400">Image with solid/light background</span>
            </div>

            {file && imgSrc && (
              <div className="space-y-4">
                {/* Scale / Zoom */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-500">
                    <span>Zoom Factor</span>
                    <span className="text-violet-600 font-bold">{zoom}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="50" 
                    max="250" 
                    value={zoom}
                    onChange={(e) => setZoom(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  />
                </div>

                {/* Rotation */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-500">
                    <span>Rotate Portrait</span>
                    <span className="text-violet-600 font-bold">{rotation}°</span>
                  </div>
                  <input 
                    type="range" 
                    min="-45" 
                    max="45" 
                    value={rotation}
                    onChange={(e) => setRotation(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  />
                </div>

                {/* Brightness Adjust (Bleaches grey backgrounds) */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-500">
                    <span className="flex items-center gap-1">
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                      <span>Background Whitening</span>
                    </span>
                    <span className="text-violet-600 font-bold">{brightness}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="90" 
                    max="160" 
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  />
                </div>

                {/* Contrast Adjust */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-500">
                    <span className="flex items-center gap-1">
                      <Contrast className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Contrast Adjustment</span>
                    </span>
                    <span className="text-violet-600 font-bold">{contrast}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="80" 
                    max="150" 
                    value={contrast}
                    onChange={(e) => setContrast(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  />
                </div>

                {/* Sizing constraints */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500">Target Size Limit</label>
                    <input 
                      type="number" 
                      value={targetSizeKB}
                      onChange={(e) => setTargetSizeKB(Math.max(5, parseInt(e.target.value) || 0))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500">Format</label>
                    <select 
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                    >
                      <option value="jpg">JPG (Recommended)</option>
                      <option value="png">PNG</option>
                    </select>
                  </div>
                </div>

                <button 
                  onClick={handleGenerate}
                  disabled={isProcessing}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-600/10"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Portrait...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Generate Passport Photo</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Live crop framing workzone and output */}
        <div className="lg:col-span-7 space-y-6">
          {file && imgSrc ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Interaction Framer */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-4">
                <div className="text-xs font-semibold text-slate-400 flex justify-between items-center">
                  <span>Alignment Framer</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setShowGrid(!showGrid)}
                      className={`p-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                        showGrid
                          ? 'bg-violet-100 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                      title="Toggle grid overlay"
                    >
                      <Grid3x3 className="w-3 h-3" />
                      Grid
                    </button>
                    <button
                      onClick={handleResetPosition}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold flex items-center gap-1 transition-all"
                      title="Reset position"
                    >
                      <RotateCw className="w-3 h-3" />
                      Reset
                    </button>
                  </div>
                </div>
                
                <div 
                  ref={containerRef}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className="relative select-none overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex items-center justify-center h-[340px]"
                >
                  {/* Backdrop representation with transformations */}
                  <img 
                    src={imgSrc} 
                    alt="Work source" 
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    style={{
                      transform: `translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg) scale(${zoom / 100})`,
                      maxHeight: '80%',
                      maxWidth: '80%',
                      cursor: isDragging ? 'grabbing' : 'grab',
                      userSelect: 'none',
                      filter: `brightness(${brightness}%) contrast(${contrast}%)`
                    }}
                    draggable={false}
                  />

                  {/* Rule-of-thirds grid overlay */}
                  {showGrid && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="w-full h-full" style={{
                        backgroundImage: 'linear-gradient(rgba(139,92,246,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.25) 1px, transparent 1px)',
                        backgroundSize: '33.33% 33.33%'
                      }} />
                    </div>
                  )}

                  {/* Standard Crop Outline box (Aspect Ratio: 3.5:4.5) */}
                  <div 
                    className="absolute pointer-events-none border-2 border-violet-500 shadow-[0_0_0_999px_rgba(0,0,0,0.5)] flex flex-col justify-between"
                    style={{
                      width: '180px',
                      height: '231px',
                    }}
                  >
                    {/* Horizontal Guideline lines */}
                    <div className="w-full border-b border-dashed border-violet-300 opacity-60 h-[25%] flex items-end justify-center">
                      <span className="text-[7px] text-white uppercase font-bold tracking-wider mb-0.5">Top of Head</span>
                    </div>
                    <div className="w-full border-b border-dashed border-violet-300 opacity-60 h-[50%] flex items-end justify-center">
                      <span className="text-[7px] text-white uppercase font-bold tracking-wider mb-0.5">Chin Line</span>
                    </div>
                    <div className="w-full h-[25%]" />
                  </div>
                </div>
              </div>

              {/* Output review */}
              <div className="flex flex-col justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel">
                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-4 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-violet-500" />
                    <span>Live Output</span>
                  </div>

                  <div className="flex items-center justify-center p-2 rounded-xl bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 h-[260px]">
                    {outputUrl ? (
                      <div className="border border-slate-300 shadow-md">
                        <img 
                          src={outputUrl} 
                          alt="Passport photo result" 
                          style={{
                            width: '140px',
                            height: '180px', // Standard 3.5x4.5 ratio
                            objectFit: 'cover'
                          }}
                        />
                      </div>
                    ) : (
                      <div className="text-center p-4">
                        <HelpCircle className="w-8 h-8 text-slate-350 mx-auto mb-2" />
                        <span className="text-[10px] text-slate-400">Output not compiled yet. Configure alignment and click Generate.</span>
                      </div>
                    )}
                  </div>
                </div>

                {outputUrl && (
                  <div className="space-y-3 mt-4">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-semibold">
                      <span>File Size:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 text-xs font-extrabold font-mono">
                        {(outputSize / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <button 
                      onClick={handleDownload}
                      className="w-full py-2 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 text-white bg-slate-900 hover:bg-slate-850 dark:bg-slate-800 dark:hover:bg-slate-700"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Photo</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[380px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/20 dark:bg-slate-900/20 glass-panel flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-4">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Framer workspace is empty</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
                Add an image of yourself, and align it inside the passport guide borders.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
