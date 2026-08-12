// ============================================================
// CompressKro — Remove Watermark PDF Page Component
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { PDFDocument, rgb, PDFName } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  FileText, 
  RefreshCw,
  Eraser
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { BACKEND_API_URL } from '../../constants';
import { usePdfWorkspace } from '../../context/PdfWorkspaceContext';
import { PdfTaskCompleted } from '../../components/PdfWorkspaceShell/PdfTaskCompleted';
import type { PDFFileItem } from '../../types';
import { HowToUse } from '../../components/ui/HowToUse';

export function RemoveWatermark() {
  const [rmFile, setRmFile] = useState<PDFFileItem | null>(null);
  const [rmMode, setRmMode] = useState<'annotations' | 'maskHeader' | 'maskFooter' | 'maskCenter'>('annotations');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);

  const rmInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();
  const { activeFile, activeFileName, activeFileSize, chainOutput } = usePdfWorkspace();

  // Auto-load file from workspace context
  useEffect(() => {
    if (activeFile) {
      setRmFile({
        id: 'active',
        name: activeFileName,
        size: activeFileSize,
        blob: activeFile
      });
      clearOutputs();
      setOutputBlob(null);
    } else {
      setRmFile(null);
    }
  }, [activeFile]);

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const executeRemoveWatermark = async () => {
    if (!rmFile) return;
    setIsProcessing(true);
    setProgressMsg('Stripping annotations & masking watermark regions...');

    try {
      let currentBlob = rmFile.blob;

      if (rmMode === 'annotations') {
        try {
          const formData = new FormData();
          formData.append('file', rmFile.blob, rmFile.name);
          const res = await fetch(`${BACKEND_API_URL}/clean-pdf`, {
            method: 'POST',
            body: formData
          });
          if (res.ok) {
            currentBlob = await res.blob();
          }
        } catch (backendErr) {
          console.warn('Backend clean PDF failed, using client masking:', backendErr);
        }
      }

      const arrayBuf = await currentBlob.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuf);
      const pages = pdfDoc.getPages();

      pages.forEach(page => {
        try {
          page.node.delete(PDFName.of('Annots'));
        } catch (e) {}

        const { width, height } = page.getSize();
        if (rmMode === 'maskHeader') {
          page.drawRectangle({
            x: 0,
            y: height - 70,
            width: width,
            height: 70,
            color: rgb(1, 1, 1),
          });
        } else if (rmMode === 'maskFooter') {
          page.drawRectangle({
            x: 0,
            y: 0,
            width: width,
            height: 70,
            color: rgb(1, 1, 1),
          });
        } else if (rmMode === 'maskCenter') {
          page.drawRectangle({
            x: width * 0.05,
            y: height * 0.35,
            width: width * 0.9,
            height: height * 0.3,
            color: rgb(1, 1, 1),
          });
        }
      });

      const bytes = await pdfDoc.save();
      const outputBlob = new Blob([bytes as any], { type: 'application/pdf' });

      setOutputUrl(URL.createObjectURL(outputBlob));
      setOutputSize(outputBlob.size);
      setOutputName(`clean_${rmFile.name}`);
      setOutputBlob(outputBlob);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Remove Watermark', `clean_${rmFile.name}`, outputBlob.size);

      showSuccess('Watermark removed!', `clean_${rmFile.name} · ${getFriendlySize(outputBlob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err) {
      console.error(err);
      showError('Cleanup failed', 'Error removing watermarks or masking PDF.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };



  return (
    <>
      <div className="space-y-6">
        {outputUrl && outputBlob ? (
          <PdfTaskCompleted
            fileName={outputName}
            fileSize={outputSize}
            originalSize={rmFile?.size}
            outputBlob={outputBlob}
            onReset={() => {
              clearOutputs();
              setOutputBlob(null);
              setRmFile(null);
            }}
          />
        ) : !rmFile ? (
          <HowToUse
            title="Remove Watermark"
            icon={Eraser}
            steps={[
              'Upload your PDF document in the center canvas.',
              'Select a removal mode: Strip annotations layer or Mask/Cover specific regions (Header, Footer, Center).',
              'Click "Process Cleanup" to strip watermarks and download your clean PDF.'
            ]}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Eraser className="w-4 h-4 text-rose-500" />
              <span>Remove Annotations & Watermark Mask</span>
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Removal Mode
                </label>
                <select
                  value={rmMode}
                  onChange={(e) => setRmMode(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                >
                  <option value="annotations">Strip Annotations & Watermark Markup Layers</option>
                  <option value="maskHeader">Mask Header Region (Cover Top Box)</option>
                  <option value="maskFooter">Mask Footer Region (Cover Bottom Box)</option>
                  <option value="maskCenter">Mask Center Region (Cover Center Stamp)</option>
                </select>
              </div>
            </div>

            <button
              onClick={executeRemoveWatermark}
              disabled={!rmFile || isProcessing}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-rose-500 to-red-650 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eraser className="w-4 h-4" />}
              <span>{isProcessing ? progressMsg : 'Process Cleanup'}</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
