// ============================================================
// CompressKro — Add Page Numbers PDF Page Component
// ============================================================

import { useState, useRef } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  FileText, 
  RefreshCw,
  Hash,
  ListOrdered
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { CompiledOutputView } from '../../components/CompiledOutputView';
import type { PDFFileItem } from '../../types';

export function PageNumbers() {
  const [pgNumFile, setPgNumFile] = useState<PDFFileItem | null>(null);
  const [pgNumFormat, setPgNumFormat] = useState<'simple' | 'page-only' | 'page-total' | 'num-total'>('page-total');
  const [pgNumPosition, setPgNumPosition] = useState<'bottom-right' | 'bottom-center' | 'bottom-left' | 'top-right' | 'top-center'>('bottom-right');
  const [pgNumFontSize, setPgNumFontSize] = useState<number>(10);
  const [pgNumStart, setPgNumStart] = useState<number>(1);
  const [skipCoverPage, setSkipCoverPage] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');

  const pgNumInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const executeAddPageNumbers = async () => {
    if (!pgNumFile) return;
    setIsProcessing(true);
    setProgressMsg('Applying page numbers...');

    try {
      const pdfDoc = await PDFDocument.load(await pgNumFile.blob.arrayBuffer());
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const totalPages = pdfDoc.getPageCount();
      const pages = pdfDoc.getPages();

      pages.forEach((page, index) => {
        if (skipCoverPage && index === 0) return;

        const currentNum = index + pgNumStart - (skipCoverPage ? 1 : 0);
        let str = `${currentNum}`;

        if (pgNumFormat === 'page-total') str = `Page ${currentNum} of ${totalPages}`;
        else if (pgNumFormat === 'page-only') str = `Page ${currentNum}`;
        else if (pgNumFormat === 'num-total') str = `${currentNum} / ${totalPages}`;

        const textWidth = font.widthOfTextAtSize(str, pgNumFontSize);
        const { width, height } = page.getSize();

        let x = width - textWidth - 36;
        let y = 30;

        if (pgNumPosition === 'bottom-center') x = (width - textWidth) / 2;
        if (pgNumPosition === 'bottom-left') x = 36;
        if (pgNumPosition === 'top-right') { x = width - textWidth - 36; y = height - 36; }
        if (pgNumPosition === 'top-center') { x = (width - textWidth) / 2; y = height - 36; }

        page.drawText(str, {
          x,
          y,
          size: pgNumFontSize,
          font,
          color: rgb(0.3, 0.3, 0.3)
        });
      });

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes as any], { type: 'application/pdf' });

      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(`numbered_${pgNumFile.name}`);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Page Numbers', `numbered_${pgNumFile.name}`, blob.size);

      showSuccess('PDF ready!', `numbered_${pgNumFile.name} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err) {
      console.error(err);
      showError('Numbering failed', 'Error drawing page numbers onto PDF.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Click "Select PDF Document" and upload your target file.' },
    { step: 2, text: 'Choose numbering format, placement, font size, start index, and whether to skip page 1.' },
    { step: 3, text: 'Click "Process Page Numbers" to overlay page numbers on pages and download.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Format Presets', desc: 'Select layout formatting: simple digit "1", "Page 1", or compound "Page 1 of 5".' },
    { title: 'Positioning Controls', desc: 'Place numbers at bottom right, bottom center, bottom left, top right, or top center.' },
    { title: 'Skip Cover Pages', desc: 'Optionally skip cover or title sheets, keeping numbering starting from page 2.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'Can I start page numbering from a number other than 1?', answer: 'Yes. You can customize the "Start Number" text field (e.g. start from 5 or 10) to accommodate continuous volumes.' },
    { question: 'Why would I want to skip the cover page?', answer: 'Most reports, books, and formal templates include a cover page where page numbers are visually undesirable. Toggling this checkbox keeps page 1 empty.' },
    { question: 'Are fonts embedded in the output PDF?', answer: 'Yes, standard Helvetica fonts are embedded to display numbers across all PDF readers on any device.' },
    { question: 'Is the page numbering process secure?', answer: 'Yes, it compiles locally using javascript, ensuring no files or passwords upload to external networks.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Add Watermark', desc: 'Overlay logo or text.', path: '/add-watermark', icon: FileText },
    { name: 'Split PDF', desc: 'Extract pages or split ranges.', path: '/split-pdf', icon: FileText },
    { name: 'Merge PDF', desc: 'Combine multiple PDF files.', path: '/merge-pdf', icon: ListOrdered }
  ];

  return (
    <ToolPageLayout
      title="Add Page Numbers to PDF Online"
      subtitle="Number your PDF pages automatically with fully customizable format and alignment styles."
      breadcrumbName="Page Numbers"
      seoTitle="Add Page Numbers to PDF Online Free | CompressKro"
      seoDescription="Add page numbers to PDF documents online for free. Fully customizable formatting, positioning, cover page skipping, and starting values. Local privacy-first."
      canonicalPath="/page-numbers"
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
              setPgNumFile(null);
            }}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Hash className="w-4 h-4 text-violet-500" />
              <span>Configure Page Numbering</span>
            </h3>

            <div className="space-y-4">
              <input 
                type="file" 
                ref={pgNumInputRef} 
                onChange={(e) => e.target.files?.[0] && setPgNumFile({ id: 'pgnum', name: e.target.files[0].name, size: e.target.files[0].size, blob: e.target.files[0] })} 
                accept="application/pdf" 
                className="hidden" 
              />
              <button
                onClick={() => pgNumInputRef.current?.click()}
                className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-violet-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-violet-500" />
                <span>{pgNumFile ? pgNumFile.name : 'Select PDF Document'}</span>
              </button>

              {pgNumFile && (
                <div className="space-y-3 border-t border-slate-200/50 dark:border-slate-800/50 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Format
                      </label>
                      <select
                        value={pgNumFormat}
                        onChange={(e) => setPgNumFormat(e.target.value as any)}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none"
                      >
                        <option value="simple">Simple Integer (e.g. 1)</option>
                        <option value="page-only">"Page 1"</option>
                        <option value="page-total">"Page 1 of 12"</option>
                        <option value="num-total">"1 / 12"</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Placement Position
                      </label>
                      <select
                        value={pgNumPosition}
                        onChange={(e) => setPgNumPosition(e.target.value as any)}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none"
                      >
                        <option value="bottom-right">Bottom Right</option>
                        <option value="bottom-center">Bottom Center</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="top-center">Top Center</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Font Size (px)
                      </label>
                      <input
                        type="number"
                        min={8}
                        max={24}
                        value={pgNumFontSize}
                        onChange={(e) => setPgNumFontSize(Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Start From Number
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={pgNumStart}
                        onChange={(e) => setPgNumStart(Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="skipCover"
                        checked={skipCoverPage}
                        onChange={(e) => setSkipCoverPage(e.target.checked)}
                        className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 h-4 w-4"
                      />
                      <label htmlFor="skipCover" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        Skip Cover Page (Page 1)
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={executeAddPageNumbers}
              disabled={!pgNumFile || isProcessing}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-indigo-650 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
              <span>{isProcessing ? progressMsg : 'Process Page Numbers'}</span>
            </button>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
