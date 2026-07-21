// ============================================================
// CompressKro — DownloadCard Component
// PDF download ready action state card.
// ============================================================

import { Download, RefreshCw } from 'lucide-react';
import type { PDFCompressedResult } from '../../types';
import { formatPdfSize } from '../../utils/pdf';

interface DownloadCardProps {
  result: PDFCompressedResult | null;
  onDownload: () => void;
  onReset: () => void;
}

export function DownloadCard({ result, onDownload, onReset }: DownloadCardProps) {
  if (!result) return null;

  return (
    <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="text-left w-full sm:w-auto">
        <span className="text-[10px] text-slate-400 dark:text-slate-500 block mb-0.5 font-bold">COMPRESSED FILE READY</span>
        <h4 className="font-bold text-slate-750 dark:text-slate-200 text-xs truncate max-w-[250px]" title={result.originalName}>
          {result.originalName}
        </h4>
        <span className="text-[10px] text-emerald-600 dark:text-emerald-450 font-bold block mt-0.5">
          Ready for download ({formatPdfSize(result.compressedSize)})
        </span>
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 hover:border-slate-300 text-slate-600 dark:text-slate-350 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>

        <button
          type="button"
          onClick={onDownload}
          className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-95 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download PDF</span>
        </button>
      </div>
    </div>
  );
}

export default DownloadCard;
