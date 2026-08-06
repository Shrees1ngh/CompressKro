// ============================================================
// CompressKro — Split PDF Page Component
// ============================================================

import React, { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  FileText, 
  RefreshCw,
  ListOrdered,
  Crop
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { CompiledOutputView } from '../../components/CompiledOutputView';
import type { PDFFileItem } from '../../types';

export function SplitPdf() {
  const [splitFile, setSplitFile] = useState<PDFFileItem | null>(null);
  const [splitRange, setSplitRange] = useState<string>('1-2');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');

  const splitInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const handleSplitFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setSplitFile({
        id: 'split',
        name: f.name,
        size: f.size,
        blob: f
      });
      clearOutputs();
    }
  };

  const executeSplit = async () => {
    if (!splitFile) return;
    setIsProcessing(true);
    setProgressMsg('Extracting pages...');

    try {
      const arrayBuf = await splitFile.blob.arrayBuffer();
      const srcDoc = await PDFDocument.load(arrayBuf);
      const totalPages = srcDoc.getPageCount();

      const pagesToExtract: number[] = [];
      const parts = splitRange.split(',');

      for (const part of parts) {
        const range = part.trim().split('-');
        if (range.length === 2) {
          const start = Math.max(1, parseInt(range[0])) - 1;
          const end = Math.min(totalPages, parseInt(range[1])) - 1;
          for (let i = start; i <= end; i++) {
            pagesToExtract.push(i);
          }
        } else if (range.length === 1) {
          const val = parseInt(range[0]) - 1;
          if (val >= 0 && val < totalPages) {
            pagesToExtract.push(val);
          }
        }
      }

      if (pagesToExtract.length === 0) {
        showError('Split failed', 'Invalid page ranges selected.');
        setIsProcessing(false);
        return;
      }

      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(srcDoc, pagesToExtract);
      copiedPages.forEach(p => newPdf.addPage(p));

      const bytes = await newPdf.save();
      const blob = new Blob([bytes as any], { type: 'application/pdf' });

      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(`extracted_${splitFile.name}`);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Split PDF', `extracted_${splitFile.name}`, blob.size);

      showSuccess('PDF ready!', `extracted_${splitFile.name} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err) {
      console.error(err);
      showError('Split failed', 'Error splitting PDF file.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Click "Select PDF to Split" and upload the target PDF document.' },
    { step: 2, text: 'Enter page ranges to extract (e.g., "1-3, 5, 8-10") in the text field.' },
    { step: 3, text: 'Click "Extract Pages" to build and download your split PDF.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'In-Browser Speed', desc: 'Splitting is completely client-side. Pages extract instantly with no network delays.' },
    { title: 'Select Specific Pages', desc: 'Choose precise individual pages, continuous ranges, or multiple ranges combined.' },
    { title: 'Privacy Guaranteed', desc: 'Runs fully locally inside sandbox. Your loaded documents are never sent online.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'How do I specify ranges for splitting?', answer: 'Use commas to separate different groups, and hyphens for ranges. For example, "1-3, 5, 8" extracts pages 1, 2, 3, 5, and 8 into a new PDF.' },
    { question: 'Does splitting a PDF damage the quality?', answer: 'No, splitting simply copies the page objects directly. Vector graphics, fonts, forms, and images remain at their original resolution.' },
    { question: 'Is my document secure?', answer: 'Yes. Since splitting runs locally using Javascript (pdf-lib), no server gets access to your PDF.' },
    { question: 'What happens if I enter an invalid page range?', answer: 'The tool checks the total page count of your PDF and ignores any out-of-bound ranges (e.g., page 50 on a 10-page document).' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Merge PDF', desc: 'Combine multiple PDF files.', path: '/merge-pdf', icon: ListOrdered },
    { name: 'Crop PDF', desc: 'Crop page margins visually.', path: '/crop-pdf', icon: Crop },
    { name: 'Rotate & Order', desc: 'Rearrange and rotate pages.', path: '/rotate-pdf', icon: RefreshCw }
  ];

  return (
    <ToolPageLayout
      title="Split PDF Online"
      subtitle="Extract specific pages or ranges from your PDF document for free."
      breadcrumbName="Split PDF"
      seoTitle="Split PDF Online Free - Extract PDF Pages | CompressKro"
      seoDescription="Split PDF files online for free. Extract specific pages or ranges from any PDF document. Fast, privacy-first local processing, no registration."
      canonicalPath="/split-pdf"
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
              setSplitFile(null);
            }}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-500" />
              <span>Split & Extract Pages</span>
            </h3>

            <div className="space-y-4">
              <input 
                type="file" 
                ref={splitInputRef} 
                onChange={handleSplitFile} 
                accept="application/pdf" 
                className="hidden" 
              />
              <button
                onClick={() => splitInputRef.current?.click()}
                className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-violet-500 dark:hover:border-violet-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-violet-500" />
                <span>{splitFile ? splitFile.name : 'Select PDF to Split'}</span>
              </button>

              {splitFile && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Page Ranges (e.g. 1-3, 5, 8-10)
                  </label>
                  <input
                    type="text"
                    value={splitRange}
                    onChange={(e) => setSplitRange(e.target.value)}
                    placeholder="1-2, 5"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  />
                </div>
              )}
            </div>

            <button
              onClick={executeSplit}
              disabled={!splitFile || isProcessing}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              <span>{isProcessing ? progressMsg : 'Extract Pages'}</span>
            </button>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
