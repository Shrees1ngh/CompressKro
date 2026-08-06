// ============================================================
// CompressKro — OCR PDF Page Component
// ============================================================

import { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  ScanText, 
  RefreshCw,
  ListOrdered,
  FileText
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { BACKEND_API_URL } from '../../constants';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { CompiledOutputView } from '../../components/CompiledOutputView';
import type { PDFFileItem } from '../../types';

export function OcrPdf() {
  const [ocrFile, setOcrFile] = useState<PDFFileItem | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');

  const ocrInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const executeOcrPdf = async () => {
    if (!ocrFile) return;
    setIsProcessing(true);
    setProgressMsg('Running OCR — this can take a minute for scanned pages...');

    try {
      const formData = new FormData();
      formData.append('file', ocrFile.blob, ocrFile.name);
      const res = await fetch(`${BACKEND_API_URL}/ocr-pdf`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'OCR failed');
      }
      const blob = await res.blob();
      const outName = `ocr_${ocrFile.name}`;

      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(outName);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('OCR PDF', outName, blob.size);

      showSuccess('PDF ready!', `${outName} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err: any) {
      console.error(err);
      showError('OCR failed', err.message || 'Could not run OCR on this PDF.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Click "Select PDF Document" and upload a scanned image-only PDF.' },
    { step: 2, text: 'Click "Perform OCR Analysis" to run optical character recognition on page content.' },
    { step: 3, text: 'Download the compiled searchable PDF containing standard selectable text overlay.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Searchable Text Overlay', desc: 'Adds transparent copy-pasteable text layers aligned precisely on top of document graphics.' },
    { title: 'Tesseract/OCR Engine Integration', desc: 'Queries robust open-source OCR engines (ocrmypdf/tesseract) at server level.' },
    { title: 'Privacy-First Architecture', desc: 'Secure temporary processing streams, keeping data safe and encrypted.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'What is OCR PDF?', answer: 'OCR (Optical Character Recognition) analyzes shapes and letters inside raw scanned PDF images or graphics and overlays searchable, selectable text characters right on top of them.' },
    { question: 'Will this make the file size larger?', answer: 'OCR adds a lightweight text dictionary to the file, which usually causes a minimal increase in file size relative to the original image scans.' },
    { question: 'What happens if the OCR engine is not installed on the server?', answer: 'If the backend does not detect the required binary engines (ocrmypdf/tesseract), it will safely return a 503 error explaining the missing dependencies.' },
    { question: 'Is my scanned PDF secure?', answer: 'Yes, HTTPS transfers are used, and sandboxed processing directories are immediately deleted from server memory after completion.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Compress PDF', desc: 'Optimize PDF file size.', path: '/compress-pdf', icon: FileText },
    { name: 'Edit PDF', desc: 'Modify text or add annotations.', path: '/edit-pdf', icon: FileText },
    { name: 'Merge PDF', desc: 'Combine multiple PDF files.', path: '/merge-pdf', icon: ListOrdered }
  ];

  return (
    <ToolPageLayout
      title="OCR PDF Online"
      subtitle="Extract text and overlay searchable copy-paste layers on scanned PDF documents for free."
      breadcrumbName="OCR PDF"
      seoTitle="OCR PDF Online Free - Searchable Text Extractor | CompressKro"
      seoDescription="OCR PDF documents online for free. Convert scanned PDF pages into fully searchable, selectable, and copy-pasteable PDF text documents."
      canonicalPath="/ocr-pdf"
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
              setOcrFile(null);
            }}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <ScanText className="w-4 h-4 text-violet-500" />
              <span>Make Scanned PDF Searchable</span>
            </h3>

            <div className="space-y-4">
              <input 
                type="file" 
                ref={ocrInputRef} 
                onChange={(e) => e.target.files?.[0] && setOcrFile({ id: 'ocr', name: e.target.files[0].name, size: e.target.files[0].size, blob: e.target.files[0] })} 
                accept="application/pdf" 
                className="hidden" 
              />
              <button
                onClick={() => ocrInputRef.current?.click()}
                className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-violet-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-violet-500" />
                <span>{ocrFile ? ocrFile.name : 'Select PDF Document'}</span>
              </button>
            </div>

            <button
              onClick={executeOcrPdf}
              disabled={!ocrFile || isProcessing}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-indigo-650 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ScanText className="w-4 h-4" />}
              <span>{isProcessing ? progressMsg : 'Perform OCR Analysis'}</span>
            </button>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
