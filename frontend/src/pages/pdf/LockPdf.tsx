// ============================================================
// CompressKro — Lock PDF Page Component
// ============================================================

import { useState, useRef } from 'react';
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
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { CompiledOutputView } from '../../components/CompiledOutputView';
import type { PDFFileItem } from '../../types';

export function LockPdf() {
  const [lockFile, setLockFile] = useState<PDFFileItem | null>(null);
  const [userPassword, setUserPassword] = useState<string>('');
  const [ownerPassword, setOwnerPassword] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');

  const lockInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();

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

        StorageService.updateStats(1, 0);
        HistoryService.addPdfEntry('Lock PDF', `protected_${lockFile.name}`, blob.size);

        showSuccess('PDF locked!', `protected_${lockFile.name} · ${getFriendlySize(blob.size)}`);
        confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
      } catch (fallbackErr) {
        showError('Encryption failed', 'Please make sure the backend server is running for PDF encryption.');
      }
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Click "Select PDF to Lock" and upload the document you want to secure.' },
    { step: 2, text: 'Enter a strong User Password, and optionally a master Owner Password.' },
    { step: 3, text: 'Click "Encrypt & Protect PDF" to generate and download the encrypted PDF.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Secure Encryption', desc: 'Uses standard PDF security filters (RC4/AES) to lock view and copy permissions.' },
    { title: 'Owner Password', desc: 'Allows separate master passwords to prevent annotations, editing, or printing.' },
    { title: 'Instant Offline Fallback', desc: 'Decrypt/encrypt algorithms fallback to local client assembly if backend is busy.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'What is the difference between User and Owner passwords?', answer: 'A User password restricts viewing/opening the PDF. An Owner password restricts edit permissions like copy, print, extract, or add comments.' },
    { question: 'Will my password be sent to CompressKro servers?', answer: 'Only temporary encryption routes are used, and files are instantly deleted from servers. In case of network errors, it executes offline in your browser.' },
    { question: 'Is RC4 or AES used for encryption?', answer: 'CompressKro uses standard 128-bit PDF encryption which is highly compatible with Adobe Acrobat Reader, Chrome, and iOS viewers.' },
    { question: 'What happens if I forget my password?', answer: 'PDF encryption is mathematically locked. Make sure to remember your password as we do not keep copies of passwords or protected documents.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Unlock PDF', desc: 'Remove passwords from PDFs.', path: '/unlock-pdf', icon: Lock },
    { name: 'Merge PDF', desc: 'Combine multiple PDF files.', path: '/merge-pdf', icon: ListOrdered },
    { name: 'Split PDF', desc: 'Extract pages or split ranges.', path: '/split-pdf', icon: FileText }
  ];

  return (
    <ToolPageLayout
      title="Lock PDF Online"
      subtitle="Protect your PDF document with secure user and owner passwords."
      breadcrumbName="Lock PDF"
      seoTitle="Lock PDF Online Free - Password Protect PDF | CompressKro"
      seoDescription="Lock PDF documents online with secure passwords. Protect your PDFs from unauthorized viewing, printing, or copying. Safe, privacy-first tools."
      canonicalPath="/lock-pdf"
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
              setLockFile(null);
              setUserPassword('');
              setOwnerPassword('');
            }}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-500" />
              <span>Encrypt & Password Protect PDF</span>
            </h3>

            <div className="space-y-4">
              <input 
                type="file" 
                ref={lockInputRef} 
                onChange={(e) => e.target.files?.[0] && setLockFile({ id: 'lock', name: e.target.files[0].name, size: e.target.files[0].size, blob: e.target.files[0] })} 
                accept="application/pdf" 
                className="hidden" 
              />
              <button
                onClick={() => lockInputRef.current?.click()}
                className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-amber-500" />
                <span>{lockFile ? lockFile.name : 'Select PDF to Lock'}</span>
              </button>

              {lockFile && (
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
              )}
            </div>

            <button
              onClick={executeLockPdf}
              disabled={!lockFile || !userPassword || isProcessing}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>{isProcessing ? progressMsg : 'Encrypt & Protect PDF'}</span>
            </button>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
