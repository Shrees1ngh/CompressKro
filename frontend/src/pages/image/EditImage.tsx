// ============================================================
// CompressKro — Pro Image Editor Page Component
// ============================================================

import { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  Edit3, 
  RotateCw, 
  RotateCcw, 
  Sliders, 
  Download, 
  Undo2,  
  Redo2, 
  RefreshCw, 
  Paintbrush, 
  Type, 
  Crop as CropIcon, 
  Sparkles, 
  Trash2,
  Check
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';

export function EditImage() {
  const [file, setFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab Control
  const [activeSubTab, setActiveSubTab] = useState<'adjust' | 'filter' | 'transform' | 'annotate' | 'crop'>('adjust');

  // Adjustment States
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);
  const [hueRotate, setHueRotate] = useState<number>(0);
  const [blur, setBlur] = useState<number>(0);
  const [grayscale, setGrayscale] = useState<number>(0);
  const [sepia, setSepia] = useState<number>(0);

  // Annotation States
  const [drawMode, setDrawMode] = useState<boolean>(false);
  const [brushColor, setBrushColor] = useState<string>('#6366f1');
  const [brushSize, setBrushSize] = useState<number>(8);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // Text Overlay States
  const [textMode, setTextMode] = useState<boolean>(false);
  const [textString, setTextString] = useState<string>('');
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [textSize, setTextSize] = useState<number>(36);
  const [textX, setTextX] = useState<number>(50);
  const [textY, setTextY] = useState<number>(50);

  // Crop States
  const [cropWidth, setCropWidth] = useState<number>(100);
  const [cropHeight, setCropHeight] = useState<number>(100);
  const [cropX, setCropX] = useState<number>(0);
  const [cropY, setCropY] = useState<number>(0);

  // Undo / Redo History Stack (Canvas DataURLs)
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const { showSuccess, showError } = useToast();

  // Load Image File
  const handleFileSetup = (uploadedFile: File) => {
    setFile(uploadedFile);
    const url = URL.createObjectURL(uploadedFile);
    setImageSrc(url);
    
    // Reset Settings
    resetAdjustments();
    setHistoryStack([]);
    setHistoryIndex(-1);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSetup(e.target.files[0]);
    }
  };

  // Reset to Defaults
  const resetAdjustments = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setHueRotate(0);
    setBlur(0);
    setGrayscale(0);
    setSepia(0);
    setDrawMode(false);
    setTextMode(false);
    setTextString('');
  };

  // Initialize Canvas Image
  useEffect(() => {
    if (!imageSrc) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Default Crop size
      setCropWidth(Math.round(img.width * 0.8));
      setCropHeight(Math.round(img.height * 0.8));
      setCropX(Math.round(img.width * 0.1));
      setCropY(Math.round(img.height * 0.1));

      // Draw base
      ctx.drawImage(img, 0, 0);
      saveState(canvas.toDataURL());
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Save State to History Stack
  const saveState = (dataUrl: string) => {
    const newStack = historyStack.slice(0, historyIndex + 1);
    newStack.push(dataUrl);
    setHistoryStack(newStack);
    setHistoryIndex(newStack.length - 1);
  };

  // Apply CSS Filters to Canvas Context and Draw the Current Stack State
  const renderCanvas = (useExitingStateUrl?: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const targetStateUrl = useExitingStateUrl || (historyIndex >= 0 ? historyStack[historyIndex] : imageSrc);
    if (!targetStateUrl) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Apply filters ONLY if we are drawing the base image (not compounding filters over history states)
      ctx.filter = `
        brightness(${brightness}%)
        contrast(${contrast}%)
        saturate(${saturation}%)
        hue-rotate(${hueRotate}deg)
        blur(${blur}px)
        grayscale(${grayscale}%)
        sepia(${sepia}%)
      `;
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none'; // reset filter for other annotations

      // Draw active crop box overlay if crop tab is open
      if (activeSubTab === 'crop') {
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = Math.max(3, canvas.width * 0.005);
        ctx.setLineDash([10, 10]);
        ctx.strokeRect(cropX, cropY, cropWidth, cropHeight);
        ctx.setLineDash([]);
      }
    };
    img.src = targetStateUrl;
  };

  // Trigger render when adjustments change
  useEffect(() => {
    renderCanvas();
  }, [brightness, contrast, saturation, hueRotate, blur, grayscale, sepia, activeSubTab, cropWidth, cropHeight, cropX, cropY]);

  // Undo Action
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      // Redraw the saved state at index
      drawStateOnCanvas(historyStack[prevIndex]);
    }
  };

  // Redo Action
  const handleRedo = () => {
    if (historyIndex < historyStack.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      drawStateOnCanvas(historyStack[nextIndex]);
    }
  };

  // Draw State URL directly to Canvas
  const drawStateOnCanvas = (stateUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = stateUrl;
  };

  // Burn/Commit Adjustments into a static history state
  const commitAdjustments = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Trigger redraw, save new baseline state, reset filters
    const currentUrl = canvas.toDataURL();
    saveState(currentUrl);
    resetAdjustments();
    showSuccess('Filter settings merged!', 'You can now apply more edits or undo this change.');
  };

  // Brush Drawing Controls
  const getCanvasMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Scale client mouse coordinates to actual internal canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawMode) return;
    const pos = getCanvasMousePos(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawMode) return;
    const pos = getCanvasMousePos(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    // Commit drawing to history stack
    const canvas = canvasRef.current;
    if (canvas) {
      saveState(canvas.toDataURL());
    }
  };

  // Text overlay draw
  const commitTextOverlay = () => {
    const canvas = canvasRef.current;
    if (!canvas || !textString.trim()) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw active state
    ctx.font = `bold ${textSize}px sans-serif`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Convert percentages to pixel positions
    const pxX = (textX / 100) * canvas.width;
    const pxY = (textY / 100) * canvas.height;
    
    ctx.fillText(textString, pxX, pxY);

    // Save and reset
    saveState(canvas.toDataURL());
    setTextString('');
    setTextMode(false);
    showSuccess('Text annotation added!');
  };

  // Transformations
  const handleRotate = (angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Keep current image
    const img = new Image();
    img.onload = () => {
      // Create a temporary canvas with flipped width/height for 90 degree rotations
      const is90 = Math.abs(angle) === 90;
      const targetWidth = is90 ? canvas.height : canvas.width;
      const targetHeight = is90 ? canvas.width : canvas.height;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = targetWidth;
      tempCanvas.height = targetHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      // Translate coordinates to center, rotate, and draw
      tempCtx.translate(targetWidth / 2, targetHeight / 2);
      tempCtx.rotate((angle * Math.PI) / 180);
      tempCtx.drawImage(img, -canvas.width / 2, -canvas.height / 2);

      // Copy back to main canvas
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.drawImage(tempCanvas, 0, 0);

      // Save state
      saveState(canvas.toDataURL());
      showSuccess('Rotation applied!');
    };
    img.src = canvas.toDataURL();
  };

  const handleFlip = (horizontal: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      if (horizontal) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      } else {
        ctx.translate(0, canvas.height);
        ctx.scale(1, -1);
      }

      ctx.drawImage(img, 0, 0);
      ctx.restore();

      // Save state
      saveState(canvas.toDataURL());
      showSuccess(horizontal ? 'Flipped Horizontally!' : 'Flipped Vertically!');
    };
    img.src = canvas.toDataURL();
  };

  // Crop Action
  const applyCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Create cropped context
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = cropWidth;
      tempCanvas.height = cropHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      tempCtx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      // Copy back
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      ctx.drawImage(tempCanvas, 0, 0);

      // Update crop states bounds
      setCropWidth(Math.round(cropWidth * 0.8));
      setCropHeight(Math.round(cropHeight * 0.8));
      setCropX(Math.round(cropWidth * 0.1));
      setCropY(Math.round(cropHeight * 0.1));

      // Save and alert
      saveState(canvas.toDataURL());
      showSuccess('Canvas cropped successfully!');
    };
    img.src = historyStack[historyIndex];
  };

  // Set Preset Filter
  const applyPresetFilter = (preset: string) => {
    resetAdjustments();
    switch (preset) {
      case 'grayscale':
        setGrayscale(100);
        break;
      case 'sepia':
        setSepia(100);
        break;
      case 'invert':
        setContrast(100);
        setHueRotate(180);
        break;
      case 'blur':
        setBlur(5);
        break;
      case 'vintage':
        setSepia(35);
        setContrast(115);
        setBrightness(95);
        break;
      case 'cool':
        setSaturation(120);
        setHueRotate(10);
        break;
      case 'dramatic':
        setContrast(130);
        setSaturation(80);
        break;
      case 'polaroid':
        setSepia(20);
        setContrast(90);
        setBrightness(110);
        break;
    }
  };

  // Export Download Image File
  const handleExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !file) return;
    setIsProcessing(true);

    try {
      const mimeType = file.type || 'image/png';
      const ext = mimeType.split('/')[1] || 'png';
      const outName = `edited_${file.name.replace(/\.[a-z0-9]+$/i, '')}.${ext}`;

      const dataUrl = canvas.toDataURL(mimeType, 0.95);
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      // Download
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = outName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      StorageService.updateStats(0, 1);
      HistoryService.addImageEntry('Image Editor', outName, blob.size);

      showSuccess('Image exported successfully!', `${outName} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.85 } });
    } catch (err: any) {
      console.error(err);
      showError('Export failed', 'Could not save the edited canvas.');
    } finally {
      setIsProcessing(false);
    }
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Upload any PNG, JPG, WebP, or HEIC image.' },
    { step: 2, text: 'Apply preset filters, draw annotations, rotate, crop, or adjust colors.' },
    { step: 3, text: 'Undo/redo edits at any time, then click Download to save.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Canvas Layers Rendering', desc: 'Edits, annotations, text bounding boxes, and crop windows are rendered in-browser.' },
    { title: 'Offline-Ready Sandbox', desc: 'No network required. Canvas adjustments process locally inside your browser memory.' },
    { title: 'Undo Action History', desc: 'Robust timeline state-tracking lets you step backward or forward through operations.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'What formats can I edit?', answer: 'We support JPG, PNG, WebP, SVG, and browser-mappable image buffers.' },
    { question: 'Are my images stored on the server?', answer: 'No. The image editor runs completely client-side in your sandbox browser memory. No files upload online.' },
    { question: 'Does cropping reduce resolution?', answer: 'Cropping trims the pixel dimensions to the selected box boundary, preserving pixel quality for the cropped section.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Image Compressor', desc: 'Target exact KB size.', path: '/compress-image', icon: ImageIcon },
    { name: 'Image Resizer', desc: 'Scale width and height.', path: '/resize-image', icon: ImageIcon },
    { name: 'Format Converter', desc: 'Convert image formats.', path: '/convert-image', icon: ImageIcon }
  ];

  const subTabs = [
    { id: 'adjust', label: 'Adjust', icon: Sliders },
    { id: 'filter', label: 'Filters', icon: Sparkles },
    { id: 'transform', label: 'Transform', icon: RotateCw },
    { id: 'annotate', label: 'Annotate', icon: Paintbrush },
    { id: 'crop', label: 'Crop', icon: CropIcon }
  ] as const;

  const isUndoDisabled = historyIndex <= 0;
  const isRedoDisabled = historyIndex >= historyStack.length - 1;

  // Render Image Icon for related tools
  function ImageIcon() {
    return <Edit3 className="w-3.5 h-3.5" />;
  }

  return (
    <ToolPageLayout
      title="Pro Image Editor"
      subtitle="Apply adjustments, preset filters, drawings, text overlays, and crop bounding boxes online for free."
      breadcrumbName="Image Editor"
      seoTitle="Pro Image Editor Online Free - Edit Photo Canvas | CompressKro"
      seoDescription="Edit images online for free. Visual adjustments, filters, rotate, flip, draw annotations, text overlays, and cropping. 100% private client-side editor."
      canonicalPath="/edit-image"
      steps={steps}
      benefits={benefits}
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <div className="space-y-6">
        {!imageSrc ? (
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
            <div className="w-12 h-12 rounded-xl bg-violet-50 dark:bg-violet-950/20 text-violet-650 dark:text-violet-400 flex items-center justify-center mx-auto shadow-xs">
              <Upload className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Upload image to edit</p>
              <p className="text-xs text-slate-400">Supports PNG, JPG, WebP, GIF, and HEIC files</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Canvas Preview Window */}
            <div className="lg:col-span-8 space-y-4">
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel shadow-xs flex flex-col items-center">
                
                {/* Canvas Toolbar Controls */}
                <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleUndo}
                      disabled={isUndoDisabled}
                      className="p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                      title="Undo"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={isRedoDisabled}
                      className="p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                      title="Redo"
                    >
                      <Redo2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        resetAdjustments();
                        if (imageSrc) drawStateOnCanvas(imageSrc);
                        setHistoryStack(historyStack.slice(0, 1));
                        setHistoryIndex(0);
                        showSuccess('Canvas reset to original!');
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>

                    <button
                      onClick={() => {
                        setFile(null);
                        setImageSrc('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Close File
                    </button>
                  </div>
                </div>

                {/* Canvas Bounding Area */}
                <div className="w-full max-h-[500px] overflow-auto flex items-center justify-center bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-200/30 dark:border-slate-850">
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    className={`max-w-full shadow-md rounded-xs ${drawMode ? 'cursor-crosshair' : 'cursor-default'}`}
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Editing Tools Control Center */}
            <div className="lg:col-span-4 space-y-4">
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel shadow-sm space-y-6">
                
                {/* Horizontal Tool Toggles */}
                <div className="flex overflow-x-auto gap-1 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                  {subTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveSubTab(tab.id);
                          setDrawMode(tab.id === 'annotate');
                          setTextMode(false);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                          activeSubTab === tab.id
                            ? 'bg-violet-600 text-white shadow-xs'
                            : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-350'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Sub-panels */}
                <div className="space-y-4 min-h-[220px]">
                  
                  {/* ADJUST TAB */}
                  {activeSubTab === 'adjust' && (
                    <div className="space-y-4">
                      {/* Brightness */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          <span>Brightness</span>
                          <span>{brightness}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={brightness}
                          onChange={(e) => setBrightness(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        />
                      </div>

                      {/* Contrast */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          <span>Contrast</span>
                          <span>{contrast}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={contrast}
                          onChange={(e) => setContrast(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        />
                      </div>

                      {/* Saturation */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          <span>Saturation</span>
                          <span>{saturation}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={saturation}
                          onChange={(e) => setSaturation(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        />
                      </div>

                      {/* Hue Rotate */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          <span>Hue Rotate</span>
                          <span>{hueRotate}°</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          value={hueRotate}
                          onChange={(e) => setHueRotate(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        />
                      </div>

                      {/* Blur */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          <span>Blur</span>
                          <span>{blur}px</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="20"
                          value={blur}
                          onChange={(e) => setBlur(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        />
                      </div>

                      <button
                        onClick={commitAdjustments}
                        className="w-full mt-2 py-2 rounded-lg text-xs font-bold text-white bg-slate-800 dark:bg-slate-700 hover:opacity-90 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Commit Adjustments</span>
                      </button>
                    </div>
                  )}

                  {/* FILTERS PRESETS */}
                  {activeSubTab === 'filter' && (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'original', name: 'Original' },
                        { id: 'grayscale', name: 'Monochrome' },
                        { id: 'sepia', name: 'Sepia' },
                        { id: 'invert', name: 'Invert' },
                        { id: 'vintage', name: 'Vintage' },
                        { id: 'cool', name: 'Cool' },
                        { id: 'dramatic', name: 'Dramatic' },
                        { id: 'polaroid', name: 'Polaroid' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => applyPresetFilter(item.id)}
                          className="py-2.5 px-3 text-[11px] font-bold rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-violet-500 hover:bg-violet-50/10 cursor-pointer transition-all"
                        >
                          {item.name}
                        </button>
                      ))}

                      <button
                        onClick={commitAdjustments}
                        className="col-span-2 mt-4 py-2 rounded-lg text-xs font-bold text-white bg-slate-800 dark:bg-slate-700 hover:opacity-90 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Apply Selected Filter</span>
                      </button>
                    </div>
                  )}

                  {/* TRANSFORM */}
                  {activeSubTab === 'transform' && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Rotate Canvas</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRotate(-90)}
                            className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>90° Left</span>
                          </button>
                          <button
                            onClick={() => handleRotate(90)}
                            className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>90° Right</span>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Flip Direction</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleFlip(true)}
                            className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer"
                          >
                            Flip Horizontal
                          </button>
                          <button
                            onClick={() => handleFlip(false)}
                            className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer"
                          >
                            Flip Vertical
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ANNOTATIONS (Draw / Text) */}
                  {activeSubTab === 'annotate' && (
                    <div className="space-y-4">
                      
                      {/* Drawing Toggle Controls */}
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/80 space-y-3">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={drawMode}
                            onChange={(e) => {
                              setDrawMode(e.target.checked);
                              if (e.target.checked) setTextMode(false);
                            }}
                            className="rounded-sm border-slate-300 dark:border-slate-700 text-violet-600 focus:ring-violet-500"
                          />
                          <span>Toggle Brush Drawing</span>
                        </label>

                        {drawMode && (
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase">Brush Size</span>
                              <input
                                type="range"
                                min="2"
                                max="40"
                                value={brushSize}
                                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                className="w-full cursor-pointer accent-violet-600"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Color</span>
                              <input
                                type="color"
                                value={brushColor}
                                onChange={(e) => setBrushColor(e.target.value)}
                                className="h-7 w-full rounded-md border border-slate-200 cursor-pointer bg-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Text Box overlays */}
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/80 space-y-3">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={textMode}
                            onChange={(e) => {
                              setTextMode(e.target.checked);
                              if (e.target.checked) setDrawMode(false);
                            }}
                            className="rounded-sm border-slate-300 dark:border-slate-700 text-violet-600 focus:ring-violet-500"
                          />
                          <span>Add Text Overlay</span>
                        </label>

                        {textMode && (
                          <div className="space-y-3 pt-2">
                            <input
                              type="text"
                              value={textString}
                              onChange={(e) => setTextString(e.target.value)}
                              className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/30 text-slate-700 dark:text-slate-350 outline-hidden focus:ring-2 focus:ring-violet-500/20"
                              placeholder="Enter text..."
                            />

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase block">Text Size</span>
                                <input
                                  type="number"
                                  value={textSize}
                                  onChange={(e) => setTextSize(Math.max(10, parseInt(e.target.value) || 20))}
                                  className="w-full p-1.5 text-xs rounded-md border border-slate-200 bg-white"
                                />
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase block">Color</span>
                                <input
                                  type="color"
                                  value={textColor}
                                  onChange={(e) => setTextColor(e.target.value)}
                                  className="h-8 w-full rounded-md border border-slate-200 cursor-pointer bg-white"
                                />
                              </div>
                            </div>

                            {/* Position Controls */}
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Horizontal X: {textX}%</span>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={textX}
                                onChange={(e) => setTextX(parseInt(e.target.value))}
                                className="w-full accent-violet-600"
                              />
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Vertical Y: {textY}%</span>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={textY}
                                onChange={(e) => setTextY(parseInt(e.target.value))}
                                className="w-full accent-violet-600"
                              />
                            </div>

                            <button
                              onClick={commitTextOverlay}
                              disabled={!textString.trim()}
                              className="w-full py-2 rounded-lg text-xs font-bold text-white bg-violet-600 hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Type className="w-3.5 h-3.5" />
                              <span>Burn Text Overlay</span>
                            </button>
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {/* CROP BOX */}
                  {activeSubTab === 'crop' && (
                    <div className="space-y-4">
                      
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/80 space-y-4">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-350">Crop Bounding Settings</div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-[11px] font-bold text-slate-500">
                            <span>Box Width (px)</span>
                            <span>{cropWidth}px</span>
                          </div>
                          <input
                            type="range"
                            min="20"
                            max={canvasRef.current?.width || 800}
                            value={cropWidth}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setCropWidth(val);
                              // Clamp bounds
                              const limit = (canvasRef.current?.width || 800) - cropX;
                              if (val > limit) setCropX(Math.max(0, (canvasRef.current?.width || 800) - val));
                            }}
                            className="w-full accent-violet-600"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-[11px] font-bold text-slate-500">
                            <span>Box Height (px)</span>
                            <span>{cropHeight}px</span>
                          </div>
                          <input
                            type="range"
                            min="20"
                            max={canvasRef.current?.height || 800}
                            value={cropHeight}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setCropHeight(val);
                              const limit = (canvasRef.current?.height || 800) - cropY;
                              if (val > limit) setCropY(Math.max(0, (canvasRef.current?.height || 800) - val));
                            }}
                            className="w-full accent-violet-600"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-[11px] font-bold text-slate-500">
                            <span>Horizontal offset X</span>
                            <span>{cropX}px</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max={Math.max(0, (canvasRef.current?.width || 800) - cropWidth)}
                            value={cropX}
                            onChange={(e) => setCropX(parseInt(e.target.value))}
                            className="w-full accent-violet-600"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-[11px] font-bold text-slate-500">
                            <span>Vertical offset Y</span>
                            <span>{cropY}px</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max={Math.max(0, (canvasRef.current?.height || 800) - cropHeight)}
                            value={cropY}
                            onChange={(e) => setCropY(parseInt(e.target.value))}
                            className="w-full accent-violet-600"
                          />
                        </div>

                        <button
                          onClick={applyCrop}
                          className="w-full py-2.5 rounded-lg text-xs font-bold text-white bg-violet-650 hover:bg-violet-700 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <CropIcon className="w-4 h-4" />
                          <span>Apply Crop Selection</span>
                        </button>
                      </div>

                    </div>
                  )}

                </div>

                {/* Final Export Download Button */}
                <button
                  onClick={handleExport}
                  disabled={isProcessing}
                  className="w-full py-3.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>Export & Download Image</span>
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
export default EditImage;
