import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Download, 
  FileText, 
  Sparkles, 
  RotateCw, 
  Scissors, 
  Hash, 
  PenTool, 
  Droplets,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Undo2
} from 'lucide-react';
import { usePdfWorkspace } from '../../context/PdfWorkspaceContext';
import { getFriendlySize } from '../../utils/format';
import { downloadBlob } from '../../utils/download';

interface PdfTaskCompletedProps {
  fileName: string;
  fileSize: number;
  originalSize?: number;
  outputBlob: Blob;
  onReset: () => void;
  onContinueEditing?: () => void;
}

export const PdfTaskCompleted: React.FC<PdfTaskCompletedProps> = ({
  fileName,
  fileSize,
  originalSize,
  outputBlob,
  onReset,
  onContinueEditing
}) => {
  const navigate = useNavigate();
  const { chainOutput, resetWorkspace } = usePdfWorkspace();

  const handleDownload = () => {
    downloadBlob(outputBlob, fileName);
  };

  const handleContinue = (targetPath: string) => {
    // Chain the current output blob to become the new active file
    chainOutput(outputBlob, fileName);
    // Navigate to the target tool
    navigate(targetPath);
  };

  const handleStartOver = () => {
    resetWorkspace();
    onReset();
  };

  // Calculate savings percentage if applicable
  const hasSavings = originalSize && originalSize > fileSize;
  const savingsPercent = hasSavings 
    ? Math.max(0, Math.round(((originalSize - fileSize) / originalSize) * 100))
    : 0;

  const nextOptions = [
    { name: 'Edit PDF', path: '/edit-pdf', icon: PenTool, color: 'text-pink-500' },
    { name: 'Compress PDF', path: '/compress-pdf', icon: Sparkles, color: 'text-violet-500' },
    { name: 'Sign PDF', path: '/sign-pdf', icon: PenTool, color: 'text-emerald-500' },
    { name: 'Add Watermark', path: '/add-watermark', icon: Droplets, color: 'text-blue-500' },
    { name: 'Rotate & Organize', path: '/rotate-pdf', icon: RotateCw, color: 'text-purple-500' },
    { name: 'Split PDF', path: '/split-pdf', icon: Scissors, color: 'text-orange-500' },
    { name: 'Page Numbers', path: '/page-numbers', icon: Hash, color: 'text-indigo-500' },
  ];

  return (
    <div className="space-y-5 animate-fade-in py-2">
      {/* Success Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 mb-2">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-[var(--ck-text-primary)]">Task Completed!</h3>
        <p className="text-[11px] text-[var(--ck-text-muted)] truncate max-w-full px-2" title={fileName}>
          {fileName}
        </p>
      </div>

      {/* Size Comparison Card */}
      {hasSavings ? (
        <div className="p-3 bg-[var(--ck-bg-muted)] border border-[var(--ck-border)] rounded-2xl space-y-2">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-[var(--ck-text-muted)]">
            <span>Size Savings</span>
            <span className="text-emerald-600">Saved {savingsPercent}%</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center pt-1">
            <div className="p-2 bg-[var(--ck-bg-card)] border border-[var(--ck-border)] rounded-xl">
              <span className="text-[8px] text-[var(--ck-text-muted)] uppercase block">Original</span>
              <span className="text-xs font-bold text-[var(--ck-text-primary)] font-mono block mt-0.5">
                {getFriendlySize(originalSize)}
              </span>
            </div>
            <div className="p-2 bg-[var(--ck-bg-card)] border border-[var(--ck-border)] rounded-xl">
              <span className="text-[8px] text-[var(--ck-text-muted)] uppercase block">Optimized</span>
              <span className="text-xs font-bold text-violet-600 dark:text-violet-400 font-mono block mt-0.5">
                {getFriendlySize(fileSize)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-[var(--ck-bg-muted)] border border-[var(--ck-border)] rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950/20 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-violet-600" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold text-[var(--ck-text-primary)] block truncate">Output Size</span>
            <span className="text-[10px] text-[var(--ck-text-muted)] font-mono block mt-0.5">
              {getFriendlySize(fileSize)}
            </span>
          </div>
        </div>
      )}

      {/* Main Download Button */}
      <button
        type="button"
        onClick={handleDownload}
        className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <Download className="w-4 h-4" />
        <span>Download PDF</span>
      </button>

      {onContinueEditing && (
        <button
          type="button"
          onClick={onContinueEditing}
          className="w-full py-2.5 rounded-xl border border-violet-500/20 hover:border-violet-500 bg-violet-500/5 hover:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span>Continue editing this PDF</span>
        </button>
      )}

      {/* Continue Section (Sejda style) */}
      <div className="space-y-2.5 pt-2 border-t border-[var(--ck-border)]">
        <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--ck-text-muted)]">
          Continue with this document
        </h4>
        <div className="grid grid-cols-1 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
          {nextOptions.map((opt) => (
            <button
              key={opt.path}
              type="button"
              onClick={() => handleContinue(opt.path)}
              className="w-full p-2.5 rounded-xl border border-[var(--ck-border)] hover:border-violet-500/50 bg-[var(--ck-bg-card)] hover:bg-[var(--ck-bg-muted)] transition-all flex items-center justify-between text-left text-xs font-bold text-[var(--ck-text-secondary)] hover:text-violet-600 cursor-pointer group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <opt.icon className={`w-3.5 h-3.5 flex-shrink-0 ${opt.color}`} />
                <span className="truncate">{opt.name}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-violet-500 transition-all transform translate-x-[-4px] group-hover:translate-x-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Reset/Start Over Buttons */}
      <div className="pt-2 border-t border-[var(--ck-border)] flex gap-2">
        <button
          type="button"
          onClick={handleStartOver}
          className="flex-1 py-2 rounded-xl border border-[var(--ck-border)] hover:bg-[var(--ck-bg-muted)] text-[var(--ck-text-secondary)] text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Start Over</span>
        </button>
      </div>
    </div>
  );
};
