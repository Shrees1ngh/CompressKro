// ============================================================
// CompressKro — Repair PDF Page Component
// ============================================================

import { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  Wrench, 
  RefreshCw,
  FileCheck,
  ShieldCheck,
  FileType
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

export function RepairPdf() {
  const [repairFile, setRepairFile] = useState<PDFFileItem | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');

  const repairInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const executeRepairPdf = async () => {
    if (!repairFile) return;
    setIsProcessing(true);
    setProgressMsg('Diagnosing and repairing PDF structure...');

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

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Repair PDF', outName, blob.size);

      showSuccess('PDF repaired successfully!', `${outName} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err: any) {
      console.warn('Backend PDF repair failed:', err);
      showError('Repair failed', err.message || 'Could not repair this PDF file.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Click "Select Corrupted PDF" and upload your damaged or unreadable PDF file.' },
    { step: 2, text: 'Click "Repair PDF Document" to trigger multi-engine structural recovery.' },
    { step: 3, text: 'Preview and download your freshly rebuilt, standard-compliant PDF document.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Rebuild XREF Tables', desc: 'Fixes broken cross-reference tables and corrupt catalog trailers caused by interrupted downloads or saving errors.' },
    { title: 'Recover Content Streams', desc: 'Restores readable page streams, embedded images, and missing font tables using Ghostscript & QPDF recovery routines.' },
    { title: '100% Private & Safe', desc: 'Processing runs inside temporary isolated sandboxes and temp files are permanently deleted immediately.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'What types of PDF corruption can be repaired?', answer: 'The repair tool can fix unreadable XREF tables, broken stream headers, corrupted page dictionaries, truncated file ends, and invalid object offsets caused by network drops or improper software export.' },
    { question: 'Will my document content or layout be altered?', answer: 'No. The repair engine preserves all valid text, images, vector elements, and page structures while discarding only corrupted binary overhead.' },
    { question: 'Can it repair password-protected damaged PDFs?', answer: 'If a PDF is password protected and corrupted, unlock it first using our "Unlock PDF" tool if accessible, then run the repair tool.' },
    { question: 'Is any software installation required?', answer: 'No, everything is processed online using high-performance server-side recovery engines.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Unlock PDF', desc: 'Remove password restrictions.', path: '/unlock-pdf', icon: FileCheck },
    { name: 'Compress PDF', desc: 'Optimize PDF file size.', path: '/compress-pdf', icon: ShieldCheck },
    { name: 'PDF to Word', desc: 'Convert text to Word format.', path: '/pdf-to-word', icon: FileType }
  ];

  return (
    <ToolPageLayout
      title="Repair Damaged PDF Online"
      subtitle="Fix corrupted, unreadable, or broken PDF documents for free using advanced recovery engines."
      breadcrumbName="Repair PDF"
      seoTitle="Repair PDF Online Free - Fix Corrupted & Broken PDFs | CompressKro"
      seoDescription="Repair corrupted PDF files online for free. Rebuild XREF tables, fix damaged stream objects, and recover unreadable PDF pages. Private, fast, and no registration required."
      canonicalPath="/repair-pdf"
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
              setRepairFile(null);
            }}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-emerald-500" />
              <span>Repair Corrupted PDF File</span>
            </h3>

            <div className="space-y-4">
              <input 
                type="file" 
                ref={repairInputRef} 
                onChange={(e) => e.target.files?.[0] && setRepairFile({ id: 'repair', name: e.target.files[0].name, size: e.target.files[0].size, blob: e.target.files[0] })} 
                accept="application/pdf" 
                className="hidden" 
              />
              <button
                onClick={() => repairInputRef.current?.click()}
                className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-emerald-500" />
                <span>{repairFile ? repairFile.name : 'Select Corrupted PDF'}</span>
              </button>
            </div>

            {repairFile && (
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setRepairFile(null)}
                  disabled={isProcessing}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeRepairPdf}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 dark:disabled:bg-slate-800 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{progressMsg}</span>
                    </>
                  ) : (
                    <>
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Repair PDF Document</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
