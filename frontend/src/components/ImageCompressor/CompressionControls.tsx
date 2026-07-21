// ============================================================
// CompressKro — Compression Controls Panel
// ============================================================

import { AlertCircle } from 'lucide-react';
import type { CompressionMode } from '../../services/compression.service';

interface CompressionControlsProps {
  mode: CompressionMode;
  quality: number;
  scalePercent: number;
  targetSizeKB: number;
  onModeChange: (mode: CompressionMode) => void;
  onQualityChange: (v: number) => void;
  onScaleChange: (v: number) => void;
  onTargetChange: (v: number) => void;
}

const MODE_BUTTONS: { id: CompressionMode; label: string }[] = [
  { id: 'target', label: 'Target KB' },
  { id: 'quality', label: 'Quality' },
  { id: 'percentage', label: 'Scale %' },
];

export function CompressionControls({
  mode,
  quality,
  scalePercent,
  targetSizeKB,
  onModeChange,
  onQualityChange,
  onScaleChange,
  onTargetChange,
}: CompressionControlsProps) {
  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-0.5 gap-0.5">
        {MODE_BUTTONS.map(btn => (
          <button
            key={btn.id}
            onClick={() => onModeChange(btn.id)}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
              mode === btn.id
                ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Target Size */}
      {mode === 'target' && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex justify-between">
            <span>Target File Size</span>
            <span className="text-violet-600 font-bold dark:text-violet-400">{targetSizeKB} KB</span>
          </label>
          <input
            type="number"
            value={targetSizeKB}
            min={1}
            onChange={e => onTargetChange(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            placeholder="Enter KB"
          />
          <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed flex gap-1 items-start">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-amber-500 mt-0.5" />
            <span>20-step binary search with gradual dimension reduction. Preserves quality first.</span>
          </div>
        </div>
      )}

      {/* Quality Slider */}
      {mode === 'quality' && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Visual Quality</span>
            <span className="text-violet-600 font-bold dark:text-violet-400">{quality}%</span>
          </div>
          <input
            type="range"
            min={5}
            max={100}
            value={quality}
            onChange={e => onQualityChange(parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
          />
          <div className="flex justify-between text-[9px] text-slate-400">
            <span>Smaller</span>
            <span>Sharper</span>
          </div>
        </div>
      )}

      {/* Scale Percentage */}
      {mode === 'percentage' && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Downscale Resolution</span>
            <span className="text-violet-600 font-bold dark:text-violet-400">{scalePercent}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            value={scalePercent}
            onChange={e => onScaleChange(parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
          />
          <div className="flex justify-between text-[9px] text-slate-400">
            <span>10%</span>
            <span>100% (original)</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompressionControls;
