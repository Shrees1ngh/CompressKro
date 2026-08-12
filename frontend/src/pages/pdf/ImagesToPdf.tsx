// ============================================================
// CompressKro — Images to PDF Page Component
// ============================================================

import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { 
  FileText, 
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { usePdfWorkspace } from '../../context/PdfWorkspaceContext';
import { PdfTaskCompleted } from '../../components/PdfWorkspaceShell/PdfTaskCompleted';
import { HowToUse } from '../../components/ui/HowToUse';

export function ImagesToPdf() {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);

  const { showSuccess, showError } = useToast();
  const { activeFiles, clearActiveFile } = usePdfWorkspace();

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const executeImagesToPdf = async () => {
    if (activeFiles.length === 0) return;
    setIsProcessing(true);
    setProgressMsg('Compiling images...');

    try {
      const pdfDoc = await PDFDocument.create();
      
      for (const imgItem of activeFiles) {
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
      setOutputBlob(blob);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Images to PDF', 'images_compiled.pdf', blob.size);

      // Chain output
      clearActiveFile();

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

  if (outputUrl && outputBlob) {
    return (
      <div className="space-y-6">
        <PdfTaskCompleted
          fileName={outputName}
          fileSize={outputSize}
          outputBlob={outputBlob}
          onReset={() => {
            clearOutputs();
            setOutputBlob(null);
            clearActiveFile();
          }}
        />
      </div>
    );
  }

  if (activeFiles.length === 0) {
    return (
      <HowToUse
        title="Images to PDF"
        icon={Upload}
        steps={[
          'Click the center canvas upload zone to select PNG or JPG images, or drag-and-drop them.',
          'Arrange the loaded images in the center canvas to set their order inside the PDF.',
          'Click "Compile to PDF" to generate and download the high-quality compiled PDF document.'
        ]}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Upload className="w-4 h-4 text-violet-500" />
          <span>Images to PDF Document</span>
        </h3>

        <div className="space-y-3 p-3 bg-violet-500/5 border border-violet-500/10 rounded-xl text-center">
          <div className="text-xs font-bold text-violet-600 dark:text-violet-400">
            {activeFiles.length} Image(s) loaded
          </div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Ready to compile
          </div>
        </div>

        <button
          onClick={executeImagesToPdf}
          disabled={activeFiles.length === 0 || isProcessing}
          className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          <span>{isProcessing ? progressMsg : 'Compile to PDF'}</span>
        </button>
      </div>
    </div>
  );
}
