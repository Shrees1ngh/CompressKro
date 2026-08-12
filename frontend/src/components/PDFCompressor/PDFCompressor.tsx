// ============================================================
// CompressKro — PDFCompressor Right-Panel Component
// Renders inside the PdfWorkspaceShell's right options panel.
// Reads the active file from PdfWorkspaceContext; all compression
// logic remains exactly the same — only layout/wiring changed.
// ============================================================

import { useState, useEffect } from 'react';
import { FileText, Loader2, Sparkles, Download, CheckCircle2, Minimize2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { analyzePdf } from '../../utils/pdf';
import { compressPdf, cancelCompression } from '../../services/pdf.service';
import type { PDFCompressedResult, PDFCompressionLevel } from '../../types';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { downloadBlob } from '../../utils/download';
import { usePdfWorkspace } from '../../context/PdfWorkspaceContext';
import { PdfTaskCompleted } from '../PdfWorkspaceShell/PdfTaskCompleted';
import { HowToUse } from '../ui/HowToUse';

export default function PDFCompressor() {
  const { showSuccess, showError, showInfo } = useToast();
  const { activeFile, activeFileName, activeFileSize, chainOutput } = usePdfWorkspace();

  // Compression Parameters
  const [level, setLevel] = useState<PDFCompressionLevel>('balanced');
  const [targetSizeKB, setTargetSizeKB] = useState<number | ''>('');

  // Processing Output State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<PDFCompressedResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // Track which file we last analyzed so we re-analyze on file changes
  const [analyzedFileRef, setAnalyzedFileRef] = useState<File | Blob | null>(null);

  // Auto-analyze when active file changes
  useEffect(() => {
    if (!activeFile || activeFile === analyzedFileRef) return;

    // Reset state for new file
    setResult(null);
    setProgress(0);
    setIsProcessing(false);
    setLevel('balanced');
    setTargetSizeKB('');

    setAnalyzedFileRef(activeFile);
    setIsAnalyzing(true);

    (async () => {
      try {
        const info = await analyzePdf(activeFile as File);
        showSuccess(`PDF analyzed: ${info.pageCount} page(s)`);
      } catch {
        // Analysis failure is non-fatal — file can still be compressed
      } finally {
        setIsAnalyzing(false);
      }
    })();
  }, [activeFile]);

  const handleCompress = async () => {
    if (!activeFile) return;
    setIsProcessing(true);
    setProgress(10);

    try {
      const outcome = await compressPdf(
        activeFile as File,
        {
          level,
          targetSizeKB: targetSizeKB === '' ? undefined : targetSizeKB,
        },
        (p) => setProgress(p)
      );

      setResult(outcome);

      // Update global stats and local operation history
      const savedBytes = activeFileSize - outcome.compressedSize;
      StorageService.updateStats(1, savedBytes);
      HistoryService.addPdfEntry('Compressed', activeFileName, outcome.compressedSize);

      const computedSavedPct = outcome.savedPercent !== undefined 
        ? outcome.savedPercent 
        : Math.max(0, Math.round((savedBytes / activeFileSize) * 100));

      showSuccess(`PDF compressed successfully by ${computedSavedPct}%!`);
    } catch (err: any) {
      if (err.message !== 'Compression cancelled by user.') {
        showError(err.message || 'PDF compression failed.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    cancelCompression();
    setIsProcessing(false);
    showInfo('Compression cancelled.');
  };

  const handleDownload = () => {
    if (!result) return;
    const name = result.originalName.replace(/\.pdf$/i, '_optimized.pdf');
    downloadBlob(result.compressedBlob, name);
  };

  // No active file — prompt user
  if (!activeFile) {
    return (
      <HowToUse
        title="PDF Compressor"
        icon={Minimize2}
        steps={[
          'Click on the center canvas drop zone to upload your PDF file.',
          'Select a compression level (Basic, Strong, or Extreme) or set a target size in KB.',
          'Click "Compress PDF" to process. Once complete, download your optimized PDF.'
        ]}
      />
    );
  }

  const handleReset = () => {
    setResult(null);
    setProgress(0);
    setLevel('balanced');
    setTargetSizeKB('');
  };

  if (result && !isProcessing) {
    const optimizedName = activeFileName.replace(/\.pdf$/i, '_optimized.pdf');
    return (
      <PdfTaskCompleted
        fileName={optimizedName}
        fileSize={result.compressedSize}
        originalSize={activeFileSize}
        outputBlob={result.compressedBlob}
        onReset={handleReset}
      />
    );
  }

  return (
    <div className="flex flex-col h-full justify-between animate-fade-in">
      <div className="space-y-5">
        <div>
          <h3 className="text-xs font-black text-[var(--ck-text-primary)] uppercase tracking-wider mb-3">Compression Level</h3>
          
          {/* Selected File Card */}
          <div className="flex items-center gap-3 p-3 bg-[var(--ck-bg-muted)] border border-[var(--ck-border)] rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/20 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-rose-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-[var(--ck-text-primary)] truncate">{activeFileName}</div>
              <div className="text-[9px] text-[var(--ck-text-muted)] font-bold uppercase tracking-wider mt-0.5">{getFriendlySize(activeFileSize)}</div>
            </div>
          </div>
        </div>

        {/* Settings selectors before processing */}
        {!result && !isProcessing && (
          <div className="space-y-3">
            {/* Basic Compression */}
            <label
              onClick={() => setLevel('best')}
              className={`flex items-start justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                level === 'best'
                  ? 'border-violet-600 bg-violet-50/20 dark:bg-violet-950/10'
                  : 'border-[var(--ck-border)] hover:border-[var(--ck-border-hover)] bg-transparent'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name="compress-level"
                  checked={level === 'best'}
                  onChange={() => setLevel('best')}
                  className="mt-0.5 accent-violet-600 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-[var(--ck-text-primary)]">Basic Compression</div>
                  <div className="text-[9px] text-[var(--ck-text-secondary)] font-bold mt-0.5 leading-normal">High quality, less compression</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0 pl-2">
                <div className="text-xs font-bold text-emerald-600 font-mono">~{getFriendlySize(activeFileSize * 0.75)}</div>
                <span className="text-[8px] font-bold uppercase tracking-widest text-[var(--ck-text-muted)]">Est. Size</span>
              </div>
            </label>

            {/* Strong Compression */}
            <label
              onClick={() => setLevel('balanced')}
              className={`flex items-start justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                level === 'balanced'
                  ? 'border-violet-600 ring-2 ring-violet-500/10 bg-violet-50/20 dark:bg-violet-950/10'
                  : 'border-[var(--ck-border)] hover:border-[var(--ck-border-hover)] bg-transparent'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name="compress-level"
                  checked={level === 'balanced'}
                  onChange={() => setLevel('balanced')}
                  className="mt-0.5 accent-violet-600 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-[var(--ck-text-primary)] flex items-center gap-1">
                    <span>Strong Compression</span>
                  </div>
                  <div className="text-[9px] text-[var(--ck-text-secondary)] font-bold mt-0.5 leading-normal">Good quality, good compression</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0 pl-2">
                <div className="text-xs font-bold text-emerald-600 font-mono">~{getFriendlySize(activeFileSize * 0.45)}</div>
                <span className="text-[8px] font-bold uppercase tracking-widest text-[var(--ck-text-muted)]">Est. Size</span>
              </div>
            </label>

            {/* Extreme Compression */}
            <label
              onClick={() => setLevel('smallest')}
              className={`flex items-start justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                level === 'smallest'
                  ? 'border-violet-600 bg-violet-50/20 dark:bg-violet-950/10'
                  : 'border-[var(--ck-border)] hover:border-[var(--ck-border-hover)] bg-transparent'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name="compress-level"
                  checked={level === 'smallest'}
                  onChange={() => setLevel('smallest')}
                  className="mt-0.5 accent-violet-600 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-[var(--ck-text-primary)]">Extreme Compression</div>
                  <div className="text-[9px] text-[var(--ck-text-secondary)] font-bold mt-0.5 leading-normal">Lower quality, high compression</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0 pl-2">
                <div className="text-xs font-bold text-rose-500 font-mono">~{getFriendlySize(activeFileSize * 0.20)}</div>
                <span className="text-[8px] font-bold uppercase tracking-widest text-[var(--ck-text-muted)]">Est. Size</span>
              </div>
            </label>

            {/* Custom Target Size Input */}
            <div className="pt-3 border-t border-[var(--ck-border)] space-y-1.5">
              <label className="block text-[11px] font-bold text-[var(--ck-text-primary)]">
                Or Set Custom Target Size (Optional)
              </label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  placeholder="e.g. 150"
                  value={targetSizeKB}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTargetSizeKB(val === '' ? '' : Number(val));
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--ck-border)] bg-[var(--ck-bg-card)] text-[var(--ck-text-primary)] focus:outline-none focus:ring-2 focus:ring-violet-500/30 font-mono pr-12"
                />
                <span className="absolute right-3 text-[10px] font-bold text-[var(--ck-text-muted)] uppercase">KB</span>
              </div>
              <p className="text-[9px] text-[var(--ck-text-muted)] font-medium leading-normal">
                Input target size to optimize the PDF to match your exact file size requirement.
              </p>
            </div>
          </div>
        )}

        {/* Processing loading display */}
        {isProcessing && (
          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-[var(--ck-text-primary)] flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin" />
                <span>Optimizing...</span>
              </span>
              <span className="text-violet-600 dark:text-violet-400 font-bold font-mono">{progress}%</span>
            </div>
            <div className="w-full bg-[var(--ck-bg-muted)] h-2 rounded-full overflow-hidden">
              <div
                className="bg-violet-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="w-full py-2 rounded-xl border border-rose-200 hover:bg-rose-50/40 text-rose-600 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Completed Results Status */}
        {result && !isProcessing && (
          <div className="space-y-4">
            {/* Status Card */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 text-xs font-bold flex flex-col gap-1 items-center text-center">
              <CheckCircle2 className="w-5 h-5 mb-1" />
              <span>PDF Compressed!</span>
              <span className="text-[10px] text-[var(--ck-text-muted)] font-bold uppercase tracking-wide mt-1">
                Saved {result.savedPercent !== undefined ? result.savedPercent : Math.max(0, Math.round(((activeFileSize - result.compressedSize) / activeFileSize) * 100))}% file size
              </span>
            </div>

            {/* Size Comparison */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-2xl border border-[var(--ck-border)] text-center bg-[var(--ck-bg-muted)]">
                <span className="text-[8px] font-bold uppercase tracking-widest text-[var(--ck-text-muted)] block">Original</span>
                <span className="text-xs font-black text-[var(--ck-text-primary)] mt-1 block font-mono">{getFriendlySize(result.originalSize)}</span>
              </div>
              <div className="p-3.5 rounded-2xl border border-[var(--ck-border)] text-center bg-[var(--ck-bg-muted)]">
                <span className="text-[8px] font-bold uppercase tracking-widest text-[var(--ck-text-muted)] block">Optimized</span>
                <span className="text-xs font-black text-violet-600 dark:text-violet-400 mt-1 block font-mono">{getFriendlySize(result.compressedSize)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions Trigger Block */}
      <div className="mt-6 pt-4 border-t border-[var(--ck-border)]">
        {!isProcessing && (
          <button
            type="button"
            onClick={handleCompress}
            disabled={isAnalyzing}
            className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Compress PDF</span>
          </button>
        )}
      </div>
    </div>
  );
}
