// ============================================================
// CompressKro — PDF Center Canvas Component
// Pure center canvas for the workspace shell. Shows PDF page
// thumbnails + main page preview with zoom controls.
// Reads the active file(s) from PdfWorkspaceContext.
// ============================================================

import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
  Upload,
  FileText,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Trash2,
  Globe,
} from 'lucide-react';
import { loadPdfJs } from '../../utils/pdfLoader';
import { usePdfWorkspace } from '../../context/PdfWorkspaceContext';
import { getFriendlySize } from '../../utils/format';

export function PdfCenterCanvas() {
  const location = useLocation();
  const {
    activeFile,
    activeFileName,
    activeFileSize,
    activeFiles,
    fileUpdatedIndicator,
    setActiveFile,
    addActiveFiles,
    removeActiveFile,
    reorderActiveFiles,
  } = usePdfWorkspace();

  const isImagesToPdf = location.pathname === '/images-to-pdf';
  const isMergePdf = location.pathname === '/merge-pdf';
  const isMultiFile = isImagesToPdf || isMergePdf;

  // PDF.js rendering state
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [zoom, setZoom] = useState(1.0);

  // Drag-and-drop state
  const [isDragOver, setIsDragOver] = useState(false);

  // Refs
  const thumbnailCanvasesRef = useRef<(HTMLCanvasElement | null)[]>([]);
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Load PDF Document ──
  useEffect(() => {
    if (!activeFile) {
      setPdfDoc(null);
      setTotalPages(0);
      setCurrentPageNum(1);
      return;
    }

    let active = true;
    setIsLoading(true);
    const objectUrl = URL.createObjectURL(activeFile);

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
        console.error('Error loading PDF in workspace canvas:', err);
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
  }, [activeFile]);

  // ── Render Thumbnails ──
  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return;

    let active = true;
    const tasks: any[] = [];

    (async () => {
      thumbnailCanvasesRef.current = thumbnailCanvasesRef.current.slice(0, totalPages);
      for (let i = 1; i <= totalPages; i++) {
        if (!active) break;
        try {
          const page = await pdfDoc.getPage(i);
          const dpr = Math.min(window.devicePixelRatio || 1, 3);
          const viewport = page.getViewport({ scale: 0.18 });
          const renderVp = page.getViewport({ scale: 0.18 * dpr });
          const canvas = thumbnailCanvasesRef.current[i - 1];
          if (!canvas) continue;

          canvas.width = Math.floor(renderVp.width);
          canvas.height = Math.floor(renderVp.height);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          const renderTask = page.render({ canvasContext: ctx, viewport: renderVp });
          tasks.push(renderTask);
          await renderTask.promise;
        } catch (err) {
          console.warn(`Thumbnail rendering error for page ${i}:`, err);
        }
      }
    })();

    return () => {
      active = false;
      tasks.forEach((t) => {
        try { t.cancel(); } catch (_) {}
      });
    };
  }, [pdfDoc, totalPages]);

  // ── Render Main Page Preview ──
  useEffect(() => {
    if (!pdfDoc) return;

    let active = true;
    let renderTask: any = null;

    (async () => {
      try {
        const page = await pdfDoc.getPage(currentPageNum);
        const canvas = mainCanvasRef.current;
        if (!canvas || !active) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const viewport = page.getViewport({ scale: 0.85 * zoom });
        const renderVp = page.getViewport({ scale: 0.85 * zoom * dpr });
        canvas.width = Math.floor(renderVp.width);
        canvas.height = Math.floor(renderVp.height);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const ctx = canvas.getContext('2d');
        if (!ctx || !active) return;

        renderTask = page.render({ canvasContext: ctx, viewport: renderVp });
        await renderTask.promise;
      } catch (err) {
        console.warn(`Main canvas rendering error for page ${currentPageNum}:`, err);
      }
    })();

    return () => {
      active = false;
      if (renderTask) {
        try { renderTask.cancel(); } catch (_) {}
      }
    };
  }, [pdfDoc, currentPageNum, zoom]);

  // ── Zoom controls ──
  const zoomIn = () => setZoom(prev => Math.min(2.0, prev + 0.15));
  const zoomOut = () => setZoom(prev => Math.max(0.5, prev - 0.15));
  const resetZoom = () => setZoom(1.0);

  // ── Upload handlers ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (isMultiFile) {
        addActiveFiles(Array.from(e.target.files));
      } else {
        const f = e.target.files[0];
        setActiveFile(f, f.name, f.size);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      if (isImagesToPdf) {
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          addActiveFiles(imageFiles);
        }
      } else if (isMergePdf) {
        const pdfFiles = files.filter(f => f.type === 'application/pdf');
        if (pdfFiles.length > 0) {
          addActiveFiles(pdfFiles);
        }
      } else {
        const f = files[0];
        if (f.type === 'application/pdf') {
          setActiveFile(f, f.name, f.size);
        }
      }
    }
  };

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--ck-bg-cream)]">
        <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
        <span className="text-xs font-bold text-[var(--ck-text-muted)] mt-3">Loading PDF pages...</span>
      </div>
    );
  }

  // ── Multi-file list layout (for Merge & Images to PDF) ──
  if (isMultiFile && activeFiles.length > 0) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-[var(--ck-bg-cream)] p-6 select-none">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={isImagesToPdf ? 'image/png, image/jpeg, image/jpg' : 'application/pdf'}
          multiple
          className="hidden"
        />
        <div className="flex justify-between items-center mb-5 flex-shrink-0">
          <div>
            <h3 className="text-xs font-black text-[var(--ck-text-primary)] uppercase tracking-wider">
              {isImagesToPdf ? 'Images in compilation queue' : 'PDFs in merge queue'}
            </h3>
            <span className="text-[10px] text-[var(--ck-text-muted)] font-bold">
              {activeFiles.length} file(s) loaded · Reorder or remove as needed
            </span>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-750 hover:scale-[1.02] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Add More Files</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto thin-scrollbar space-y-3 pr-1">
          {activeFiles.map((file, idx) => {
            const isImage = file.blob.type.startsWith('image/');
            const previewSrc = isImage ? URL.createObjectURL(file.blob) : null;

            return (
              <div
                key={file.id}
                className="flex items-center justify-between p-4 bg-[var(--ck-bg-card)] border border-[var(--ck-border)] rounded-2xl shadow-sm hover:border-[var(--ck-border-hover)] transition-all animate-fade-in"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-16 rounded-lg bg-slate-105 dark:bg-slate-900 border border-[var(--ck-border)] flex items-center justify-center overflow-hidden flex-shrink-0 bg-white">
                    {isImage && previewSrc ? (
                      <img
                        src={previewSrc}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        onLoad={() => {
                          if (previewSrc) URL.revokeObjectURL(previewSrc);
                        }}
                      />
                    ) : (
                      <FileText className="w-6 h-6 text-rose-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--ck-text-primary)] truncate max-w-[280px] lg:max-w-[400px]">
                      {file.name}
                    </div>
                    <div className="text-[10px] text-[var(--ck-text-muted)] font-bold mt-1 uppercase tracking-wider font-mono">
                      {getFriendlySize(file.size)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => reorderActiveFiles('up', idx)}
                    disabled={idx === 0}
                    className="p-2 rounded-lg border border-[var(--ck-border)] bg-[var(--ck-bg-card)] text-[var(--ck-text-muted)] hover:text-violet-600 disabled:opacity-30 cursor-pointer transition-colors"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => reorderActiveFiles('down', idx)}
                    disabled={idx === activeFiles.length - 1}
                    className="p-2 rounded-lg border border-[var(--ck-border)] bg-[var(--ck-bg-card)] text-[var(--ck-text-muted)] hover:text-violet-600 disabled:opacity-30 cursor-pointer transition-colors"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeActiveFile(file.id)}
                    className="p-2 rounded-lg border border-[var(--ck-border)] bg-[var(--ck-bg-card)] text-red-500 hover:text-white hover:bg-red-500 cursor-pointer transition-all"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── No file loaded: show upload zone ──
  const isLoaded = isMultiFile ? activeFiles.length > 0 : !!activeFile;
  if (!isLoaded) {
    if (location.pathname === '/html-to-pdf') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[var(--ck-bg-cream)] p-8">
          <div className="w-full max-w-md min-h-[280px] border-2 border-dashed border-[var(--ck-border)] bg-[var(--ck-bg-card)] rounded-3xl flex flex-col items-center justify-center p-8 text-center select-none">
            <div className="p-4 rounded-full bg-pink-550/10 text-pink-600 dark:text-pink-400 mb-4 bg-pink-50 dark:bg-pink-950/20">
              <Globe className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-[var(--ck-text-primary)] text-sm">
              HTML to PDF Generator
            </h3>
            <p className="text-xs text-[var(--ck-text-muted)] mt-1.5 max-w-[280px] leading-relaxed font-semibold">
              Enter your HTML code markup or target website URL in the right options panel, then click "Convert to PDF" to generate and display the document here.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--ck-bg-cream)] p-8">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={isImagesToPdf ? 'image/png, image/jpeg, image/jpg' : 'application/pdf'}
          multiple={isMultiFile}
          className="hidden"
        />
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full max-w-md min-h-[280px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-8 text-center cursor-pointer transition-all duration-300 ${
            isDragOver
              ? 'border-violet-500 bg-violet-500/5 scale-[0.99]'
              : 'border-[var(--ck-border)] bg-[var(--ck-bg-card)] hover:border-[var(--ck-border-hover)]'
          }`}
        >
          <div className="p-4 rounded-full bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 mb-4">
            <Upload className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-[var(--ck-text-primary)] text-sm">
            {isImagesToPdf ? 'Drag & Drop PNG/JPG Images here' : 'Drag & Drop PDF here'}
          </h3>
          <p className="text-xs text-[var(--ck-text-muted)] mt-1.5 max-w-[280px] leading-relaxed font-semibold">
            {isImagesToPdf
              ? 'or click to browse your files. Add multiple images to compile them into a single PDF.'
              : 'or click to browse your files. Select a tool from the sidebar, then upload a PDF to get started.'}
          </p>
        </div>
      </div>
    );
  }

  // ── Single file loaded: show canvas ──
  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 bg-[var(--ck-bg-cream)]">
      {/* Thumbnail Pane */}
      <div className="w-full lg:w-[120px] bg-[var(--ck-bg-card)] border-b lg:border-b-0 lg:border-r border-[var(--ck-border)] flex lg:flex-col gap-3 p-2.5 flex-shrink-0 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto thin-scrollbar">
        <span className="hidden lg:block text-[9px] font-bold text-[var(--ck-text-muted)] uppercase tracking-widest pb-1 border-b border-[var(--ck-border)]">
          Pages
        </span>
        <div className="flex flex-row lg:flex-col gap-3 items-center">
          {Array.from({ length: totalPages }).map((_, index) => {
            const pageNum = index + 1;
            const isSelected = currentPageNum === pageNum;
            return (
              <button
                key={index}
                onClick={() => setCurrentPageNum(pageNum)}
                className="relative flex-shrink-0 flex flex-col items-center group cursor-pointer"
              >
                <div
                  className={`p-0.5 bg-[var(--ck-bg-muted)] rounded border transition-all ${
                    isSelected
                      ? 'border-violet-500 ring-2 ring-violet-500/10 scale-105'
                      : 'border-[var(--ck-border)] group-hover:border-[var(--ck-border-hover)]'
                  }`}
                >
                  <canvas
                    ref={(el) => {
                      thumbnailCanvasesRef.current[index] = el;
                    }}
                    className="w-[70px] h-[98px] object-contain rounded"
                  />
                </div>
                <span
                  className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center border shadow-sm ${
                    isSelected
                      ? 'bg-violet-600 border-violet-500 text-white'
                      : 'bg-[var(--ck-bg-card)] border-[var(--ck-border)] text-[var(--ck-text-muted)]'
                  }`}
                >
                  {pageNum}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 p-4 flex flex-col items-center justify-center min-h-[250px] lg:min-h-0 relative select-none">
        {/* File info bar */}
        <div className="absolute top-3 left-3 flex items-center gap-2 z-20">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--ck-bg-card)]/90 dark:bg-slate-900/90 border border-[var(--ck-border)] backdrop-blur-md rounded-full shadow-sm">
            <FileText className="w-3 h-3 text-violet-600" />
            <span className="text-[10px] font-bold text-[var(--ck-text-primary)] max-w-[180px] truncate">
              {activeFileName}
            </span>
            <span className="text-[9px] font-bold text-[var(--ck-text-muted)] font-mono">
              {getFriendlySize(activeFileSize)}
            </span>
          </div>
          {/* "File updated ✓" indicator */}
          {fileUpdatedIndicator && (
            <div className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-full animate-fade-in">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span className="text-[10px] font-bold text-emerald-600">File updated ✓</span>
            </div>
          )}
        </div>

        {/* Zoom controls */}
        <div className="absolute top-3 right-3 bg-[var(--ck-bg-card)]/90 dark:bg-slate-900/90 border border-[var(--ck-border)] backdrop-blur-md rounded-full shadow-sm px-3 py-1 flex items-center gap-3 z-30">
          <button
            onClick={zoomOut}
            disabled={zoom <= 0.5}
            className="p-1 rounded-full text-[var(--ck-text-muted)] hover:text-[var(--ck-text-primary)] hover:bg-[var(--ck-bg-muted)] disabled:opacity-30 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-bold text-[var(--ck-text-secondary)] font-mono w-9 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={zoom >= 2.0}
            className="p-1 rounded-full text-[var(--ck-text-muted)] hover:text-[var(--ck-text-primary)] hover:bg-[var(--ck-bg-muted)] disabled:opacity-30 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetZoom}
            className="p-1 rounded-full text-[var(--ck-text-muted)] hover:text-[var(--ck-text-primary)] hover:bg-[var(--ck-bg-muted)] cursor-pointer border-l border-[var(--ck-border)] pl-2 ml-1"
            title="Reset Fit"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Canvas display */}
        <div className="w-full h-full flex overflow-auto pt-16 pb-4 px-4 thin-scrollbar">
          <div className="m-auto workspace-page-shadow rounded bg-white border border-[var(--ck-border)] p-2 transform transition-transform duration-200">
            <canvas ref={mainCanvasRef} className="block max-w-full h-auto rounded" />
          </div>
        </div>

        {/* Page counter */}
        <div className="mt-1 text-[10px] text-[var(--ck-text-muted)] font-bold uppercase tracking-wider">
          Page {currentPageNum} of {totalPages}
        </div>
      </div>
    </div>
  );
}
