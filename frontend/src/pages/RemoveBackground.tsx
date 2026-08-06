// ============================================================
// CompressKro — AI Remove Background Page Component
// ============================================================

import { useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  Sparkles, 
  Download, 
  RefreshCw, 
  ImageIcon,
  Trash2,
  Settings
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { StorageService } from '../services/storage.service';
import { HistoryService } from '../services/history.service';
import { getFriendlySize } from '../utils/format';
import { BACKEND_API_URL } from '../constants';
import { ToolPageLayout } from '../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../components/ToolPageLayout';

export function RemoveBackground() {
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [resultUrl, setResultUrl] = useState<string>('');
  const [resultSize, setResultSize] = useState<number>(0);
  
  // Settings
  const [model, setModel] = useState<string>('isnet-general-use');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const { showSuccess, showError } = useToast();

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
  };

  const executeRemoveBg = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgressMsg('Uploading image and initializing AI saliency model...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', model);

    try {
      const res = await fetch(`${BACKEND_API_URL}/remove-bg`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'AI processing failed');
      }

      const blob = await res.blob();
      const outName = `${file.name.replace(/\.[a-z0-9]+$/i, '')}_no_bg.png`;

      setResultUrl(URL.createObjectURL(blob));
      setResultSize(blob.size);

      StorageService.updateStats(0, 1);
      HistoryService.addImageEntry('AI Remove Bg', outName, blob.size);

      showSuccess('Background removed!', `Transparent PNG cutout generated successfully.`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err: any) {
      console.error(err);
      showError('AI Processing failed', err.message || 'Could not complete backdrop removal.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
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
    { step: 1, text: 'Drag and drop or select your photo.' },
    { step: 2, text: 'Select an AI model and click "Erase Background".' },
    { step: 3, text: 'Preview the cutout on a checkered grid and download your transparent PNG.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Automatic Saliency Detection', desc: 'Identifies portraits, animals, products, or cars automatically and segments the background.' },
    { title: 'Lossless Output Cutout', desc: 'Saves your extracted foreground element as a high-quality, transparent web-ready PNG.' },
    { title: 'Clean Boundary Masking', desc: 'Applies fine-tuned neural boundaries to separate hair strands or fine textures.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'What model is recommended?', answer: 'The default isnet-general-use model is state-of-the-art for clean object/portrait segmentation.' },
    { question: 'Can I download the output as JPG?', answer: 'JPEGs do not support transparency. Cutouts are exported strictly as transparent PNGs.' },
    { question: 'Is my photo private?', answer: 'Yes, images are processed securely inside our backend sandbox and are immediately deleted after execution.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Image Editor', desc: 'Filters, drawing, overlays.', path: '/edit-image', icon: ImageIconComponent },
    { name: 'Image Compressor', desc: 'Reduce file size.', path: '/compress-image', icon: ImageIconComponent },
    { name: 'Image Resizer', desc: 'Adjust pixel dimensions.', path: '/resize-image', icon: ImageIconComponent }
  ];

  function ImageIconComponent() {
    return <ImageIcon className="w-3.5 h-3.5" />;
  }

  return (
    <ToolPageLayout
      title="AI Background Remover"
      subtitle="Erase backgrounds automatically from portraits, animals, and products using neural network models."
      breadcrumbName="AI Remove Background"
      seoTitle="Remove Background Online Free - AI Transparent PNG Cutout | CompressKro"
      seoDescription="Erase backgrounds from images automatically online for free. AI-assisted portrait, animal, and product segmentation. Secure sandbox processing."
      canonicalPath="/remove-background"
      steps={steps}
      benefits={benefits}
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <div className="space-y-6">
        {!file ? (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-12 bg-white/30 dark:bg-slate-900/30 hover:border-violet-500 hover:bg-violet-50/10 cursor-pointer transition-all"
               onClick={() => document.getElementById('file-upload-bg')?.click()}>
            <input
              type="file"
              id="file-upload-bg"
              className="hidden"
              onChange={handleFileChange}
              accept="image/*"
            />
            <div className="p-4 bg-violet-50 dark:bg-violet-950/20 rounded-2xl text-violet-650 dark:text-violet-400 mb-4 shadow-xs">
              <Upload className="w-8 h-8" />
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Drag & drop or click to upload</p>
            <p className="text-xs text-slate-400 mt-1">Supports PNG, JPG, WebP, and portrait photos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Image Preview / Output window */}
            <div className="lg:col-span-8 space-y-4">
              <div className="p-5 bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col items-center">
                
                <div className="w-full flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-4">
                  <span className="text-xs font-bold text-slate-650 dark:text-slate-350">
                    {resultUrl ? 'Result Preview (Transparent Cutout)' : 'Original Image Preview'}
                  </span>
                  
                  <button
                    onClick={() => {
                      setFile(null);
                      setImagePreview('');
                      setResultUrl('');
                    }}
                    className="flex items-center gap-1 text-xs text-rose-605 dark:text-rose-450 hover:opacity-90 font-bold px-2 py-1 rounded-lg border border-rose-100 dark:border-rose-955/20 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>

                {/* Grid Preview Display */}
                <div className={`w-full max-h-[480px] overflow-auto flex items-center justify-center p-4 border border-slate-100 dark:border-slate-800 rounded-xl ${resultUrl ? 'checkered-bg' : 'bg-slate-50 dark:bg-slate-955/25'}`}>
                  <img
                    src={resultUrl || imagePreview}
                    alt="Remove background preview"
                    className="max-h-[420px] rounded-lg shadow-sm object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Side Configuration Menu */}
            <div className="lg:col-span-4 space-y-4">
              <div className="p-5 bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-5">
                
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                  <Settings className="w-4 h-4 text-violet-500" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">AI Model Settings</span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Segmentation Model</label>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/30 text-slate-700 dark:text-slate-300 outline-hidden cursor-pointer focus:ring-2 focus:ring-violet-500/20"
                    >
                      <option value="isnet-general-use">ISNet General Use (Recommended)</option>
                      <option value="u2net">U2Net (Standard Portrait)</option>
                      <option value="u2netp">U2Netp (Lightweight / Fast)</option>
                    </select>
                    <p className="text-[9px] text-slate-400 leading-tight">ISNet model provides the best overall masking edge accuracy for modern photorealistic renders.</p>
                  </div>
                </div>

                {!resultUrl ? (
                  <button
                    onClick={executeRemoveBg}
                    disabled={isProcessing}
                    className="w-full py-3.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-650 to-fuchsia-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>{isProcessing ? progressMsg : 'Erase Background'}</span>
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
                        setResultUrl('');
                        setResultSize(0);
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-all cursor-pointer"
                    >
                      Process Another Model
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
export default RemoveBackground;
