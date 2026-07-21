// ============================================================
// CompressKro — CompressionReport Component
// Visual layout showing PDF before and after optimization results.
// ============================================================

import { CheckCircle2, Clock, Image, Layers, Sparkles } from 'lucide-react';
import type { PDFCompressedResult } from '../../types';
import { formatPdfSize } from '../../utils/pdf';

interface CompressionReportProps {
  result: PDFCompressedResult | null;
}

export function CompressionReport({ result }: CompressionReportProps) {
  if (!result) return null;

  const savedSize = result.originalSize - result.compressedSize;
  const savedPercent = result.savedPercent !== undefined 
    ? result.savedPercent 
    : Math.max(0, Math.round((savedSize / result.originalSize) * 100));

  return (
    <div className="p-5 rounded-2xl border border-emerald-100 dark:border-emerald-950 bg-emerald-50/15 dark:bg-emerald-950/5 shadow-sm space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        <h3 className="font-bold text-sm tracking-wide">Compression Successful</h3>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900/65 border border-slate-100 dark:border-slate-800/40">
          <span className="text-slate-400 dark:text-slate-500 block text-[10px] mb-0.5 font-medium">Original Size</span>
          <span className="font-bold text-slate-700 dark:text-slate-350 text-xs">
            {formatPdfSize(result.originalSize)}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900/65 border border-slate-100 dark:border-slate-800/40">
          <span className="text-slate-400 dark:text-slate-500 block text-[10px] mb-0.5 font-medium">Optimized Size</span>
          <span className="font-bold text-emerald-650 dark:text-emerald-450 text-xs">
            {formatPdfSize(result.compressedSize)}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900/65 border border-slate-100 dark:border-slate-800/40">
          <span className="text-slate-400 dark:text-slate-500 block text-[10px] mb-0.5 font-medium">Bytes Saved</span>
          <span className="font-bold text-violet-650 dark:text-violet-400 text-xs">
            {savedPercent}% ({formatPdfSize(Math.max(0, savedSize))})
          </span>
        </div>
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800/60 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Layers className="w-3.5 h-3.5 text-slate-450" />
          <span>Pages: <strong>{result.pageCount}</strong></span>
        </div>
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Image className="w-3.5 h-3.5 text-slate-450" />
          <span>Images: <strong>{result.imagesOptimized ?? 0}</strong></span>
        </div>
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Sparkles className="w-3.5 h-3.5 text-slate-450" />
          <span>Fonts: <strong>{result.fontsPreserved ?? 0}</strong></span>
        </div>
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Clock className="w-3.5 h-3.5 text-slate-450" />
          <span>Time: <strong>{((result.compressionTimeMs || 0) / 1000).toFixed(2)}s</strong></span>
        </div>
      </div>
    </div>
  );
}

export default CompressionReport;
