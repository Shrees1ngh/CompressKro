// ============================================================
// CompressKro — PDF to Excel Page Component
// ============================================================

import { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  FileSpreadsheet, 
  RefreshCw,
  ListOrdered,
  FileText
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

export function PdfToExcel() {
  const [excelFile, setExcelFile] = useState<PDFFileItem | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');

  const excelInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const executePdfToExcel = async () => {
    if (!excelFile) return;
    setIsProcessing(true);
    setProgressMsg('Converting PDF to Excel...');

    try {
      const formData = new FormData();
      formData.append('file', excelFile.blob, excelFile.name);
      const res = await fetch(`${BACKEND_API_URL}/pdf-to-excel`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Conversion failed');
      }
      const blob = await res.blob();
      const outName = excelFile.name.replace(/\.pdf$/i, '') + '.xlsx';

      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(outName);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('PDF to Excel', outName, blob.size);

      showSuccess('Excel file ready!', `${outName} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err: any) {
      console.error(err);
      showError('Conversion failed', err.message || 'Could not convert PDF to Excel.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Click "Select PDF Document" and upload the PDF file containing tables.' },
    { step: 2, text: 'Click "Convert to Excel (XLSX)" to start layout grouping and tabular extraction.' },
    { step: 3, text: 'Download the compiled Microsoft Excel spreadsheet (.xlsx) instantly.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Tabular Structure Mapping', desc: 'Sorts words by row and column position to rebuild spreadsheet sheets accurately.' },
    { title: 'Multi-Page Data Sync', desc: 'Converts multi-page PDF documents into single consolidated sheets or separate sheets.' },
    { title: '100% Free & Secure', desc: 'Completely free to use, no account creation, and files deleted instantly from backend memory.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'Will my table formatting and values remain intact?', answer: 'Yes. The converter groups text values that align horizontally and vertically, mapping them into standard Excel cells. Merged cells and spacing are reconstructed.' },
    { question: 'Can I convert scanned sheets or invoice printouts?', answer: 'For scanned PDFs containing flat image layers, please run our "OCR PDF" tool first. This adds a text layout overlay that the PDF to Excel converter can read.' },
    { question: 'Do I need Microsoft Excel to open the file?', answer: 'No. The output is a standard OpenXML Spreadsheet (.xlsx) which opens seamlessly in Microsoft Excel, Google Sheets, numbers, or LibreOffice Calc.' },
    { question: 'Is my upload secure?', answer: 'Yes. Uploaded files are held only in temporary system memory buffers during conversion, and are permanently wiped immediately after download.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'PDF to Word', desc: 'Convert PDF to Word document.', path: '/pdf-to-word', icon: FileText },
    { name: 'OCR PDF', desc: 'Make scanned pages searchable.', path: '/ocr-pdf', icon: FileText },
    { name: 'Merge PDF', desc: 'Combine multiple PDF files.', path: '/merge-pdf', icon: ListOrdered }
  ];

  return (
    <ToolPageLayout
      title="Convert PDF to Excel Online"
      subtitle="Extract tables and spreadsheets from PDF documents into Microsoft Excel XLSX sheets online for free."
      breadcrumbName="PDF to Excel"
      seoTitle="Convert PDF to Excel Online Free - XLSX Spreadsheet | CompressKro"
      seoDescription="Convert PDF to Excel (XLSX) online for free. Extract tabular data from PDF files and convert them into fully editable Excel spreadsheets. Safe and secure."
      canonicalPath="/pdf-to-excel"
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
            sourcePdfBlob={excelFile?.blob ?? null}
            onClear={() => {
              clearOutputs();
              setExcelFile(null);
            }}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span>Convert PDF to Excel Spreadsheet</span>
            </h3>

            <div className="space-y-4">
              <input 
                type="file" 
                ref={excelInputRef} 
                onChange={(e) => e.target.files?.[0] && setExcelFile({ id: 'excel', name: e.target.files[0].name, size: e.target.files[0].size, blob: e.target.files[0] })} 
                accept="application/pdf" 
                className="hidden" 
              />
              <button
                onClick={() => excelInputRef.current?.click()}
                className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-emerald-500" />
                <span>{excelFile ? excelFile.name : 'Select PDF Document'}</span>
              </button>
            </div>

            <button
              onClick={executePdfToExcel}
              disabled={!excelFile || isProcessing}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-650 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              <span>{isProcessing ? progressMsg : 'Convert to Excel (XLSX)'}</span>
            </button>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
