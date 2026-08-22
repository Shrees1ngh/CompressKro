// ============================================================
// CompressKro — OCR PDF Page Component
// ============================================================

import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  ScanText, 
  RefreshCw,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/ui/Toast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { usePdfWorkspace } from '../../context/PdfWorkspaceContext';
import { PdfTaskCompleted } from '../../components/PdfWorkspaceShell/PdfTaskCompleted';
import type { PDFFileItem } from '../../types';
import { HowToUse } from '../../components/ui/HowToUse';
import { ocrPdf } from '../../features/pdf-editor/ocr/ocrPdf';

const LANGUAGES = [
  { code: 'eng', name: 'English' },
  { code: 'hin', name: 'Hindi' },
  { code: 'spa', name: 'Spanish' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'chi_sim', name: 'Chinese (Simp)' },
  { code: 'chi_tra', name: 'Chinese (Trad)' },
  { code: 'jpn', name: 'Japanese' },
  { code: 'kor', name: 'Korean' },
  { code: 'rus', name: 'Russian' },
  { code: 'ara', name: 'Arabic' },
];

export function OcrPdf() {
  const [ocrFile, setOcrFile] = useState<PDFFileItem | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);

  const [isAutoDetect, setIsAutoDetect] = useState<boolean>(true);
  const [selectedLangs, setSelectedLangs] = useState<string[]>(['eng', 'hin']);

  const { toasts, showSuccess, showError, showWarning, dismiss } = useToast();
  const { activeFile, activeFileName, activeFileSize, chainOutput, clearActiveFile } = usePdfWorkspace();

  const [ocrLoadedFile, setOcrLoadedFile] = useState<File | Blob | null>(null);

  // Auto-load file from workspace context
  useEffect(() => {
    if (activeFile) {
      if (activeFile === outputBlob) {
        return;
      }
      if (activeFile !== ocrLoadedFile) {
        setOcrLoadedFile(activeFile);
        setOcrFile({
          id: 'active',
          name: activeFileName,
          size: activeFileSize,
          blob: activeFile
        });
        clearOutputs();
        setOutputBlob(null);
      }
    } else {
      setOcrLoadedFile(null);
      setOcrFile(null);
      clearOutputs();
      setOutputBlob(null);
    }
  }, [activeFile, ocrLoadedFile, outputBlob, activeFileName, activeFileSize]);

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const toggleLanguage = (code: string) => {
    setSelectedLangs((prev) => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev;
        return prev.filter((l) => l !== code);
      } else {
        return [...prev, code];
      }
    });
  };

  const executeOcrPdf = async () => {
    if (!ocrFile) return;
    setIsProcessing(true);
    setProgressMsg('Starting OCR...');
  
    try {
      // Read the raw file bytes
      const arrayBuffer = await (ocrFile.blob as Blob).arrayBuffer();

      // Run the dedicated OCR engine (preserves original PDF, just adds text layer)
      const langsToPass = isAutoDetect ? ['auto'] : selectedLangs;
      const { pdfBytes, warnings } = await ocrPdf(arrayBuffer, langsToPass, (msg) => {
        setProgressMsg(msg);
      });
  
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const outName = `ocr_${ocrFile.name}`;
  
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(outName);
      setOutputBlob(blob);
  
      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('OCR PDF', outName, blob.size);
  
      // Chain output
      chainOutput(blob, outName);
  
      if (warnings.length > 0) {
        const doc = await PDFDocument.load(pdfBytes);
        const totalCount = doc.getPageCount();
        if (warnings.length === totalCount) {
          showWarning(
            'No Text Recognized',
            'Tesseract recognized zero text lines across the entire document. Please check the scan quality or selected languages.'
          );
        } else {
          showWarning(
            'OCR Completed with Warnings',
            `OCR completed, but no text was recognized on some pages:\n${warnings.join('\n')}`
          );
        }
      } else {
        showSuccess('OCR completed!', `${outName} · ${getFriendlySize(blob.size)}`);
      }
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
          'Click "Perform OCR Analysis" to add a searchable text layer.',
          'Download your text-searchable PDF document.'
        ]}
        warning="Note: OCR is processed client-side with multi-language support. Original PDF quality is fully preserved."
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

          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium p-2.5 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-200/50 dark:border-slate-800/50 leading-normal font-semibold">
            Adds an invisible searchable text layer to your PDF. Original quality, colors, and file size are fully preserved.
          </div>

          {/* Language Selector */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAutoDetect}
                onChange={(e) => setIsAutoDetect(e.target.checked)}
                className="rounded text-violet-600 focus:ring-violet-500 w-3.5 h-3.5"
              />
              <span>English + Hindi (Default / Recommended)</span>
            </label>

            {!isAutoDetect && (
              <div className="space-y-2 animate-fade-in">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Select Document Language(s)
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto p-2 border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl thin-scrollbar">
                  {LANGUAGES.map((lang) => {
                    const isSelected = selectedLangs.includes(lang.code);
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => toggleLanguage(lang.code)}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg text-left text-[11px] font-semibold border transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-400 font-bold'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="rounded text-violet-600 focus:ring-violet-500 pointer-events-none w-3 h-3"
                        />
                        <span className="truncate">{lang.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
