// ============================================================
// CompressKro — PDF to JPG Page Component
// ============================================================

import { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  FileImage, 
  RefreshCw,
  Download,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { loadPdfJs } from '../../utils/pdfLoader';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import type { PDFFileItem, PdfJpgResult } from '../../types';

export function PdfToJpg() {
  const [pdfJpgFile, setPdfJpgFile] = useState<PDFFileItem | null>(null);
  const [pdfJpgResults, setPdfJpgResults] = useState<PdfJpgResult[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const pdfJpgInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();

  const executePdfToJpg = async () => {
    if (!pdfJpgFile) return;
    setIsProcessing(true);
    setProgressMsg('Rendering PDF pages to JPEG images...');

    try {
      const pdfjsLib = await loadPdfJs();
      const arrayBuf = await pdfJpgFile.blob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
      const resultsList: PdfJpgResult[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        setProgressMsg(`Rendering page ${i} of ${pdf.numPages}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport }).promise;

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const res = await fetch(dataUrl);
        const blob = await res.blob();

        const baseName = pdfJpgFile.name.replace(/\.[^/.]+$/, '');
        resultsList.push({
          pageNum: i,
          dataUrl,
          blob,
          size: blob.size,
          filename: `${baseName}_page_${i}.jpg`
        });
      }

      setPdfJpgResults(resultsList);
      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('PDF to JPG', pdfJpgFile.name, pdfJpgFile.size);
      showSuccess('Conversion complete!', `Rendered ${resultsList.length} page(s) to JPG.`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err) {
      console.error(err);
      showError('Conversion failed', 'Error converting PDF pages to JPG images.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const downloadSingleJpg = (item: PdfJpgResult) => {
    const a = document.createElement('a');
    a.href = item.dataUrl;
    a.download = item.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Click "Select PDF Document" and load your PDF file.' },
    { step: 2, text: 'Click "Convert to JPG Images" to trigger high-resolution rendering.' },
    { step: 3, text: 'Download converted page images individually from the output results grid.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'High Definition', desc: 'Renders pages at double pixel density (scale=2.0) to keep texts and charts extremely clear.' },
    { title: 'Individual Downloads', desc: 'View page previews and download only the specific sheets you need.' },
    { title: 'Secure and Local', desc: 'Queries pdf.js inside browser context. Your document pages are rendered locally.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'Will my converted JPEGs be blurry?', answer: 'No. CompressKro exports pages at 2x resolution, meaning small print and illustrations remain sharp and clean.' },
    { question: 'Can I select which pages to convert?', answer: 'The tool converts all pages to JPG first, and then lets you selectively download only the specific page images you want.' },
    { question: 'Is my data private?', answer: 'Yes. Every page image is generated inside your browser memory as a local canvas data URL. No images upload online.' },
    { question: 'Can I convert password protected files?', answer: 'No. Decrypt the password protected file using our "Unlock PDF" tool first before converting pages to JPG.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Images to PDF', desc: 'Convert photos to PDF page.', path: '/images-to-pdf', icon: Upload },
    { name: 'Extract Images', desc: 'Extract inline photos from PDF.', path: '/extract-images', icon: FileImage },
    { name: 'Split PDF', desc: 'Extract pages or split ranges.', path: '/split-pdf', icon: FileText }
  ];

  return (
    <ToolPageLayout
      title="Convert PDF to JPG Online"
      subtitle="Render and extract all pages of your PDF file as JPEG images online for free."
      breadcrumbName="PDF to JPG"
      seoTitle="Convert PDF to JPG Online Free - Extract PDF Pages | CompressKro"
      seoDescription="Convert PDF pages to JPG images online for free. High-definition page rendering, individual page image downloads. Secure in-browser local processing."
      canonicalPath="/pdf-to-jpg"
      steps={steps}
      benefits={benefits}
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <div className="space-y-6">
        {pdfJpgResults.length > 0 ? (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm relative">
            <button 
              onClick={() => {
                setPdfJpgFile(null);
                setPdfJpgResults([]);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Start over"
            >
              Clear
            </button>
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800 pr-12">
              <h3 className="text-md font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Converted JPG Images ({pdfJpgResults.length})</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[380px] overflow-y-auto pr-1">
              {pdfJpgResults.map(item => (
                <div key={item.pageNum} className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-slate-950/30 space-y-2">
                  <div className="h-40 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-800">
                    <img src={item.dataUrl} alt={`Page ${item.pageNum}`} className="max-h-full object-contain" />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">Page {item.pageNum}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{getFriendlySize(item.size)}</span>
                  </div>
                  <button
                    onClick={() => downloadSingleJpg(item)}
                    className="w-full py-1.5 rounded-lg text-xs font-semibold bg-violet-650 hover:bg-violet-700 text-white flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Page {item.pageNum}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileImage className="w-4 h-4 text-fuchsia-500" />
              <span>Convert PDF Pages to JPG</span>
            </h3>

            <div className="space-y-4">
              <input 
                type="file" 
                ref={pdfJpgInputRef} 
                onChange={(e) => e.target.files?.[0] && setPdfJpgFile({ id: 'pdfJpg', name: e.target.files[0].name, size: e.target.files[0].size, blob: e.target.files[0] })} 
                accept="application/pdf" 
                className="hidden" 
              />
              <button
                onClick={() => pdfJpgInputRef.current?.click()}
                className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-fuchsia-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-fuchsia-500" />
                <span>{pdfJpgFile ? pdfJpgFile.name : 'Select PDF Document'}</span>
              </button>
            </div>

            <button
              onClick={executePdfToJpg}
              disabled={!pdfJpgFile || isProcessing}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-fuchsia-600 to-pink-650 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileImage className="w-4 h-4" />}
              <span>{isProcessing ? progressMsg : 'Convert to JPG Images'}</span>
            </button>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
