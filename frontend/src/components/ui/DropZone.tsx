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
}

export function DropZone({ options, label, sublabel, accept, compact = false }: DropZoneProps) {
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
      <div className={`flex flex-col items-center gap-2 ${compact ? 'gap-1.5' : 'gap-2'}`}>
        {isDragOver ? (
          <CloudUpload className={`text-violet-500 ${compact ? 'w-6 h-6' : 'w-8 h-8'}`} />
        ) : (
          <Upload className={`text-slate-400 ${compact ? 'w-6 h-6' : 'w-8 h-8'}`} />
        )}
        <div className={`font-bold text-slate-700 dark:text-slate-300 ${compact ? 'text-xs' : 'text-xs'}`}>
          {isDragOver ? 'Drop files here' : label ?? 'Select File'}
        </div>
        {sublabel && !isDragOver && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{sublabel}</span>
        )}
      </div>
    </div>
  );
}

export default DropZone;
