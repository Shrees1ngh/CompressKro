// ============================================================
// CompressKro — Image Analyzer Panel
// Shows analysis of the uploaded image before compression
// ============================================================

import type { ImageAnalysis } from '../../types';
import { getFriendlySize } from '../../utils/format';
import { Info, Eye } from 'lucide-react';

interface ImageAnalyzerProps {
  analysis: ImageAnalysis;
}

const POTENTIAL_COLORS = {
  high: 'text-emerald-600 dark:text-emerald-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-slate-500 dark:text-slate-400',
};

const POTENTIAL_BG = {
  high: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30',
  medium: 'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30',
  low: 'bg-slate-50 dark:bg-slate-900/20 border-slate-100 dark:border-slate-800',
};

export function ImageAnalyzer({ analysis }: ImageAnalyzerProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/30 dark:bg-slate-900/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
        <Eye className="w-4 h-4 text-violet-500" />
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Image Analysis</span>
      </div>

      {/* Metrics grid */}
      <div className="p-3 grid grid-cols-2 gap-2.5">
        {/* Resolution */}
        <div className="space-y-0.5">
          <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Resolution</div>
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {analysis.width} × {analysis.height} px
          </div>
        </div>

        {/* Aspect Ratio */}
        <div className="space-y-0.5">
          <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Aspect Ratio</div>
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{analysis.aspectRatio}</div>
        </div>

        {/* File Size */}
        <div className="space-y-0.5">
          <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Current Size</div>
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {getFriendlySize(analysis.fileSize)}
          </div>
        </div>

        {/* Transparency */}
        <div className="space-y-0.5">
          <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Transparency</div>
          <div className={`text-xs font-bold ${analysis.hasTransparency ? 'text-violet-600 dark:text-violet-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {analysis.hasTransparency ? 'Yes (Alpha)' : 'None'}
          </div>
        </div>

        {/* Recommended format */}
        <div className="space-y-0.5">
          <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Rec. Format</div>
          <div className="text-xs font-bold text-violet-600 dark:text-violet-400">
            {analysis.recommendedFormat}
          </div>
        </div>

        {/* Compression potential */}
        <div className="space-y-0.5">
          <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Est. Savings</div>
          <div className={`text-xs font-bold ${POTENTIAL_COLORS[analysis.compressionPotential]}`}>
            ~{analysis.compressionPotentialPct}% ({analysis.compressionPotential})
          </div>
        </div>
      </div>

      {/* Recommendation banner */}
      <div className={`mx-3 mb-3 px-3 py-2.5 rounded-lg border text-[11px] leading-relaxed ${POTENTIAL_BG[analysis.compressionPotential]} flex items-start gap-2`}>
        <Info className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${POTENTIAL_COLORS[analysis.compressionPotential]}`} />
        <span className="text-slate-600 dark:text-slate-400">{analysis.recommendation}</span>
      </div>
    </div>
  );
}

export default ImageAnalyzer;
