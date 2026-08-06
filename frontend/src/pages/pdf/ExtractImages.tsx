// ============================================================
// CompressKro — Extract PDF Images Page Component
// ============================================================

import { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Upload, FileImage, RefreshCw } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { BACKEND_API_URL } from '../../constants';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { CompiledOutputView } from '../../components/CompiledOutputView';

export function ExtractImages() {
  const [pdfFile, setPdfFile] = useState<{ name: string; size: number; blob: File } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const executeExtract = async () => {
    if (!pdfFile) return;
    setIsProcessing(true);
    setProgressMsg('Scanning and extracting embedded images...');

    try {
      const formData = new FormData();
      formData.append('file', pdfFile.blob, pdfFile.name);
      
      const res = await fetch(`${BACKEND_API_URL}/extract-images`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Extraction failed. Make sure the PDF contains actual embedded images.');
      }

      const blob = await res.blob();
      const outName = pdfFile.name.replace(/\.pdf$/i, '') + '_extracted_images.zip';
      
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(outName);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Extract Images', outName, blob.size);

      showSuccess('Images extracted!', `${outName} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err: any) {
      console.error(err);
      showError('Extraction failed', err.message || 'Could not extract images from PDF.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Click "Select PDF File" and upload the PDF containing the images you want.' },
    { step: 2, text: 'Click "Extract All Images" to scan object dictionary tags.' },
    { step: 3, text: 'Download the completed ZIP archive containing all extracted files.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Zero Re-compression loss', desc: 'Pulls raw JPEG binary objects directly from the PDF streams without rendering or losing pixels.' },
    { title: 'Format Standardizing', desc: 'Processes raw RGB or FlateDecode streams, converting them into standard PNG images automatically.' },
    { title: 'Bundled ZIP Output', desc: 'Compresses all discovered photos into a single neat folder archive for immediate convenience.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'What image formats can be extracted?', answer: 'This service extracts JPEG, PNG, and vector-aligned bitmap objects embedded within the PDF stream coordinates.' },
    { question: 'Will it extract text or background decorations?', answer: 'No. This tool skips background decorations, margins, and text layers, focusing solely on actual photo objects and inline graphics.' },
    { question: 'What if no images are found?', answer: 'If a PDF contains only text characters and font paths, the scanner will return a notice and skip compilation since there are no image streams.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'PDF to JPG', desc: 'Render entire PDF pages into JPG images.', path: '/pdf-to-jpg', icon: FileImage },
    { name: 'Images to PDF', desc: 'Convert multiple images into a single PDF.', path: '/images-to-pdf', icon: FileImage },
    { name: 'Compress PDF', desc: 'Reduce PDF sizes.', path: '/compress-pdf', icon: FileImage }
  ];

  return (
    <ToolPageLayout
      title="Extract Images from PDF Online"
      subtitle="Scan and extract all embedded photos, screenshots, and graphic assets from a PDF document into a ZIP file."
      breadcrumbName="Extract Images"
      seoTitle="Extract Images from PDF Free Online - JPG/PNG Extractor | CompressKro"
      seoDescription="Extract images from PDF online for free. Export inline photos and graphics into a ZIP file. Fast, safe, and no installation required."
      canonicalPath="/extract-images"
      steps={steps}
      benefits={benefits}
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <div className="space-y-6">
        {outputUrl ? (
          <CompiledOutputView
            outputUrl={outputUrl}
            outputSize={outputSize}
            outputName={outputName}
            onClear={() => {
              clearOutputs();
              setPdfFile(null);
            }}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileImage className="w-4 h-4 text-yellow-600" />
              <span>Extract Inline PDF Images</span>
            </h3>

            <div className="space-y-4">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={(e) => e.target.files?.[0] && setPdfFile({ name: e.target.files[0].name, size: e.target.files[0].size, blob: e.target.files[0] })} 
                accept="application/pdf" 
                className="hidden" 
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-yellow-600 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-yellow-600" />
                <span>{pdfFile ? pdfFile.name : 'Select PDF File'}</span>
              </button>
            </div>

            <button
              onClick={executeExtract}
              disabled={!pdfFile || isProcessing}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-yellow-600 to-amber-650 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileImage className="w-4 h-4" />}
              <span>{isProcessing ? progressMsg : 'Extract All Images'}</span>
            </button>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
