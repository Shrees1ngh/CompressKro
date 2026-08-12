// ============================================================
// CompressKro — Split PDF Page Component
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  FileText, 
  RefreshCw,
  ListOrdered,
  Crop
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { usePdfWorkspace } from '../../context/PdfWorkspaceContext';
import { PdfTaskCompleted } from '../../components/PdfWorkspaceShell/PdfTaskCompleted';
import type { PDFFileItem } from '../../types';
import { HowToUse } from '../../components/ui/HowToUse';

export function SplitPdf() {
  const [splitFile, setSplitFile] = useState<PDFFileItem | null>(null);
  const [splitRange, setSplitRange] = useState<string>('1-2');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);

  const splitInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();
  const { activeFile, activeFileName, activeFileSize, chainOutput } = usePdfWorkspace();

  // Auto-load file from workspace context
  useEffect(() => {
    if (activeFile) {
      setSplitFile({
        id: 'active',
        name: activeFileName,
        size: activeFileSize,
        blob: activeFile
      });
      clearOutputs();
      setOutputBlob(null);
    } else {
      setSplitFile(null);
    }
  }, [activeFile]);

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const handleSplitFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setSplitFile({
        id: 'split',
        name: f.name,
        size: f.size,
        blob: f
      });
      clearOutputs();
    }
  };

  const executeSplit = async () => {
    if (!splitFile) return;
    setIsProcessing(true);
    setProgressMsg('Extracting pages...');

    try {
      const arrayBuf = await splitFile.blob.arrayBuffer();
      const srcDoc = await PDFDocument.load(arrayBuf);
      const totalPages = srcDoc.getPageCount();

      const pagesToExtract: number[] = [];
      const parts = splitRange.split(',');

      for (const part of parts) {
        const range = part.trim().split('-');
        if (range.length === 2) {
          const start = Math.max(1, parseInt(range[0])) - 1;
          const end = Math.min(totalPages, parseInt(range[1])) - 1;
          for (let i = start; i <= end; i++) {
            pagesToExtract.push(i);
          }
        } else if (range.length === 1) {
          const val = parseInt(range[0]) - 1;
          if (val >= 0 && val < totalPages) {
            pagesToExtract.push(val);
          }
        }
      }

      if (pagesToExtract.length === 0) {
        showError('Split failed', 'Invalid page ranges selected.');
        setIsProcessing(false);
        return;
      }

      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(srcDoc, pagesToExtract);
      copiedPages.forEach(p => newPdf.addPage(p));

      const bytes = await newPdf.save();
      const blob = new Blob([bytes as any], { type: 'application/pdf' });

      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(`extracted_${splitFile.name}`);
      setOutputBlob(blob);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Split PDF', `extracted_${splitFile.name}`, blob.size);

      // Chain output to workspace context
      chainOutput(blob, `extracted_${splitFile.name}`);

      showSuccess('PDF ready!', `extracted_${splitFile.name} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err) {
      console.error(err);
      showError('Split failed', 'Error splitting PDF file.');
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
            originalSize={splitFile?.size}
            outputBlob={outputBlob}
            onReset={() => {
              clearOutputs();
              setOutputBlob(null);
              setSplitFile(null);
            }}
          />
        ) : !splitFile ? (
          <HowToUse
            title="Split PDF"
            icon={FileText}
            steps={[
              'Upload your PDF document in the center canvas.',
              'Define the page ranges (e.g., "1-3, 5, 8-10") in the right panel input.',
              'Click "Extract Pages" to split and download your selected pages.'
            ]}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-500" />
              <span>Split & Extract Pages</span>
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Page Ranges (e.g. 1-3, 5, 8-10)
                </label>
                <input
                  type="text"
                  value={splitRange}
                  onChange={(e) => setSplitRange(e.target.value)}
                  placeholder="1-2, 5"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
              </div>
            </div>

            <button
              onClick={executeSplit}
              disabled={isProcessing}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              <span>{isProcessing ? progressMsg : 'Extract Pages'}</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
