// ============================================================
// CompressKro — Merge PDF Page Component
// ============================================================

import { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  FileText, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  ListOrdered, 
  RefreshCw,
  Crop
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { CompiledOutputView } from '../../components/CompiledOutputView';
import type { PDFFileItem } from '../../types';

export function MergePdf() {
  const [mergeFiles, setMergeFiles] = useState<PDFFileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  
  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');

  const mergeInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const handleMergeFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newItems = Array.from(e.target.files).map(f => ({
        id: Math.random().toString(36).substring(2),
        name: f.name,
        size: f.size,
        blob: f
      }));
      setMergeFiles([...mergeFiles, ...newItems]);
      clearOutputs();
    }
  };

  const moveMergeItem = (index: number, direction: 'up' | 'down') => {
    const list = [...mergeFiles];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx >= 0 && targetIdx < list.length) {
      const temp = list[index];
      list[index] = list[targetIdx];
      list[targetIdx] = temp;
      setMergeFiles(list);
    }
  };

  const removeMergeItem = (id: string) => {
    setMergeFiles(mergeFiles.filter(item => item.id !== id));
    clearOutputs();
  };

  const executeMerge = async () => {
    if (mergeFiles.length < 2) return;
    setIsProcessing(true);
    setProgressMsg('Merging files...');

    try {
      const mergedPdf = await PDFDocument.create();
      for (const item of mergeFiles) {
        const arrayBuf = await item.blob.arrayBuffer();
        const doc = await PDFDocument.load(arrayBuf);
        const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
        copiedPages.forEach(p => mergedPdf.addPage(p));
      }

      const mergedBytes = await mergedPdf.save();
      const outputBlob = new Blob([mergedBytes as any], { type: 'application/pdf' });
      
      setOutputUrl(URL.createObjectURL(outputBlob));
      setOutputSize(outputBlob.size);
      setOutputName('merged_document.pdf');

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Merge PDF', 'merged_document.pdf', outputBlob.size);

      showSuccess('PDF ready!', `merged_document.pdf · ${getFriendlySize(outputBlob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err) {
      console.error(err);
      showError('Merge failed', 'Ensure all PDFs are unencrypted and valid files.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // SEO Metadata
  const steps: StepItem[] = [
    { step: 1, text: 'Click "Add PDF Documents" and select 2 or more files from your device.' },
    { step: 2, text: 'Use the up and down arrows to rearrange files into the desired order.' },
    { step: 3, text: 'Click "Merge PDFs Now" to combine pages and download your merged PDF.' }
  ];

  const benefits: BenefitItem[] = [
    { title: '100% Client-Side', desc: 'Merging runs instantly in-browser. Your private PDFs never leave your computer.' },
    { title: 'Zero File Limits', desc: 'Combine as many PDFs as you want. No registration, no restrictions, and no watermarks.' },
    { title: 'Preserves Layouts', desc: 'Maintains font rendering, form fields, shapes, and structural orientation flawlessly.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'Is it safe to merge my PDFs on CompressKro?', answer: 'Yes, absolutely. Because CompressKro operates client-side, the merging is done directly in your browser. Your documents are never uploaded to any remote server.' },
    { question: 'Can I merge password-protected PDFs?', answer: 'No. You must unlock the password-protected PDFs using our "Unlock PDF" tool first before merging them together.' },
    { question: 'Is there a limit on the number of files I can combine?', answer: 'There is no hard limit on files. However, merging very large or dozens of files might consume more browser memory.' },
    { question: 'Does CompressKro add watermarks to merged files?', answer: 'No, we do not add any branding or watermarks. Your output remains clean and pristine.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Split PDF', desc: 'Extract pages or split ranges.', path: '/split-pdf', icon: FileText },
    { name: 'Crop PDF', desc: 'Crop page margins visually.', path: '/crop-pdf', icon: Crop },
    { name: 'Compress PDF', desc: 'Reduce PDF file size.', path: '/compress-pdf', icon: FileText }
  ];

  return (
    <ToolPageLayout
      title="Merge PDF Online"
      subtitle="Combine multiple PDF files into one single document online for free."
      breadcrumbName="Merge PDF"
      seoTitle="Merge PDF Online Free - Combine PDF Files | CompressKro"
      seoDescription="Merge PDF files online for free. Combine multiple PDF documents into one. Privacy-first local processing, no registration, no watermarks."
      canonicalPath="/merge-pdf"
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
              setMergeFiles([]);
            }}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-violet-500" />
              <span>Merge Multiple PDFs</span>
            </h3>

            <div className="space-y-3">
              <input 
                type="file" 
                ref={mergeInputRef} 
                onChange={handleMergeFiles} 
                accept="application/pdf" 
                multiple 
                className="hidden" 
              />
              <button
                onClick={() => mergeInputRef.current?.click()}
                className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-violet-500 dark:hover:border-violet-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-violet-500" />
                <span>Add PDF Documents</span>
              </button>

              {mergeFiles.length > 0 && (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {mergeFiles.map((file, idx) => (
                    <div key={file.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 text-xs">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <FileText className="w-4 h-4 text-violet-500 flex-shrink-0" />
                        <span className="truncate font-semibold text-slate-700 dark:text-slate-300">{file.name}</span>
                        <span className="text-[10px] text-slate-400">({getFriendlySize(file.size)})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => moveMergeItem(idx, 'up')} disabled={idx === 0} className="p-1 hover:text-violet-500 disabled:opacity-30 cursor-pointer">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => moveMergeItem(idx, 'down')} disabled={idx === mergeFiles.length - 1} className="p-1 hover:text-violet-500 disabled:opacity-30 cursor-pointer">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => removeMergeItem(file.id)} className="p-1 text-red-500 hover:text-red-600 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={executeMerge}
              disabled={mergeFiles.length < 2 || isProcessing}
              className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm ${
                mergeFiles.length < 2 && !isProcessing
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90 cursor-pointer'
              }`}
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ListOrdered className="w-4 h-4" />}
              <span>{isProcessing ? progressMsg : 'Merge PDFs Now'}</span>
            </button>

            {mergeFiles.length < 2 && !isProcessing && (
              <p className="text-center text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                Add at least 2 PDFs to merge.
              </p>
            )}
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
