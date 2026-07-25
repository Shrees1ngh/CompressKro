// ============================================================
// CompressKro — PDF to Word Page Component
// ============================================================

import { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  FileType, 
  RefreshCw,
  ListOrdered
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

export function PdfToWord() {
  const [wordFile, setWordFile] = useState<PDFFileItem | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');

  const wordInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const executePdfToWord = async () => {
    if (!wordFile) return;
    setIsProcessing(true);
    setProgressMsg('Converting PDF to Word...');

    try {
      const formData = new FormData();
      formData.append('file', wordFile.blob, wordFile.name);
      const res = await fetch(`${BACKEND_API_URL}/pdf-to-word`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Conversion failed');
      }
      const blob = await res.blob();
      const outName = wordFile.name.replace(/\.pdf$/i, '') + '.docx';
      
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(outName);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('PDF to Word', outName, blob.size);

      showSuccess('Word document ready!', `${outName} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err: any) {
      console.error(err);
      showError('Conversion failed', err.message || 'Could not convert PDF to Word.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Click "Select PDF Document" and upload the PDF file you wish to convert.' },
    { step: 2, text: 'Click "Convert to Word (DOCX)" to trigger text extraction and document compiling.' },
    { step: 3, text: 'Download the completed Microsoft Word document (.docx) directly.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Fully Editable Output', desc: 'Converts text content into standard Microsoft Word tables and paragraphs.' },
    { title: 'Scanned Document Support', desc: 'Runs layout reconstruction algorithms to bucket words into visual coordinates.' },
    { title: 'Private & Clean', desc: 'No email registrations, no captcha challenges, and zero added watermarks.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'Does this converter preserve document formatting?', answer: 'Yes. The converter extracts text boxes alongside their exact layout coordinates to place paragraphs and headers as closely as possible to the original PDF.' },
    { question: 'Can I convert image-only scanned PDFs directly to Word?', answer: 'Image-only scanned documents contain no selectable text layers, so the basic converter will output a blank Word document. Please run the document through our "OCR PDF" tool first to generate searchable text before converting.' },
    { question: 'Is my data secure?', answer: 'Yes, our backend processes the conversion in temp folders and permanently removes files immediately after sending the download stream.' },
    { question: 'Do I need Microsoft Word installed?', answer: 'No. The output is a standard Office Open XML (.docx) file which can be opened by Microsoft Word, Google Docs, LibreOffice, or Pages.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'PDF to Excel', desc: 'Convert tables to sheets.', path: '/pdf-to-excel', icon: FileType },
    { name: 'OCR PDF', desc: 'Make scanned pages searchable.', path: '/ocr-pdf', icon: FileType },
    { name: 'Merge PDF', desc: 'Combine multiple PDF files.', path: '/merge-pdf', icon: ListOrdered }
  ];

  return (
    <ToolPageLayout
      title="Convert PDF to Word Online"
      subtitle="Convert PDF documents into editable Microsoft Word DOCX files online for free."
      breadcrumbName="PDF to Word"
      seoTitle="Convert PDF to Word Online Free - DOCX Converter | CompressKro"
      seoDescription="Convert PDF to Word (DOCX) online for free. Extract layout text and convert PDF documents into editable Word sheets. Safe, private, and registration-free."
      canonicalPath="/pdf-to-word"
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
            sourcePdfBlob={wordFile?.blob ?? null}
            onClear={() => {
              clearOutputs();
              setWordFile(null);
            }}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileType className="w-4 h-4 text-blue-500" />
              <span>Convert PDF to Word Document</span>
            </h3>

            <div className="space-y-4">
              <input 
                type="file" 
                ref={wordInputRef} 
                onChange={(e) => e.target.files?.[0] && setWordFile({ id: 'word', name: e.target.files[0].name, size: e.target.files[0].size, blob: e.target.files[0] })} 
                accept="application/pdf" 
                className="hidden" 
              />
              <button
                onClick={() => wordInputRef.current?.click()}
                className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-blue-500" />
                <span>{wordFile ? wordFile.name : 'Select PDF Document'}</span>
              </button>
            </div>

            <button
              onClick={executePdfToWord}
              disabled={!wordFile || isProcessing}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-blue-500 to-indigo-650 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileType className="w-4 h-4" />}
              <span>{isProcessing ? progressMsg : 'Convert to Word (DOCX)'}</span>
            </button>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
