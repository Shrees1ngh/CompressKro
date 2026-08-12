// ============================================================
// CompressKro — Crop PDF Page Component
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { Crop, RefreshCw } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { loadPdfJs } from '../../utils/pdfLoader';
import { usePdfWorkspace } from '../../context/PdfWorkspaceContext';
import { PdfTaskCompleted } from '../../components/PdfWorkspaceShell/PdfTaskCompleted';
import { HowToUse } from '../../components/ui/HowToUse';

export function CropPdf() {
  const [pdfFile, setPdfFile] = useState<{ name: string; size: number; blob: File } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  
  // Crop margins in percentage (0 to 50%)
  const [cropLeft, setCropLeft] = useState<number>(10);
  const [cropRight, setCropRight] = useState<number>(10);
  const [cropTop, setCropTop] = useState<number>(10);
  const [cropBottom, setCropBottom] = useState<number>(10);

  const [previewUrl, setPreviewUrl] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { showSuccess, showError } = useToast();
  const { activeFile, activeFileName, activeFileSize, chainOutput, clearActiveFile } = usePdfWorkspace();
  const [loadedFileRef, setLoadedFileRef] = useState<File | Blob | null>(null);

  // Auto-load file from workspace context
  useEffect(() => {
    if (activeFile) {
      if (activeFile !== loadedFileRef) {
        setLoadedFileRef(activeFile);
        const f = activeFile instanceof File
          ? activeFile
          : new File([activeFile], activeFileName || 'document.pdf', { type: 'application/pdf' });
        processFile(f);
      }
    } else {
      setLoadedFileRef(null);
      setPdfFile(null);
      setPreviewUrl('');
      clearOutputs();
      setOutputBlob(null);
    }
  }, [activeFile, loadedFileRef]);

  const [activeDragMode, setActiveDragMode] = useState<string | null>(null);
  const startStateRef = useRef({ left: 0, right: 0, top: 0, bottom: 0, mouseX: 0, mouseY: 0 });

  const getCanvasMouseCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0, w: 0, h: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y, w: rect.width, h: rect.height };
  };

  const getDragMode = (x: number, y: number, w: number, h: number) => {
    const leftPx = (cropLeft / 100) * w;
    const rightPx = w - (cropRight / 100) * w;
    const topPx = (cropTop / 100) * h;
    const bottomPx = h - (cropBottom / 100) * h;
    const tolerance = 15;

    // Corner Checks
    if (Math.abs(x - leftPx) < tolerance && Math.abs(y - topPx) < tolerance) return 'topLeft';
    if (Math.abs(x - rightPx) < tolerance && Math.abs(y - topPx) < tolerance) return 'topRight';
    if (Math.abs(x - leftPx) < tolerance && Math.abs(y - bottomPx) < tolerance) return 'bottomLeft';
    if (Math.abs(x - rightPx) < tolerance && Math.abs(y - bottomPx) < tolerance) return 'bottomRight';

    // Edge Checks
    if (Math.abs(x - leftPx) < tolerance && y >= topPx - tolerance && y <= bottomPx + tolerance) return 'left';
    if (Math.abs(x - rightPx) < tolerance && y >= topPx - tolerance && y <= bottomPx + tolerance) return 'right';
    if (Math.abs(y - topPx) < tolerance && x >= leftPx - tolerance && x <= rightPx + tolerance) return 'top';
    if (Math.abs(y - bottomPx) < tolerance && x >= leftPx - tolerance && x <= rightPx + tolerance) return 'bottom';

    // Inside Check
    if (x > leftPx && x < rightPx && y > topPx && y < bottomPx) return 'move';

    return null;
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeDragMode) return; // ignore cursor update while dragging
    const { x, y, w, h } = getCanvasMouseCoords(e);
    const mode = getDragMode(x, y, w, h);
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (mode === 'topLeft' || mode === 'bottomRight') {
      canvas.style.cursor = 'nwse-resize';
    } else if (mode === 'topRight' || mode === 'bottomLeft') {
      canvas.style.cursor = 'nesw-resize';
    } else if (mode === 'left' || mode === 'right') {
      canvas.style.cursor = 'ew-resize';
    } else if (mode === 'top' || mode === 'bottom') {
      canvas.style.cursor = 'ns-resize';
    } else if (mode === 'move') {
      canvas.style.cursor = 'move';
    } else {
      canvas.style.cursor = 'default';
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y, w, h } = getCanvasMouseCoords(e);
    const mode = getDragMode(x, y, w, h);
    if (mode) {
      e.preventDefault();
      setActiveDragMode(mode);
      startStateRef.current = {
        left: cropLeft,
        right: cropRight,
        top: cropTop,
        bottom: cropBottom,
        mouseX: e.clientX,
        mouseY: e.clientY
      };
    }
  };

  useEffect(() => {
    if (!activeDragMode || !canvasRef.current) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const deltaX = ((e.clientX - startStateRef.current.mouseX) / rect.width) * 100;
      const deltaY = ((e.clientY - startStateRef.current.mouseY) / rect.height) * 100;

      const start = startStateRef.current;
      const limit = (val: number) => Math.max(0, Math.min(45, Math.round(val)));

      if (activeDragMode === 'topLeft') {
        setCropLeft(limit(start.left + deltaX));
        setCropTop(limit(start.top + deltaY));
      } else if (activeDragMode === 'topRight') {
        setCropRight(limit(start.right - deltaX));
        setCropTop(limit(start.top + deltaY));
      } else if (activeDragMode === 'bottomLeft') {
        setCropLeft(limit(start.left + deltaX));
        setCropBottom(limit(start.bottom - deltaY));
      } else if (activeDragMode === 'bottomRight') {
        setCropRight(limit(start.right - deltaX));
        setCropBottom(limit(start.bottom - deltaY));
      } else if (activeDragMode === 'left') {
        setCropLeft(limit(start.left + deltaX));
      } else if (activeDragMode === 'right') {
        setCropRight(limit(start.right - deltaX));
      } else if (activeDragMode === 'top') {
        setCropTop(limit(start.top + deltaY));
      } else if (activeDragMode === 'bottom') {
        setCropBottom(limit(start.bottom - deltaY));
      } else if (activeDragMode === 'move') {
        const shiftX = deltaX;
        const shiftY = deltaY;
        
        let newLeft = start.left + shiftX;
        let newRight = start.right - shiftX;
        let newTop = start.top + shiftY;
        let newBottom = start.bottom - shiftY;

        if (newLeft >= 0 && newRight >= 0 && newLeft + newRight < 90) {
          setCropLeft(Math.round(newLeft));
          setCropRight(Math.round(newRight));
        }
        if (newTop >= 0 && newBottom >= 0 && newTop + newBottom < 90) {
          setCropTop(Math.round(newTop));
          setCropBottom(Math.round(newBottom));
        }
      }
    };

    const handleWindowMouseUp = () => {
      setActiveDragMode(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [activeDragMode, cropBottom, cropLeft, cropRight, cropTop]);

  const processFile = async (file: File) => {
    setPdfFile({ name: file.name, size: file.size, blob: file });
    clearOutputs();
    setOutputBlob(null);
    setIsProcessing(true);
    setProgressMsg('Rendering preview...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await loadPdfJs();
      const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdfjsDoc.getPage(1);
      
      const viewport = page.getViewport({ scale: 0.5 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        setPreviewUrl(canvas.toDataURL('image/jpeg', 0.85));
      }
    } catch (err: any) {
      console.error(err);
      showError('Preview failed', 'Could not render page preview from PDF.');
      setPdfFile(null);
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // Draw preview grid on adjust
  useEffect(() => {
    if (previewUrl && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Draw crop guides
        const w = img.width;
        const h = img.height;
        const x1 = (cropLeft / 100) * w;
        const y1 = (cropTop / 100) * h;
        const x2 = w - (cropRight / 100) * w;
        const y2 = h - (cropBottom / 100) * h;

        // Draw dark overlay outside crop box
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        // Top
        ctx.fillRect(0, 0, w, y1);
        // Bottom
        ctx.fillRect(0, y2, w, h - y2);
        // Left
        ctx.fillRect(0, y1, x1, y2 - y1);
        // Right
        ctx.fillRect(x2, y1, w - x2, y2 - y1);

        // Draw border line
        ctx.strokeStyle = '#8b5cf6'; // Violet boundary
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      };
      img.src = previewUrl;
    }
  }, [previewUrl, cropLeft, cropRight, cropTop, cropBottom]);

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  const executeCrop = async () => {
    if (!pdfFile) return;
    setIsProcessing(true);
    setProgressMsg('Trimming document pages...');

    try {
      const arrayBuffer = await pdfFile.blob.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      for (const page of pages) {
        const { width, height } = page.getSize();

        const x = (cropLeft / 100) * width;
        const y = (cropBottom / 100) * height;
        const w = width - ((cropLeft + cropRight) / 100) * width;
        const h = height - ((cropTop + cropBottom) / 100) * height;

        // Update crop boundaries
        page.setCropBox(x, y, w, h);
        page.setMediaBox(x, y, w, h);
      }

      const modifiedBytes = await pdfDoc.save();
      const outputBlob = new Blob([modifiedBytes as any], { type: 'application/pdf' });
      const outName = `cropped_${pdfFile.name}`;

      setOutputUrl(URL.createObjectURL(outputBlob));
      setOutputSize(outputBlob.size);
      setOutputName(outName);
      setOutputBlob(outputBlob);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Crop PDF', outName, outputBlob.size);

      // Chain output
      chainOutput(outputBlob, outName);

      showSuccess('PDF Cropped successfully!', `${outName} · ${getFriendlySize(outputBlob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err: any) {
      console.error(err);
      showError('Crop failed', err.message || 'Could not crop this PDF document.');
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
          originalSize={pdfFile?.size}
          outputBlob={outputBlob}
          onReset={() => {
            clearOutputs();
            setOutputBlob(null);
            clearActiveFile();
            setPreviewUrl('');
          }}
        />
      </div>
    );
  }

  if (!activeFile) {
    return (
      <HowToUse
        title="Crop PDF"
        icon={Crop}
        steps={[
          'Upload your PDF file using the center canvas upload zone.',
          'Adjust the crop margins on the right panel using the sliders, or drag the crop box boundaries directly.',
          'Click "Crop PDF Document" to generate and download the cropped file.'
        ]}
      />
    );
  }

  if (isProcessing && progressMsg === 'Rendering preview...') {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white/40 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 glass-panel shadow-sm">
        <RefreshCw className="w-6 h-6 animate-spin text-purple-500 mb-2" />
        <span className="text-xs font-bold text-slate-500">{progressMsg}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm animate-fade-in">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Crop className="w-4 h-4 text-purple-500" />
            <span>Trim Page View Boundaries</span>
          </h3>

          {previewUrl && !isProcessing && (
            <div className="space-y-4">
              <div className="flex flex-col justify-center items-center bg-slate-100 dark:bg-slate-950 p-4 rounded-xl relative">
                <div className="relative inline-block">
                  <canvas 
                    ref={canvasRef} 
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    className="max-w-full rounded-md shadow-md max-h-[220px] object-contain select-none" 
                  />
                </div>
                <div className="text-center text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-2 leading-relaxed">
                  💡 Drag boundaries or use sliders below
                </div>
              </div>

              <div className="space-y-3.5 pt-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350">Adjust Crop Margins (%)</h4>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold text-slate-400">
                    <span>Top Margin</span>
                    <span>{cropTop}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={cropTop}
                    onChange={(e) => setCropTop(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold text-slate-400">
                    <span>Bottom Margin</span>
                    <span>{cropBottom}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={cropBottom}
                    onChange={(e) => setCropBottom(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold text-slate-400">
                    <span>Left Margin</span>
                    <span>{cropLeft}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={cropLeft}
                    onChange={(e) => setCropLeft(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold text-slate-400">
                    <span>Right Margin</span>
                    <span>{cropRight}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={cropRight}
                    onChange={(e) => setCropRight(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              </div>

              <button
                onClick={executeCrop}
                className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-500 to-indigo-650 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer mt-4"
              >
                <Crop className="w-4 h-4" />
                <span>Crop PDF Document</span>
              </button>
            </div>
          )}

          {isProcessing && progressMsg !== 'Rendering preview...' && (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500 font-bold animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-500" />
              <span>{progressMsg}</span>
            </div>
          )}
        </div>
    </div>
  );
}
