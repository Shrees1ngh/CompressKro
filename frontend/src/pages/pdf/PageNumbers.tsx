// ============================================================
// CompressKro — Add Page Numbers PDF Page Component
// ============================================================

import { useState, useRef, useEffect } from 'react';
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
import { usePdfWorkspace } from '../../context/PdfWorkspaceContext';
import { PdfTaskCompleted } from '../../components/PdfWorkspaceShell/PdfTaskCompleted';
import type { PDFFileItem } from '../../types';
import { HowToUse } from '../../components/ui/HowToUse';

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
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);

  const pgNumInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();
  const { activeFile, activeFileName, activeFileSize, chainOutput } = usePdfWorkspace();

  // Auto-load file from workspace context
  useEffect(() => {
    if (activeFile) {
      setPgNumFile({
        id: 'active',
        name: activeFileName,
        size: activeFileSize,
        blob: activeFile
      });
      clearOutputs();
      setOutputBlob(null);
    } else {
      setPgNumFile(null);
    }
  }, [activeFile]);

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
      setOutputBlob(blob);

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



  return (
    <>
      <div className="space-y-6">
        {outputUrl && outputBlob ? (
          <PdfTaskCompleted
            fileName={outputName}
            fileSize={outputSize}
            originalSize={pgNumFile?.size}
            outputBlob={outputBlob}
            onReset={() => {
              clearOutputs();
              setOutputBlob(null);
              setPgNumFile(null);
            }}
          />
        ) : !pgNumFile ? (
          <HowToUse
            title="Add Page Numbers"
            icon={Hash}
            steps={[
              'Upload your PDF document in the center canvas.',
              'Choose your page number format (Simple, Page X, Page X of Y) and placement position (Bottom/Top).',
              'Specify start page index and whether to skip numbering the cover page (Page 1).',
              'Click "Process Page Numbers" to stamp your document and download the output.'
            ]}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Hash className="w-4 h-4 text-violet-500" />
              <span>Configure Page Numbering</span>
            </h3>

            <div className="space-y-4">
              <div className="space-y-3">
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
    </>
  );
}
