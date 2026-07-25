// ============================================================
// CompressKro — Remove Watermark PDF Page Component
// ============================================================

import { useState, useRef } from 'react';
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
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { CompiledOutputView } from '../../components/CompiledOutputView';
import type { PDFFileItem } from '../../types';

export function RemoveWatermark() {
  const [rmFile, setRmFile] = useState<PDFFileItem | null>(null);
  const [rmMode, setRmMode] = useState<'annotations' | 'maskHeader' | 'maskFooter' | 'maskCenter'>('annotations');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');

  const rmInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();

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
      const blob = new Blob([bytes as any], { type: 'application/pdf' });

      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(`clean_${rmFile.name}`);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Remove Watermark', `clean_${rmFile.name}`, blob.size);

      showSuccess('PDF ready!', `clean_${rmFile.name} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err) {
      console.error(err);
      showError('Cleanup failed', 'Error stripping annotations or watermark regions.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Click "Select PDF Document" and upload your watermarked PDF file.' },
    { step: 2, text: 'Select Removal Mode: either strip digital Annotation layers or place custom white Masks.' },
    { step: 3, text: 'Click "Process Cleanup" to strip watermark metadata and download.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Strip Annotations', desc: 'Queries backend Ghostscript engine to drop PDF stamps and comments layers.' },
    { title: 'Custom Area Masking', desc: 'Allows blocking header, footer, or center regions with solid white page masks.' },
    { title: 'Clean Documents', desc: 'Generates polished, clean outputs without altering the vector layouts.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'How does annotation stripping work?', answer: 'Many PDF watermarks are saved as digital "Annotation" layers. Our tool strips these specific dictionary entries, removing the watermark while preserving page contents.' },
    { question: 'What is regional masking?', answer: 'If watermarks are permanently rasterized/flattened onto the page, they cannot be deleted. Instead, regional masking draws a solid white rectangle over target areas (header, footer, center) to cover them.' },
    { question: 'Will this make the file look messy?', answer: 'Annotation stripping keeps the layout perfectly clean. Region masking covers the background, which is ideal if the background is solid white.' },
    { question: 'Can I remove text watermarks that are merged into the main content?', answer: 'If a text watermark is completely baked into the content stream as vector paths, it cannot be safely stripped without removing normal page text. In this case, use "Mask Center" or another masking option.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Add Watermark', desc: 'Add text or logo watermark.', path: '/add-watermark', icon: FileText },
    { name: 'Split PDF', desc: 'Extract pages or split ranges.', path: '/split-pdf', icon: FileText },
    { name: 'Page Numbers', desc: 'Add page indices.', path: '/page-numbers', icon: FileText }
  ];

  return (
    <ToolPageLayout
      title="Remove Watermark from PDF Online"
      subtitle="Strip digital annotation layers or overlay clean white region masks on your PDF."
      breadcrumbName="Remove Watermark"
      seoTitle="Remove Watermark from PDF Free - Strip PDF Watermarks | CompressKro"
      seoDescription="Remove watermarks from PDF documents online for free. Strip annotation stamps or mask header/footer/center watermark zones. Secure local browser edits."
      canonicalPath="/remove-watermark"
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
              setRmFile(null);
            }}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Eraser className="w-4 h-4 text-rose-500" />
              <span>Remove Annotations & Watermark Mask</span>
            </h3>

            <div className="space-y-4">
              <input 
                type="file" 
                ref={rmInputRef} 
                onChange={(e) => e.target.files?.[0] && setRmFile({ id: 'rm', name: e.target.files[0].name, size: e.target.files[0].size, blob: e.target.files[0] })} 
                accept="application/pdf" 
                className="hidden" 
              />
              <button
                onClick={() => rmInputRef.current?.click()}
                className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-rose-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-rose-500" />
                <span>{rmFile ? rmFile.name : 'Select PDF Document'}</span>
              </button>

              {rmFile && (
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
              )}
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
    </ToolPageLayout>
  );
}
