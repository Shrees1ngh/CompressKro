// ============================================================
// CompressKro — Shared Compiled Output Viewer Component
// Renders full-size scrollable multi-page PDF stacked canvases
// with scroll navigation, or source PDF thumbnail previews for
// non-PDF outputs (Word, Excel, PPT) with format overlay badges.
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, FileText, Download, X, FileType, Table2 } from 'lucide-react';
import { loadPdfJs } from '../utils/pdfLoader';
import { getFriendlySize } from '../utils/format';

interface CompiledOutputViewProps {
  outputUrl: string;
  outputSize: number;
  outputName: string;
  onClear: () => void;
  /** Optional: pass the original PDF blob to render a source preview for non-PDF outputs */
  sourcePdfBlob?: Blob | null;
}

export function CompiledOutputView({
  outputUrl,
  outputSize,
  outputName,
  onClear,
  sourcePdfBlob,
}: CompiledOutputViewProps) {
  const [outputPdfDoc, setOutputPdfDoc] = useState<any>(null);
  const [outputCurrentPageNum, setOutputCurrentPageNum] = useState<number>(1);
  const [outputTotalPages, setOutputTotalPages] = useState<number>(0);

  // Source PDF preview state (for non-PDF outputs)
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string>('');
  const [sourceTotalPages, setSourceTotalPages] = useState<number>(0);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);

  const outputPageCanvasesRef = useRef<(HTMLCanvasElement | null)[]>([]);
  const outputViewerContainerRef = useRef<HTMLDivElement>(null);

  const isPdfOutput = outputName.toLowerCase().endsWith('.pdf');

  // Load compiled output PDF document via pdf.js (only for PDF outputs)
  useEffect(() => {
    if (outputUrl && isPdfOutput) {
      let active = true;
      (async () => {
        try {
          const pdfjsLib = await loadPdfJs();
          const doc = await pdfjsLib.getDocument(outputUrl).promise;
          if (active) {
            setOutputPdfDoc(doc);
            setOutputTotalPages(doc.numPages);
            setOutputCurrentPageNum(1);
          }
        } catch (err) {
          console.error('Error loading compiled output PDF for preview:', err);
          if (active) {
            setOutputPdfDoc(null);
          }
        }
      })();
      return () => {
        active = false;
      };
    } else {
      setOutputPdfDoc(null);
      setOutputTotalPages(0);
      setOutputCurrentPageNum(1);
    }
  }, [outputUrl, outputName]);

  // Render source PDF thumbnail for non-PDF outputs
  useEffect(() => {
    if (!isPdfOutput && sourcePdfBlob) {
      let active = true;
      let objectUrl = '';
      (async () => {
        try {
          const pdfjsLib = await loadPdfJs();
          objectUrl = URL.createObjectURL(sourcePdfBlob);
          setSourcePreviewUrl(objectUrl);
          const doc = await pdfjsLib.getDocument(objectUrl).promise;
          if (!active) { await doc.destroy(); return; }
          
          setSourceTotalPages(doc.numPages);
          
          // Render first page as a thumbnail
          const page = await doc.getPage(1);
          const viewport = page.getViewport({ scale: 0.7 });
          const canvas = sourceCanvasRef.current;
          if (canvas && active) {
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              await page.render({ canvasContext: ctx, viewport }).promise;
            }
          }
          await doc.destroy();
        } catch (err) {
          console.error('Error rendering source PDF thumbnail:', err);
        }
      })();
      return () => {
        active = false;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    } else {
      setSourcePreviewUrl('');
      setSourceTotalPages(0);
    }
  }, [sourcePdfBlob, isPdfOutput]);

  // Render ALL pages of compiled output PDF onto stacked canvases
  useEffect(() => {
    if (outputPdfDoc && outputTotalPages > 0) {
      let active = true;
      const tasks: any[] = [];

      (async () => {
        // Render each page sequentially onto its corresponding canvas
        for (let i = 1; i <= outputTotalPages; i++) {
          if (!active) break;
          try {
            const page = await outputPdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.85 }); // nice aspect ratio for preview card
            const canvas = outputPageCanvasesRef.current[i - 1];
            if (!canvas) continue;
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;
            const renderTask = page.render({ canvasContext: ctx, viewport });
            tasks.push(renderTask);
            await renderTask.promise;
          } catch (err) {
            console.warn(`Output page ${i} rendering error:`, err);
          }
        }
      })();

      return () => {
        active = false;
        tasks.forEach(t => {
          try { t.cancel(); } catch (_) {}
        });
      };
    }
  }, [outputPdfDoc, outputTotalPages]);

  // Sync output current page number dynamically when scrolling the compiled output PDF previewer
  const handleOutputViewerScroll = () => {
    const container = outputViewerContainerRef.current;
    if (!container || !outputPdfDoc) return;

    const pageWrappers = container.querySelectorAll('.pdf-output-page-wrapper');
    if (!pageWrappers.length) return;

    let closestPageIdx = 0;
    let minDistance = Infinity;
    const containerCenter = container.getBoundingClientRect().top + container.offsetHeight / 2;

    pageWrappers.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();
      const elCenter = rect.top + rect.height / 2;
      const distance = Math.abs(containerCenter - elCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestPageIdx = idx;
      }
    });

    const newPageNum = closestPageIdx + 1;
    if (outputCurrentPageNum !== newPageNum) {
      setOutputCurrentPageNum(newPageNum);
    }
  };

  const handleDownload = () => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = outputName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Determine format info for non-PDF outputs
  const getFormatInfo = () => {
    const ext = outputName.toLowerCase().split('.').pop();
    switch (ext) {
      case 'docx': return { label: 'Word Document', icon: FileType, color: 'blue', bgGradient: 'from-blue-500 to-indigo-600' };
      case 'xlsx': return { label: 'Excel Spreadsheet', icon: Table2, color: 'emerald', bgGradient: 'from-emerald-500 to-teal-600' };
      default: return { label: 'Document', icon: FileText, color: 'slate', bgGradient: 'from-slate-500 to-slate-600' };
    }
  };

  const getDownloadLabel = () => {
    const ext = outputName.toLowerCase().split('.').pop();
    switch (ext) {
      case 'docx': return 'Word Document';
      case 'xlsx': return 'Excel Sheet';
      case 'pdf': return 'PDF';
      default: return 'File';
    }
  };

  return (
    <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 relative">
      {/* Clear/Reset button */}
      <button 
        onClick={onClear}
        className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title="Start over"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800 pr-8">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <span className="text-md font-bold text-slate-800 dark:text-slate-200">Output Document Compiled</span>
        </div>
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{getFriendlySize(outputSize)}</span>
      </div>

      {/* Output Live stacked pages previewer / Source PDF thumbnail / fallback file card */}
      {outputPdfDoc ? (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900/10 dark:bg-slate-950/40 flex flex-col items-center gap-3">
          <div className="flex justify-between items-center w-full pb-2 border-b border-slate-200/50 dark:border-slate-800/50">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-sans">Live Document Preview</span>
            {outputTotalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const newPage = Math.max(1, outputCurrentPageNum - 1);
                    setOutputCurrentPageNum(newPage);
                    const target = outputViewerContainerRef.current?.querySelectorAll('.pdf-output-page-wrapper')[newPage - 1];
                    target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }}
                  disabled={outputCurrentPageNum <= 1}
                  className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                  Page {outputCurrentPageNum} of {outputTotalPages}
                </span>
                <button
                  onClick={() => {
                    const newPage = Math.min(outputTotalPages, outputCurrentPageNum + 1);
                    setOutputCurrentPageNum(newPage);
                    const target = outputViewerContainerRef.current?.querySelectorAll('.pdf-output-page-wrapper')[newPage - 1];
                    target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }}
                  disabled={outputCurrentPageNum >= outputTotalPages}
                  className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          
          {/* Real scrollable output stacked page viewer */}
          <div 
            ref={outputViewerContainerRef}
            onScroll={handleOutputViewerScroll}
            className="flex flex-col items-center bg-slate-900/60 dark:bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-y-auto max-h-[460px] gap-6 relative select-none w-full scroll-smooth"
          >
            <div className="space-y-6 w-full flex flex-col items-center">
              {Array.from({ length: outputTotalPages }).map((_, index) => (
                <div 
                  key={index}
                  onClick={() => setOutputCurrentPageNum(index + 1)}
                  className={`relative shadow-lg rounded bg-white border pdf-output-page-wrapper transition-all duration-200 cursor-pointer ${
                    outputCurrentPageNum === index + 1 
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                      : 'border-slate-300 dark:border-slate-800 hover:border-slate-500'
                  }`}
                  style={{ width: 'fit-content' }}
                >
                  <canvas 
                    ref={(el) => { outputPageCanvasesRef.current[index] = el; }} 
                    className="block max-w-full h-auto rounded" 
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : sourcePdfBlob ? (
        /* Source PDF thumbnail preview for non-PDF outputs */
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900/10 dark:bg-slate-950/40 flex flex-col items-center gap-4">
          <div className="flex justify-between items-center w-full pb-2 border-b border-slate-200/50 dark:border-slate-800/50">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-sans">Source Document Preview</span>
            {sourceTotalPages > 0 && (
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 font-mono">
                {sourceTotalPages} page{sourceTotalPages > 1 ? 's' : ''} converted
              </span>
            )}
          </div>

          <div className="relative group">
            {/* Source PDF first page thumbnail */}
            <div className="rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 shadow-lg bg-white">
              <canvas
                ref={sourceCanvasRef}
                className="block max-w-full max-h-[340px] h-auto"
              />
            </div>

            {/* Format overlay badge */}
            {(() => {
              const formatInfo = getFormatInfo();
              const IconComponent = formatInfo.icon;
              return (
                <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r ${formatInfo.bgGradient} shadow-lg shadow-${formatInfo.color}-500/30 flex items-center gap-1.5`}>
                  <IconComponent className="w-3.5 h-3.5 text-white" />
                  <span className="text-[11px] font-bold text-white whitespace-nowrap">{formatInfo.label}</span>
                </div>
              );
            })()}
          </div>

          {/* File info */}
          <div className="text-center pt-2">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 max-w-xs truncate">{outputName}</div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
              Converted from {sourceTotalPages} PDF page{sourceTotalPages > 1 ? 's' : ''} • {getFriendlySize(outputSize)}
            </div>
          </div>
        </div>
      ) : (
        /* Minimal fallback when no source PDF is available */
        <div className="flex flex-col items-center justify-center p-8 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-900/10 dark:bg-slate-950/40 text-center h-[240px] animate-fade-in">
          {(() => {
            const formatInfo = getFormatInfo();
            const IconComponent = formatInfo.icon;
            return (
              <>
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${formatInfo.bgGradient} flex items-center justify-center mb-4 shadow-lg`}>
                  <IconComponent className="w-8 h-8 text-white" />
                </div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 max-w-xs truncate">{outputName}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-medium">Ready for download • Size: {getFriendlySize(outputSize)}</div>
              </>
            );
          })()}
        </div>
      )}

      <button
        onClick={handleDownload}
        className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <Download className="w-4 h-4" />
        <span>Download {getDownloadLabel()}</span>
      </button>
    </div>
  );
}
