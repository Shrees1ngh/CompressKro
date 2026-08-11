// ============================================================
// CompressKro — Client-Side AI Background Remover with Manual Editor
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  Sparkles, 
  Download, 
  RefreshCw, 
  ImageIcon,
  Trash2,
  AlertTriangle,
  Eraser,
  Undo2,
  Palette
} from 'lucide-react';
import { removeBackground } from '@imgly/background-removal';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';

type EditorMode = 'view' | 'erase' | 'restore';
type BgType = 'transparent' | 'color' | 'gradient';

interface ColorPreset {
  name: string;
  value: string;
}

interface GradientPreset {
  name: string;
  color1: string;
  color2: string;
  css: string;
}

export function RemoveBg() {
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  
  // Model Processing States
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);

  // Editor States
  const [hasResult, setHasResult] = useState<boolean>(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('view');
  const [brushSize, setBrushSize] = useState<number>(30);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // Background Customization States
  const [bgType, setBgType] = useState<BgType>('transparent');
  const [solidColor, setSolidColor] = useState<string>('#FFFFFF');
  const [activeGradient, setActiveGradient] = useState<number>(0);

  const { showSuccess, showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  
  // Image instances stored in ref to prevent state-trigger loops
  const originalImgRef = useRef<HTMLImageElement | null>(null);
  const cutoutImgRef = useRef<HTMLImageElement | null>(null);
  const normalizedOriginalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Preset Colors
  const colorPresets: ColorPreset[] = [
    { name: 'White', value: '#FFFFFF' },
    { name: 'Passport Blue', value: '#0A5CFF' },
    { name: 'Soft Gray', value: '#F1F5F9' },
    { name: 'Studio Orange', value: '#FF6B35' },
    { name: 'Studio Black', value: '#1E293B' },
    { name: 'Chroma Green', value: '#00FF00' }
  ];

  // Preset Gradients
  const gradientPresets: GradientPreset[] = [
    { name: 'Sunset', color1: '#FF512F', color2: '#DD2476', css: 'linear-gradient(to bottom, #FF512F, #DD2476)' },
    { name: 'Ocean', color1: '#2193b0', color2: '#6dd5ed', css: 'linear-gradient(to bottom, #2193b0, #6dd5ed)' },
    { name: 'Aurora', color1: '#83a4d4', color2: '#b6fbff', css: 'linear-gradient(to bottom, #83a4d4, #b6fbff)' },
    { name: 'Neon Green', color1: '#11998e', color2: '#38ef7d', css: 'linear-gradient(to bottom, #11998e, #38ef7d)' },
    { name: 'Dark Slate', color1: '#0f2027', color2: '#203a43', css: 'linear-gradient(to bottom, #0f2027, #203a43)' }
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setupFile(e.target.files[0]);
    }
  };

  const setupFile = (selectedFile: File) => {
    setFile(selectedFile);
    setImagePreview(URL.createObjectURL(selectedFile));
    setHasResult(false);
    setEditorMode('view');
    setBgType('transparent');

    // Load original image in memory
    const img = new Image();
    img.onload = () => {
      originalImgRef.current = img;
    };
    img.src = URL.createObjectURL(selectedFile);
  };

  const executeRemoveBg = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgressMsg('Initializing local AI model...');
    setProgressPercent(0);

    try {
      const config = {
        progress: (key: string, current: number, total: number) => {
          const part = key.split('/').pop() || 'weights';
          const percent = Math.round((current / total) * 100);
          setProgressPercent(percent);
          setProgressMsg(`Loading ${part}: ${percent}%`);
        }
      };

      // Process image client-side via @imgly/background-removal
      const blob = await removeBackground(file, config);
      
      const img = new Image();
      img.onload = () => {
        cutoutImgRef.current = img;
        initCanvas(img);
        setHasResult(true);
        showSuccess('AI Cutout complete!', 'Background removed. You can now touch up or change backgrounds.');
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.85 } });
      };
      img.src = URL.createObjectURL(blob);
    } catch (err: any) {
      console.error(err);
      showError('AI Processing failed', err.message || 'Could not complete backdrop removal.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
      setProgressPercent(0);
    }
  };

  // Initialize main editing canvas
  const initCanvas = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = img.width;
    canvas.height = img.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Create a normalized original image canvas matching the cutout size exactly.
    // This is created once upon init, preventing heavy scaling operations inside mousemove events.
    if (originalImgRef.current) {
      const normCanvas = document.createElement('canvas');
      normCanvas.width = canvas.width;
      normCanvas.height = canvas.height;
      const normCtx = normCanvas.getContext('2d');
      if (normCtx) {
        normCtx.drawImage(originalImgRef.current, 0, 0, canvas.width, canvas.height);
        normalizedOriginalCanvasRef.current = normCanvas;
      }
    }
  };

  // Get canvas coordinate mapping from cursor events
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Scale coords to match internal resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  // Handle Brush Dragging (Erase or Restore)
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || editorMode === 'view') return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const normCanvas = normalizedOriginalCanvasRef.current;

    if (!canvas || !ctx || !normCanvas) return;

    const coords = getCanvasCoords(e);
    const prev = lastPosRef.current;

    ctx.save();
    
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(coords.x, coords.y);

    if (editorMode === 'erase') {
      // Erase: clears pixels on path stroke
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.stroke();
    } else if (editorMode === 'restore') {
      // Restore: draws the original image pixels back inside the path stroke.
      // This is extremely efficient and leverages browser native GPU-accelerated pattern mapping.
      ctx.globalCompositeOperation = 'source-over';
      const pattern = ctx.createPattern(normCanvas, 'no-repeat');
      if (pattern) {
        ctx.strokeStyle = pattern;
        ctx.stroke();
      }
    }

    ctx.restore();
    lastPosRef.current = coords;
  };

  // Revert manual edits back to pure AI cutout
  const handleResetCutout = () => {
    if (cutoutImgRef.current) {
      initCanvas(cutoutImgRef.current);
      showSuccess('Manual edits cleared', 'Restored back to the original AI cutout.');
    }
  };

  // Update cursor position and size directly in DOM for high performance
  const updateCursorSizeAndPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editorMode === 'view' || !canvasRef.current || !cursorRef.current) return;
    const canvas = canvasRef.current;
    const cursor = cursorRef.current;
    
    const scale = canvas.clientWidth / canvas.width;
    const size = brushSize * scale;
    
    cursor.style.width = `${size}px`;
    cursor.style.height = `${size}px`;
    cursor.style.left = `${e.nativeEvent.offsetX}px`;
    cursor.style.top = `${e.nativeEvent.offsetY}px`;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    updateCursorSizeAndPos(e);
    draw(e);
  };

  const handleMouseEnter = () => {
    if (editorMode !== 'view' && cursorRef.current) {
      cursorRef.current.style.display = 'block';
    }
  };

  const handleMouseLeave = () => {
    if (cursorRef.current) {
      cursorRef.current.style.display = 'none';
    }
  };

  // Synchronize cursor styling and size immediately when brush size or editor mode changes
  useEffect(() => {
    if (editorMode !== 'view' && cursorRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const cursor = cursorRef.current;
      const scale = canvas.clientWidth / canvas.width;
      const size = brushSize * scale;
      cursor.style.width = `${size}px`;
      cursor.style.height = `${size}px`;
      cursor.style.border = `2px solid ${editorMode === 'restore' ? '#10b981' : '#ef4444'}`;
      cursor.style.backgroundColor = editorMode === 'restore' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
    }
  }, [brushSize, editorMode]);

  // Automatically initialize canvas once the canvas element mounts and processed image is ready
  useEffect(() => {
    if (hasResult && cutoutImgRef.current && canvasRef.current) {
      initCanvas(cutoutImgRef.current);
    }
  }, [hasResult]);



  // Download compiled PNG
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !file) return;

    // Create a temporary compiler canvas to blend background with cutout
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return;

    // Fill background layer
    if (bgType === 'color') {
      exportCtx.fillStyle = solidColor;
      exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    } else if (bgType === 'gradient') {
      const gradPreset = gradientPresets[activeGradient];
      const grad = exportCtx.createLinearGradient(0, 0, 0, exportCanvas.height);
      grad.addColorStop(0, gradPreset.color1);
      grad.addColorStop(1, gradPreset.color2);
      exportCtx.fillStyle = grad;
      exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    }

    // Draw active cutout layer
    exportCtx.drawImage(canvas, 0, 0);

    const outName = `${file.name.replace(/\.[a-z0-9]+$/i, '')}_edited.png`;
    const link = document.createElement('a');
    link.href = exportCanvas.toDataURL('image/png');
    link.download = outName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Save statistics entry
    StorageService.updateStats(0, 1);
    HistoryService.addImageEntry('Remove Background', outName, 0);
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Drag & drop or upload your photo.' },
    { step: 2, text: 'Click "Erase Background" to run the local AI segmentation model.' },
    { step: 3, text: 'Calibrate boundaries manually with Erase/Restore brushes, pick gradient or solid backdrops, and download.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Local AI Eraser', desc: 'WASM runs directly in your browser — photos are processed privately on your hardware.' },
    { title: 'Precision Touch-Up Brushes', desc: 'Manually erase missed specs or paint back important details using custom brush sizes.' },
    { title: 'Background Studio Presets', desc: 'Instantly add solid colors for passport presets or modern color gradients.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'How do Erase and Restore brushes work?', answer: 'Erase clears pixels locally. Restore paints back details from your original image. Perfect for manual adjustments.' },
    { question: 'Why does it freeze during manual brushing on huge files?', answer: 'Since canvas pixel blending runs on the main browser thread, large images process millions of pixels which causes load spikes.' },
    { question: 'Where are backgrounds compiled?', answer: 'The background selection is rendered behind the cutout. On export, we merge both layers into a single high-quality transparent PNG.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Image Editor', desc: 'Filters, drawings, adjustments.', path: '/edit-image', icon: ImageIconComponent },
    { name: 'Image Compressor', desc: 'Target exact KB size.', path: '/compress-image', icon: ImageIconComponent },
    { name: 'Image Resizer', desc: 'Scale dimensions.', path: '/resize-image', icon: ImageIconComponent }
  ];

  function ImageIconComponent() {
    return <ImageIcon className="w-3.5 h-3.5" />;
  }

  return (
    <ToolPageLayout
      title="Remove Background"
      subtitle="Erase backgrounds automatically using AI, then touch up borders or add custom background colors locally."
      breadcrumbName="Remove Background"
      seoTitle="Remove Background Free Online - AI Transparency Generator | CompressKro"
      seoDescription="Remove backgrounds from images online for free. AI-assisted portrait and product segmentation with manual brush adjustments and background color change."
      canonicalPath="/remove-background"
      steps={steps}
      benefits={benefits}
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <div className="space-y-6">
        {!file ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center hover:border-violet-500 hover:bg-violet-50/10 transition-all cursor-pointer space-y-4"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-xl bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto shadow-xs">
              <Upload className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Upload image to remove background</p>
              <p className="text-xs text-slate-400">Supports PNG, JPG, WebP — executed entirely in-browser</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left: Interactive Preview */}
            <div className="lg:col-span-8 space-y-4">
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel shadow-xs flex flex-col items-center">
                
                <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-4 text-xs font-semibold text-slate-650 dark:text-slate-350">
                  <span>
                    {hasResult 
                      ? `Editor Mode: ${editorMode === 'view' ? 'AI Output View' : editorMode === 'erase' ? 'Manual Eraser Brush' : 'Manual Restore Brush'}` 
                      : 'Original Image Preview'}
                  </span>

                  <button
                    onClick={() => {
                      setFile(null);
                      setImagePreview('');
                      setHasResult(false);
                      setEditorMode('view');
                      originalImgRef.current = null;
                      cutoutImgRef.current = null;
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset Editor</span>
                  </button>
                </div>

                {/* Transparency checkered viewport or custom background fill */}
                <div 
                  className={`w-full max-h-[500px] overflow-auto flex items-center justify-center rounded-xl p-4 border border-slate-200/30 dark:border-slate-800 ${bgType === 'transparent' ? 'checkered-bg' : ''}`}
                  style={{ 
                    backgroundColor: bgType === 'color' ? solidColor : undefined,
                    backgroundImage: bgType === 'gradient' ? gradientPresets[activeGradient].css : undefined
                  }}
                >
                  {hasResult ? (
                    <div className="relative overflow-hidden select-none">
                      <canvas
                        ref={canvasRef}
                        onMouseDown={(e) => {
                          setIsDrawing(true);
                          lastPosRef.current = getCanvasCoords(e);
                        }}
                        onMouseMove={handleMouseMove}
                        onMouseUp={() => setIsDrawing(false)}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={() => {
                          setIsDrawing(false);
                          handleMouseLeave();
                        }}
                        className={`max-w-full shadow-md rounded-xs border border-dashed border-slate-300 dark:border-slate-800 ${editorMode !== 'view' ? 'cursor-none' : 'cursor-default'}`}
                      />
                      {editorMode !== 'view' && (
                        <div
                          ref={cursorRef}
                          style={{
                            position: 'absolute',
                            pointerEvents: 'none',
                            display: 'none',
                            borderRadius: '50%',
                            transform: 'translate(-50%, -50%)',
                            border: `2px solid ${editorMode === 'restore' ? '#10b981' : '#ef4444'}`,
                            backgroundColor: editorMode === 'restore' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.8), inset 0 0 0 1px rgba(255, 255, 255, 0.8)',
                            zIndex: 50,
                          }}
                        />
                      )}
                    </div>
                  ) : (
                    <img
                      src={imagePreview}
                      alt="Background removal preview"
                      className="max-h-[420px] rounded-lg shadow-sm object-contain"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Right: Settings Toolbar */}
            <div className="lg:col-span-4 space-y-4">
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel shadow-sm space-y-6">
                
                {/* Large Image Warning Alert */}
                {file && file.size > 1.5 * 1024 * 1024 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-start gap-2 text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-[10px] leading-snug">
                      <strong>Large Image Warning:</strong> Running AI segmentation or manual brush touch-ups locally on a large image ({getFriendlySize(file.size)}) may cause your browser to temporarily freeze.
                    </p>
                  </div>
                )}

                {/* Model Processing State */}
                {isProcessing && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      <span className="truncate max-w-[200px]">{progressMsg}</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-violet-600 h-1.5 rounded-full transition-all duration-350"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {!hasResult ? (
                  <button
                    onClick={executeRemoveBg}
                    disabled={isProcessing}
                    className="w-full py-3.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>{isProcessing ? 'Processing AI...' : 'Erase Background'}</span>
                  </button>
                ) : (
                  <div className="space-y-5">
                    
                    {/* Panel 1: Manual Touch-up Brushes */}
                    <div className="space-y-3.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-350 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                        <Eraser className="w-4 h-4 text-violet-500" />
                        <span>Manual Touch-Up (Erase / Restore)</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => setEditorMode('view')}
                          className={`py-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${editorMode === 'view' ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300'}`}
                        >
                          View Mode
                        </button>
                        <button
                          onClick={() => setEditorMode('erase')}
                          className={`py-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${editorMode === 'erase' ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300'}`}
                        >
                          Erase Brush
                        </button>
                        <button
                          onClick={() => setEditorMode('restore')}
                          className={`py-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${editorMode === 'restore' ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300'}`}
                        >
                          Restore Brush
                        </button>
                      </div>

                      {editorMode !== 'view' && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-bold text-slate-500">
                            <span>Brush Size</span>
                            <span>{brushSize} px</span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="120"
                            value={brushSize}
                            onChange={(e) => setBrushSize(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                          />
                        </div>
                      )}

                      <button
                        onClick={handleResetCutout}
                        className="w-full py-2 border border-dashed border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>Revert to Pure AI Cutout</span>
                      </button>
                    </div>

                    {/* Panel 2: Change Background Suggestions */}
                    <div className="space-y-3.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-350 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                        <Palette className="w-4 h-4 text-violet-500" />
                        <span>Change Background</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => setBgType('transparent')}
                          className={`py-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${bgType === 'transparent' ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300'}`}
                        >
                          Transparent
                        </button>
                        <button
                          onClick={() => setBgType('color')}
                          className={`py-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${bgType === 'color' ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300'}`}
                        >
                          Solid Color
                        </button>
                        <button
                          onClick={() => setBgType('gradient')}
                          className={`py-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${bgType === 'gradient' ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300'}`}
                        >
                          Gradients
                        </button>
                      </div>

                      {/* Solid Color Options */}
                      {bgType === 'color' && (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2.5">
                            {colorPresets.map((c) => (
                              <button
                                key={c.value}
                                onClick={() => setSolidColor(c.value)}
                                className={`w-7 h-7 rounded-lg border shadow-xs cursor-pointer hover:scale-105 transition-all ${solidColor === c.value ? 'border-violet-600 ring-2 ring-violet-500/20' : 'border-slate-200 dark:border-slate-800'}`}
                                style={{ backgroundColor: c.value }}
                                title={c.name}
                              />
                            ))}
                            <div className="relative w-7 h-7 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 hover:scale-105 transition-all shadow-xs flex items-center justify-center bg-white">
                              <input
                                type="color"
                                value={solidColor}
                                onChange={(e) => setSolidColor(e.target.value)}
                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                              />
                              <span className="text-[10px] text-slate-400 font-bold">Hex</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Gradient Options */}
                      {bgType === 'gradient' && (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2.5">
                            {gradientPresets.map((g, index) => (
                              <button
                                key={g.name}
                                onClick={() => setActiveGradient(index)}
                                className={`w-7 h-7 rounded-lg border shadow-xs cursor-pointer hover:scale-105 transition-all ${activeGradient === index ? 'border-violet-600 ring-2 ring-violet-500/20' : 'border-slate-200 dark:border-slate-800'}`}
                                style={{ background: g.css }}
                                title={g.name}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Export / Download */}
                    <button
                      onClick={handleDownload}
                      className="w-full py-3.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Cutout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
export default RemoveBg;
