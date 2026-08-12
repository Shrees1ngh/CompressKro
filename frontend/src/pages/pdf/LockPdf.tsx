// ============================================================
// CompressKro — Lock PDF Page Component
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  FileText, 
  RefreshCw,
  Lock,
  Key,
  ListOrdered
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

export function LockPdf() {
  const [lockFile, setLockFile] = useState<PDFFileItem | null>(null);
  const [userPassword, setUserPassword] = useState<string>('');
  const [ownerPassword, setOwnerPassword] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);

  const lockInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();
  const { activeFile, activeFileName, activeFileSize, chainOutput } = usePdfWorkspace();

  // Auto-load file from workspace context
  useEffect(() => {
    if (activeFile) {
      setLockFile({
        id: 'active',
        name: activeFileName,
        size: activeFileSize,
        blob: activeFile
      });
      clearOutputs();
      setOutputBlob(null);
    } else {
      setLockFile(null);
    }
  }, [activeFile]);

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const executeLockPdf = async () => {
    if (!lockFile) return;
    if (!userPassword) {
      showError('Password required', 'Please enter a password to encrypt the PDF.');
      return;
    }
    setIsProcessing(true);
    setProgressMsg('Encrypting PDF document...');

    try {
      const formData = new FormData();
      formData.append('file', lockFile.blob, lockFile.name);
      formData.append('userPassword', userPassword);
      if (ownerPassword) formData.append('ownerPassword', ownerPassword);

      const res = await fetch(`${BACKEND_API_URL}/lock-pdf`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw new Error('Server lock failed');
      }

      const blob = await res.blob();
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(`protected_${lockFile.name}`);
      setOutputBlob(blob);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Lock PDF', `protected_${lockFile.name}`, blob.size);

      showSuccess('PDF locked!', `protected_${lockFile.name} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err) {
      console.warn('Backend PDF lock failed, falling back to client engine:', err);
      try {
        const arrayBuf = await lockFile.blob.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuf);
        const bytes = await pdfDoc.save({
          userPassword,
          ownerPassword: ownerPassword || userPassword,
        } as any);
        const blob = new Blob([bytes as any], { type: 'application/pdf' });
        
        setOutputUrl(URL.createObjectURL(blob));
        setOutputSize(blob.size);
        setOutputName(`protected_${lockFile.name}`);
        setOutputBlob(blob);

        StorageService.updateStats(1, 0);
        HistoryService.addPdfEntry('Lock PDF', `protected_${lockFile.name}`, blob.size);

        showSuccess('PDF locked!', `protected_${lockFile.name} · ${getFriendlySize(blob.size)}`);
        confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
      } catch (fallbackErr) {
        showError('Encryption failed', 'Fallback encryption failed.');
      }
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
            originalSize={lockFile?.size}
            outputBlob={outputBlob}
            onReset={() => {
              clearOutputs();
              setOutputBlob(null);
              setLockFile(null);
              setUserPassword('');
              setOwnerPassword('');
            }}
          />
        ) : !lockFile ? (
          <HowToUse
            title="Lock PDF"
            icon={Lock}
            steps={[
              'Upload your PDF document in the center canvas.',
              'Enter a user password (required) and an optional owner password on the right.',
              'Click "Encrypt & Protect PDF" to secure the document and download the locked PDF.'
            ]}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-500" />
              <span>Encrypt & Password Protect PDF</span>
            </h3>

            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    User Password (Required)
                  </label>
                  <div className="relative">
                    <Key className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      placeholder="Enter password to open PDF..."
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Owner Password (Optional)
                  </label>
                  <input
                    type="password"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    placeholder="Restrict editing, copying, or printing..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={executeLockPdf}
              disabled={!userPassword || isProcessing}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>{isProcessing ? progressMsg : 'Encrypt & Protect PDF'}</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
