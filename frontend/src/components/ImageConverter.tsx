import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  RefreshCw, 
  Download, 
  HelpCircle, 
  ArrowRight,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

import confetti from 'canvas-confetti';
import { useToast } from '../hooks/useToast';
import { StorageService } from '../services/storage.service';
import { HistoryService } from '../services/history.service';
import { ToastContainer } from './ui/Toast';
import { downloadBlob, buildConvertedFilename } from '../utils/download';
import { BACKEND_API_URL } from '../constants';

interface ImageConverterProps {
  initialFile?: File | null;
  clearInitialFile?: () => void;
}

interface ConvertedResult {
  originalName: string;
  originalFormat: string;
  targetFormat: string;
  convertedUrl: string;
  convertedBlob: Blob;
  size: number;
}

export default function ImageConverter({ initialFile, clearInitialFile }: ImageConverterProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [targetFormat, setTargetFormat] = useState<string>('webp');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [results, setResults] = useState<ConvertedResult[]>([]);
  const [conversionProgress, setConversionProgress] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toasts, showSuccess, showError, dismiss } = useToast();

  useEffect(() => {
    if (initialFile) {
      setFiles([initialFile]);
      setResults([]);
      if (clearInitialFile) clearInitialFile();
    }
  }, [initialFile, clearInitialFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
      setResults([]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(Array.from(e.dataTransfer.files));
      setResults([]);
    }
  };

  const convertImageToFormat = async (file: File, target: string): Promise<ConvertedResult> => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    setConversionProgress(`Converting "${file.name}" to ${target.toUpperCase()}...`);

    // 1. Attempt Backend Conversion first (supports all formats including AVIF, HEIC, TIFF, BMP)
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetFormat', target);
      formData.append('quality', '90');

      const res = await fetch(`${BACKEND_API_URL}/convert-image`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const blob = await res.blob();
        return {
          originalName: file.name,
          originalFormat: ext,
          targetFormat: target,
          convertedUrl: URL.createObjectURL(blob),
          convertedBlob: blob,
          size: blob.size
        };
      }
      console.warn('Backend conversion responded with error, falling back to client-side if possible');
    } catch (backendErr) {
      console.warn('Backend server is offline or unreachable. Falling back to client-side if possible:', backendErr);
    }

    // 2. Client-side browser fallback (limited to WebP, JPEG, PNG, PDF)
    const browserSupportedTargets = ['webp', 'jpg', 'jpeg', 'png', 'pdf'];
    if (!browserSupportedTargets.includes(target.toLowerCase())) {
      throw new Error(`Converting to ${target.toUpperCase()} requires the backend server. Please make sure the backend is running.`);
    }

    let sourceBlob: Blob = file;
    // Check for HEIC format and convert client-side if possible
    if (ext === 'heic' || file.type === 'image/heic') {
      setConversionProgress(`Converting HEIC image "${file.name}" to JPG first...`);
      try {
        const { default: heic2any } = await import('heic2any');
        const heicResult = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.9
        });
        sourceBlob = Array.isArray(heicResult) ? heicResult[0] : heicResult;
      } catch (heicErr) {
        throw new Error(`Failed to convert HEIC client-side: ${heicErr}. Make sure the backend server is running.`);
      }
    }

    setConversionProgress(`Converting "${file.name}" to ${target.toUpperCase()} (Client-Side)...`);

    // Load source image
    const imgUrl = URL.createObjectURL(sourceBlob);
    const img = new Image();
    img.src = imgUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Failed to load image file source.'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas rendering failed');
    ctx.drawImage(img, 0, 0);

    let outputBlob: Blob | null = null;
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp'
    };

    if (target === 'pdf') {
      // Direct JPG export, then package to PDF
      const tempJpgBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
      });
      if (!tempJpgBlob) throw new Error('PDF packaging intermediate conversion failed');
      
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([img.width, img.height]);
      const arrayBuffer = await tempJpgBlob.arrayBuffer();
      const embeddedJpg = await pdfDoc.embedJpg(arrayBuffer);
      
      page.drawImage(embeddedJpg, {
        x: 0,
        y: 0,
        width: img.width,
        height: img.height
      });
      
      const pdfBytes = await pdfDoc.save();
      outputBlob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    } else {
      const mime = mimeMap[target] || 'image/jpeg';
      outputBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), mime, 0.9);
      });
    }

    if (!outputBlob) throw new Error('Conversion canvas failed to serialize output');

    return {
      originalName: file.name,
      originalFormat: ext || 'unknown',
      targetFormat: target,
      convertedUrl: URL.createObjectURL(outputBlob),
      convertedBlob: outputBlob,
      size: outputBlob.size
    };
  };

  const handleConvert = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setConversionProgress('Initializing...');
    setResults([]);

    try {
      const list: ConvertedResult[] = [];
      for (const file of files) {
        const item = await convertImageToFormat(file, targetFormat);
        list.push(item);
      }
      setResults(list);
      setConversionProgress('');

      StorageService.updateStats(files.length, 0);
      list.forEach(r => HistoryService.addConversionEntry(r));

      showSuccess(
        `${list.length} file${list.length > 1 ? 's' : ''} converted!`,
        `All converted to ${targetFormat.toUpperCase()}.`
      );

      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    } catch (e: any) {
      console.error(e);
      showError('Conversion failed', e?.message ?? 'Ensure all files are valid images.');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadFile = (res: ConvertedResult) => {
    downloadBlob(res.convertedBlob, buildConvertedFilename(res.originalName, res.targetFormat));
  };

  const downloadAll = () => {
    results.forEach(res => downloadFile(res));
  };

  const getFriendlySize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Format Converter</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Convert JPG, PNG, WebP, SVG, HEIC, AVIF, TIFF, BMP images into WebP, JPG, PNG, PDF, AVIF, HEIC, or TIFF formats.</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {['webp', 'jpg', 'png', 'pdf', 'avif', 'heic', 'tiff'].map((fmt) => (
            <button 
              key={fmt}
              onClick={() => setTargetFormat(fmt)}
              className={`px-4 py-2 text-xs font-semibold uppercase rounded-xl transition-all border ${
                targetFormat === fmt 
                  ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/20' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input panel */}
        <div className="lg:col-span-4 space-y-6">
          <div 
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6"
          >
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Input Files ({files.length})
            </h3>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept="image/*,.heic"
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-violet-500 dark:hover:border-violet-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors"
            >
              <Upload className="w-4 h-4 text-violet-500" />
              <span>Select Files to Convert</span>
            </button>

            {files.length > 0 && (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 text-xs">
                    <span className="truncate font-semibold text-slate-700 dark:text-slate-300 max-w-[180px]">{file.name}</span>
                    <span className="text-[10px] text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ))}
              </div>
            )}

            <button 
              onClick={handleConvert}
              disabled={files.length === 0 || isProcessing}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 text-white shadow-lg ${
                files.length === 0 
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed' 
                  : isProcessing 
                    ? 'bg-violet-500 cursor-wait' 
                    : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-violet-600/10'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Converting...</span>
                </>
              ) : (
                <>
                  <span>Convert to {targetFormat.toUpperCase()}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {isProcessing && conversionProgress && (
              <div className="text-[10px] text-violet-600 dark:text-violet-400 text-center animate-pulse">
                {conversionProgress}
              </div>
            )}
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-8">
          {results.length > 0 ? (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-md font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Converted Outputs ({results.length})</span>
                </h3>
                {results.length > 1 && (
                  <button 
                    onClick={downloadAll}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download All</span>
                  </button>
                )}
              </div>

              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                {results.map((res, i) => (
                  <div 
                    key={i} 
                    className="flex flex-col md:flex-row items-center justify-between border border-slate-100 dark:border-slate-800/80 rounded-xl p-4 bg-white/20 dark:bg-slate-950/20 gap-4"
                  >
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-900 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-800">
                        {res.targetFormat === 'pdf' ? (
                          <FileText className="w-6 h-6 text-red-500" />
                        ) : (
                          <img 
                            src={res.convertedUrl} 
                            alt="preview" 
                            className="max-w-full max-h-full object-contain"
                          />
                        )}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[200px] md:max-w-[280px]">
                          {res.originalName}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex gap-2">
                          <span className="uppercase">{res.originalFormat}</span>
                          <span>→</span>
                          <span className="uppercase font-bold text-violet-600">{res.targetFormat}</span>
                          <span>•</span>
                          <span>{getFriendlySize(res.size)}</span>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => downloadFile(res)}
                      className="w-full md:w-auto px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[380px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/20 dark:bg-slate-900/20 glass-panel flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-4">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Converted layout is empty</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
                Add one or more images, choose a target output format, and trigger conversion. HEIC files will convert automatically.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
