// ============================================================
// CompressKro — Rotate & Reorder PDF Page Component
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  FileText, 
  RefreshCw, 
  RotateCw, 
  Trash2,
  ListOrdered,
  FileType
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { usePdfWorkspace } from '../../context/PdfWorkspaceContext';
import { PdfTaskCompleted } from '../../components/PdfWorkspaceShell/PdfTaskCompleted';
import type { PDFFileItem, PDFPageItem } from '../../types';
import { getFriendlySize } from '../../utils/format';
import { loadPdfJs } from '../../utils/pdfLoader';
import { HowToUse } from '../../components/ui/HowToUse';
import { ShieldCheck } from 'lucide-react';

export function RotatePdf() {
  const [editFile, setEditFile] = useState<PDFFileItem | null>(null);
  const [editPages, setEditPages] = useState<PDFPageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
 
  const editInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();
  const { activeFile, activeFileName, activeFileSize, chainOutput } = usePdfWorkspace();
  const [loadedFileRef, setLoadedFileRef] = useState<File | Blob | null>(null);

  // Auto-load file from workspace context
  useEffect(() => {
    if (activeFile) {
      if (activeFile !== loadedFileRef) {
        setLoadedFileRef(activeFile);
        processFile(activeFile);
      }
    } else {
      setLoadedFileRef(null);
      setEditFile(null);
      setEditPages([]);
      clearOutputs();
      setOutputBlob(null);
    }
  }, [activeFile, loadedFileRef]);

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const processFile = async (f: File | Blob) => {
    setEditFile({
      id: 'edit',
      name: f instanceof File ? f.name : (activeFileName || 'document.pdf'),
      size: f.size,
      blob: f
    });
    clearOutputs();
    setOutputBlob(null);
    setIsProcessing(true);
    setProgressMsg('Generating page previews...');

    try {
      const arrayBuf = await f.arrayBuffer();
      const doc = await PDFDocument.load(arrayBuf);
      const count = doc.getPageCount();
      
      const pdfjsLib = await loadPdfJs();
      const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuf.slice(0) }).promise;
      
      const pages: PDFPageItem[] = [];
      for (let i = 0; i < count; i++) {
        const page = await pdfjsDoc.getPage(i + 1);
        const viewport = page.getViewport({ scale: 0.25 });
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          await page.render({ canvasContext: tempCtx, viewport }).promise;
        }
        pages.push({
          originalIndex: i,
          rotation: 0,
          previewUrl: tempCanvas.toDataURL('image/jpeg', 0.6)
        });
      }
      setEditPages(pages);
    } catch (err) {
      console.error(err);
      showError('PDF load failed', 'Error parsing pages from PDF.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const handleEditFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const rotatePage = (index: number) => {
    const list = [...editPages];
    list[index].rotation = (list[index].rotation + 90) % 360;
    setEditPages(list);
    clearOutputs();
  };

  const deletePage = (index: number) => {
    setEditPages(editPages.filter((_, i) => i !== index));
    clearOutputs();
  };

  const handlePageDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handlePageDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndexStr = e.dataTransfer.getData('text/plain');
    if (!sourceIndexStr) return;
    const sourceIndex = parseInt(sourceIndexStr, 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const list = [...editPages];
    const [draggedItem] = list.splice(sourceIndex, 1);
    list.splice(targetIndex, 0, draggedItem);
    setEditPages(list);
    clearOutputs();
  };

  const executeEditSave = async () => {
    if (!editFile || editPages.length === 0) return;
    setIsProcessing(true);
    setProgressMsg('Applying manipulations...');

    try {
      const arrayBuf = await editFile.blob.arrayBuffer();
      const srcDoc = await PDFDocument.load(arrayBuf);
      const outputPdf = await PDFDocument.create();

      for (const pageItem of editPages) {
        const [copiedPage] = await outputPdf.copyPages(srcDoc, [pageItem.originalIndex]);
        if (pageItem.rotation > 0) {
          copiedPage.setRotation(degrees(pageItem.rotation));
        }
        outputPdf.addPage(copiedPage);
      }

      const bytes = await outputPdf.save();
      const blob = new Blob([bytes as any], { type: 'application/pdf' });

      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(`edited_${editFile.name}`);
      setOutputBlob(blob);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Rotate & Order', `edited_${editFile.name}`, blob.size);

      // Chain output
      chainOutput(blob, `edited_${editFile.name}`);

      showSuccess('PDF ready!', `edited_${editFile.name} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err) {
      console.error(err);
      showError('Compilation failed', 'Error applying changes to PDF.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[var(--ck-bg-cream)]">
      {!editFile ? (
        <div className="flex flex-col lg:flex-row w-full h-full min-h-0 overflow-hidden">
          {/* Center: Upload Drop Zone */}
          <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
            <input 
              type="file" 
              ref={editInputRef} 
              onChange={handleEditFile} 
              accept="application/pdf" 
              className="hidden" 
            />
            <div
              onClick={() => editInputRef.current?.click()}
              className="w-full max-w-md min-h-[280px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-8 text-center cursor-pointer border-[var(--ck-border)] bg-[var(--ck-bg-card)] hover:border-[var(--ck-border-hover)] transition-all"
            >
              <div className="p-4 rounded-full bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 mb-4">
                <Upload className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-[var(--ck-text-primary)] text-sm">
                Drag & Drop PDF here
              </h3>
              <p className="text-xs text-[var(--ck-text-muted)] mt-1.5 max-w-[280px] leading-relaxed font-semibold">
                or click to browse your files. Upload a PDF to start rotating and reordering pages.
              </p>
            </div>
          </div>
          
          {/* Right: How to use & Privacy */}
          <div className="w-full lg:w-[320px] bg-[var(--ck-bg-card)] border-t lg:border-t-0 lg:border-l border-[var(--ck-border)] flex flex-col min-h-[250px] lg:min-h-0 overflow-y-auto thin-scrollbar flex-shrink-0 p-5 justify-between">
            <div className="flex-1 pb-5">
              <HowToUse
                title="Rotate & Reorder"
                icon={RotateCw}
                steps={[
                  'Upload your PDF document in the center canvas.',
                  'Rotate individual pages by clicking the Rotate icon on each sheet.',
                  'Drag and drop the sheets to rearrange their order.',
                  'Click "Apply & Save PDF" in the right panel to download your modified document.'
                ]}
              />
            </div>
            <div className="flex gap-2 p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 mt-auto flex-shrink-0">
              <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-left">
                <h4 className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Privacy Guaranteed</h4>
                <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400 leading-normal font-semibold">
                  Processing runs 100% locally inside your browser. Your documents never upload to any servers.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ---- Workspace Split Layout ---- */
        <div className="flex-1 flex flex-row w-full h-full min-h-0 overflow-hidden">
          {/* Main sheets grid in center */}
          <div className="flex-1 p-6 overflow-y-auto min-w-0">
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex justify-between items-center pb-3 border-b border-[var(--ck-border)]">
                <div>
                  <h3 className="text-md font-bold text-slate-800 dark:text-slate-200">
                    Rotate & Reorder Pages
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Drag and drop sheets to reorder. Click rotate button to change page orientation.
                  </p>
                </div>
                <div className="text-xs font-bold px-3 py-1 bg-violet-500/10 text-violet-600 rounded-full">
                  {editPages.length} Pages
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 pt-2">
                {editPages.map((page, idx) => (
                  <div 
                    key={idx}
                    draggable={true}
                    onDragStart={(e) => handlePageDragStart(e, idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handlePageDrop(e, idx)}
                    className="relative border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white/35 dark:bg-slate-950/20 text-center space-y-3 group shadow-sm flex flex-col justify-between cursor-grab active:cursor-grabbing hover:border-violet-500 hover:ring-2 hover:ring-violet-500/10 transition-all duration-200"
                  >
                    <div className="text-xs font-bold text-slate-650 dark:text-slate-350">
                      Page {page.originalIndex + 1}
                    </div>
                    <div className="w-28 h-36 border border-slate-200 dark:border-slate-800 mx-auto rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center shadow-md relative overflow-hidden transition-transform duration-300 ease-out pointer-events-none"
                      style={{
                        transform: `rotate(${page.rotation}deg)`
                      }}
                    >
                      {page.previewUrl ? (
                        <img 
                          src={page.previewUrl} 
                          alt={`Page ${page.originalIndex + 1}`} 
                          className="w-full h-full object-contain pointer-events-none" 
                        />
                      ) : (
                        <FileText className="w-10 h-10 text-slate-400" />
                      )}
                      {page.rotation > 0 && (
                        <span className="absolute bottom-1 right-1 bg-violet-600 text-white text-[8px] px-1 py-0.5 rounded font-extrabold shadow leading-none z-10">
                          {page.rotation}°
                        </span>
                      )}
                    </div>

                    <div className="flex justify-center gap-2 pt-1 opacity-85 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); rotatePage(idx); }} className="p-1.5 hover:text-violet-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer" title="Rotate Page">
                        <RotateCw className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deletePage(idx); }} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg cursor-pointer" title="Delete Page">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right sidebar options */}
          <div className="w-[320px] border-l border-[var(--ck-border)] bg-[var(--ck-bg-card)] p-6 flex flex-col justify-between flex-shrink-0 h-full overflow-y-auto thin-scrollbar">
            {outputUrl && outputBlob ? (
              <PdfTaskCompleted
                fileName={outputName}
                fileSize={outputSize}
                originalSize={editFile?.size}
                outputBlob={outputBlob}
                onReset={() => {
                  clearOutputs();
                  setOutputBlob(null);
                  setEditFile(null);
                  setEditPages([]);
                }}
              />
            ) : (
              <div className="flex-1 flex flex-col justify-between h-full">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Manipulations
                  </h4>
                  <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/10 text-xs text-slate-655 dark:text-slate-400 leading-relaxed font-medium">
                    Reorder the pages by dragging them. Rotate or delete specific pages before compiling the output document.
                  </div>
                </div>

                <div className="space-y-3 pt-6 mt-auto">
                  {isProcessing && (
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-500 animate-pulse">
                      <RefreshCw className="w-4 h-4 animate-spin text-violet-500" />
                      <span>{progressMsg}</span>
                    </div>
                  )}
                  <button
                    onClick={executeEditSave}
                    disabled={isProcessing}
                    className="w-full py-3.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-indigo-650 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>Apply & Save PDF</span>
                  </button>

                  <div className="flex gap-2 p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 mt-3 flex-shrink-0">
                    <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-0.5 text-left">
                      <h4 className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Privacy Guaranteed</h4>
                      <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400 leading-normal font-semibold">
                        Processing runs 100% locally inside your browser. Your documents never upload to any servers.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
