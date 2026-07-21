// ============================================================
// CompressKro — PDFAnalyzer Component
// Technical file reports including total pages, images, and optimizer notes.
// ============================================================

import { FileText, Sparkles } from 'lucide-react';
import type { PDFAnalysis } from '../../types';
import { formatPdfSize } from '../../utils/pdf';

interface PDFAnalyzerProps {
  analysis: PDFAnalysis | null;
}

export function PDFAnalyzer({ analysis }: PDFAnalyzerProps) {
  if (!analysis) return null;

  return (
    <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm space-y-4">
      <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
        <FileText className="w-4 h-4 text-violet-500" />
        <h3 className="font-bold text-sm tracking-wide">Document Analysis</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60">
          <span className="text-slate-450 dark:text-slate-500 block mb-0.5 font-medium">File Name</span>
          <span className="font-bold text-slate-750 dark:text-slate-350 truncate block" title={analysis.name}>
            {analysis.name}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60">
          <span className="text-slate-450 dark:text-slate-500 block mb-0.5 font-medium">Original Size</span>
          <span className="font-bold text-slate-750 dark:text-slate-350">
            {formatPdfSize(analysis.fileSize)}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60">
          <span className="text-slate-455 dark:text-slate-500 block mb-0.5 font-medium">Total Pages</span>
          <span className="font-bold text-slate-750 dark:text-slate-350">
            {analysis.pageCount} page{analysis.pageCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60">
          <span className="text-slate-450 dark:text-slate-500 block mb-0.5 font-medium">Contains Images</span>
          <span className="font-bold text-slate-750 dark:text-slate-350">
            {analysis.hasImages ? 'Yes' : 'No (Text/Vectors only)'}
          </span>
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-violet-50/30 dark:bg-violet-950/10 border border-violet-100/50 dark:border-violet-900/40 text-xs flex gap-2.5 items-start">
        <Sparkles className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
        <div className="space-y-1 text-slate-650 dark:text-slate-400 leading-relaxed text-[11px]">
          <span className="font-bold text-violet-850 dark:text-violet-300 block">Optimizer Notes</span>
          {analysis.hasImages ? (
            <span>
              This PDF includes embedded raster images. We will downsample and re-compress them using sharp Lanczos3 filters to achieve maximal savings.
            </span>
          ) : (
            <span>
              No images detected. We will optimize internal font registries and stream containers to achieve clean stream level compression.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default PDFAnalyzer;
