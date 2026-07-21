// ============================================================
// CompressKro — Quality Score Panel
// Displays compression result metrics with visual quality score
// ============================================================

import type { CompressedFile } from '../../types';
import { getFriendlySize, getSavedPercent, getCompressionRatio, getQualityColor, getQualityLabel } from '../../utils/format';

interface QualityScorePanelProps {
  result: CompressedFile;
}

export function QualityScorePanel({ result }: QualityScorePanelProps) {
  const savedPct = getSavedPercent(result.originalSize, result.compressedSize);
  const ratio = getCompressionRatio(result.originalSize, result.compressedSize);
  const scoreColor = getQualityColor(result.qualityScore);
  const scoreLabel = getQualityLabel(result.qualityScore);
  const dimensionsChanged =
    result.dimensions.width !== result.originalDimensions.width ||
    result.dimensions.height !== result.originalDimensions.height;

  // Score ring calculation
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - result.qualityScore / 100);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
      {/* Visual Quality Score */}
      <div className="flex flex-col items-center md:items-start gap-2">
        <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Quality Score</div>
        <div className="flex items-center gap-2.5">
          {/* SVG Ring */}
          <svg width="52" height="52" viewBox="0 0 52 52" className="transform -rotate-90">
            <circle cx="26" cy="26" r={radius} fill="none" stroke="currentColor"
              className="text-slate-200 dark:text-slate-800" strokeWidth="4" />
            <circle
              cx="26" cy="26" r={radius} fill="none"
              stroke="currentColor"
              className={scoreColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
            <text
              x="26" y="26"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="12"
              fontWeight="700"
              className="fill-current"
              style={{ transform: 'rotate(90deg)', transformOrigin: '26px 26px' }}
            >
              {result.qualityScore}
            </text>
          </svg>
          <div>
            <div className={`text-sm font-extrabold ${scoreColor}`}>{scoreLabel}</div>
            <div className="text-[10px] text-slate-400">{result.qualityScore}/100</div>
          </div>
        </div>
      </div>

      {/* Savings */}
      <div className="text-center md:text-left">
        <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Space Saved</div>
        <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
          {savedPct}%
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">
          {getFriendlySize(result.originalSize)} → {getFriendlySize(result.compressedSize)}
        </div>
      </div>

      {/* Compression Ratio */}
      <div className="text-center md:text-left">
        <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Ratio</div>
        <div className="text-2xl font-extrabold text-violet-600 dark:text-violet-400 mt-1">{ratio}</div>
        <div className="text-[10px] text-slate-400 mt-0.5">compression ratio</div>
      </div>

      {/* Dimensions */}
      <div className="text-center md:text-left">
        <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Output Dims</div>
        <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">
          {result.dimensions.width} × {result.dimensions.height}
        </div>
        {dimensionsChanged && (
          <div className="text-[10px] text-amber-500 mt-0.5 flex items-center gap-0.5">
            <span>↓ scaled from {result.originalDimensions.width}×{result.originalDimensions.height}</span>
          </div>
        )}
        <div className="text-[10px] text-slate-400 mt-0.5">
          Q: {result.qualityUsed}% {result.psnr ? `· PSNR: ${result.psnr} dB` : ''}
        </div>
      </div>
    </div>
  );
}

export default QualityScorePanel;
