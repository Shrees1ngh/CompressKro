// ============================================================
// CompressKro — Repair PDF Page Component
// ============================================================

import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Wrench, 
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

export function RepairPdf() {
  const [repairFile, setRepairFile] = useState<PDFFileItem | null>(null);
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
      setRepairFile({
        id: 'active',
        name: activeFileName,
        size: activeFileSize,
        blob: activeFile
      });
      clearOutputs();
      setOutputBlob(null);
    } else {
      setRepairFile(null);
    }
  }, [activeFile, activeFileName, activeFileSize]);

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const executeRepairPdf = async () => {
    if (!repairFile) return;
    setIsProcessing(true);
    setProgressMsg('Repairing PDF structure...');

    try {
      const formData = new FormData();
      formData.append('file', repairFile.blob, repairFile.name);

      const res = await fetch(`${BACKEND_API_URL}/repair-pdf`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = typeof errJson.error === 'string' 
          ? errJson.error 
          : (errJson.message || 'Could not repair this PDF file.');
        throw new Error(errMsg);
      }

      const blob = await res.blob();
      const outName = `repaired_${repairFile.name}`;

      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(outName);
      setOutputBlob(blob);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Repair PDF', outName, blob.size);

      // Chain output
      chainOutput(blob, outName);

      showSuccess('PDF ready!', `${outName} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err: any) {
      console.error(err);
      showError('Repair failed', err.message || 'Error executing PDF recovery process.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  if (!activeFile) {
    return (
      <HowToUse
        title="Repair PDF"
        icon={Wrench}
        steps={[
          'Upload a corrupted, broken, or unreadable PDF document in the center canvas.',
          'Click "Repair PDF Document" in the right option panel.',
          'Download the recovered, repaired PDF document.'
        ]}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {outputUrl && outputBlob ? (
        <PdfTaskCompleted
          fileName={outputName}
          fileSize={outputSize}
          originalSize={repairFile?.size}
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
            <Wrench className="w-4 h-4 text-emerald-500" />
            <span>Repair Corrupted PDF</span>
          </h3>

          <div className="space-y-3 p-3 bg-emerald-550/5 border border-emerald-500/10 rounded-xl text-center">
            <div className="text-xs font-bold text-[var(--ck-text-primary)] truncate">
              {repairFile?.name}
            </div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
              {repairFile ? getFriendlySize(repairFile.size) : ''}
            </div>
          </div>

          <button
            onClick={executeRepairPdf}
            disabled={isProcessing}
            className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-650 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
            <span>{isProcessing ? progressMsg : 'Repair PDF Document'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
