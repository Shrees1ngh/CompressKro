import { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { loadPdfJs } from '../../utils/pdfLoader';

interface PDFPreviewProps {
  file: File | Blob | null;
}

export function PDFPreview({ file }: PDFPreviewProps) {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const canvasesRef = useRef<(HTMLCanvasElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load PDF document
  useEffect(() => {
    if (!file) {
      setPdfDoc(null);
      setTotalPages(0);
      setCurrentPageNum(1);
      return;
    }

    let active = true;
    setIsLoading(true);
    const objectUrl = URL.createObjectURL(file);

    (async () => {
      try {
        const pdfjsLib = await loadPdfJs();
        const doc = await pdfjsLib.getDocument(objectUrl).promise;
        if (active) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setCurrentPageNum(1);
          setIsLoading(false);
        } else {
          await doc.destroy();
        }
      } catch (err) {
        console.error('Error loading PDF in preview:', err);
        if (active) {
          setPdfDoc(null);
          setTotalPages(0);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  // Render pages
  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return;

    let active = true;
    const tasks: any[] = [];

    (async () => {
      // Clear canvases array sizes
      canvasesRef.current = canvasesRef.current.slice(0, totalPages);

      for (let i = 1; i <= totalPages; i++) {
        if (!active) break;
        try {
          const page = await pdfDoc.getPage(i);
          // Standard preview card scale
          const viewport = page.getViewport({ scale: 0.95 });
          const canvas = canvasesRef.current[i - 1];
          if (!canvas) continue;

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          const renderTask = page.render({ canvasContext: ctx, viewport });
          tasks.push(renderTask);
          await renderTask.promise;
        } catch (err) {
          console.warn(`Preview page ${i} rendering error:`, err);
        }
      }
    })();

    return () => {
      active = false;
      tasks.forEach((t) => {
        try {
          t.cancel();
        } catch (_) {}
      });
    };
  }, [pdfDoc, totalPages]);

  // Scroll sync page indicator
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container || !pdfDoc) return;

    const pageWrappers = container.querySelectorAll('.pdf-page-wrapper');
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
    if (currentPageNum !== newPageNum) {
      setCurrentPageNum(newPageNum);
    }
  };

  const scrollToPage = (pageNum: number) => {
    const target = containerRef.current?.querySelectorAll('.pdf-page-wrapper')[pageNum - 1];
    target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setCurrentPageNum(pageNum);
  };

  if (!file) {
    return (
      <div className="w-full h-full min-h-[460px] bg-white/40 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed flex flex-col items-center justify-center p-6 text-center">
        <span className="text-slate-400 dark:text-slate-500 text-xs">No PDF uploaded yet</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full h-full min-h-[460px] bg-white/40 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        <span className="text-slate-400 dark:text-slate-500 text-xs mt-2">Loading document preview...</span>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel flex flex-col gap-3 h-full">
      <div className="flex justify-between items-center w-full pb-2 border-b border-slate-200/50 dark:border-slate-800/50">
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-sans">Document Preview</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => scrollToPage(Math.max(1, currentPageNum - 1))}
              disabled={currentPageNum <= 1}
              className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
              Page {currentPageNum} of {totalPages}
            </span>
            <button
              onClick={() => scrollToPage(Math.min(totalPages, currentPageNum + 1))}
              disabled={currentPageNum >= totalPages}
              className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Scrollable PDF container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex flex-col items-center bg-slate-900/10 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 overflow-y-auto max-h-[500px] gap-6 relative select-none w-full scroll-smooth"
      >
        <div className="space-y-6 w-full flex flex-col items-center">
          {Array.from({ length: totalPages }).map((_, index) => (
            <div
              key={index}
              onClick={() => scrollToPage(index + 1)}
              className={`relative shadow-md rounded bg-white border pdf-page-wrapper transition-all duration-200 cursor-pointer ${
                currentPageNum === index + 1
                  ? 'border-violet-500 ring-2 ring-violet-500/20'
                  : 'border-slate-300 dark:border-slate-800 hover:border-slate-500'
              }`}
              style={{ width: 'fit-content' }}
            >
              <canvas
                ref={(el) => {
                  canvasesRef.current[index] = el;
                }}
                className="block max-w-full h-auto rounded"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PDFPreview;
