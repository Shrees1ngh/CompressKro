// ============================================================
// CompressKro — Add Signature Page Component
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  PenTool, 
  RefreshCw,
  Image as ImageIcon,
  Type,
  Eraser,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  FileText
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { loadPdfJs } from '../../utils/pdfLoader';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { CompiledOutputView } from '../../components/CompiledOutputView';
import type { PDFFileItem } from '../../types';

export function AddSignature() {
  const [signFile, setSignFile] = useState<PDFFileItem | null>(null);
  const [signPdfDoc, setSignPdfDoc] = useState<any>(null);
  const [signNumPages, setSignNumPages] = useState<number>(0);
  const [signCurrentPageNum, setSignCurrentPageNum] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');

  // Signature Configs
  const [signMode, setSignMode] = useState<'draw' | 'upload' | 'text' | 'stamp'>('draw');
  const [signText, setSignText] = useState<string>('');
  const [signTargetPage, setSignTargetPage] = useState<'current' | 'last' | 'first' | 'all' | 'custom'>('current');
  const [customPageRange, setCustomPageRange] = useState<string>('2,3');
  const [signPosX, setSignPosX] = useState<number>(75); // % from left
  const [signPosY, setSignPosY] = useState<number>(15); // % from bottom
  const [signScale, setSignScale] = useState<number>(0.25);
  const [signOpacity] = useState<number>(1.0);
  const [signColor, setSignColor] = useState<string>('#0f172a');
  const [signFontStyle, setSignFontStyle] = useState<'great-vibes' | 'dancing-script' | 'sacramento' | 'caveat' | 'playfair' | 'montserrat'>('dancing-script');
  const [signUnderline, setSignUnderline] = useState<boolean>(false);

  // Drawing Pad states
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hasSignatureDrawing, setHasSignatureDrawing] = useState<boolean>(false);
  const [sigPreviewUrl, setSigPreviewUrl] = useState<string>('');
  const [signImageFile, setSignImageFile] = useState<File | null>(null);

  // Stamp States
  const [includeStamp, setIncludeStamp] = useState<boolean>(false);
  const [stampImageFile, setStampImageFile] = useState<File | null>(null);
  const [stampPreviewUrl, setStampPreviewUrl] = useState<string>('');
  const [stampPosX, setStampPosX] = useState<number>(50); // % from left
  const [stampPosY, setStampPosY] = useState<number>(20); // % from bottom
  const [stampScale] = useState<number>(0.25);
  const [stampOpacity] = useState<number>(1.0);

  // Date States
  const [includeDate, setIncludeDate] = useState<boolean>(true);
  const [dateText, setDateText] = useState<string>(new Date().toLocaleDateString('en-GB'));
  const [dateColor] = useState<string>('#334155');
  const [dateFontSize] = useState<number>(12);
  const [datePosX, setDatePosX] = useState<number>(20); // % from left
  const [datePosY, setDatePosY] = useState<number>(15); // % from bottom

  // Selection states
  const [isSigSelected, setIsSigSelected] = useState<boolean>(false);
  const [isDateSelected, setIsDateSelected] = useState<boolean>(false);
  const [isStampSelected, setIsStampSelected] = useState<boolean>(false);

  // Drag states
  const [isDraggingSig, setIsDraggingSig] = useState<boolean>(false);
  const [isDraggingDate, setIsDraggingDate] = useState<boolean>(false);
  const [isDraggingStamp, setIsDraggingStamp] = useState<boolean>(false);

  // Drag offsets
  const sigDragOffset = useRef({ dx: 0, dy: 0 });
  const dateDragOffset = useRef({ dx: 0, dy: 0 });
  const stampDragOffset = useRef({ dx: 0, dy: 0 });

  // Refs
  const signInputRef = useRef<HTMLInputElement>(null);
  const signImageInputRef = useRef<HTMLInputElement>(null);
  const stampImageInputRef = useRef<HTMLInputElement>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigOverlayRef = useRef<HTMLDivElement>(null);
  const dateOverlayRef = useRef<HTMLDivElement>(null);
  const stampOverlayRef = useRef<HTMLDivElement>(null);
  const pdfPageContainerRef = useRef<HTMLDivElement>(null);
  const pageCanvasesRef = useRef<(HTMLCanvasElement | null)[]>([]);
  const docViewerContainerRef = useRef<HTMLDivElement>(null);

  const { showSuccess, showError } = useToast();

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  // Convert Font Key to standard CSS font family string
  const getSignFontFamily = (key: typeof signFontStyle) => {
    switch (key) {
      case 'dancing-script': return '"Dancing Script", cursive';
      case 'great-vibes': return '"Great Vibes", cursive';
      case 'sacramento': return '"Sacramento", cursive';
      case 'caveat': return '"Caveat", cursive';
      case 'playfair': return '"Playfair Display", serif';
      case 'montserrat': return '"Montserrat", sans-serif';
      default: return 'cursive';
    }
  };

  // Read File Select
  const handleSignFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      const item: PDFFileItem = { id: 'sign', name: f.name, size: f.size, blob: f };
      setSignFile(item);
      clearOutputs();
      try {
        const pdfjsLib = await loadPdfJs();
        const arrayBuf = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
        setSignPdfDoc(pdf);
        setSignNumPages(pdf.numPages);
        setSignCurrentPageNum(1);
      } catch (err) {
        console.error('Error rendering PDF for signature:', err);
      }
    }
  };

  // Render ALL PDF Pages onto stacked canvases sequentially
  useEffect(() => {
    if (signPdfDoc) {
      let active = true;
      const tasks: any[] = [];

      (async () => {
        for (let i = 1; i <= signNumPages; i++) {
          if (!active) break;
          try {
            const page = await signPdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 1.25 });
            const canvas = pageCanvasesRef.current[i - 1];
            if (!canvas) continue;
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;
            const renderTask = page.render({ canvasContext: ctx, viewport });
            tasks.push(renderTask);
            await renderTask.promise;
          } catch (err) {
            console.warn(`PDF page ${i} render error:`, err);
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
  }, [signPdfDoc, signNumPages]);

  // Sync current page number dynamically when scrolling the PDF pages vertically
  const handleViewerScroll = () => {
    const container = docViewerContainerRef.current;
    if (!container || !signPdfDoc) return;

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
    if (signCurrentPageNum !== newPageNum) {
      setSignCurrentPageNum(newPageNum);
    }
  };

  // Drawing Pad ink scale coordinates
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = signColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const { x, y } = getCanvasCoords(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignatureDrawing(true);
  };

  const stopDrawing = () => {
    if (isDrawing && sigCanvasRef.current) {
      setSigPreviewUrl(sigCanvasRef.current.toDataURL('image/png'));
    }
    setIsDrawing(false);
  };

  const clearSigCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignatureDrawing(false);
    setSigPreviewUrl('');
  };

  // Stamp preview generator
  useEffect(() => {
    if (includeStamp && stampImageFile) {
      const url = URL.createObjectURL(stampImageFile);
      setStampPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setStampPreviewUrl('');
    }
  }, [includeStamp, stampImageFile]);

  // Pointer Capture Drags
  const handleSigPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsSigSelected(true);
    setIsDateSelected(false);
    setIsStampSelected(false);
    const overlayEl = sigOverlayRef.current;
    if (overlayEl) {
      const overlayRect = overlayEl.getBoundingClientRect();
      sigDragOffset.current = {
        dx: e.clientX - overlayRect.left,
        dy: e.clientY - overlayRect.top,
      };
    }
    setIsDraggingSig(true);
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch (_) {}
  };

  const handleSigPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingSig || !sigOverlayRef.current) return;
    const canvas = pageCanvasesRef.current[signCurrentPageNum - 1];
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const overlayW = sigOverlayRef.current.offsetWidth;
    const overlayH = sigOverlayRef.current.offsetHeight;
    const newLeft = e.clientX - rect.left - sigDragOffset.current.dx;
    const newTop = e.clientY - rect.top - sigDragOffset.current.dy;
    const clampedLeft = Math.max(0, Math.min(rect.width - overlayW, newLeft));
    const clampedTop = Math.max(0, Math.min(rect.height - overlayH, newTop));
    const centerX = clampedLeft + overlayW / 2;
    const centerY = clampedTop + overlayH / 2;
    setSignPosX(Math.round((centerX / rect.width) * 100));
    setSignPosY(Math.round(((rect.height - centerY) / rect.height) * 100));
  };

  const handleSigPointerUp = (e: React.PointerEvent) => {
    if (isDraggingSig) {
      setIsDraggingSig(false);
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch (_) {}
    }
  };

  const handleDatePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDateSelected(true);
    setIsSigSelected(false);
    setIsStampSelected(false);
    const overlayEl = dateOverlayRef.current;
    if (overlayEl) {
      const overlayRect = overlayEl.getBoundingClientRect();
      dateDragOffset.current = {
        dx: e.clientX - overlayRect.left,
        dy: e.clientY - overlayRect.top,
      };
    }
    setIsDraggingDate(true);
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch (_) {}
  };

  const handleDatePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingDate || !dateOverlayRef.current) return;
    const canvas = pageCanvasesRef.current[signCurrentPageNum - 1];
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const overlayW = dateOverlayRef.current.offsetWidth;
    const overlayH = dateOverlayRef.current.offsetHeight;
    const newLeft = e.clientX - rect.left - dateDragOffset.current.dx;
    const newTop = e.clientY - rect.top - dateDragOffset.current.dy;
    const clampedLeft = Math.max(0, Math.min(rect.width - overlayW, newLeft));
    const clampedTop = Math.max(0, Math.min(rect.height - overlayH, newTop));
    const centerX = clampedLeft + overlayW / 2;
    const centerY = clampedTop + overlayH / 2;
    setDatePosX(Math.round((centerX / rect.width) * 100));
    setDatePosY(Math.round(((rect.height - centerY) / rect.height) * 100));
  };

  const handleDatePointerUp = (e: React.PointerEvent) => {
    if (isDraggingDate) {
      setIsDraggingDate(false);
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch (_) {}
    }
  };

  const handleStampPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsStampSelected(true);
    setIsSigSelected(false);
    setIsDateSelected(false);
    const overlayEl = stampOverlayRef.current;
    if (overlayEl) {
      const overlayRect = overlayEl.getBoundingClientRect();
      stampDragOffset.current = {
        dx: e.clientX - overlayRect.left,
        dy: e.clientY - overlayRect.top,
      };
    }
    setIsDraggingStamp(true);
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch (_) {}
  };

  const handleStampPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingStamp || !stampOverlayRef.current) return;
    const canvas = pageCanvasesRef.current[signCurrentPageNum - 1];
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const overlayW = stampOverlayRef.current.offsetWidth;
    const overlayH = stampOverlayRef.current.offsetHeight;
    const newLeft = e.clientX - rect.left - stampDragOffset.current.dx;
    const newTop = e.clientY - rect.top - stampDragOffset.current.dy;
    const clampedLeft = Math.max(0, Math.min(rect.width - overlayW, newLeft));
    const clampedTop = Math.max(0, Math.min(rect.height - overlayH, newTop));
    const centerX = clampedLeft + overlayW / 2;
    const centerY = clampedTop + overlayH / 2;
    setStampPosX(Math.round((centerX / rect.width) * 100));
    setStampPosY(Math.round(((rect.height - centerY) / rect.height) * 100));
  };

  const handleStampPointerUp = (e: React.PointerEvent) => {
    if (isDraggingStamp) {
      setIsDraggingStamp(false);
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch (_) {}
    }
  };

  const handlePageBackgroundClick = (e: React.MouseEvent) => {
    if (sigOverlayRef.current && sigOverlayRef.current.contains(e.target as Node)) return;
    if (dateOverlayRef.current && dateOverlayRef.current.contains(e.target as Node)) return;
    if (stampOverlayRef.current && stampOverlayRef.current.contains(e.target as Node)) return;
    setIsSigSelected(false);
    setIsDateSelected(false);
    setIsStampSelected(false);
  };

  // Keyboard nudge listener
  useEffect(() => {
    if (!isSigSelected && !isDateSelected && !isStampSelected) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 5 : 1;
      
      if (isSigSelected) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); setSignPosX(prev => Math.max(0, prev - step)); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); setSignPosX(prev => Math.min(100, prev + step)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSignPosY(prev => Math.min(100, prev + step)); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setSignPosY(prev => Math.max(0, prev - step)); }
      } else if (isDateSelected) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); setDatePosX(prev => Math.max(0, prev - step)); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); setDatePosX(prev => Math.min(100, prev + step)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setDatePosY(prev => Math.min(100, prev + step)); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setDatePosY(prev => Math.max(0, prev - step)); }
      } else if (isStampSelected) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); setStampPosX(prev => Math.max(0, prev - step)); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); setStampPosX(prev => Math.min(100, prev + step)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setStampPosY(prev => Math.min(100, prev + step)); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setStampPosY(prev => Math.max(0, prev - step)); }
      }
      
      if (e.key === 'Escape') {
        setIsSigSelected(false);
        setIsDateSelected(false);
        setIsStampSelected(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSigSelected, isDateSelected, isStampSelected]);

  // execute signature embedding
  const executeAddSignature = async () => {
    if (!signFile) return;
    setIsProcessing(true);
    setProgressMsg('Embedding digital signature...');

    try {
      let imageBuffer: ArrayBuffer | null = null;
      let isPng = true;

      if (signMode === 'draw') {
        const canvas = sigCanvasRef.current;
        if (canvas && hasSignatureDrawing) {
          const dataUrl = canvas.toDataURL('image/png');
          const res = await fetch(dataUrl);
          imageBuffer = await res.arrayBuffer();
        }
      } else if (signMode === 'upload' && signImageFile) {
        imageBuffer = await signImageFile.arrayBuffer();
        isPng = signImageFile.name.toLowerCase().endsWith('.png');
      } else if (signMode === 'text') {
        if (signText.trim()) {
          const canvas = document.createElement('canvas');
          canvas.width = 420;
          canvas.height = 100;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const fontFamily = getSignFontFamily(signFontStyle);
            ctx.font = `italic bold 42px ${fontFamily}`;
            ctx.fillStyle = signColor;
            ctx.textBaseline = 'middle';
            ctx.fillText(signText.trim(), 20, 50);
            
            if (signUnderline) {
              const textWidth = ctx.measureText(signText.trim()).width;
              ctx.strokeStyle = signColor + '80';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(20, 75);
              ctx.lineTo(20 + textWidth + 10, 75);
              ctx.stroke();
            }

            const dataUrl = canvas.toDataURL('image/png');
            const res = await fetch(dataUrl);
            imageBuffer = await res.arrayBuffer();
          }
        }
      }

      if (!imageBuffer && (!includeStamp || !stampImageFile) && !includeDate) {
        showError('Action required', 'Please provide a signature drawing, text, company stamp, or date stamp to embed.');
        setIsProcessing(false);
        return;
      }

      const pdfDoc = await PDFDocument.load(await signFile.blob.arrayBuffer());
      let embeddedImg: any = null;
      if (imageBuffer) {
        embeddedImg = isPng 
          ? await pdfDoc.embedPng(imageBuffer) 
          : await pdfDoc.embedJpg(imageBuffer);
      }

      let embeddedStampImg: any = null;
      if (includeStamp && stampImageFile) {
        const stampBuf = await stampImageFile.arrayBuffer();
        const isStampPng = stampImageFile.name.toLowerCase().endsWith('.png');
        embeddedStampImg = isStampPng
          ? await pdfDoc.embedPng(stampBuf)
          : await pdfDoc.embedJpg(stampBuf);
      }

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const totalPages = pdfDoc.getPageCount();
      const pagesToSign: number[] = [];

      if (signTargetPage === 'current') {
        pagesToSign.push(signCurrentPageNum - 1);
      } else if (signTargetPage === 'last') {
        pagesToSign.push(totalPages - 1);
      } else if (signTargetPage === 'first') {
        pagesToSign.push(0);
      } else if (signTargetPage === 'all') {
        for (let i = 0; i < totalPages; i++) pagesToSign.push(i);
      } else if (signTargetPage === 'custom') {
        const cleanRange = customPageRange.trim().replace(/\s+/g, '');
        const items = cleanRange.split(',');
        for (const item of items) {
          if (item.includes('-')) {
            const [startStr, endStr] = item.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            if (!isNaN(start) && !isNaN(end)) {
              for (let idx = Math.max(1, start); idx <= Math.min(totalPages, end); idx++) {
                pagesToSign.push(idx - 1);
              }
            }
          } else {
            const idx = parseInt(item, 10);
            if (!isNaN(idx) && idx >= 1 && idx <= totalPages) {
              pagesToSign.push(idx - 1);
            }
          }
        }
      }

      const hexToRgb = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return rgb(r, g, b);
      };

      pagesToSign.forEach(pageIndex => {
        const page = pdfDoc.getPage(pageIndex);
        const { width, height } = page.getSize();
        
        if (embeddedImg) {
          const imgScale = embeddedImg.scale(signScale);
          const targetCenterX = (width * signPosX) / 100;
          const targetY = (height * signPosY) / 100;
          const drawX = Math.max(0, Math.min(width - imgScale.width, targetCenterX - (imgScale.width / 2)));
          const drawY = Math.max(0, Math.min(height - imgScale.height, targetY - (imgScale.height / 2)));

          page.drawImage(embeddedImg, {
            x: drawX,
            y: drawY,
            width: imgScale.width,
            height: imgScale.height,
            opacity: signOpacity
          });
        }

        if (includeStamp && embeddedStampImg) {
          const stampScaled = embeddedStampImg.scale(stampScale);
          const stampTargetCenterX = (width * stampPosX) / 100;
          const stampTargetY = (height * stampPosY) / 100;
          const stampDrawX = Math.max(0, Math.min(width - stampScaled.width, stampTargetCenterX - (stampScaled.width / 2)));
          const stampDrawY = Math.max(0, Math.min(height - stampScaled.height, stampTargetY - (stampScaled.height / 2)));

          page.drawImage(embeddedStampImg, {
            x: stampDrawX,
            y: stampDrawY,
            width: stampScaled.width,
            height: stampScaled.height,
            opacity: stampOpacity
          });
        }

        if (includeDate && dateText.trim()) {
          const dateStr = dateText.trim();
          const dfs = Math.max(6, dateFontSize);
          const dateTargetCenterX = (width * datePosX) / 100;
          const dateTargetY = (height * datePosY) / 100;
          
          const approxDateWidth = dateStr.length * dfs * 0.55;
          const approxDateHeight = dfs;
          const dateDrawX = Math.max(5, Math.min(width - approxDateWidth - 5, dateTargetCenterX - (approxDateWidth / 2)));
          const dateDrawY = Math.max(5, Math.min(height - approxDateHeight - 5, dateTargetY - (approxDateHeight / 2)));

          page.drawText(dateStr, {
            x: dateDrawX,
            y: dateDrawY,
            size: dfs,
            font,
            color: hexToRgb(dateColor),
            opacity: signOpacity
          });
        }
      });

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes as any], { type: 'application/pdf' });

      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(`signed_${signFile.name}`);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('Add Signature', `signed_${signFile.name}`, blob.size);

      showSuccess('PDF ready!', `signed_${signFile.name} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err) {
      console.error(err);
      showError('Signature failed', 'Error embedding signature onto PDF page.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Click "Select PDF Document" to open your target document.' },
    { step: 2, text: 'Draw your signature, select text style, or upload custom stamps. Drag elements into place.' },
    { step: 3, text: 'Nudge placements using Arrow keys. Select target pages, and click "Sign PDF Document".' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Interactive Multi-Elements', desc: 'Drag-and-drop signatures, stamps, and date overlays independently on the same document.' },
    { title: 'Keyboard Micro-Nudges', desc: 'Precise Arrow key nudging allows for pixel-perfect positioning of elements.' },
    { title: 'Local Client-Side Canvas', desc: 'Draw fluid sign lines with vector scaling. Runs offline in standard browsers.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'Can I place stamps and dates separately?', answer: 'Yes. In CompressKro, you can toggle on signature drawing, text name, company stamp uploads, and dates separately, and drag each overlay to its own position.' },
    { question: 'How do I align elements precisely?', answer: 'You can drag them with your mouse/touch, or click to select an overlay and use the Arrow keys on your keyboard for fine pixel nudges (use Shift + Arrow for larger increments).' },
    { question: 'Will my signature remain sharp in the PDF?', answer: 'Yes. Hand-drawn signatures and formatted text names are compiled into high-resolution PNG buffers which render clearly at any magnification.' },
    { question: 'Can I sign specific page ranges?', answer: 'Yes. The target page selector lets you embed overlays on the current page, first page, last page, all pages, or a custom page range (e.g. "2, 3-5").' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Add Watermark', desc: 'Overlay logo or text.', path: '/add-watermark', icon: FileText },
    { name: 'Merge PDF', desc: 'Combine multiple PDF files.', path: '/merge-pdf', icon: ListOrdered },
    { name: 'Split PDF', desc: 'Extract pages or split ranges.', path: '/split-pdf', icon: FileText }
  ];

  return (
    <ToolPageLayout
      title="Sign PDF Online"
      subtitle="Draw signatures, upload custom company seals, stamp dates, and drag overlays onto your PDF."
      breadcrumbName="Sign PDF"
      seoTitle="Sign PDF Online Free - Add Signature & Stamp | CompressKro"
      seoDescription="Add digital signatures and custom stamps to PDF online for free. Draw signatures, upload brand stamps, and position them with arrow nudges. Local client privacy."
      canonicalPath="/sign-pdf"
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
              setSignFile(null);
              setSignPdfDoc(null);
              setSignNumPages(0);
              setSigPreviewUrl('');
              setStampImageFile(null);
              setSignText('');
            }}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Sidebar Controls Panel */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <PenTool className="w-4 h-4 text-emerald-500" />
                <span>Signing Options & Inputs</span>
              </h3>

              <div className="space-y-4">
                <input 
                  type="file" 
                  ref={signInputRef} 
                  onChange={handleSignFileSelect} 
                  accept="application/pdf" 
                  className="hidden" 
                />
                <button
                  onClick={() => signInputRef.current?.click()}
                  className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-emerald-500" />
                  <span>{signFile ? signFile.name : 'Select PDF Document'}</span>
                </button>

                {signFile && (
                  <div className="space-y-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Signature Source
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSignMode('draw')}
                          className={`py-2 text-[10px] font-bold rounded-lg border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            signMode === 'draw' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>Draw</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSignMode('upload')}
                          className={`py-2 text-[10px] font-bold rounded-lg border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            signMode === 'upload' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Upload</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSignMode('text')}
                          className={`py-2 text-[10px] font-bold rounded-lg border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            signMode === 'text' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <Type className="w-3.5 h-3.5" />
                          <span>Text</span>
                        </button>
                      </div>
                    </div>

                    {signMode === 'draw' ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                          <span>Ink Drawing Pad</span>
                          <button type="button" onClick={clearSigCanvas} className="text-red-500 hover:text-red-650 flex items-center gap-1 font-bold cursor-pointer">
                            <Eraser className="w-3.5 h-3.5" /> Clear
                          </button>
                        </div>
                        <canvas
                          ref={sigCanvasRef}
                          width={400}
                          height={140}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          className="w-full h-[130px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white cursor-crosshair touch-none shadow-inner"
                        />
                      </div>
                    ) : signMode === 'upload' ? (
                      <div>
                        <input
                          type="file"
                          ref={signImageInputRef}
                          onChange={(e) => e.target.files?.[0] && setSignImageFile(e.target.files[0])}
                          accept="image/png, image/jpeg"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => signImageInputRef.current?.click()}
                          className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          {signImageFile ? signImageFile.name : 'Upload Sign Image (PNG/JPG)'}
                        </button>
                      </div>
                    ) : signMode === 'text' ? (
                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Name / Text
                        </label>
                        <input
                          type="text"
                          value={signText}
                          onChange={(e) => setSignText(e.target.value)}
                          placeholder="Type signature..."
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none"
                        />
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Font Family</label>
                          <div className="grid grid-cols-2 gap-1">
                            {([
                              { key: 'dancing-script' as const, label: 'Dancing Script', sample: '"Dancing Script", cursive' },
                              { key: 'great-vibes' as const, label: 'Great Vibes', sample: '"Great Vibes", cursive' },
                              { key: 'sacramento' as const, label: 'Sacramento', sample: '"Sacramento", cursive' },
                              { key: 'caveat' as const, label: 'Caveat', sample: '"Caveat", cursive' },
                              { key: 'playfair' as const, label: 'Playfair Serif', sample: '"Playfair Display", serif' },
                              { key: 'montserrat' as const, label: 'Montserrat', sample: '"Montserrat", sans-serif' },
                            ]).map(fs => (
                              <button
                                key={fs.key}
                                type="button"
                                onClick={() => setSignFontStyle(fs.key)}
                                className={`px-1 py-1.5 text-[10px] rounded border transition-all truncate cursor-pointer ${
                                  signFontStyle === fs.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850'
                                }`}
                                style={{ fontFamily: fs.sample, fontWeight: 700 }}
                              >
                                {fs.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={signUnderline}
                            onChange={(e) => setSignUnderline(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                          />
                          <span className="text-[10px] font-semibold text-slate-500">Add Underline</span>
                        </label>
                      </div>
                    ) : null}

                    {/* Ink Color */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Ink Color</label>
                      <div className="flex gap-1">
                        {['#0f172a', '#1e3a5f', '#1d4ed8', '#dc2626', '#059669', '#7c3aed'].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setSignColor(c)}
                            className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${
                              signColor === c ? 'ring-2 ring-emerald-500 scale-105' : 'hover:scale-105'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Company Stamp Independent Upload */}
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-2">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeStamp}
                          onChange={(e) => setIncludeStamp(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                        />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Add Stamp / Seal</span>
                      </label>
                      {includeStamp && (
                        <div className="space-y-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                          <input
                            type="file"
                            ref={stampImageInputRef}
                            onChange={(e) => e.target.files?.[0] && setStampImageFile(e.target.files[0])}
                            accept="image/png, image/jpeg"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => stampImageInputRef.current?.click()}
                            className="w-full py-1.5 rounded-lg border border-dashed border-slate-350 text-[10px] font-semibold text-slate-650 cursor-pointer"
                          >
                            {stampImageFile ? stampImageFile.name : 'Upload Stamp Logo'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Date Stamp */}
                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-2">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeDate}
                          onChange={(e) => setIncludeDate(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                        />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Add Date Stamp</span>
                      </label>
                      {includeDate && (
                        <div className="space-y-2 pt-1">
                          <input
                            type="text"
                            value={dateText}
                            onChange={(e) => setDateText(e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                      )}
                    </div>

                    {/* Position Details / Page select */}
                    <div className="space-y-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Target Page</label>
                          <select
                            value={signTargetPage}
                            onChange={(e) => setSignTargetPage(e.target.value as any)}
                            className="w-full px-1.5 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                          >
                            <option value="current">Current Page ({signCurrentPageNum})</option>
                            <option value="all">All Pages</option>
                            <option value="custom">Custom...</option>
                            <option value="first">First Page</option>
                            <option value="last">Last Page</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Sign Scale</label>
                          <input
                            type="range"
                            min={0.1}
                            max={0.8}
                            step={0.05}
                            value={signScale}
                            onChange={(e) => setSignScale(Number(e.target.value))}
                            className="w-full accent-emerald-500"
                          />
                        </div>
                      </div>
                      {signTargetPage === 'custom' && (
                        <div>
                          <input
                            type="text"
                            value={customPageRange}
                            onChange={(e) => setCustomPageRange(e.target.value)}
                            placeholder="e.g. 2,3 or 1-4"
                            className="w-full px-2 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={executeAddSignature}
                disabled={!signFile || isProcessing}
                className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-650 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PenTool className="w-4 h-4" />}
                <span>{isProcessing ? progressMsg : 'Sign PDF Document'}</span>
              </button>
            </div>

            {/* Document Interactive Viewer Panel */}
            <div className="lg:col-span-2 space-y-4">
              {signPdfDoc ? (
                <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-900/10 dark:bg-slate-950/40 space-y-3 flex flex-col items-center select-none relative shadow-inner">
                  <div className="flex justify-between items-center w-full pb-2 border-b border-slate-200/50 dark:border-slate-800/50">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Drag items to position them</span>
                    {signNumPages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const newPage = Math.max(1, signCurrentPageNum - 1);
                            setSignCurrentPageNum(newPage);
                            const target = docViewerContainerRef.current?.querySelectorAll('.pdf-page-wrapper')[newPage - 1];
                            target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                          }}
                          disabled={signCurrentPageNum <= 1}
                          className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                          Page {signCurrentPageNum} of {signNumPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const newPage = Math.min(signNumPages, signCurrentPageNum + 1);
                            setSignCurrentPageNum(newPage);
                            const target = docViewerContainerRef.current?.querySelectorAll('.pdf-page-wrapper')[newPage - 1];
                            target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                          }}
                          disabled={signCurrentPageNum >= signNumPages}
                          className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Vertically stacked pages viewer */}
                  <div
                    ref={docViewerContainerRef}
                    onScroll={handleViewerScroll}
                    className="flex flex-col items-center bg-slate-900/60 dark:bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-y-auto max-h-[500px] gap-6 relative w-full scroll-smooth"
                  >
                    <div ref={pdfPageContainerRef} className="space-y-6 w-full flex flex-col items-center relative" onClick={handlePageBackgroundClick}>
                      {Array.from({ length: signNumPages }).map((_, index) => (
                        <div
                          key={index}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                          onDrop={(e) => {
                            e.preventDefault();
                            setSignCurrentPageNum(index + 1);
                            const rect = e.currentTarget.getBoundingClientRect();
                            const dropType = e.dataTransfer.getData('text/plain');
                            
                            if (dropType === 'sig') {
                              const overlayW = sigOverlayRef.current?.offsetWidth || 120;
                              const overlayH = sigOverlayRef.current?.offsetHeight || 50;
                              const rawLeft = e.clientX - rect.left - overlayW / 2;
                              const rawTop = e.clientY - rect.top - overlayH / 2;
                              const clampedLeft = Math.max(0, Math.min(rect.width - overlayW, rawLeft));
                              const clampedTop = Math.max(0, Math.min(rect.height - overlayH, rawTop));
                              setSignPosX(Math.round(((clampedLeft + overlayW / 2) / rect.width) * 100));
                              setSignPosY(Math.round(((rect.height - (clampedTop + overlayH / 2)) / rect.height) * 100));
                              setIsSigSelected(true);
                              setIsDateSelected(false);
                              setIsStampSelected(false);
                            } else if (dropType === 'stamp') {
                              const overlayW = stampOverlayRef.current?.offsetWidth || 120;
                              const overlayH = stampOverlayRef.current?.offsetHeight || 120;
                              const rawLeft = e.clientX - rect.left - overlayW / 2;
                              const rawTop = e.clientY - rect.top - overlayH / 2;
                              const clampedLeft = Math.max(0, Math.min(rect.width - overlayW, rawLeft));
                              const clampedTop = Math.max(0, Math.min(rect.height - overlayH, rawTop));
                              setStampPosX(Math.round(((clampedLeft + overlayW / 2) / rect.width) * 100));
                              setStampPosY(Math.round(((rect.height - (clampedTop + overlayH / 2)) / rect.height) * 100));
                              setIsStampSelected(true);
                              setIsSigSelected(false);
                              setIsDateSelected(false);
                            }
                          }}
                          onClick={() => setSignCurrentPageNum(index + 1)}
                          className={`relative shadow-2xl rounded-lg bg-white border pdf-page-wrapper transition-all duration-200 cursor-pointer ${
                            signCurrentPageNum === index + 1 
                              ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                              : 'border-slate-800 hover:border-slate-650'
                          }`}
                          style={{ width: 'fit-content' }}
                        >
                          <canvas 
                            ref={(el) => { pageCanvasesRef.current[index] = el; }} 
                            className="block max-w-full h-auto rounded-lg" 
                          />

                          {/* Display interactive overlays ONLY on the active page */}
                          {signCurrentPageNum === index + 1 && (
                            <>
                              {(sigPreviewUrl || signText.trim()) && (() => {
                                const canvas = pageCanvasesRef.current[index];
                                const overlayEl = sigOverlayRef.current;
                                let leftPx = 0, topPx = 0;
                                const cW = canvas ? canvas.clientWidth || 595 : 595;
                                const cH = canvas ? canvas.clientHeight || 842 : 842;
                                const oW = overlayEl ? overlayEl.offsetWidth : 120;
                                const oH = overlayEl ? overlayEl.offsetHeight : 50;
                                leftPx = Math.max(0, Math.min(cW - oW, ((signPosX / 100) * cW) - oW / 2));
                                topPx = Math.max(0, Math.min(cH - oH, (((100 - signPosY) / 100) * cH) - oH / 2));
                                const sigScale_ = 0.7 + signScale * 0.8;
                                return (
                                  <div
                                    ref={sigOverlayRef}
                                    tabIndex={0}
                                    onPointerDown={handleSigPointerDown}
                                    onPointerMove={handleSigPointerMove}
                                    onPointerUp={handleSigPointerUp}
                                    onFocus={() => setIsSigSelected(true)}
                                    className={`absolute select-none rounded outline-none ${
                                      isDraggingSig ? 'cursor-grabbing z-30' : 'cursor-grab z-20'
                                    }`}
                                    style={{
                                      left: `${leftPx}px`,
                                      top: `${topPx}px`,
                                      transform: `scale(${sigScale_})`,
                                      transformOrigin: 'top left',
                                      opacity: signOpacity,
                                    }}
                                  >
                                    <div className={`absolute inset-0 rounded pointer-events-none transition-all ${
                                      isSigSelected ? 'ring-2 ring-blue-500 shadow-lg' : 'ring-1 ring-slate-400/45 hover:ring-emerald-500'
                                    }`} />
                                    {sigPreviewUrl ? (
                                      <img src={sigPreviewUrl} alt="Sign Stamp" className="max-h-12 max-w-[180px] object-contain pointer-events-none" />
                                    ) : (
                                      <div className="font-serif italic font-bold text-lg px-2" style={{ fontFamily: getSignFontFamily(signFontStyle), color: signColor, textDecoration: signUnderline ? 'underline' : 'none' }}>
                                        {signText}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {includeStamp && stampPreviewUrl && (() => {
                                const canvas = pageCanvasesRef.current[index];
                                const overlayEl = stampOverlayRef.current;
                                let leftPx = 0, topPx = 0;
                                const cW = canvas ? canvas.clientWidth || 595 : 595;
                                const cH = canvas ? canvas.clientHeight || 842 : 842;
                                const oW = overlayEl ? overlayEl.offsetWidth : 120;
                                const oH = overlayEl ? overlayEl.offsetHeight : 120;
                                leftPx = Math.max(0, Math.min(cW - oW, ((stampPosX / 100) * cW) - oW / 2));
                                topPx = Math.max(0, Math.min(cH - oH, (((100 - stampPosY) / 100) * cH) - oH / 2));
                                const stampScale_ = 0.7 + stampScale * 0.8;
                                return (
                                  <div
                                    ref={stampOverlayRef}
                                    tabIndex={0}
                                    onPointerDown={handleStampPointerDown}
                                    onPointerMove={handleStampPointerMove}
                                    onPointerUp={handleStampPointerUp}
                                    onFocus={() => setIsStampSelected(true)}
                                    className={`absolute select-none rounded outline-none ${
                                      isDraggingStamp ? 'cursor-grabbing z-30' : 'cursor-grab z-20'
                                    }`}
                                    style={{
                                      left: `${leftPx}px`,
                                      top: `${topPx}px`,
                                      transform: `scale(${stampScale_})`,
                                      transformOrigin: 'top left',
                                      opacity: stampOpacity,
                                    }}
                                  >
                                    <div className={`absolute inset-0 rounded pointer-events-none transition-all ${
                                      isStampSelected ? 'ring-2 ring-blue-500 shadow-lg' : 'ring-1 ring-slate-400/45 hover:ring-sky-500'
                                    }`} />
                                    <img src={stampPreviewUrl} alt="Stamp Seal" className="max-h-16 max-w-[160px] object-contain pointer-events-none" />
                                  </div>
                                );
                              })()}

                              {includeDate && dateText.trim() && (() => {
                                const canvas = pageCanvasesRef.current[index];
                                const overlayEl = dateOverlayRef.current;
                                let leftPx = 0, topPx = 0;
                                const cW = canvas ? canvas.clientWidth || 595 : 595;
                                const cH = canvas ? canvas.clientHeight || 842 : 842;
                                const oW = overlayEl ? overlayEl.offsetWidth : 80;
                                const oH = overlayEl ? overlayEl.offsetHeight : 24;
                                leftPx = Math.max(0, Math.min(cW - oW, ((datePosX / 100) * cW) - oW / 2));
                                topPx = Math.max(0, Math.min(cH - oH, (((100 - datePosY) / 100) * cH) - oH / 2));
                                return (
                                  <div
                                    ref={dateOverlayRef}
                                    tabIndex={0}
                                    onPointerDown={handleDatePointerDown}
                                    onPointerMove={handleDatePointerMove}
                                    onPointerUp={handleDatePointerUp}
                                    onFocus={() => setIsDateSelected(true)}
                                    className={`absolute select-none rounded outline-none px-2 py-0.5 ${
                                      isDraggingDate ? 'cursor-grabbing z-35' : 'cursor-grab z-25'
                                    }`}
                                    style={{
                                      left: `${leftPx}px`,
                                      top: `${topPx}px`,
                                      color: dateColor,
                                      fontSize: `${dateFontSize}px`,
                                      fontWeight: 'bold',
                                    }}
                                  >
                                    <div className={`absolute inset-0 rounded pointer-events-none transition-all ${
                                      isDateSelected ? 'ring-2 ring-blue-500 shadow-lg' : 'ring-1 ring-slate-400/40 hover:ring-amber-500'
                                    }`} />
                                    <span>{dateText}</span>
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Draggable Stamps Tray */}
                  <div className="flex gap-4 w-full justify-center pt-2">
                    <div
                      draggable={true}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', 'sig'); e.dataTransfer.effectAllowed = 'copyMove'; }}
                      className="px-4 py-2 border border-slate-300 dark:border-slate-800 rounded-lg bg-slate-50 hover:border-emerald-500 cursor-grab text-[10px] font-bold text-slate-600 flex items-center gap-1.5 shadow-sm"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                      <span>Signature Stamp</span>
                    </div>
                    {includeStamp && stampPreviewUrl && (
                      <div
                        draggable={true}
                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', 'stamp'); e.dataTransfer.effectAllowed = 'copyMove'; }}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-800 rounded-lg bg-slate-50 hover:border-sky-500 cursor-grab text-[10px] font-bold text-slate-600 flex items-center gap-1.5 shadow-sm"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                        <span>Company Stamp</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-16 text-center text-slate-400 bg-white/10 h-[360px] shadow-sm">
                  <PenTool className="w-16 h-16 text-slate-300 dark:text-slate-800 mb-4" />
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Please upload a PDF document in the options panel to view pages and place signatures.</p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
