// ============================================================
// CompressKro — Remove Background Page Component
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  Eraser, 
  Settings, 
  Download, 
  RefreshCw, 
  Pipette,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';

export function RemoveBg() {
  const [file, setFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);



  // Background removal states
  const [targetColor, setTargetColor] = useState<{ r: number; g: number; b: number }>({ r: 255, g: 255, b: 255 });
  const [tolerance, setTolerance] = useState<number>(30);
  const [feather, setFeather] = useState<number>(5);

  const { showSuccess, showError } = useToast();

  const handleFileSetup = (uploadedFile: File) => {
    setFile(uploadedFile);
    setImageSrc(URL.createObjectURL(uploadedFile));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSetup(e.target.files[0]);
    }
  };

  // Convert RGB to Hex String for preview
  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join("");
  };

  // Redraw and execute transparent color keying on canvas
  const processImageBackground = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSrc) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Setup canvas size
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw image
      ctx.drawImage(img, 0, 0);

      // Read pixel buffer
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Extract parameters
      const { r: tr, g: tg, b: tb } = targetColor;
      const t = tolerance;
      const f = feather;

      // Color key transparent replacement loop
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Euclidean color distance in 3D RGB space
        const dist = Math.sqrt(
          Math.pow(r - tr, 2) +
          Math.pow(g - tg, 2) +
          Math.pow(b - tb, 2)
        );

        if (dist <= t) {
          data[i + 3] = 0; // Transparent
        } else if (dist < t + f) {
          // Linear feather transparency blend
          const ratio = (dist - t) / f;
          data[i + 3] = Math.round(data[i + 3] * ratio);
        }
      }

      ctx.putImageData(imgData, 0, 0);
    };
    img.src = imageSrc;
  };

  // Process when settings adjust
  useEffect(() => {
    processImageBackground();
  }, [imageSrc, targetColor, tolerance, feather]);

  // Read pixel color from canvas on click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    // Map click bounds to internal dimensions
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = Math.round((e.clientX - rect.left) * scaleX);
    const clickY = Math.round((e.clientY - rect.top) * scaleY);

    // Temp canvas to inspect clean original pixel
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const img = new Image();
    img.onload = () => {
      tempCtx.drawImage(img, 0, 0);
      const pixel = tempCtx.getImageData(clickX, clickY, 1, 1).data;
      setTargetColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
      showSuccess('Color sampled!', `RGB(${pixel[0]}, ${pixel[1]}, ${pixel[2]}) set as background target.`);
    };
    img.src = imageSrc;
  };

  // Download Output PNG
  const handleExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !file) return;
    setIsProcessing(true);

    try {
      const outName = `${file.name.replace(/\.[a-z0-9]+$/i, '')}_transparent.png`;
      const dataUrl = canvas.toDataURL('image/png');
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = outName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      StorageService.updateStats(0, 1);
      HistoryService.addImageEntry('Remove Background', outName, blob.size);

      showSuccess('Background removed!', `${outName} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.85 } });
    } catch (err: any) {
      console.error(err);
      showError('Export failed', 'Could not export transparent image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Upload any solid-colored background image.' },
    { step: 2, text: 'Adjust the tolerance slider or click directly on the image to select a custom color to remove.' },
    { step: 3, text: 'Adjust the feather slider for edge smoothing, and click export to download as a PNG.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Chroma Key Extraction', desc: 'Real-time Euclidean color distance matching for pixel-perfect solid transparency.' },
    { title: 'Click-to-Target Color', desc: 'Easily select any sky, green screen, or custom studio backdrop color from the photo.' },
    { title: 'Edge Smoothing Feather', desc: 'Auto-blends borders to prevent jagged cutouts around complex edges.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'Does this tool work for complex multi-colored backgrounds?', answer: 'This tool is optimized for single or solid-tone backgrounds (such as studio drops, green screens, white product backings, signatures, or logos). For complex patterns, color picker threshold adjustments are required.' },
    { question: 'Can I download the output as a JPEG?', answer: 'No. JPEGs do not support transparent alpha channels. Transparent outputs are strictly saved in standard PNG formats.' },
    { question: 'Is my picture secure?', answer: 'Yes. Color segmentation compiles purely in-browser on client canvases. No files are uploaded to any server.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Image Editor', desc: 'Filters, cropping, drawings.', path: '/edit-image', icon: Eraser },
    { name: 'Image Compressor', desc: 'Target exact KB size.', path: '/compress-image', icon: Eraser },
    { name: 'Image Resizer', desc: 'Scale dimensions.', path: '/resize-image', icon: Eraser }
  ];

  return (
    <ToolPageLayout
      title="Remove Background"
      subtitle="Erase white, black, green screen, or custom picked backdrops from logos, signatures, and photos locally."
      breadcrumbName="Remove Background"
      seoTitle="Remove Background Free Online - Transparency Generator | CompressKro"
      seoDescription="Remove solid backgrounds from images online for free. Clean signatures, transparent logos, green screen keying. 100% private client-side canvas tool."
      canonicalPath="/remove-background"
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
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Upload solid background image</p>
              <p className="text-xs text-slate-400">Perfect for signatures, logos, or green screens</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left: Interactive Canvas */}
            <div className="lg:col-span-8 space-y-4">
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel shadow-xs flex flex-col items-center">
                
                <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Pipette className="w-3.5 h-3.5" />
                    <span>Click anywhere on the image below to pick target color to remove</span>
                  </div>

                  <button
                    onClick={() => {
                      setFile(null);
                      setImageSrc('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer"
                  >
                    Close File
                  </button>
                </div>

                {/* Transparency checkered viewport */}
                <div className="w-full max-h-[500px] overflow-auto flex items-center justify-center checkered-bg rounded-xl p-4 border border-slate-200/30 dark:border-slate-850">
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    className="max-w-full shadow-md rounded-xs cursor-crosshair border border-slate-350 dark:border-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Right: Settings Toolbar */}
            <div className="lg:col-span-4 space-y-4">
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel shadow-sm space-y-6">
                
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                  <Settings className="w-4 h-4 text-violet-500" />
                  <span>Removal Calibration</span>
                </div>

                <div className="space-y-5">
                  {/* Selected target color swatch */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 flex items-center gap-4">
                    <div 
                      className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-750 shadow-inner" 
                      style={{ backgroundColor: rgbToHex(targetColor.r, targetColor.g, targetColor.b) }}
                    />
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Target Background Color</div>
                      <div className="text-xs font-mono text-slate-700 dark:text-slate-350">
                        {rgbToHex(targetColor.r, targetColor.g, targetColor.b).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Tolerance range slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      <span>Tolerance sensitivity</span>
                      <span>{tolerance}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="150"
                      value={tolerance}
                      onChange={(e) => setTolerance(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                    />
                    <p className="text-[9px] text-slate-400 leading-tight">Increase value to remove more similar color shade variations. Decrease to preserve details.</p>
                  </div>

                  {/* Smoothing feather edge slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      <span>Edge feathering blend</span>
                      <span>{feather} px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={feather}
                      onChange={(e) => setFeather(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                    />
                    <p className="text-[9px] text-slate-400 leading-tight">Smooths cut edges by feathering the transparency boundaries.</p>
                  </div>
                </div>

                {file && file.size > 1.5 * 1024 * 1024 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-start gap-2 text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-[10px] leading-snug">
                      <strong>Large Image Warning:</strong> Running color extraction locally on a large image ({getFriendlySize(file.size)}) may cause your browser to temporarily freeze.
                    </p>
                  </div>
                )}

                {/* Export Button */}
                <button
                  onClick={handleExport}
                  disabled={isProcessing}
                  className="w-full py-3.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>Export Transparent PNG</span>
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
export default RemoveBg;
