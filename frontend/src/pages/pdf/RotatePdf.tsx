// ============================================================
// CompressKro — Rotate & Reorder PDF Page Component
// ============================================================

import React, { useState, useRef } from 'react';
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
import { getFriendlySize } from '../../utils/format';
import { loadPdfJs } from '../../utils/pdfLoader';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { CompiledOutputView } from '../../components/CompiledOutputView';
import type { PDFFileItem, PDFPageItem } from '../../types';

export function RotatePdf() {
  const [editFile, setEditFile] = useState<PDFFileItem | null>(null);
  const [editPages, setEditPages] = useState<PDFPageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');

  const editInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const handleEditFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setEditFile({
        id: 'edit',
        name: f.name,
        size: f.size,
        blob: f
      });
      clearOutputs();
      setIsProcessing(true);
      setProgressMsg('Generating page previews...');

      try {
        const arrayBuf = await f.arrayBuffer();
        const doc = await PDFDocument.load(arrayBuf);
        const count = doc.getPageCount();
        
        // Dynamically load pdf.js for rendering previews
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

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Rotate & Order', `edited_${editFile.name}`, blob.size);

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

  const steps: StepItem[] = [
    { step: 1, text: 'Click "Select PDF to Edit" to upload your target document.' },
    { step: 2, text: 'Drag and drop cards to change page order. Click the rotate icon to turn pages 90°.' },
    { step: 3, text: 'Click "Apply & Save PDF" to build your modified PDF file.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Interactive Previews', desc: 'See each page clearly as a card before applying rotation or order changes.' },
    { title: 'Custom Organization', desc: 'Drag-and-drop page sorting allows for quick, simple document reordering.' },
    { title: 'Delete Unused Pages', desc: 'Remove specific sheets directly from your document to clean up clutter.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'How do I change the order of pages?', answer: 'Simply click and hold the page card, drag it to the desired position in the grid, and drop it. The grid will update instantly.' },
    { question: 'How does rotating pages work?', answer: 'Clicking the rotate icon rotates that specific page 90 degrees clockwise. You can click it multiple times to rotate it 180 or 270 degrees.' },
    { question: 'Can I remove specific pages from the PDF?', answer: 'Yes. Every page card has a trash icon. Clicking it removes that page from the document. The original file on your device remains unchanged.' },
    { question: 'Will the text content remain selectable after rotation?', answer: 'Yes. Rotating pages updates the page orientation metadata without rasterizing the text. All text, links, and forms remain interactive.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Merge PDF', desc: 'Combine multiple PDF files.', path: '/merge-pdf', icon: ListOrdered },
    { name: 'Split PDF', desc: 'Extract pages or split ranges.', path: '/split-pdf', icon: FileText },
    { name: 'PDF to JPG', desc: 'Save PDF pages as JPEG images.', path: '/pdf-to-jpg', icon: FileType }
  ];

  return (
    <ToolPageLayout
      title="Rotate & Organize PDF Pages"
      subtitle="Rearrange page order, delete sheets, or rotate PDF pages online for free."
      breadcrumbName="Rotate PDF"
      seoTitle="Rotate PDF Online Free - Rearrange PDF Pages | CompressKro"
      seoDescription="Rotate and organize PDF pages online for free. Drag and drop to reorder pages, rotate sheets, or delete pages from any PDF document. Privacy-first."
      canonicalPath="/rotate-pdf"
      steps={steps}
      benefits={benefits}
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <div className="space-y-6">
        {outputUrl ? (
          <CompiledOutputView
            outputUrl={outputUrl}
            outputSize={outputSize}
            outputName={outputName}
            onClear={() => {
              clearOutputs();
              setEditFile(null);
              setEditPages([]);
            }}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-violet-500" />
              <span>Rotate & Reorder Pages</span>
            </h3>

            <div className="space-y-4">
              <input 
                type="file" 
                ref={editInputRef} 
                onChange={handleEditFile} 
                accept="application/pdf" 
                className="hidden" 
              />
              <button
                onClick={() => editInputRef.current?.click()}
                className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-violet-500 dark:hover:border-violet-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-violet-500" />
                <span>{editFile ? editFile.name : 'Select PDF to Edit'}</span>
              </button>

              {isProcessing && progressMsg.includes('previews') && (
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin text-violet-500" />
                  <span>{progressMsg}</span>
                </div>
              )}

              {editFile && editPages.length > 0 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-h-[480px] overflow-y-auto pr-1">
                    {editPages.map((page, idx) => (
                      <div 
                        key={idx}
                        draggable={true}
                        onDragStart={(e) => handlePageDragStart(e, idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handlePageDrop(e, idx)}
                        className="relative border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white/35 dark:bg-slate-950/20 text-center space-y-3 group shadow-sm flex flex-col justify-between cursor-grab active:cursor-grabbing hover:border-violet-500 hover:ring-2 hover:ring-violet-500/10 transition-all duration-200"
                      >
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          Sheet {page.originalIndex + 1}
                        </div>
                        <div className="w-32 h-44 border border-slate-200 dark:border-slate-800 mx-auto rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center shadow-md relative overflow-hidden transition-transform duration-300 ease-out pointer-events-none"
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
                            <FileText className="w-12 h-12 text-slate-400" />
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

                  <button
                    onClick={executeEditSave}
                    disabled={isProcessing}
                    className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                    <span>{isProcessing ? progressMsg : 'Apply & Save PDF'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
