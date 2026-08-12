// ============================================================
// CompressKro — OCR PDF Page Component
// ============================================================

import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  ScanText, 
  RefreshCw,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { BACKEND_API_URL } from '../../constants';
import { usePdfWorkspace } from '../../context/PdfWorkspaceContext';
import { PdfTaskCompleted } from '../../components/PdfWorkspaceShell/PdfTaskCompleted';
import type { PDFFileItem } from '../../types';
import { HowToUse } from '../../components/ui/HowToUse';

export function OcrPdf() {
  const [ocrFile, setOcrFile] = useState<PDFFileItem | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);

  const { showSuccess, showError } = useToast();
  const { activeFile, activeFileName, activeFileSize, chainOutput, clearActiveFile } = usePdfWorkspace();

  // Auto-load file from workspace context
  useEffect(() => {
    if (activeFile) {
      setOcrFile({
        id: 'active',
        name: activeFileName,
        size: activeFileSize,
        blob: activeFile
      });
      clearOutputs();
      setOutputBlob(null);
    } else {
      setOcrFile(null);
    }
  }, [activeFile, activeFileName, activeFileSize]);

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const executeOcrPdf = async () => {
    if (!ocrFile) return;
    setIsProcessing(true);
    setProgressMsg('Running OCR analysis...');

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
      setOutputBlob(blob);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('OCR PDF', outName, blob.size);

      // Chain output
      chainOutput(blob, outName);

      showSuccess('OCR completed!', `${outName} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err: any) {
      console.error(err);
      showError('OCR failed', err.message || 'Error processing OCR on PDF.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  if (!activeFile) {
    return (
      <HowToUse
        title="OCR PDF"
        icon={ScanText}
        steps={[
          'Upload a scanned PDF document in the center canvas upload zone.',
          'Click "Perform OCR Analysis" to scan and extract page text.',
          'Download your output text-searchable PDF document.'
        ]}
        warning="Note: OCR is processed client-side. Accuracy is not perfect and may misread some characters/fonts."
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {outputUrl && outputBlob ? (
        <PdfTaskCompleted
          fileName={outputName}
          fileSize={outputSize}
          originalSize={ocrFile?.size}
          outputBlob={outputBlob}
          onReset={() => {
            clearOutputs();
            setOutputBlob(null);
            clearActiveFile();
          }}
        />
      ) : (
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <ScanText className="w-4 h-4 text-violet-500" />
            <span>OCR Scanned Document</span>
          </h3>

          <div className="space-y-3 p-3 bg-violet-500/5 border border-violet-500/10 rounded-xl text-center">
            <div className="text-xs font-bold text-[var(--ck-text-primary)] truncate">
              {ocrFile?.name}
            </div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
              {ocrFile ? getFriendlySize(ocrFile.size) : ''}
            </div>
          </div>

          <div className="text-[10px] text-slate-505 dark:text-slate-400 font-medium p-2.5 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-200/50 dark:border-slate-800/50 leading-normal font-semibold">
            Note: OCR is processed client-side. Accuracy is not perfect and may misread some characters/fonts.
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
  );
}
