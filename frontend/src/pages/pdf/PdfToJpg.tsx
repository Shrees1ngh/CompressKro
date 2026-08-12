// ============================================================
// CompressKro — PDF to JPG Page Component
// ============================================================

import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  FileImage, 
  RefreshCw,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { loadPdfJs } from '../../utils/pdfLoader';
import type { PDFFileItem, PdfJpgResult } from '../../types';
import { usePdfWorkspace } from '../../context/PdfWorkspaceContext';
import { HowToUse } from '../../components/ui/HowToUse';

export function PdfToJpg() {
  const [pdfJpgFile, setPdfJpgFile] = useState<PDFFileItem | null>(null);
  const [pdfJpgResults, setPdfJpgResults] = useState<PdfJpgResult[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const { showSuccess, showError } = useToast();
  const { activeFile, activeFileName, activeFileSize, clearActiveFile } = usePdfWorkspace();
 
  // Auto-load file from workspace context
  useEffect(() => {
    if (activeFile) {
      setPdfJpgFile({
        id: 'active',
        name: activeFileName,
        size: activeFileSize,
        blob: activeFile
      });
      setPdfJpgResults([]);
    } else {
      setPdfJpgFile(null);
      setPdfJpgResults([]);
    }
  }, [activeFile, activeFileName, activeFileSize]);

  const executePdfToJpg = async () => {
    if (!pdfJpgFile) return;
    setIsProcessing(true);
    setProgressMsg('Rendering PDF pages to JPEG...');

    try {
      const pdfjsLib = await loadPdfJs();
      const arrayBuf = await pdfJpgFile.blob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
      const resultsList: PdfJpgResult[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        setProgressMsg(`Rendering page ${i} of ${pdf.numPages}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        await page.render({ canvasContext: ctx, viewport }).promise;

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const res = await fetch(dataUrl);
        const blob = await res.blob();

        const baseName = pdfJpgFile.name.replace(/\.[^/.]+$/, '');
        resultsList.push({
          pageNum: i,
          dataUrl,
          blob,
          size: blob.size,
          filename: `${baseName}_page_${i}.jpg`
        });
      }

      setPdfJpgResults(resultsList);
      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('PDF to JPG', pdfJpgFile.name, pdfJpgFile.size);
      showSuccess('Conversion complete!', `Rendered ${resultsList.length} page(s) to JPG.`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err) {
      console.error(err);
      showError('Conversion failed', 'Error converting PDF pages to JPG images.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const downloadSingleJpg = (item: PdfJpgResult) => {
    const a = document.createElement('a');
    a.href = item.dataUrl;
    a.download = item.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!activeFile) {
    return (
      <HowToUse
        title="PDF to JPG"
        icon={FileImage}
        steps={[
          'Upload your PDF document using the center canvas upload zone.',
          'Click "Convert to JPG Images" in the options panel to render all pages.',
          'Download individual pages as high-quality JPG image files.'
        ]}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {pdfJpgResults.length > 0 ? (
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm relative">
          <button 
            onClick={() => {
              clearActiveFile();
              setPdfJpgResults([]);
            }}
            className="absolute top-4 right-4 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase cursor-pointer"
            title="Start over"
          >
            Clear
          </button>
          <div className="flex justify-between items-center pb-2 border-b border-slate-250 dark:border-slate-800 pr-12">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Converted JPGs ({pdfJpgResults.length})</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 max-h-[380px] overflow-y-auto pr-1 thin-scrollbar">
            {pdfJpgResults.map(item => (
              <div key={item.pageNum} className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-slate-950/30 space-y-2">
                <div className="h-40 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-800">
                  <img src={item.dataUrl} alt={`Page ${item.pageNum}`} className="max-h-full object-contain" />
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">Page {item.pageNum}</span>
                  <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">{getFriendlySize(item.size)}</span>
                </div>
                <button
                  onClick={() => downloadSingleJpg(item)}
                  className="w-full py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-750 text-white flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Page {item.pageNum}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <FileImage className="w-4 h-4 text-fuchsia-500" />
            <span>Convert PDF Pages to JPG</span>
          </h3>

          <div className="space-y-3 p-3 bg-violet-550/5 border border-violet-500/10 rounded-xl text-center">
            <div className="text-xs font-bold text-[var(--ck-text-primary)] truncate">
              {pdfJpgFile?.name}
            </div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
              {pdfJpgFile ? getFriendlySize(pdfJpgFile.size) : ''}
            </div>
          </div>

          <button
            onClick={executePdfToJpg}
            disabled={!pdfJpgFile || isProcessing}
            className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-fuchsia-600 to-pink-650 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileImage className="w-4 h-4" />}
            <span>{isProcessing ? progressMsg : 'Convert to JPG Images'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
