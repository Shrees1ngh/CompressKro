// ============================================================
// CompressKro — Add Watermark PDF Page Component
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  FileText, 
  RefreshCw,
  Droplets
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { usePdfWorkspace } from '../../context/PdfWorkspaceContext';
import { PdfTaskCompleted } from '../../components/PdfWorkspaceShell/PdfTaskCompleted';
import type { PDFFileItem } from '../../types';
import { HowToUse } from '../../components/ui/HowToUse';

export function AddWatermark() {
  const [wmFile, setWmFile] = useState<PDFFileItem | null>(null);
  const [wmType, setWmType] = useState<'text' | 'image'>('text');
  const [wmText, setWmText] = useState<string>('CONFIDENTIAL');
  const [wmFontSize, setWmFontSize] = useState<number>(48);
  const [wmOpacity, setWmOpacity] = useState<number>(0.3);
  const [wmRotation, setWmRotation] = useState<number>(45);
  const [wmColor, setWmColor] = useState<'gray' | 'red' | 'blue' | 'black'>('gray');
  const [wmPosition, setWmPosition] = useState<'center' | 'top' | 'bottom'>('center');
  const [wmImageFile, setWmImageFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);

  const wmInputRef = useRef<HTMLInputElement>(null);
  const wmImageInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError } = useToast();
  const { activeFile, activeFileName, activeFileSize, chainOutput } = usePdfWorkspace();

  // Auto-load file from workspace context
  useEffect(() => {
    if (activeFile) {
      setWmFile({
        id: 'active',
        name: activeFileName,
        size: activeFileSize,
        blob: activeFile
      });
      clearOutputs();
      setOutputBlob(null);
    } else {
      setWmFile(null);
    }
  }, [activeFile]);

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const executeAddWatermark = async () => {
    if (!wmFile) return;
    setIsProcessing(true);
    setProgressMsg('Applying watermark to all pages...');

    try {
      const arrayBuf = await wmFile.blob.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuf);
      const pages = pdfDoc.getPages();

      if (wmType === 'text') {
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        let rgbColor = rgb(0.5, 0.5, 0.5);
        if (wmColor === 'red') rgbColor = rgb(0.9, 0.2, 0.2);
        if (wmColor === 'blue') rgbColor = rgb(0.2, 0.4, 0.9);
        if (wmColor === 'black') rgbColor = rgb(0.1, 0.1, 0.1);

        const textStr = wmText || 'CONFIDENTIAL';
        const fontSize = wmFontSize;
        const textWidth = font.widthOfTextAtSize(textStr, fontSize);
        const textHeight = fontSize * 0.75;

        const rad = (wmRotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const cx = textWidth / 2;
        const cy = textHeight / 2;

        const rx = cx * cos - cy * sin;
        const ry = cx * sin + cy * cos;

        pages.forEach(page => {
          const { width, height } = page.getSize();
          let targetX = width / 2;
          let targetY = height / 2;
          if (wmPosition === 'top') targetY = height * 0.85;
          if (wmPosition === 'bottom') targetY = height * 0.15;

          const drawX = targetX - rx;
          const drawY = targetY - ry;

          page.drawText(textStr, {
            x: drawX,
            y: drawY,
            size: fontSize,
            font,
            color: rgbColor,
            opacity: wmOpacity,
            rotate: degrees(wmRotation),
          });
        });
      } else if (wmType === 'image' && wmImageFile) {
        const imgBuf = await wmImageFile.arrayBuffer();
        const embeddedImg = wmImageFile.name.toLowerCase().endsWith('.png')
          ? await pdfDoc.embedPng(imgBuf)
          : await pdfDoc.embedJpg(imgBuf);

        pages.forEach(page => {
          const { width, height } = page.getSize();
          const imgScale = embeddedImg.scale(0.3);
          let targetY = height / 2;
          if (wmPosition === 'top') targetY = height * 0.85;
          if (wmPosition === 'bottom') targetY = height * 0.15;

          page.drawImage(embeddedImg, {
            x: (width - imgScale.width) / 2,
            y: targetY - (imgScale.height / 2),
            width: imgScale.width,
            height: imgScale.height,
            opacity: wmOpacity,
          });
        });
      }

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes as any], { type: 'application/pdf' });

      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(`watermarked_${wmFile.name}`);
      setOutputBlob(blob);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Add Watermark', `watermarked_${wmFile.name}`, blob.size);

      showSuccess('PDF ready!', `watermarked_${wmFile.name} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err) {
      console.error(err);
      showError('Watermark failed', 'Error adding watermark to PDF.');
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
            originalSize={wmFile?.size}
            outputBlob={outputBlob}
            onReset={() => {
              clearOutputs();
              setOutputBlob(null);
              setWmFile(null);
              setWmImageFile(null);
            }}
          />
        ) : !wmFile ? (
          <HowToUse
            title="Add Watermark"
            icon={Droplets}
            steps={[
              'Upload your PDF document in the center canvas.',
              'Choose either Text Watermark or Image Logo Watermark on the right.',
              'Configure size, opacity, color, angle, and position.',
              'Click "Apply Watermark" to stamp pages and download your document.'
            ]}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Droplets className="w-4 h-4 text-blue-500" />
              <span>Add Watermark to PDF</span>
            </h3>

            <div className="space-y-4">
              <div className="space-y-3 p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl text-center">
                <div className="text-xs font-bold text-[var(--ck-text-primary)] truncate">
                  {wmFile.name}
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                  {getFriendlySize(wmFile.size)}
                </div>
              </div>

              {wmFile && (
                <div className="space-y-4 border-t border-slate-200/50 dark:border-slate-800/50 pt-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setWmType('text')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        wmType === 'text'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      Text Watermark
                    </button>
                    <button
                      type="button"
                      onClick={() => setWmType('image')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        wmType === 'image'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      Image Logo Watermark
                    </button>
                  </div>

                  {wmType === 'text' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Watermark Text
                        </label>
                        <input
                          type="text"
                          value={wmText}
                          onChange={(e) => setWmText(e.target.value)}
                          placeholder="CONFIDENTIAL"
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Size ({wmFontSize}px)</label>
                          <input
                            type="range"
                            min={16}
                            max={96}
                            value={wmFontSize}
                            onChange={(e) => setWmFontSize(Number(e.target.value))}
                            className="w-full accent-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Opacity ({Math.round(wmOpacity * 100)}%)</label>
                          <input
                            type="range"
                            min={0.1}
                            max={1.0}
                            step={0.05}
                            value={wmOpacity}
                            onChange={(e) => setWmOpacity(Number(e.target.value))}
                            className="w-full accent-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Angle</label>
                          <select
                            value={wmRotation}
                            onChange={(e) => setWmRotation(Number(e.target.value))}
                            className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                          >
                            <option value={0}>0° Horizontal</option>
                            <option value={45}>45° Diagonal</option>
                            <option value={90}>90° Vertical</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Color</label>
                          <select
                            value={wmColor}
                            onChange={(e) => setWmColor(e.target.value as any)}
                            className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                          >
                            <option value="gray">Gray</option>
                            <option value="red">Red</option>
                            <option value="blue">Blue</option>
                            <option value="black">Black</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Position</label>
                          <select
                            value={wmPosition}
                            onChange={(e) => setWmPosition(e.target.value as any)}
                            className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                          >
                            <option value="center">Center</option>
                            <option value="top">Top Header</option>
                            <option value="bottom">Bottom Footer</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <input
                          type="file"
                          ref={wmImageInputRef}
                          onChange={(e) => e.target.files?.[0] && setWmImageFile(e.target.files[0])}
                          accept="image/png, image/jpeg"
                          className="hidden"
                        />
                        <button
                          onClick={() => wmImageInputRef.current?.click()}
                          className="w-full py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          {wmImageFile ? wmImageFile.name : 'Upload Logo (PNG/JPG)'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Opacity ({Math.round(wmOpacity * 100)}%)</label>
                          <input
                            type="range"
                            min={0.1}
                            max={1.0}
                            step={0.05}
                            value={wmOpacity}
                            onChange={(e) => setWmOpacity(Number(e.target.value))}
                            className="w-full accent-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Position</label>
                          <select
                            value={wmPosition}
                            onChange={(e) => setWmPosition(e.target.value as any)}
                            className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                          >
                            <option value="center">Center</option>
                            <option value="top">Top Header</option>
                            <option value="bottom">Bottom Footer</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={executeAddWatermark}
              disabled={!wmFile || (wmType === 'image' && !wmImageFile) || isProcessing}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-blue-500 to-indigo-650 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Droplets className="w-4 h-4" />}
              <span>{isProcessing ? progressMsg : 'Apply Watermark'}</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
