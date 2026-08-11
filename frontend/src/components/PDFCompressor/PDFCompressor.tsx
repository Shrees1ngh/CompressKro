// ============================================================
// CompressKro — PDFCompressor Orchestrator Component
// Unified user experience coordinating upload, live metadata analysis,
// preview embed, quality select, and compression reporting.
// ============================================================

import { useState, useRef } from 'react';
import { Upload, FileText, X, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { useObjectURL } from '../../hooks/useObjectURL';
import { analyzePdf, validatePdf } from '../../utils/pdf';
import { compressPdf, cancelCompression } from '../../services/pdf.service';
import type { PDFAnalysis, PDFCompressedResult, PDFCompressionLevel } from '../../types';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { loadPdfJs } from '../../utils/pdfLoader';
import { getFriendlySize } from '../../utils/format';

import PDFPreview from './PDFPreview';
import PDFAnalyzer from './PDFAnalyzer';
import CompressionControls from './CompressionControls';
import CompressionReport from './CompressionReport';
import DownloadCard from './DownloadCard';
import { downloadBlob } from '../../utils/download';
import DropZone from '../ui/DropZone';

export default function PDFCompressor() {
  const { showSuccess, showError, showInfo } = useToast();
  const { revokeAll } = useObjectURL();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Flow State
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<PDFAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>('');

  // Compression Parameters
  const [level, setLevel] = useState<PDFCompressionLevel>('balanced');
  const [targetSizeKB, setTargetSizeKB] = useState<number | ''>('');

  // Processing Output State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<PDFCompressedResult | null>(null);

  // Drag and Drop triggers
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const resetAll = () => {
    setFile(null);
    setAnalysis(null);
    setResult(null);
    setProgress(0);
    setIsProcessing(false);
    setIsAnalyzing(false);
    setTargetSizeKB('');
    setLevel('balanced');
    setPdfPreviewUrl('');
    revokeAll();
  };

  const processUploadedFile = async (uploadedFile: File) => {
    const val = validatePdf(uploadedFile);
    if (!val.valid) {
      showError(val.error || 'Invalid PDF file.');
      return;
    }

    resetAll();
    setFile(uploadedFile);
    setIsAnalyzing(true);

    try {
      const info = await analyzePdf(uploadedFile);
      setAnalysis(info);
      showSuccess(`PDF uploaded and analyzed: ${info.pageCount} page(s)`);

      // Generate first page thumbnail preview
      try {
        const pdfjsLib = await loadPdfJs();
        const fileUrl = URL.createObjectURL(uploadedFile);
        const doc = await pdfjsLib.getDocument(fileUrl).promise;
        const page = await doc.getPage(1);
        
        const canvas = document.createElement('canvas');
        const viewport = page.getViewport({ scale: 0.35 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          const dataUrl = canvas.toDataURL('image/png');
          setPdfPreviewUrl(dataUrl);
        }
        await doc.destroy();
        URL.revokeObjectURL(fileUrl);
      } catch (previewErr) {
        console.warn('Failed to generate PDF thumbnail preview:', previewErr);
      }
    } catch {
      showError('Failed to analyze PDF file structure locally.');
      setFile(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processUploadedFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCompress = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgress(10);

    try {
      const outcome = await compressPdf(
        file,
        {
          level,
          targetSizeKB: targetSizeKB === '' ? undefined : targetSizeKB,
        },
        (p) => setProgress(p)
      );

      setResult(outcome);

      // Update global stats and local operation history
      const savedBytes = file.size - outcome.compressedSize;
      StorageService.updateStats(1, savedBytes);
      HistoryService.addPdfEntry('Compressed', file.name, outcome.compressedSize);

      const computedSavedPct = outcome.savedPercent !== undefined 
        ? outcome.savedPercent 
        : Math.max(0, Math.round((savedBytes / file.size) * 100));

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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <FileText className="w-6 h-6 text-violet-600" />
          <span>PDF Compressor</span>
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Optimize PDF file size with high visual quality retention, image re-compression, and vector layer preservation.
        </p>
      </div>

      {/* Uploader / Upload Dashboard */}
      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerUploadClick}
          className={`w-full min-h-[300px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-8 text-center cursor-pointer transition-all duration-300 ${
            isDragOver
              ? 'border-violet-500 bg-violet-500/5 scale-[0.99]'
              : 'border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 hover:border-slate-350 dark:hover:border-slate-700 hover:bg-white/60 dark:hover:bg-slate-900/60'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="application/pdf"
            className="hidden"
          />
          <div className="p-4 rounded-full bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 mb-4 animate-bounce-slow">
            <Upload className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
            Drag & Drop PDF here
          </h3>
          <p className="text-xs text-slate-450 dark:text-slate-500 mt-1.5 max-w-[280px] leading-relaxed">
            or click to browse your files. Supports files up to 20 MB.
          </p>
        </div>
      ) : !result ? (
        /* Single-column settings view before compression */
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Drop Zone Preview */}
          <DropZone
            options={{
              multiple: false,
              onFiles: (files) => {
                if (files.length > 0) processUploadedFile(files[0]);
              },
              onError: (msg) => showError(msg),
            }}
            label="1 PDF file selected"
            sublabel={`${file.name} • ${getFriendlySize(file.size)}`}
            accept="application/pdf"
            previewUrl={pdfPreviewUrl || undefined}
          />
          
          {/* Analyzer */}
          {isAnalyzing ? (
            <div className="p-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 rounded-2xl flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 text-violet-600 animate-spin" />
              <span className="text-xs text-slate-500">Parsing PDF layers...</span>
            </div>
          ) : (
            <PDFAnalyzer analysis={analysis} />
          )}

          {/* Controls Settings */}
          {!isProcessing && (
            <>
              <CompressionControls
                level={level}
                onLevelChange={setLevel}
                targetSizeKB={targetSizeKB}
                onTargetSizeChange={setTargetSizeKB}
              />
              
              <button
                type="button"
                onClick={handleCompress}
                disabled={isAnalyzing}
                className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 active:scale-[0.99] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-violet-200" />
                <span>Compress PDF</span>
              </button>
            </>
          )}

          {/* Processing Overlay */}
          {isProcessing && (
            <div className="p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 rounded-2xl space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin" />
                  <span>Compressing PDF...</span>
                </span>
                <span className="text-violet-600 dark:text-violet-400 font-bold">{progress}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-violet-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="w-full py-2.5 rounded-xl border border-rose-200 hover:bg-rose-50/40 text-rose-600 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel Compression</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Split layout display after compression */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
          {/* Reports and download actions (Left Column) */}
          <div className="lg:col-span-5 space-y-6">
            <CompressionReport result={result} />
            <DownloadCard result={result} onDownload={handleDownload} onReset={resetAll} />
          </div>

          {/* Big scrollable page-by-page document preview (Right Column) */}
          <div className="lg:col-span-7">
            <PDFPreview file={result.compressedBlob} />
          </div>
        </div>
      )}
    </div>
  );
}
