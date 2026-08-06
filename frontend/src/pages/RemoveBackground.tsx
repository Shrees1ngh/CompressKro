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
  Trash2
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
    setProgressMsg('Uploading image & running AI model...');

    const formData = new FormData();
    formData.append('file', file);

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
      showError('Processing failed', err.message || 'Could not remove background. Please try again.');
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
    { step: 1, text: 'Upload your photo — portraits, products, or any image.' },
    { step: 2, text: 'Click "Erase Background" and wait a few seconds.' },
    { step: 3, text: 'Download your transparent PNG cutout.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Automatic Detection', desc: 'AI identifies people, animals, and products automatically — no manual selection needed.' },
    { title: 'Transparent PNG Output', desc: 'Get a clean cutout with transparent background, ready for any design project.' },
    { title: 'Secure Processing', desc: 'Your images are processed in an isolated sandbox and deleted immediately after download.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'What types of images work best?', answer: 'Portraits, product photos, and images with clear subject-background separation give the best results.' },
    { question: 'Can I download as JPG?', answer: 'No — JPEG does not support transparency. Cutouts are always exported as transparent PNGs.' },
    { question: 'Is my photo private?', answer: 'Yes, images are processed securely and automatically deleted after you download the result.' }
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
      subtitle="Erase backgrounds automatically from portraits, animals, and products using AI."
      breadcrumbName="AI Remove Background"
      seoTitle="Remove Background Online Free - AI Transparent PNG Cutout | CompressKro"
      seoDescription="Erase backgrounds from images automatically online for free. AI-powered portrait and product segmentation. Secure and private."
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
            <p className="text-xs text-slate-400 mt-1">Supports PNG, JPG, WebP — portraits, products, or any image</p>
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

            {/* Side Action Panel — Simple, no settings */}
            <div className="lg:col-span-4 space-y-4">
              <div className="p-5 bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-5">
                
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">AI Background Removal</span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Our AI automatically detects the main subject in your photo and removes the background, producing a clean transparent PNG.
                </p>

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
export default RemoveBackground;
