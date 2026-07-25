// ============================================================
// CompressKro — Reusable DropZone Component
// ============================================================

import { useRef } from 'react';
import { Upload, CloudUpload } from 'lucide-react';
import { useDragDrop } from '../../hooks/useDragDrop';
import type { DragDropOptions } from '../../types';

interface DropZoneProps {
  options: DragDropOptions;
  label?: string;
  sublabel?: string;
  accept?: string;
  compact?: boolean;
  previewUrl?: string;
}

export function DropZone({ options, label, sublabel, accept, compact = false, previewUrl }: DropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileInputChange,
  } = useDragDrop(options);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-xl text-center cursor-pointer transition-all duration-200 select-none
        ${compact ? 'p-4' : 'p-6'}
        ${isDragOver
          ? 'border-violet-500 bg-violet-50/60 dark:bg-violet-950/20 scale-[1.01]'
          : 'border-slate-200 dark:border-slate-700 hover:border-violet-400 dark:hover:border-violet-700 bg-white/20 dark:bg-slate-900/20'
        }
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={options.multiple}
        onChange={handleFileInputChange}
      />
      <div className={`flex flex-col items-center gap-2 ${compact ? 'gap-1.5' : 'gap-2'} w-full h-full justify-center`}>
        {isDragOver ? (
          <>
            <CloudUpload className={`text-violet-500 ${compact ? 'w-6 h-6' : 'w-8 h-8'}`} />
            <div className={`font-bold text-slate-700 dark:text-slate-300 text-xs`}>
              Drop files here
            </div>
          </>
        ) : previewUrl ? (
          <div className="relative group/preview flex flex-col items-center justify-center w-full h-full py-1">
            {/* Image Preview Container */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
              <img
                src={previewUrl}
                alt="Selected preview"
                className="w-full h-full object-cover transition-transform duration-300 group-hover/preview:scale-105"
                onError={(e) => {
                  // Fallback for files browsers can't render natively (e.g. raw HEIC)
                  (e.target as HTMLElement).style.display = 'none';
                  const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div 
                className="hidden absolute inset-0 items-center justify-center bg-slate-100 dark:bg-slate-950"
                style={{ display: 'none' }}
              >
                <Upload className="w-8 h-8 text-slate-400" />
              </div>
            </div>
            
            {/* Metadata overlay */}
            <div className="mt-2 text-center">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                {label}
              </div>
              <div className="text-[9px] text-violet-500 font-semibold mt-0.5 opacity-80 group-hover/preview:opacity-100 transition-opacity">
                Click or drag to change
              </div>
            </div>
          </div>
        ) : (
          <>
            <Upload className={`text-slate-400 ${compact ? 'w-6 h-6' : 'w-8 h-8'}`} />
            <div className={`font-bold text-slate-700 dark:text-slate-300 text-xs`}>
              {label ?? 'Select File'}
            </div>
            {sublabel && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{sublabel}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DropZone;
