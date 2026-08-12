// ============================================================
// CompressKro — Merge PDF Page Component
// ============================================================

import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { 
  ListOrdered, 
  RefreshCw,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { usePdfWorkspace } from '../../context/PdfWorkspaceContext';
import { PdfTaskCompleted } from '../../components/PdfWorkspaceShell/PdfTaskCompleted';
import { HowToUse } from '../../components/ui/HowToUse';

export function MergePdf() {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  
  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);

  const { showSuccess, showError } = useToast();
  const { activeFiles, clearActiveFile } = usePdfWorkspace();

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const executeMerge = async () => {
    if (activeFiles.length < 2) return;
    setIsProcessing(true);
    setProgressMsg('Merging files...');

    try {
      const mergedPdf = await PDFDocument.create();
      for (const item of activeFiles) {
        const arrayBuf = await item.blob.arrayBuffer();
        const doc = await PDFDocument.load(arrayBuf);
        const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
        copiedPages.forEach(p => mergedPdf.addPage(p));
      }

      const mergedBytes = await mergedPdf.save();
      const outputBlob = new Blob([mergedBytes as any], { type: 'application/pdf' });
      
      setOutputUrl(URL.createObjectURL(outputBlob));
      setOutputSize(outputBlob.size);
      setOutputName('merged_document.pdf');
      setOutputBlob(outputBlob);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Merge PDF', 'merged_document.pdf', outputBlob.size);

      showSuccess('PDF ready!', `merged_document.pdf · ${getFriendlySize(outputBlob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err) {
      console.error(err);
      showError('Merge failed', 'Ensure all PDFs are unencrypted and valid files.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  if (outputUrl && outputBlob) {
    return (
      <div className="space-y-6">
        <PdfTaskCompleted
          fileName={outputName}
          fileSize={outputSize}
          outputBlob={outputBlob}
          onReset={() => {
            clearOutputs();
            setOutputBlob(null);
            clearActiveFile();
          }}
        />
      </div>
    );
  }

  if (activeFiles.length === 0) {
    return (
      <HowToUse
        title="Merge PDF"
        icon={ListOrdered}
        steps={[
          'Click the center canvas upload zone to select multiple PDF files, or drag-and-drop them.',
          'Arrange the files in the center canvas using the Up and Down arrow buttons to set the page order.',
          'Click "Merge PDFs Now" to combine the documents into a single PDF.'
        ]}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm animate-fade-in">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-violet-500" />
          <span>Merge Multiple PDFs</span>
        </h3>

        <div className="space-y-3 p-3 bg-violet-500/5 border border-violet-500/10 rounded-xl text-center">
          <div className="text-xs font-bold text-violet-600 dark:text-violet-400">
            {activeFiles.length} PDF file(s) loaded
          </div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Ready to compile
          </div>
        </div>

        <button
          onClick={executeMerge}
          disabled={activeFiles.length < 2 || isProcessing}
          className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm ${
            activeFiles.length < 2 && !isProcessing
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90 cursor-pointer'
          }`}
        >
          {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ListOrdered className="w-4 h-4" />}
          <span>{isProcessing ? progressMsg : 'Merge PDFs Now'}</span>
        </button>

        {activeFiles.length < 2 && !isProcessing && (
          <p className="text-center text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
            Add at least 2 PDFs to merge.
          </p>
        )}
      </div>
    </div>
  );
}
