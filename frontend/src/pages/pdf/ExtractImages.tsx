// ============================================================
// CompressKro — Extract PDF Images Page Component
// ============================================================

import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { FileImage, RefreshCw } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { BACKEND_API_URL } from '../../constants';
import { CompiledOutputView } from '../../components/CompiledOutputView';
import { usePdfWorkspace } from '../../context/PdfWorkspaceContext';
import { HowToUse } from '../../components/ui/HowToUse';

export function ExtractImages() {
  const [pdfFile, setPdfFile] = useState<{ name: string; size: number; blob: File } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');

  const { showSuccess, showError } = useToast();
  const { activeFile, activeFileName, activeFileSize, clearActiveFile } = usePdfWorkspace();
 
  // Auto-load file from workspace context
  useEffect(() => {
    if (activeFile) {
      const f = activeFile instanceof File
        ? activeFile
        : new File([activeFile], activeFileName || 'document.pdf', { type: 'application/pdf' });
      setPdfFile({
        name: f.name,
        size: f.size,
        blob: f
      });
      clearOutputs();
    } else {
      setPdfFile(null);
    }
  }, [activeFile, activeFileName, activeFileSize]);

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const executeExtract = async () => {
    if (!pdfFile) return;
    setIsProcessing(true);
    setProgressMsg('Extracting embedded images...');

    try {
      const formData = new FormData();
      formData.append('file', pdfFile.blob, pdfFile.name);
      
      const res = await fetch(`${BACKEND_API_URL}/extract-images`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Extraction failed. Make sure the PDF contains actual embedded images.');
      }

      const blob = await res.blob();
      const outName = pdfFile.name.replace(/\.pdf$/i, '') + '_extracted_images.zip';
      
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(outName);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Extract Images', outName, blob.size);

      showSuccess('Images extracted!', `${outName} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err: any) {
      console.error(err);
      showError('Extraction failed', err.message || 'Could not extract images from PDF.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  if (!activeFile) {
    return (
      <HowToUse
        title="Extract Images"
        icon={FileImage}
        steps={[
          'Upload your PDF document containing embedded photos/images in the center canvas.',
          'Click "Extract All Images" in the options panel on the right.',
          'Download the generated ZIP archive containing all extracted inline images.'
        ]}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {outputUrl ? (
        <CompiledOutputView
          outputUrl={outputUrl}
          outputSize={outputSize}
          outputName={outputName}
          onClear={() => {
            clearOutputs();
            clearActiveFile();
          }}
        />
      ) : (
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <FileImage className="w-4 h-4 text-yellow-600" />
            <span>Extract Inline PDF Images</span>
          </h3>

          <div className="space-y-3 p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-xl text-center">
            <div className="text-xs font-bold text-[var(--ck-text-primary)] truncate">
              {pdfFile?.name}
            </div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
              {pdfFile ? getFriendlySize(pdfFile.size) : ''}
            </div>
          </div>

          <button
            onClick={executeExtract}
            disabled={!pdfFile || isProcessing}
            className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-yellow-600 to-amber-650 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileImage className="w-4 h-4" />}
            <span>{isProcessing ? progressMsg : 'Extract All Images'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
