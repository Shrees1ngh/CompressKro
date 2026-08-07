// ============================================================
// CompressKro — AI Client-Side Remove Background Page
// ============================================================

import React, { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  Sparkles, 
  Download, 
  RefreshCw, 
  ImageIcon,
  Trash2,
  AlertTriangle,
  Settings
} from 'lucide-react';
import { removeBackground } from '@imgly/background-removal';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';

export function RemoveBg() {
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [resultUrl, setResultUrl] = useState<string>('');
  const [resultSize, setResultSize] = useState<number>(0);
  
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);

  const { showSuccess, showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setupFile(e.target.files[0]);
    }
  };

  const setupFile = (selectedFile: File) => {
    setFile(selectedFile);
    setImagePreview(URL.createObjectURL(selectedFile));
    setResultUrl('');
    setResultSize(0);
    setProgressPercent(0);
  };

  const executeRemoveBg = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgressMsg('Initializing local AI model...');
    setProgressPercent(0);

    try {
      const config = {
        progress: (key: string, current: number, total: number) => {
          const part = key.split('/').pop() || 'neural assets';
          const percent = Math.round((current / total) * 100);
          setProgressPercent(percent);
          setProgressMsg(`Loading ${part}: ${percent}%`);
        }
      };

      // Process image entirely client-side using @imgly/background-removal WASM
      const blob = await removeBackground(file, config);
      const outName = `${file.name.replace(/\.[a-z0-9]+$/i, '')}_no_bg.png`;

      setResultUrl(URL.createObjectURL(blob));
      setResultSize(blob.size);

      StorageService.updateStats(0, 1);
      HistoryService.addImageEntry('Remove Background', outName, blob.size);

      showSuccess('Background removed!', `Transparent PNG cutout generated successfully.`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err: any) {
      console.error(err);
      showError('AI Processing failed', err.message || 'Could not complete backdrop removal.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
      setProgressPercent(0);
    }
  };

  const handleDownload = () => {
    if (!resultUrl || !file) return;
    const outName = `${file.name.replace(/\.[a-z0-9]+$/i, '')}_no_bg.png`;
    const link = document.createElement('a');
    link.href = resultUrl;
    link.download = outName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Drag & drop or upload your photo.' },
    { step: 2, text: 'Click "Erase Background" to run the local AI segmentation model.' },
    { step: 3, text: 'Preview the transparent PNG cutout and download.' }
  ];

  const benefits: BenefitItem[] = [
    { title: '100% Client-Side AI', desc: 'Runs entirely in your browser using WASM neural networks — your photos never touch a server.' },
    { title: 'High-Quality Segmentation', desc: 'Uses advanced neural segmentation to cleanly extract portraits, animals, and products.' },
    { title: 'Completely Private & Free', desc: 'Secure, offline execution provides maximum data protection with unlimited exports.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'Why does it take longer on the first run?', answer: 'The first execution downloads the AI model weights (approx. 7MB) to your browser cache. Subsequent removals run instantly.' },
    { question: 'Does this tool work for complex backdrops?', answer: 'Yes! The AI segments subjects from any background structure, including complex studio presets, streets, or natural settings.' },
    { question: 'Is my picture secure?', answer: 'Yes. Since background removal compiles 100% in-browser on client threads, no files are ever uploaded.' }
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
      subtitle="Erase backgrounds automatically from portraits, animals, and products locally in your browser using AI."
      breadcrumbName="Remove Background"
      seoTitle="Remove Background Free Online - AI Transparency Generator | CompressKro"
      seoDescription="Remove backgrounds from images online for free. AI-assisted portrait and product segmentation running entirely client-side. 100% private."
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
            <div className="w-12 h-12 rounded-xl bg-violet-50 dark:bg-violet-950/20 text-violet-650 dark:text-violet-400 flex items-center justify-center mx-auto shadow-xs">
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
                
                <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <span>
                    {resultUrl ? 'Result Preview (Transparent PNG)' : 'Original Image Preview'}
                  </span>

                  <button
                    onClick={() => {
                      setFile(null);
                      setImagePreview('');
                      setResultUrl('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>

                {/* Transparency checkered viewport */}
                <div className={`w-full max-h-[500px] overflow-auto flex items-center justify-center rounded-xl p-4 border border-slate-200/30 dark:border-slate-850 ${resultUrl ? 'checkered-bg' : 'bg-slate-50 dark:bg-slate-955/25'}`}>
                  <img
                    src={resultUrl || imagePreview}
                    alt="Background removal preview"
                    className="max-h-[420px] rounded-lg shadow-sm object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Right: Settings Toolbar */}
            <div className="lg:col-span-4 space-y-4">
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel shadow-sm space-y-6">
                
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                  <Settings className="w-4 h-4 text-violet-500" />
                  <span>AI Model Settings</span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Our client-side AI processes your image locally using ONNX WebAssembly. Your photos never leave your device.
                </p>

                {/* Large Image Warning Alert */}
                {file && file.size > 1.5 * 1024 * 1024 && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-start gap-2 text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-[10px] leading-snug">
                      <strong>Large Image Warning:</strong> Running AI segmentation locally on a large image ({getFriendlySize(file.size)}) may cause your browser to temporarily freeze.
                    </p>
                  </div>
                )}

                {/* Loading / Progress State */}
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

                {/* Actions */}
                {!resultUrl ? (
                  <button
                    onClick={executeRemoveBg}
                    disabled={isProcessing}
                    className="w-full py-3.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>{isProcessing ? 'Processing AI...' : 'Erase Background'}</span>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={handleDownload}
                      className="w-full py-3.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Cutout ({getFriendlySize(resultSize)})</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setFile(null);
                        setImagePreview('');
                        setResultUrl('');
                        setResultSize(0);
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-all cursor-pointer"
                    >
                      Try Another Image
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
