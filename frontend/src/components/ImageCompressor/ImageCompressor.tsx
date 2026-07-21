// ============================================================
// CompressKro — Image Compressor (Refactored Orchestrator)
// Splits logic across sub-components and services.
// ============================================================

import { useState, useEffect } from 'react';
import { Image as ImageIcon, RefreshCw, Download, CheckCircle2, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

import type { CompressedFile } from '../../types';
import type { CompressionMode } from '../../services/compression.service';
import { compressFiles } from '../../services/compression.service';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { analyzeImage } from '../../utils/image';
import type { ImageAnalysis } from '../../types';
import { buildCompressedFilename, downloadMultipleBlobs, downloadBlob } from '../../utils/download';
import { useObjectURL } from '../../hooks/useObjectURL';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../ui/Toast';
import { DropZone } from '../ui/DropZone';
import { EmptyState } from '../ui/EmptyState';
import { CompressionControls } from './CompressionControls';
import { ComparisonSlider } from './ComparisonSlider';
import { QualityScorePanel } from './QualityScorePanel';
import { ImageAnalyzer } from './ImageAnalyzer';
import { getFriendlySize } from '../../utils/format';

interface ImageCompressorProps {
  initialFile?: File | null;
  clearInitialFile?: () => void;
  presetConfig?: { targetSizeKB?: number } | null;
  onNavigateToTab?: (tab: string, file?: File) => void;
}

export default function ImageCompressor({ initialFile, clearInitialFile, presetConfig, onNavigateToTab }: ImageCompressorProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<CompressionMode>('target');
  const [quality, setQuality] = useState(75);
  const [scalePercent, setScalePercent] = useState(80);
  const [targetSizeKB, setTargetSizeKB] = useState(50);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<CompressedFile[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [analyses, setAnalyses] = useState<Record<string, ImageAnalysis>>({});

  const { toasts, showSuccess, showError, showWarning, dismiss } = useToast();
  const { revokeAll } = useObjectURL();

  // Cleanup URLs on unmount
  useEffect(() => () => revokeAll(), []);

  // Apply preset config from Govt Assistant
  useEffect(() => {
    if (presetConfig?.targetSizeKB) {
      setTargetSizeKB(presetConfig.targetSizeKB);
      setMode('target');
    }
  }, [presetConfig]);

  // Handle file drop from Dashboard
  useEffect(() => {
    if (initialFile) {
      handleFilesSelected([initialFile]);
      clearInitialFile?.();
    }
  }, [initialFile]);

  const handleFilesSelected = async (newFiles: File[]) => {
    setFiles(newFiles);
    setResults([]);
    setProgress(0);

    // Analyze first file in background
    if (newFiles.length > 0) {
      try {
        const analysis = await analyzeImage(newFiles[0]);
        setAnalyses({ [newFiles[0].name]: analysis });
      } catch {
        // Analysis failure is non-critical
      }
    }
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setResults([]);
    setProgress(0);

    try {
      const compressed = await compressFiles(
        files,
        { mode, quality, scalePercent, targetSizeKB },
        (done, total) => setProgress(Math.round((done / total) * 100))
      );

      setResults(compressed);
      setActiveIdx(0);

      // Stats & history
      const totalSaved = compressed.reduce((acc, r) => acc + (r.originalSize - r.compressedSize), 0);
      StorageService.updateStats(compressed.length, totalSaved);
      compressed.forEach(r => HistoryService.addCompressionEntry(r));

      // Show success toast
      const avgSaved = Math.round(
        compressed.reduce((acc, r) => acc + ((r.originalSize - r.compressedSize) / r.originalSize), 0) /
          compressed.length * 100
      );
      showSuccess(
        `${compressed.length} file${compressed.length > 1 ? 's' : ''} compressed!`,
        `Average ${avgSaved}% reduction achieved.`
      );

      if (totalSaved > 0) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
      }
    } catch (error: any) {
      console.error(error);
      showError('Compression failed', error?.message ?? 'Ensure all files are valid images.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadOne = (result: CompressedFile) => {
    downloadBlob(result.compressedBlob, buildCompressedFilename(result.originalName, result.mimeType));
  };

  const handleDownloadAll = () => {
    downloadMultipleBlobs(
      results.map(r => ({
        blob: r.compressedBlob,
        filename: buildCompressedFilename(r.originalName, r.mimeType),
      }))
    );
  };

  const handleConvertRedirect = () => {
    if (!onNavigateToTab || !activeResult) return;
    const fileToConvert = new File([activeResult.compressedBlob], activeResult.originalName, {
      type: activeResult.mimeType,
    });
    onNavigateToTab('convert', fileToConvert);
  };

  const activeResult = results[activeIdx];

  // Original file object URL for comparison slider
  const [originalUrls, setOriginalUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (files.length === 0) return;
    const urls: Record<string, string> = {};
    files.forEach(f => { urls[f.name] = URL.createObjectURL(f); });
    setOriginalUrls(urls);
    return () => { Object.values(urls).forEach(u => URL.revokeObjectURL(u)); };
  }, [files]);

  return (
    <div className="space-y-8 animate-fade-in">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Image Compressor</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Optimize file sizes client-side with smart binary-search compression. Quality-first algorithm.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ── Left Control Panel ─────────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-5">
            <h3 className="text-md font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-violet-500" />
              <span>Compression Settings</span>
            </h3>

            {/* Drop Zone */}
            <DropZone
              options={{
                multiple: true,
                onFiles: handleFilesSelected,
                onError: msg => showWarning('Invalid file', msg),
              }}
              label={files.length > 0 ? `${files.length} file(s) selected` : 'Select Image(s)'}
              sublabel="JPG, PNG, WebP, AVIF, HEIC"
              accept="image/*,.heic"
            />

            {/* File list */}
            {files.length > 0 && (
              <div className="max-h-[120px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl text-xs">
                {files.map((f, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 px-3">
                    <span className="truncate font-medium text-slate-700 dark:text-slate-300 max-w-[160px]">
                      {f.name}
                    </span>
                    <span className="text-slate-400 text-[10px] ml-2 flex-shrink-0">
                      {getFriendlySize(f.size)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Compression Controls */}
            <CompressionControls
              mode={mode}
              quality={quality}
              scalePercent={scalePercent}
              targetSizeKB={targetSizeKB}
              onModeChange={setMode}
              onQualityChange={setQuality}
              onScaleChange={setScalePercent}
              onTargetChange={setTargetSizeKB}
            />

            {/* Compress Button */}
            <button
              onClick={handleProcess}
              disabled={files.length === 0 || isProcessing}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 text-white shadow-lg ${
                files.length === 0
                  ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed text-slate-500 shadow-none'
                  : isProcessing
                  ? 'bg-violet-500 cursor-wait'
                  : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-violet-600/20'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Compressing{files.length > 1 ? ` (${progress}%)` : '...'}</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4" />
                  <span>Compress Now</span>
                </>
              )}
            </button>
          </div>

          {/* Image Analyzer */}
          {files.length > 0 && analyses[files[0].name] && (
            <ImageAnalyzer analysis={analyses[files[0].name]} />
          )}
        </div>

        {/* ── Right Output Panel ─────────────────────────────────────── */}
        <div className="lg:col-span-8">
          {results.length > 0 ? (
            <div className="space-y-5">
              {/* Batch file tabs */}
              {results.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {results.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveIdx(i)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex-shrink-0 border transition-all ${
                        activeIdx === i
                          ? 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
                      }`}
                    >
                      {r.originalName.slice(0, 12)}…
                    </button>
                  ))}
                </div>
              )}

              {activeResult && (
                <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
                  {/* Result header */}
                  <div className="flex justify-between items-center">
                    <h3 className="text-md font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>Optimization Report</span>
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDownloadOne(activeResult)}
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                      {results.length > 1 && (
                        <button
                          onClick={handleDownloadAll}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          All ({results.length})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Before/After Comparison Slider */}
                  {originalUrls[activeResult.originalName] && (
                    <ComparisonSlider
                      beforeUrl={originalUrls[activeResult.originalName]}
                      afterUrl={activeResult.compressedUrl}
                      beforeLabel={`Before · ${getFriendlySize(activeResult.originalSize)}`}
                      afterLabel={`After · ${getFriendlySize(activeResult.compressedSize)}`}
                    />
                  )}

                  {/* Quality Score + Metrics */}
                  <QualityScorePanel result={activeResult} />

                  {/* Optional Better Format Recommendation */}
                  {(() => {
                    const rec = analyses[activeResult.originalName];
                    if (!rec) return null;
                    const recFmt = rec.recommendedFormat;
                    const currentFmt = activeResult.mimeType === 'image/jpeg' ? 'JPEG' : 
                                       activeResult.mimeType === 'image/png' ? 'PNG' : 
                                       activeResult.mimeType === 'image/webp' ? 'WEBP' : 
                                       activeResult.mimeType === 'image/avif' ? 'AVIF' : 'HEIC';
                    if (recFmt === currentFmt) return null;

                    // Compute dynamic savings based on empirical next-gen codecs difference
                    let multiplier = 0.5;
                    let label = 'next-gen high-efficiency browsers';
                    if (recFmt === 'AVIF') {
                      multiplier = 0.45; // ~55% savings over JPEG/PNG
                      label = 'maximum next-gen efficiency';
                    } else if (recFmt === 'WEBP') {
                      multiplier = 0.70; // ~30% savings over JPEG/PNG
                      label = 'websites & wide compatibility';
                    } else if (recFmt === 'JPEG') {
                      multiplier = 0.50; // ~50% savings over transparentless PNG
                      label = 'maximum compatibility & photos';
                    }

                    const estSize = Math.round(activeResult.compressedSize * multiplier);
                    const pctSaved = Math.round((1 - multiplier) * 100);

                    return (
                      <div className="p-4 rounded-xl border border-violet-100 dark:border-violet-900 bg-violet-50/30 dark:bg-violet-950/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in mt-4">
                        <div className="space-y-0.5 text-left">
                          <div className="font-bold text-violet-850 dark:text-violet-300 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-violet-500 animate-pulse" />
                            <span>Better Compression Available</span>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                            Recommended Format: <strong className="text-violet-700 dark:text-violet-400">{recFmt}</strong>.
                            Converting could save an additional <strong className="text-violet-700 dark:text-violet-400">{pctSaved}%</strong> of space, reducing size to ~<strong>{getFriendlySize(estSize)}</strong> (Best for {label}).
                          </p>
                        </div>
                        <button
                          onClick={handleConvertRedirect}
                          className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold text-[10px] tracking-wide uppercase transition-colors shrink-0"
                        >
                          Convert
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title="No output yet"
              description="Add images, configure compression settings, and click Compress Now to see results with before/after comparison."
            />
          )}
        </div>
      </div>
    </div>
  );
}
