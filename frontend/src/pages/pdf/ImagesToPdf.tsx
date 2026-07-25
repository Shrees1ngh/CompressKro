// ============================================================
// CompressKro — Images to PDF Page Component
// ============================================================

import React, { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  FileText, 
  RefreshCw,
  ListOrdered,
  FileType
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { CompiledOutputView } from '../../components/CompiledOutputView';
import type { PDFFileItem } from '../../types';

export function ImagesToPdf() {
  const [images, setImages] = useState<PDFFileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');

  const imagesInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const handleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const list = Array.from(e.target.files).map(f => ({
        id: Math.random().toString(36).substring(2),
        name: f.name,
        size: f.size,
        blob: f
      }));
      setImages([...images, ...list]);
      clearOutputs();
    }
  };

  const executeImagesToPdf = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    setProgressMsg('Compiling images into A4 pages...');

    try {
      const pdfDoc = await PDFDocument.create();
      
      for (const imgItem of images) {
        const page = pdfDoc.addPage([595.27, 841.89]);
        const arrayBuf = await imgItem.blob.arrayBuffer();
        
        let embeddedImg;
        if (imgItem.name.toLowerCase().endsWith('.png')) {
          embeddedImg = await pdfDoc.embedPng(arrayBuf);
        } else {
          embeddedImg = await pdfDoc.embedJpg(arrayBuf);
        }

        const imgScale = embeddedImg.scale(1.0);
        const maxW = 535.27;
        const maxH = 781.89;
        
        let fitW = imgScale.width;
        let fitH = imgScale.height;
        const ratio = fitW / fitH;

        if (fitW > maxW) {
          fitW = maxW;
          fitH = fitW / ratio;
        }
        if (fitH > maxH) {
          fitH = maxH;
          fitW = fitH * ratio;
        }

        page.drawImage(embeddedImg, {
          x: (595.27 - fitW) / 2,
          y: (841.89 - fitH) / 2,
          width: fitW,
          height: fitH
        });
      }

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes as any], { type: 'application/pdf' });

      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName('images_compiled.pdf');

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Images to PDF', 'images_compiled.pdf', blob.size);

      showSuccess('PDF ready!', `images_compiled.pdf · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err) {
      console.error(err);
      showError('Conversion failed', 'Ensure images are PNG or JPG format.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Click "Add PNG / JPG Images" and choose one or more pictures.' },
    { step: 2, text: 'Verify the list of selected files below the button.' },
    { step: 3, text: 'Click "Compile to PDF" to generate and download your compiled PDF.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'A4 Proportion Alignment', desc: 'Auto-calculates aspect ratios to scale images neatly centered inside standard A4 sheets.' },
    { title: 'Multiple Formats Supported', desc: 'Allows PNG, JPG, and JPEG images to be uploaded and merged together.' },
    { title: 'Fast Client-Side Compile', desc: 'Builds the PDF entirely inside browser memory with zero network delay.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'What image formats can I convert to PDF?', answer: 'CompressKro supports standard PNG, JPG, and JPEG image files.' },
    { question: 'Will my images retain their high quality?', answer: 'Yes, we embed the images at their original quality without compression or down-scaling their resolution.' },
    { question: 'Is there a limit on how many images I can convert?', answer: 'No hard limit. However, importing dozens of very high resolution images may consume more browser memory.' },
    { question: 'How is the layout generated?', answer: 'Each image is automatically placed on its own standard A4 page, scaled to fit inside the margins, and centered vertically and horizontally.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Merge PDF', desc: 'Combine multiple PDF files.', path: '/merge-pdf', icon: ListOrdered },
    { name: 'PDF to JPG', desc: 'Save PDF pages as JPEG images.', path: '/pdf-to-jpg', icon: FileType },
    { name: 'Rotate & Order', desc: 'Rearrange and rotate pages.', path: '/rotate-pdf', icon: RefreshCw }
  ];

  return (
    <ToolPageLayout
      title="Convert Images to PDF Online"
      subtitle="Convert PNG, JPG, and JPEG images into A4 PDF pages online for free."
      breadcrumbName="Images to PDF"
      seoTitle="Images to PDF Online Free - Convert JPG, PNG to PDF | CompressKro"
      seoDescription="Convert PNG, JPG, and JPEG images to PDF files online for free. Combine multiple photos into a single PDF document. Safe in-browser processing."
      canonicalPath="/images-to-pdf"
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
              setImages([]);
            }}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Upload className="w-4 h-4 text-violet-500" />
              <span>Images to PDF Document</span>
            </h3>

            <div className="space-y-3">
              <input 
                type="file" 
                ref={imagesInputRef} 
                onChange={handleImagesUpload} 
                accept="image/png, image/jpeg, image/jpg" 
                multiple 
                className="hidden" 
              />
              <button
                onClick={() => imagesInputRef.current?.click()}
                className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-violet-500 dark:hover:border-violet-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-violet-500" />
                <span>Add PNG / JPG Images</span>
              </button>

              {images.length > 0 && (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {images.map(img => (
                    <div key={img.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 text-xs">
                      <span className="truncate font-semibold text-slate-700 dark:text-slate-300">{img.name}</span>
                      <span className="text-[10px] text-slate-400">({getFriendlySize(img.size)})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={executeImagesToPdf}
              disabled={images.length === 0 || isProcessing}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              <span>{isProcessing ? progressMsg : 'Compile to PDF'}</span>
            </button>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
