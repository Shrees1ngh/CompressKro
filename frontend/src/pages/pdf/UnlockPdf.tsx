// ============================================================
// CompressKro — Unlock PDF Page Component
// ============================================================

import { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  FileText, 
  RefreshCw,
  Unlock,
  Key,
  ListOrdered,
  Lock
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

export function UnlockPdf() {
  const [unlockFile, setUnlockFile] = useState<PDFFileItem | null>(null);
  const [unlockPassword, setUnlockPassword] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);

  const unlockInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();
  const { activeFile, activeFileName, activeFileSize, chainOutput } = usePdfWorkspace();

  // Auto-load file from workspace context
  useEffect(() => {
    if (activeFile) {
      setUnlockFile({
        id: 'active',
        name: activeFileName,
        size: activeFileSize,
        blob: activeFile
      });
      clearOutputs();
      setOutputBlob(null);
    } else {
      setUnlockFile(null);
    }
  }, [activeFile]);

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const executeUnlockPdf = async () => {
    if (!unlockFile) return;
    setIsProcessing(true);
    setProgressMsg('Decrypting PDF document...');

    try {
      const formData = new FormData();
      formData.append('file', unlockFile.blob, unlockFile.name);
      formData.append('password', unlockPassword);

      const res = await fetch(`${BACKEND_API_URL}/unlock-pdf`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Server unlock failed');
      }

      const blob = await res.blob();
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(`unlocked_${unlockFile.name}`);
      setOutputBlob(blob);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Unlock PDF', `unlocked_${unlockFile.name}`, blob.size);

      showSuccess('PDF ready!', `unlocked_${unlockFile.name} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err: any) {
      console.warn('Backend PDF unlock failed:', err);
      showError('Unlock failed', err.message || 'Incorrect password or backend processing error.');
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
            originalSize={unlockFile?.size}
            outputBlob={outputBlob}
            onReset={() => {
              clearOutputs();
              setOutputBlob(null);
              setUnlockFile(null);
              setUnlockPassword('');
            }}
          />
        ) : !unlockFile ? (
          <HowToUse
            title="Unlock PDF"
            icon={Unlock}
            steps={[
              'Upload your password-protected PDF document in the center canvas.',
              'Enter the document password (if required) on the right options panel.',
              'Click "Process Decryption" to remove password restrictions and download the unlocked PDF.'
            ]}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Unlock className="w-4 h-4 text-emerald-500" />
              <span>Remove PDF Password Protection</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Document Password (If required)
                </label>
                <div className="relative">
                  <Key className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={unlockPassword}
                    onChange={(e) => setUnlockPassword(e.target.value)}
                    placeholder="Password (leave blank if only owner-locked)..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={executeUnlockPdf}
              disabled={isProcessing}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-500 to-teal-650 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
              <span>{isProcessing ? progressMsg : 'Process Decryption'}</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
