// ============================================================
// CompressKro — CompressionControls Component
// Settings panel containing preset profiles and custom target size settings.
// ============================================================

import { Sliders, HardDrive } from 'lucide-react';
import type { PDFCompressionLevel } from '../../types';
import { PDF_COMPRESSION_CONFIGS } from '../../constants';

interface CompressionControlsProps {
  level: PDFCompressionLevel;
  onLevelChange: (level: PDFCompressionLevel) => void;
  targetSizeKB: number | '';
  onTargetSizeChange: (size: number | '') => void;
}

export function CompressionControls({
  level,
  onLevelChange,
  targetSizeKB,
  onTargetSizeChange
}: CompressionControlsProps) {
  return (
    <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm space-y-4">
      <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
        <Sliders className="w-4 h-4 text-violet-500" />
        <h3 className="font-bold text-sm tracking-wide">Compression Settings</h3>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-450 dark:text-slate-500 block">
          Compression Profile
        </label>
        
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(PDF_COMPRESSION_CONFIGS) as PDFCompressionLevel[]).map((lvl) => {
            const conf = PDF_COMPRESSION_CONFIGS[lvl];
            const active = level === lvl;
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => onLevelChange(lvl)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 group cursor-pointer ${
                  active
                    ? 'border-violet-500 bg-violet-500/10 dark:bg-violet-950/20 text-violet-600 dark:text-violet-300 shadow-sm font-bold scale-[1.02]'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-350 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                <span className="text-xs font-bold">{conf.label}</span>
                <span className="text-[9px] mt-1 text-slate-400 dark:text-slate-500 leading-tight block group-hover:text-slate-500 dark:group-hover:text-slate-450">
                  {lvl === 'best' ? '90% scale' : lvl === 'balanced' ? '75% scale' : '50% scale'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold text-slate-455 dark:text-slate-500 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5" />
            <span>Target Size (Optional)</span>
          </label>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">in KB</span>
        </div>
        <div className="relative">
          <input
            type="number"
            min={1}
            value={targetSizeKB}
            onChange={(e) => {
              const val = e.target.value === '' ? '' : parseInt(e.target.value);
              onTargetSizeChange(val);
            }}
            placeholder="e.g. 500"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
          />
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
          The engine will dynamically adjust quality and resize factors to match this limit. Leave empty for profile defaults.
        </p>
      </div>
    </div>
  );
}

export default CompressionControls;
