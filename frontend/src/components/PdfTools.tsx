import { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Download, 
  HelpCircle, 
  RefreshCw, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  RotateCw,
  CheckCircle2,
  ListOrdered,
  Lock,
  Unlock,
  Droplets,
  Key,
  Type,
  Image as ImageIcon,
  PenTool,
  Hash,
  FileImage,
  Eraser,
  ChevronLeft,
  ChevronRight,
  Move,
  GripVertical
} from 'lucide-react';
import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { useToast } from '../hooks/useToast';
import { StorageService } from '../services/storage.service';
import { HistoryService } from '../services/history.service';
import { ToastContainer } from './ui/Toast';
import { getFriendlySize } from '../utils/format';
import { BACKEND_API_URL } from '../constants';

interface PDFFileItem {
  id: string;
  name: string;
  size: number;
  blob: Blob;
}

interface PDFPageItem {
  originalIndex: number;
  rotation: number; // 0, 90, 180, 270
  previewUrl?: string;
}

interface PdfJpgResult {
  pageNum: number;
  dataUrl: string;
  blob: Blob;
  size: number;
  filename: string;
}

type PdfToolTab = 'merge' | 'split' | 'edit' | 'imgToPdf' | 'lock' | 'unlock' | 'watermark' | 'sign' | 'pageNumbers' | 'pdfToJpg';

export default function PdfTools() {
  const [activeTab, setActiveTab] = useState<PdfToolTab>('merge');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const { toasts, showSuccess, showError, dismiss } = useToast();

  // Merge state
  const [mergeFiles, setMergeFiles] = useState<PDFFileItem[]>([]);
  const mergeInputRef = useRef<HTMLInputElement>(null);

  // Split state
  const [splitFile, setSplitFile] = useState<PDFFileItem | null>(null);
  const [splitRange, setSplitRange] = useState<string>('1-2');
  const splitInputRef = useRef<HTMLInputElement>(null);

  // Edit/Organize state
  const [editFile, setEditFile] = useState<PDFFileItem | null>(null);
  const [editPages, setEditPages] = useState<PDFPageItem[]>([]);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Images to PDF state
  const [images, setImages] = useState<PDFFileItem[]>([]);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  // Lock PDF state
  const [lockFile, setLockFile] = useState<PDFFileItem | null>(null);
  const [userPassword, setUserPassword] = useState<string>('');
  const [ownerPassword, setOwnerPassword] = useState<string>('');
  const lockInputRef = useRef<HTMLInputElement>(null);

  // Unlock PDF state
  const [unlockFile, setUnlockFile] = useState<PDFFileItem | null>(null);
  const [unlockPassword, setUnlockPassword] = useState<string>('');
  const unlockInputRef = useRef<HTMLInputElement>(null);

  // Add Watermark state
  const [wmFile, setWmFile] = useState<PDFFileItem | null>(null);
  const [wmType, setWmType] = useState<'text' | 'image'>('text');
  const [wmText, setWmText] = useState<string>('CONFIDENTIAL');
  const [wmFontSize, setWmFontSize] = useState<number>(48);
  const [wmOpacity, setWmOpacity] = useState<number>(0.3);
  const [wmRotation, setWmRotation] = useState<number>(45);
  const [wmColor, setWmColor] = useState<'gray' | 'red' | 'blue' | 'black'>('gray');
  const [wmPosition, setWmPosition] = useState<'center' | 'top' | 'bottom'>('center');
  const [wmImageFile, setWmImageFile] = useState<File | null>(null);
  const wmInputRef = useRef<HTMLInputElement>(null);
  const wmImageInputRef = useRef<HTMLInputElement>(null);

  // Add Signature / Stamp state
  const [signFile, setSignFile] = useState<PDFFileItem | null>(null);
  const [signMode, setSignMode] = useState<'draw' | 'upload' | 'text' | 'stamp'>('draw');
  const [signText, setSignText] = useState<string>('');
  const [signTargetPage, setSignTargetPage] = useState<'current' | 'last' | 'first' | 'all' | 'custom'>('current');
  const [customPageRange, setCustomPageRange] = useState<string>('2,3');
  const [signPosX, setSignPosX] = useState<number>(75); // % from left
  const [signPosY, setSignPosY] = useState<number>(15); // % from bottom
  const [signScale, setSignScale] = useState<number>(0.25);
  const [signOpacity, setSignOpacity] = useState<number>(1.0);
  const [signColor, setSignColor] = useState<string>('#0f172a');
  const [signFontStyle, setSignFontStyle] = useState<'great-vibes' | 'dancing-script' | 'sacramento' | 'caveat' | 'playfair' | 'montserrat'>('dancing-script');
  const [signUnderline, setSignUnderline] = useState<boolean>(false);
  // Company Stamp uploader state - completely independent image uploader
  const [includeStamp, setIncludeStamp] = useState<boolean>(false);
  const [stampImageFile, setStampImageFile] = useState<File | null>(null);
  const [stampPreviewUrl, setStampPreviewUrl] = useState<string>('');
  const [stampPosX, setStampPosX] = useState<number>(50); // % from left
  const [stampPosY, setStampPosY] = useState<number>(20); // % from bottom
  const [stampScale, setStampScale] = useState<number>(0.25);
  const [stampOpacity, setStampOpacity] = useState<number>(1.0);
  
  // Date Stamp state - completely independent
  const [includeDate, setIncludeDate] = useState<boolean>(true);
  const [dateText, setDateText] = useState<string>(new Date().toLocaleDateString('en-GB')); // Default dd/mm/yyyy format
  const [dateColor, setDateColor] = useState<string>('#334155');
  const [dateFontSize, setDateFontSize] = useState<number>(12);
  const [datePosX, setDatePosX] = useState<number>(20); // % from left (separate from signature)
  const [datePosY, setDatePosY] = useState<number>(15); // % from bottom (separate from signature)
  
  const [signImageFile, setSignImageFile] = useState<File | null>(null);
  const signInputRef = useRef<HTMLInputElement>(null);
  const signImageInputRef = useRef<HTMLInputElement>(null);
  const stampImageInputRef = useRef<HTMLInputElement>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hasSignatureDrawing, setHasSignatureDrawing] = useState<boolean>(false);

  // Real signature preview image & dragging state
  const [sigPreviewUrl, setSigPreviewUrl] = useState<string>('');
  const [isDraggingSig, setIsDraggingSig] = useState<boolean>(false);
  const [isSigSelected, setIsSigSelected] = useState<boolean>(false);
  const sigDragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const sigOverlayRef = useRef<HTMLDivElement>(null);
  
  // Date dragging state
  const [isDraggingDate, setIsDraggingDate] = useState<boolean>(false);
  const [isDateSelected, setIsDateSelected] = useState<boolean>(false);
  const dateDragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const dateOverlayRef = useRef<HTMLDivElement>(null);

  // Company Stamp dragging state
  const [isDraggingStamp, setIsDraggingStamp] = useState<boolean>(false);
  const [isStampSelected, setIsStampSelected] = useState<boolean>(false);
  const stampDragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const stampOverlayRef = useRef<HTMLDivElement>(null);

  // Compiled PDF output previewer state
  const [outputPdfDoc, setOutputPdfDoc] = useState<any>(null);
  const [outputCurrentPageNum, setOutputCurrentPageNum] = useState<number>(1);
  const [outputTotalPages, setOutputTotalPages] = useState<number>(0);
  const outputPageCanvasesRef = useRef<(HTMLCanvasElement | null)[]>([]);
  const outputViewerContainerRef = useRef<HTMLDivElement>(null);

  const docViewerContainerRef = useRef<HTMLDivElement>(null);
  const pdfPageContainerRef = useRef<HTMLDivElement>(null);
  const pageCanvasesRef = useRef<(HTMLCanvasElement | null)[]>([]);

  // Sign PDF.js document preview state
  const [signPdfDoc, setSignPdfDoc] = useState<any>(null);
  const [signNumPages, setSignNumPages] = useState<number>(1);
  const [signCurrentPageNum, setSignCurrentPageNum] = useState<number>(1);

  // Add Page Numbers state
  const [pgNumFile, setPgNumFile] = useState<PDFFileItem | null>(null);
  const [pgNumFormat, setPgNumFormat] = useState<'page-total' | 'page-only' | 'num-total' | 'num-only'>('page-total');
  const [pgNumPosition, setPgNumPosition] = useState<'bottom-right' | 'bottom-center' | 'bottom-left' | 'top-right' | 'top-center'>('bottom-right');
  const [pgNumFontSize, setPgNumFontSize] = useState<number>(10);
  const [pgNumStart, setPgNumStart] = useState<number>(1);
  const [skipCoverPage, setSkipCoverPage] = useState<boolean>(false);
  const pgNumInputRef = useRef<HTMLInputElement>(null);

  // PDF to JPG state
  const [pdfJpgFile, setPdfJpgFile] = useState<PDFFileItem | null>(null);
  const [pdfJpgResults, setPdfJpgResults] = useState<PdfJpgResult[]>([]);
  const pdfJpgInputRef = useRef<HTMLInputElement>(null);

  // Output URLs
  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
    setPdfJpgResults([]);
  };

  // Load beautiful Google Fonts for text signature mode dynamically on mount
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Dancing+Script:wght@700&family=Great+Vibes&family=Montserrat:ital,wght@1,700&family=Playfair+Display:ital,wght@1,700&family=Sacramento&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => {
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
    };
  }, []);

  // Font family helper
  const getSignFontFamily = (style: string) => {
    switch (style) {
      case 'great-vibes':
        return '"Great Vibes", cursive';
      case 'sacramento':
        return '"Sacramento", cursive';
      case 'caveat':
        return '"Caveat", cursive';
      case 'playfair':
        return '"Playfair Display", Georgia, serif';
      case 'montserrat':
        return '"Montserrat", sans-serif';
      case 'dancing-script':
      default:
        return '"Dancing Script", cursive';
    }
  };

  // Setup signature drawing canvas
  useEffect(() => {
    if (activeTab === 'sign' && signMode === 'draw' && sigCanvasRef.current) {
      const canvas = sigCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx && !hasSignatureDrawing) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = signColor;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [activeTab, signMode, signColor]);

  // Generate live real-time signature image preview Data URL
  useEffect(() => {
    if (activeTab !== 'sign') return;

    if (signMode === 'draw') {
      if (sigCanvasRef.current && hasSignatureDrawing) {
        setSigPreviewUrl(sigCanvasRef.current.toDataURL('image/png'));
      } else {
        setSigPreviewUrl('');
      }
    } else if (signMode === 'upload' && signImageFile) {
      const url = URL.createObjectURL(signImageFile);
      setSigPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (signMode === 'text') {
      if (signText.trim()) {
        const canvas = document.createElement('canvas');
        canvas.width = 420;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const fontFamily = getSignFontFamily(signFontStyle);
          ctx.font = `italic bold 38px ${fontFamily}`;
          ctx.fillStyle = signColor;
          ctx.textBaseline = 'middle';
          ctx.fillText(signText.trim(), 15, 45);
          if (signUnderline) {
            const tw = ctx.measureText(signText.trim()).width;
            ctx.strokeStyle = signColor + '80';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(15, 68);
            ctx.lineTo(15 + tw + 10, 68);
            ctx.stroke();
          }
          setSigPreviewUrl(canvas.toDataURL('image/png'));
        }
      } else {
        setSigPreviewUrl('');
      }
    } else {
      setSigPreviewUrl('');
    }
  }, [activeTab, signMode, signImageFile, signText, signColor, signFontStyle, signUnderline, hasSignatureDrawing]);

  // Company Stamp Image Object URL hook
  useEffect(() => {
    if (stampImageFile) {
      const url = URL.createObjectURL(stampImageFile);
      setStampPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setStampPreviewUrl('');
    }
  }, [stampImageFile]);

  // Handle PDF document load for Signature preview
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

  // Render ALL PDF Pages onto stacked canvases for interactive signing
  useEffect(() => {
    if (activeTab === 'sign' && signPdfDoc) {
      let active = true;
      const tasks: any[] = [];

      (async () => {
        // Render each page sequentially onto its corresponding canvas
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
  }, [activeTab, signPdfDoc, signNumPages]);

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

  // Load compiled output PDF document via pdf.js
  useEffect(() => {
    if (outputUrl) {
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
  }, [outputUrl]);

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

  // Canva-like Signature and Date Overlays Interaction
  // Click on element -> select it, enable dragging. Click background -> deselect both.
  // Selected element is moved by Arrow keys (Shift+Arrow = 5% coarse).

  // Signature Pointer Handlers
  const handleSigPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsSigSelected(true);
    setIsDateSelected(false);
    const overlayEl = sigOverlayRef.current;
    if (overlayEl) {
      const overlayRect = overlayEl.getBoundingClientRect();
      sigDragOffset.current = {
        dx: e.clientX - overlayRect.left,
        dy: e.clientY - overlayRect.top,
      };
    }
    setIsDraggingSig(true);
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handleSigPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingSig || !pdfPageContainerRef.current || !sigOverlayRef.current) return;
    const pageRect = pdfPageContainerRef.current.getBoundingClientRect();
    const overlayW = sigOverlayRef.current.offsetWidth;
    const overlayH = sigOverlayRef.current.offsetHeight;
    const newLeft = e.clientX - pageRect.left - sigDragOffset.current.dx;
    const newTop = e.clientY - pageRect.top - sigDragOffset.current.dy;
    const clampedLeft = Math.max(0, Math.min(pageRect.width - overlayW, newLeft));
    const clampedTop = Math.max(0, Math.min(pageRect.height - overlayH, newTop));
    const centerX = clampedLeft + overlayW / 2;
    const centerY = clampedTop + overlayH / 2;
    const pctX = (centerX / pageRect.width) * 100;
    const pctY = ((pageRect.height - centerY) / pageRect.height) * 100;
    setSignPosX(Math.round(pctX));
    setSignPosY(Math.round(pctY));
  };

  const handleSigPointerUp = (e: React.PointerEvent) => {
    if (isDraggingSig) {
      setIsDraggingSig(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  // Date Pointer Handlers
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
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handleDatePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingDate || !pdfPageContainerRef.current || !dateOverlayRef.current) return;
    const pageRect = pdfPageContainerRef.current.getBoundingClientRect();
    const overlayW = dateOverlayRef.current.offsetWidth;
    const overlayH = dateOverlayRef.current.offsetHeight;
    const newLeft = e.clientX - pageRect.left - dateDragOffset.current.dx;
    const newTop = e.clientY - pageRect.top - dateDragOffset.current.dy;
    const clampedLeft = Math.max(0, Math.min(pageRect.width - overlayW, newLeft));
    const clampedTop = Math.max(0, Math.min(pageRect.height - overlayH, newTop));
    const centerX = clampedLeft + overlayW / 2;
    const centerY = clampedTop + overlayH / 2;
    const pctX = (centerX / pageRect.width) * 100;
    const pctY = ((pageRect.height - centerY) / pageRect.height) * 100;
    setDatePosX(Math.round(pctX));
    setDatePosY(Math.round(pctY));
  };

  const handleDatePointerUp = (e: React.PointerEvent) => {
    if (isDraggingDate) {
      setIsDraggingDate(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  // Company Stamp Pointer Handlers
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
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handleStampPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingStamp || !pdfPageContainerRef.current || !stampOverlayRef.current) return;
    const pageRect = pdfPageContainerRef.current.getBoundingClientRect();
    const overlayW = stampOverlayRef.current.offsetWidth;
    const overlayH = stampOverlayRef.current.offsetHeight;
    const newLeft = e.clientX - pageRect.left - stampDragOffset.current.dx;
    const newTop = e.clientY - pageRect.top - stampDragOffset.current.dy;
    const clampedLeft = Math.max(0, Math.min(pageRect.width - overlayW, newLeft));
    const clampedTop = Math.max(0, Math.min(pageRect.height - overlayH, newTop));
    const centerX = clampedLeft + overlayW / 2;
    const centerY = clampedTop + overlayH / 2;
    const pctX = (centerX / pageRect.width) * 100;
    const pctY = ((pageRect.height - centerY) / pageRect.height) * 100;
    setStampPosX(Math.round(pctX));
    setStampPosY(Math.round(pctY));
  };

  const handleStampPointerUp = (e: React.PointerEvent) => {
    if (isDraggingStamp) {
      setIsDraggingStamp(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  // Click on page background -> deselect everything
  const handlePageBackgroundClick = (e: React.MouseEvent) => {
    if (sigOverlayRef.current && sigOverlayRef.current.contains(e.target as Node)) return;
    if (dateOverlayRef.current && dateOverlayRef.current.contains(e.target as Node)) return;
    if (stampOverlayRef.current && stampOverlayRef.current.contains(e.target as Node)) return;
    setIsSigSelected(false);
    setIsDateSelected(false);
    setIsStampSelected(false);
  };

  // Combined Keyboard Nudge handler for Selected Signature, Date, or Stamp
  useEffect(() => {
    if ((!isSigSelected && !isDateSelected && !isStampSelected) || activeTab !== 'sign') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 5 : 1;
      
      if (isSigSelected) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setSignPosX(prev => Math.max(0, prev - step));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setSignPosX(prev => Math.min(100, prev + step));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSignPosY(prev => Math.min(100, prev + step));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSignPosY(prev => Math.max(0, prev - step));
        }
      } else if (isDateSelected) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setDatePosX(prev => Math.max(0, prev - step));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setDatePosX(prev => Math.min(100, prev + step));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setDatePosY(prev => Math.min(100, prev + step));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setDatePosY(prev => Math.max(0, prev - step));
        }
      } else if (isStampSelected) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setStampPosX(prev => Math.max(0, prev - step));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setStampPosX(prev => Math.min(100, prev + step));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setStampPosY(prev => Math.min(100, prev + step));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setStampPosY(prev => Math.max(0, prev - step));
        }
      }
      
      if (e.key === 'Escape') {
        setIsSigSelected(false);
        setIsDateSelected(false);
        setIsStampSelected(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSigSelected, isDateSelected, isStampSelected, activeTab]);

  // Fluid signature drawing canvas helper with exact scaling
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

  // PDF.JS Dynamic Loader for PDF to JPG & Page Viewer
  const loadPdfJs = async () => {
    if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(pdfjsLib);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  // Merge Helpers
  const handleMergeFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newItems = Array.from(e.target.files).map(f => ({
        id: Math.random().toString(36).substring(2),
        name: f.name,
        size: f.size,
        blob: f
      }));
      setMergeFiles([...mergeFiles, ...newItems]);
      clearOutputs();
    }
  };

  const moveMergeItem = (index: number, direction: 'up' | 'down') => {
    const list = [...mergeFiles];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx >= 0 && targetIdx < list.length) {
      const temp = list[index];
      list[index] = list[targetIdx];
      list[targetIdx] = temp;
      setMergeFiles(list);
    }
  };

  const removeMergeItem = (id: string) => {
    setMergeFiles(mergeFiles.filter(item => item.id !== id));
    clearOutputs();
  };

  const executeMerge = async () => {
    if (mergeFiles.length < 2) return;
    setIsProcessing(true);
    setProgressMsg('Merging files...');

    try {
      const mergedPdf = await PDFDocument.create();
      for (const item of mergeFiles) {
        const arrayBuf = await item.blob.arrayBuffer();
        const doc = await PDFDocument.load(arrayBuf);
        const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
        copiedPages.forEach(p => mergedPdf.addPage(p));
      }

      const mergedBytes = await mergedPdf.save();
      const outputBlob = new Blob([mergedBytes as any], { type: 'application/pdf' });
      
      setOutputBlobData(outputBlob, 'merged_document.pdf');
    } catch (err) {
      console.error(err);
      showError('Merge failed', 'Ensure all PDFs are unencrypted and valid files.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // Split Helpers
  const handleSplitFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setSplitFile({
        id: 'split',
        name: f.name,
        size: f.size,
        blob: f
      });
      clearOutputs();
    }
  };

  const executeSplit = async () => {
    if (!splitFile) return;
    setIsProcessing(true);
    setProgressMsg('Extracting pages...');

    try {
      const arrayBuf = await splitFile.blob.arrayBuffer();
      const srcDoc = await PDFDocument.load(arrayBuf);
      const totalPages = srcDoc.getPageCount();

      const pagesToExtract: number[] = [];
      const parts = splitRange.split(',');

      for (const part of parts) {
        const range = part.trim().split('-');
        if (range.length === 2) {
          const start = Math.max(1, parseInt(range[0])) - 1;
          const end = Math.min(totalPages, parseInt(range[1])) - 1;
          for (let i = start; i <= end; i++) {
            pagesToExtract.push(i);
          }
        } else if (range.length === 1) {
          const val = parseInt(range[0]) - 1;
          if (val >= 0 && val < totalPages) {
            pagesToExtract.push(val);
          }
        }
      }

      if (pagesToExtract.length === 0) {
        showError('Split failed', 'Invalid page ranges selected.');
        setIsProcessing(false);
        return;
      }

      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(srcDoc, pagesToExtract);
      copiedPages.forEach(p => newPdf.addPage(p));

      const bytes = await newPdf.save();
      const blob = new Blob([bytes as any], { type: 'application/pdf' });

      setOutputBlobData(blob, `extracted_${splitFile.name}`);
    } catch (err) {
      console.error(err);
      showError('Split failed', 'Error splitting PDF file.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // Edit/Organize Helpers
  const handleEditFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setEditFile({
        id: 'edit',
        name: f.name,
        size: f.size,
        blob: f
      });
      clearOutputs();
      setIsProcessing(true);
      setProgressMsg('Generating page previews...');

      try {
        const arrayBuf = await f.arrayBuffer();
        const doc = await PDFDocument.load(arrayBuf);
        const count = doc.getPageCount();
        
        // Dynamically load pdf.js for rendering previews
        const pdfjsLib = await loadPdfJs();
        const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuf.slice(0) }).promise;
        
        const pages: PDFPageItem[] = [];
        for (let i = 0; i < count; i++) {
          const page = await pdfjsDoc.getPage(i + 1);
          // Scale to a nice small preview (e.g. scale=0.25)
          const viewport = page.getViewport({ scale: 0.25 });
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = viewport.width;
          tempCanvas.height = viewport.height;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            await page.render({ canvasContext: tempCtx, viewport }).promise;
          }
          pages.push({
            originalIndex: i,
            rotation: 0,
            previewUrl: tempCanvas.toDataURL('image/jpeg', 0.6)
          });
        }
        setEditPages(pages);
      } catch (err) {
        console.error(err);
        showError('PDF load failed', 'Error parsing pages from PDF.');
      } finally {
        setIsProcessing(false);
        setProgressMsg('');
      }
    }
  };

  const rotatePage = (index: number) => {
    const list = [...editPages];
    list[index].rotation = (list[index].rotation + 90) % 360;
    setEditPages(list);
    clearOutputs();
  };

  const deletePage = (index: number) => {
    setEditPages(editPages.filter((_, i) => i !== index));
    clearOutputs();
  };

  const handlePageDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handlePageDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndexStr = e.dataTransfer.getData('text/plain');
    if (!sourceIndexStr) return;
    const sourceIndex = parseInt(sourceIndexStr, 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const list = [...editPages];
    const [draggedItem] = list.splice(sourceIndex, 1);
    list.splice(targetIndex, 0, draggedItem);
    setEditPages(list);
    clearOutputs();
  };

  const executeEditSave = async () => {
    if (!editFile || editPages.length === 0) return;
    setIsProcessing(true);
    setProgressMsg('Applying manipulations...');

    try {
      const arrayBuf = await editFile.blob.arrayBuffer();
      const srcDoc = await PDFDocument.load(arrayBuf);
      const outputPdf = await PDFDocument.create();

      for (const pageItem of editPages) {
        const [copiedPage] = await outputPdf.copyPages(srcDoc, [pageItem.originalIndex]);
        if (pageItem.rotation > 0) {
          copiedPage.setRotation(degrees(pageItem.rotation));
        }
        outputPdf.addPage(copiedPage);
      }

      const bytes = await outputPdf.save();
      const blob = new Blob([bytes as any], { type: 'application/pdf' });

      setOutputBlobData(blob, `edited_${editFile.name}`);
    } catch (err) {
      console.error(err);
      showError('Compilation failed', 'Error applying changes to PDF.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // Images to PDF Helpers
  const handleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const list = Array.from(e.target.files).map(f => ({
        id: Math.random().toString(36).substring(2),
        name: f.name,
        size: f.size,
        blob: f
      }));
      setImages([...images, ...list]);
      clearOutputs();
    }
  };

  const executeImagesToPdf = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    setProgressMsg('Compiling images into A4 pages...');

    try {
      const pdfDoc = await PDFDocument.create();
      
      for (const imgItem of images) {
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
      setOutputBlobData(blob, 'images_compiled.pdf');
    } catch (err) {
      console.error(err);
      showError('Conversion failed', 'Ensure images are PNG or JPG format.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // Lock PDF Execution
  const executeLockPdf = async () => {
    if (!lockFile) return;
    if (!userPassword) {
      showError('Password required', 'Please enter a password to encrypt the PDF.');
      return;
    }
    setIsProcessing(true);
    setProgressMsg('Encrypting PDF document...');

    try {
      const formData = new FormData();
      formData.append('file', lockFile.blob, lockFile.name);
      formData.append('userPassword', userPassword);
      if (ownerPassword) formData.append('ownerPassword', ownerPassword);

      const res = await fetch(`${BACKEND_API_URL}/lock-pdf`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw new Error('Server lock failed');
      }

      const blob = await res.blob();
      setOutputBlobData(blob, `protected_${lockFile.name}`);
    } catch (err) {
      console.warn('Backend PDF lock failed, falling back to client engine:', err);
      try {
        const arrayBuf = await lockFile.blob.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuf);
        const bytes = await pdfDoc.save({
          userPassword,
          ownerPassword: ownerPassword || userPassword,
        } as any);
        const blob = new Blob([bytes as any], { type: 'application/pdf' });
        setOutputBlobData(blob, `protected_${lockFile.name}`);
      } catch (fallbackErr) {
        showError('Encryption failed', 'Please make sure the backend server is running for PDF encryption.');
      }
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // Unlock PDF Execution
  const executeUnlockPdf = async () => {
    if (!unlockFile) return;
    setIsProcessing(true);
    setProgressMsg('Decrypting PDF document...');

    try {
      const formData = new FormData();
      formData.append('file', unlockFile.blob, unlockFile.name);
      formData.append('password', unlockPassword);

      const res = await fetch(`${BACKEND_API_URL}/unlock-pdf`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Server unlock failed');
      }

      const blob = await res.blob();
      setOutputBlobData(blob, `unlocked_${unlockFile.name}`);
    } catch (err: any) {
      console.warn('Backend PDF unlock failed:', err);
      showError('Unlock failed', err.message || 'Incorrect password or backend processing error.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // Watermark Execution
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
      setOutputBlobData(blob, `watermarked_${wmFile.name}`);
    } catch (err) {
      console.error(err);
      showError('Watermark failed', 'Error adding watermark to PDF.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // Add Signature Execution
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

      // Helper to convert hex color to rgb components
      const hexToRgb = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return rgb(r, g, b);
      };

      pagesToSign.forEach(pageIndex => {
        const page = pdfDoc.getPage(pageIndex);
        const { width, height } = page.getSize();
        
        // Draw Signature overlay
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

        // Draw Company Stamp overlay
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

        // Date stamp — completely independent placement
        if (includeDate && dateText.trim()) {
          const dateStr = dateText.trim();
          const dfs = Math.max(6, dateFontSize);
          
          const dateTargetCenterX = (width * datePosX) / 100;
          const dateTargetY = (height * datePosY) / 100;
          
          // Estimate dimensions for clamping
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
      setOutputBlobData(blob, `signed_${signFile.name}`);
    } catch (err) {
      console.error(err);
      showError('Signature failed', 'Error embedding signature onto PDF page.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // Add Page Numbers Execution
  const executeAddPageNumbers = async () => {
    if (!pgNumFile) return;
    setIsProcessing(true);
    setProgressMsg('Applying page numbers...');

    try {
      const pdfDoc = await PDFDocument.load(await pgNumFile.blob.arrayBuffer());
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const totalPages = pdfDoc.getPageCount();
      const pages = pdfDoc.getPages();

      pages.forEach((page, index) => {
        if (skipCoverPage && index === 0) return;

        const currentNum = index + pgNumStart - (skipCoverPage ? 1 : 0);
        let str = `${currentNum}`;

        if (pgNumFormat === 'page-total') str = `Page ${currentNum} of ${totalPages}`;
        else if (pgNumFormat === 'page-only') str = `Page ${currentNum}`;
        else if (pgNumFormat === 'num-total') str = `${currentNum} / ${totalPages}`;

        const textWidth = font.widthOfTextAtSize(str, pgNumFontSize);
        const { width, height } = page.getSize();

        let x = width - textWidth - 36;
        let y = 30;

        if (pgNumPosition === 'bottom-center') x = (width - textWidth) / 2;
        if (pgNumPosition === 'bottom-left') x = 36;
        if (pgNumPosition === 'top-right') { x = width - textWidth - 36; y = height - 36; }
        if (pgNumPosition === 'top-center') { x = (width - textWidth) / 2; y = height - 36; }

        page.drawText(str, {
          x,
          y,
          size: pgNumFontSize,
          font,
          color: rgb(0.3, 0.3, 0.3)
        });
      });

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes as any], { type: 'application/pdf' });
      setOutputBlobData(blob, `numbered_${pgNumFile.name}`);
    } catch (err) {
      console.error(err);
      showError('Numbering failed', 'Error drawing page numbers onto PDF.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // PDF to JPG Execution
  const executePdfToJpg = async () => {
    if (!pdfJpgFile) return;
    setIsProcessing(true);
    setProgressMsg('Rendering PDF pages to JPEG images...');

    try {
      const pdfjsLib = await loadPdfJs();
      const arrayBuf = await pdfJpgFile.blob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
      const resultsList: PdfJpgResult[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        setProgressMsg(`Rendering page ${i} of ${pdf.numPages}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport }).promise;

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const res = await fetch(dataUrl);
        const blob = await res.blob();

        const baseName = pdfJpgFile.name.replace(/\.[^/.]+$/, '');
        resultsList.push({
          pageNum: i,
          dataUrl,
          blob,
          size: blob.size,
          filename: `${baseName}_page_${i}.jpg`
        });
      }

      setPdfJpgResults(resultsList);
      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('PDF to JPG', pdfJpgFile.name, pdfJpgFile.size);
      showSuccess('Conversion complete!', `Rendered ${resultsList.length} page(s) to JPG.`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err) {
      console.error(err);
      showError('Conversion failed', 'Error converting PDF pages to JPG images.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const setOutputBlobData = (blob: Blob, defaultName: string) => {
    setOutputUrl(URL.createObjectURL(blob));
    setOutputSize(blob.size);
    setOutputName(defaultName);

    StorageService.updateStats(1, 0);
    HistoryService.addPdfEntry(defaultName.split('_')[0] || 'PDF Operation', defaultName, blob.size);

    showSuccess('PDF ready!', `${defaultName} · ${getFriendlySize(blob.size)}`);
    confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
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

  const downloadSingleJpg = (item: PdfJpgResult) => {
    const a = document.createElement('a');
    a.href = item.dataUrl;
    a.download = item.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">PDF Utilities</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manipulate pages, digital signatures, page numbers, PDF to JPG, lock/unlock, watermarks & merge — all in browser.</p>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {[
            { id: 'merge', label: 'Merge PDFs', icon: ListOrdered },
            { id: 'split', label: 'Split PDF', icon: FileText },
            { id: 'edit', label: 'Rotate & Order', icon: RotateCw },
            { id: 'imgToPdf', label: 'Images to PDF', icon: Upload },
            { id: 'sign', label: 'Add Sign', icon: PenTool },
            { id: 'pageNumbers', label: 'Page Numbers', icon: Hash },
            { id: 'pdfToJpg', label: 'PDF to JPG', icon: FileImage },
            { id: 'lock', label: 'Lock PDF', icon: Lock },
            { id: 'unlock', label: 'Unlock PDF', icon: Unlock },
            { id: 'watermark', label: 'Add Watermark', icon: Droplets }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button 
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as PdfToolTab);
                  clearOutputs();
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                  activeTab === tab.id 
                    ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/20' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Input Controls Sidebar / Left Column */}
        <div className="lg:col-span-5 space-y-6">

          {/* Merge PDFs Tab */}
          {activeTab === 'merge' && (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-violet-500" />
                <span>Merge Multiple PDFs</span>
              </h3>

              <div className="space-y-3">
                <input 
                  type="file" 
                  ref={mergeInputRef} 
                  onChange={handleMergeFiles} 
                  accept="application/pdf" 
                  multiple 
                  className="hidden" 
                />
                <button
                  onClick={() => mergeInputRef.current?.click()}
                  className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-violet-500 dark:hover:border-violet-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4 text-violet-500" />
                  <span>Add PDF Documents</span>
                </button>

                {mergeFiles.length > 0 && (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {mergeFiles.map((file, idx) => (
                      <div key={file.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 text-xs">
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <FileText className="w-4 h-4 text-violet-500 flex-shrink-0" />
                          <span className="truncate font-semibold text-slate-700 dark:text-slate-300">{file.name}</span>
                          <span className="text-[10px] text-slate-400">({getFriendlySize(file.size)})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => moveMergeItem(idx, 'up')} disabled={idx === 0} className="p-1 hover:text-violet-500 disabled:opacity-30">
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => moveMergeItem(idx, 'down')} disabled={idx === mergeFiles.length - 1} className="p-1 hover:text-violet-500 disabled:opacity-30">
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => removeMergeItem(file.id)} className="p-1 text-red-500 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={executeMerge}
                disabled={mergeFiles.length < 2 || isProcessing}
                className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ListOrdered className="w-4 h-4" />}
                <span>{isProcessing ? progressMsg : 'Merge PDFs Now'}</span>
              </button>
            </div>
          )}

          {/* Split PDF Tab */}
          {activeTab === 'split' && (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-500" />
                <span>Split & Extract Pages</span>
              </h3>

              <div className="space-y-4">
                <input 
                  type="file" 
                  ref={splitInputRef} 
                  onChange={handleSplitFile} 
                  accept="application/pdf" 
                  className="hidden" 
                />
                <button
                  onClick={() => splitInputRef.current?.click()}
                  className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-violet-500 dark:hover:border-violet-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4 text-violet-500" />
                  <span>{splitFile ? splitFile.name : 'Select PDF to Split'}</span>
                </button>

                {splitFile && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      Page Ranges (e.g. 1-3, 5, 8-10)
                    </label>
                    <input
                      type="text"
                      value={splitRange}
                      onChange={(e) => setSplitRange(e.target.value)}
                      placeholder="1-2, 5"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={executeSplit}
                disabled={!splitFile || isProcessing}
                className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                <span>{isProcessing ? progressMsg : 'Extract Pages'}</span>
              </button>
            </div>
          )}

          {/* Rotate & Reorder Tab */}
          {activeTab === 'edit' && (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <RotateCw className="w-4 h-4 text-violet-500" />
                <span>Rotate & Reorder Pages</span>
              </h3>

              <div className="space-y-4">
                <input 
                  type="file" 
                  ref={editInputRef} 
                  onChange={handleEditFile} 
                  accept="application/pdf" 
                  className="hidden" 
                />
                <button
                  onClick={() => editInputRef.current?.click()}
                  className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-violet-500 dark:hover:border-violet-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4 text-violet-500" />
                  <span>{editFile ? editFile.name : 'Select PDF to Edit'}</span>
                </button>
              </div>

              <button
                onClick={executeEditSave}
                disabled={!editFile || editPages.length === 0 || isProcessing}
                className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                <span>{isProcessing ? progressMsg : 'Save Modified PDF'}</span>
              </button>
            </div>
          )}

          {/* Images to PDF Tab */}
          {activeTab === 'imgToPdf' && (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Upload className="w-4 h-4 text-violet-500" />
                <span>Images to PDF Document</span>
              </h3>

              <div className="space-y-3">
                <input 
                  type="file" 
                  ref={imagesInputRef} 
                  onChange={handleImagesUpload} 
                  accept="image/png, image/jpeg, image/jpg" 
                  multiple 
                  className="hidden" 
                />
                <button
                  onClick={() => imagesInputRef.current?.click()}
                  className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-violet-500 dark:hover:border-violet-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4 text-violet-500" />
                  <span>Add PNG / JPG Images</span>
                </button>

                {images.length > 0 && (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {images.map(img => (
                      <div key={img.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 text-xs">
                        <span className="truncate font-semibold text-slate-700 dark:text-slate-300">{img.name}</span>
                        <span className="text-[10px] text-slate-400">({getFriendlySize(img.size)})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={executeImagesToPdf}
                disabled={images.length === 0 || isProcessing}
                className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                <span>{isProcessing ? progressMsg : 'Compile to PDF'}</span>
              </button>
            </div>
          )}

          {/* Add Signature Sidebar Controls */}
          {activeTab === 'sign' && (
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
                  className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4 text-emerald-500" />
                  <span>{signFile ? signFile.name : 'Select PDF Document'}</span>
                </button>

                {signFile && (
                  <div className="space-y-4">
                    {/* Signature Input Mode Selection */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Signature Source
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          onClick={() => setSignMode('draw')}
                          className={`py-2 text-[10px] font-bold rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${
                            signMode === 'draw' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>Draw</span>
                        </button>
                        <button
                          onClick={() => setSignMode('upload')}
                          className={`py-2 text-[10px] font-bold rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${
                            signMode === 'upload' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Upload</span>
                        </button>
                        <button
                          onClick={() => setSignMode('text')}
                          className={`py-2 text-[10px] font-bold rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${
                            signMode === 'text' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <Type className="w-3.5 h-3.5" />
                          <span>Text</span>
                        </button>
                      </div>
                    </div>

                    {/* Signature Input Panel */}
                    {signMode === 'draw' ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          <span>Freehand Ink Drawing</span>
                          <button onClick={clearSigCanvas} className="text-red-500 hover:text-red-600 flex items-center gap-1 text-xs font-bold">
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
                          onClick={() => signImageInputRef.current?.click()}
                          className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2"
                        >
                          <Upload className="w-4 h-4 text-emerald-500" />
                          <span>{signImageFile ? signImageFile.name : 'Upload Signature Image (PNG/JPG)'}</span>
                        </button>
                      </div>
                    ) : signMode === 'text' ? (
                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Signature Name / Text
                        </label>
                        <input
                          type="text"
                          value={signText}
                          onChange={(e) => setSignText(e.target.value)}
                          placeholder=""
                          className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        />
                        {/* Font Style Selector — Google Fonts preview */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Font Family</label>
                          <div className="grid grid-cols-2 gap-1.5">
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
                                onClick={() => setSignFontStyle(fs.key)}
                                className={`px-2 py-2 text-xs rounded-lg border transition-all truncate text-center ${
                                  signFontStyle === fs.key
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                                style={{ fontFamily: fs.sample, fontWeight: 700 }}
                              >
                                {fs.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Underline Toggle */}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={signUnderline}
                            onChange={(e) => setSignUnderline(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Add Underline</span>
                        </label>
                      </div>
                    ) : null}

                    {/* Ink Color Picker */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Ink Color</label>
                      <div className="flex items-center gap-1.5">
                        {[
                          { color: '#0f172a', label: 'Black' },
                          { color: '#1e3a5f', label: 'Navy' },
                          { color: '#1d4ed8', label: 'Blue' },
                          { color: '#dc2626', label: 'Red' },
                          { color: '#059669', label: 'Green' },
                          { color: '#7c3aed', label: 'Purple' },
                        ].map(c => (
                          <button
                            key={c.color}
                            onClick={() => setSignColor(c.color)}
                            title={c.label}
                            className={`w-7 h-7 rounded-full border-2 transition-all ${
                              signColor === c.color
                                ? 'border-emerald-400 ring-2 ring-emerald-500/40 scale-110'
                                : 'border-slate-300 dark:border-slate-600 hover:scale-105'
                            }`}
                            style={{ backgroundColor: c.color }}
                          />
                        ))}
                        <div className="relative ml-1">
                          <input
                            type="color"
                            value={signColor}
                            onChange={(e) => setSignColor(e.target.value)}
                            className="w-7 h-7 rounded-full cursor-pointer border-2 border-slate-300 dark:border-slate-600"
                            title="Custom color"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Independent Company Stamp Image Uploader & Settings */}
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <label htmlFor="inc-stamp" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            id="inc-stamp"
                            checked={includeStamp}
                            onChange={(e) => setIncludeStamp(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Add Company Stamp / Seal</span>
                        </label>
                      </div>

                      {includeStamp && (
                        <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                          <div>
                            <input
                              type="file"
                              ref={stampImageInputRef}
                              onChange={(e) => e.target.files?.[0] && setStampImageFile(e.target.files[0])}
                              accept="image/png, image/jpeg"
                              className="hidden"
                            />
                            <button
                              onClick={() => stampImageInputRef.current?.click()}
                              className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-white dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2"
                            >
                              <Upload className="w-3.5 h-3.5 text-emerald-500" />
                              <span>{stampImageFile ? stampImageFile.name : 'Upload Custom Stamp Image'}</span>
                            </button>
                          </div>
                          
                          {stampPreviewUrl && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Stamp Scale ({Math.round(stampScale * 100)}%)</label>
                                <input
                                  type="range"
                                  min={0.1}
                                  max={0.8}
                                  step={0.05}
                                  value={stampScale}
                                  onChange={(e) => setStampScale(Number(e.target.value))}
                                  className="w-full accent-emerald-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Stamp Opacity ({Math.round(stampOpacity * 100)}%)</label>
                                <input
                                  type="range"
                                  min={0.2}
                                  max={1.0}
                                  step={0.05}
                                  value={stampOpacity}
                                  onChange={(e) => setStampOpacity(Number(e.target.value))}
                                  className="w-full accent-emerald-500"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Draggable Sidebar Stamp Card (iLovePDF Style) — High Visibility Checkerboard */}
                    <div className="p-3 rounded-2xl border-2 border-dashed border-emerald-500/80 bg-emerald-500/5 dark:bg-emerald-950/30 space-y-2">
                      <div className="flex justify-between items-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <span className="flex items-center gap-1">
                          <GripVertical className="w-3.5 h-3.5" />
                          <span>Your Signature Stamp</span>
                        </span>
                        <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-extrabold uppercase">
                          Drag to Document
                        </span>
                      </div>

                      <div
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', 'sig');
                          e.dataTransfer.effectAllowed = 'copyMove';
                        }}
                        className="p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:8px_8px] shadow-inner cursor-grab active:cursor-grabbing hover:border-emerald-500 transition-all flex flex-col items-center justify-center group min-h-[70px]"
                      >
                        {sigPreviewUrl ? (
                          <img src={sigPreviewUrl} alt="Signature Stamp" className="max-h-12 max-w-[180px] object-contain pointer-events-none" />
                        ) : (
                          <div className="font-serif italic font-bold text-lg text-slate-800" style={{ fontFamily: getSignFontFamily(signFontStyle), color: signColor }}>
                            {signText || 'Sign Text'}
                          </div>
                        )}
                        <div className="text-[9px] text-slate-500 font-semibold mt-1.5 flex items-center gap-1 group-hover:text-emerald-600">
                          <Move className="w-2.5 h-2.5" /> Drag & Drop signature onto document
                        </div>
                      </div>
                    </div>

                    {/* Draggable Company Stamp Card */}
                    {includeStamp && stampPreviewUrl && (
                      <div className="p-3 rounded-2xl border-2 border-dashed border-sky-500/80 bg-sky-50/5 dark:bg-sky-950/30 space-y-2">
                        <div className="flex justify-between items-center text-[11px] font-bold text-sky-600 dark:text-sky-400">
                          <span className="flex items-center gap-1">
                            <GripVertical className="w-3.5 h-3.5" />
                            <span>Your Company Stamp</span>
                          </span>
                          <span className="text-[9px] bg-sky-600 text-white px-1.5 py-0.5 rounded font-extrabold uppercase">
                            Drag to Document
                          </span>
                        </div>

                        <div
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', 'stamp');
                            e.dataTransfer.effectAllowed = 'copyMove';
                          }}
                          className="p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:8px_8px] shadow-inner cursor-grab active:cursor-grabbing hover:border-sky-500 transition-all flex flex-col items-center justify-center group min-h-[70px]"
                        >
                          <img src={stampPreviewUrl} alt="Company Stamp" className="max-h-12 max-w-[180px] object-contain pointer-events-none" />
                          <div className="text-[9px] text-slate-500 font-semibold mt-1.5 flex items-center gap-1 group-hover:text-sky-600">
                            <Move className="w-2.5 h-2.5" /> Drag & Drop stamp onto document
                          </div>
                        </div>
                      </div>
                    )}

                     {/* Page Target & Size Controls */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Target Page</label>
                          <select
                            value={signTargetPage}
                            onChange={(e) => setSignTargetPage(e.target.value as any)}
                            className="w-full px-1.5 py-1.5 text-[11px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                          >
                            <option value="current">Current Page ({signCurrentPageNum})</option>
                            <option value="all">All Pages</option>
                            <option value="custom">Custom Pages...</option>
                            <option value="first">First Page (1)</option>
                            <option value="last">Last Page ({signNumPages})</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Scale ({Math.round(signScale * 100)}%)</label>
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
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Opacity ({Math.round(signOpacity * 100)}%)</label>
                        <input
                          type="range"
                          min={0.2}
                          max={1.0}
                          step={0.05}
                          value={signOpacity}
                          onChange={(e) => setSignOpacity(Number(e.target.value))}
                          className="w-full accent-emerald-500"
                        />
                      </div>
                    </div>

                    {signTargetPage === 'custom' && (
                      <div className="pt-1">
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                          Enter Page Numbers / Ranges (e.g. 2,3 or 1-3)
                        </label>
                        <input
                          type="text"
                          value={customPageRange}
                          onChange={(e) => setCustomPageRange(e.target.value)}
                          placeholder="e.g. 2,3"
                          className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none"
                        />
                      </div>
                    )}
                    </div>

                    {/* Date Stamp Controls — Independent */}
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="inc-date" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            id="inc-date"
                            checked={includeDate}
                            onChange={(e) => setIncludeDate(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Add Date Stamp</span>
                        </label>
                      </div>

                      {includeDate && (
                        <div className="space-y-2 pt-1">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Date Text</label>
                            <input
                              type="text"
                              value={dateText}
                              onChange={(e) => setDateText(e.target.value)}
                              placeholder="dd/mm/yyyy"
                              className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Date Color</label>
                              <div className="flex items-center gap-1.5">
                                {[
                                  { color: '#334155', label: 'Dark' },
                                  { color: '#0f172a', label: 'Black' },
                                  { color: '#1d4ed8', label: 'Blue' },
                                  { color: '#dc2626', label: 'Red' },
                                ].map(c => (
                                  <button
                                    key={c.color}
                                    onClick={() => setDateColor(c.color)}
                                    title={c.label}
                                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                                      dateColor === c.color
                                        ? 'border-emerald-400 ring-1 ring-emerald-500/40 scale-110'
                                        : 'border-slate-300 dark:border-slate-600 hover:scale-105'
                                    }`}
                                    style={{ backgroundColor: c.color }}
                                  />
                                ))}
                                <input
                                  type="color"
                                  value={dateColor}
                                  onChange={(e) => setDateColor(e.target.value)}
                                  className="w-5 h-5 rounded-full cursor-pointer border border-slate-300 dark:border-slate-600"
                                  title="Custom"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Font Size ({dateFontSize}px)</label>
                              <input
                                type="range"
                                min={6}
                                max={20}
                                value={dateFontSize}
                                onChange={(e) => setDateFontSize(Number(e.target.value))}
                                className="w-full accent-emerald-500"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={executeAddSignature}
                disabled={!signFile || isProcessing}
                className="w-full py-3.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PenTool className="w-4 h-4" />}
                <span>{isProcessing ? progressMsg : 'Sign PDF Document'}</span>
              </button>
            </div>
          )}

          {/* Add Page Numbers Tab */}
          {activeTab === 'pageNumbers' && (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Hash className="w-4 h-4 text-indigo-500" />
                <span>Add Page Numbering</span>
              </h3>

              <div className="space-y-4">
                <input 
                  type="file" 
                  ref={pgNumInputRef} 
                  onChange={(e) => e.target.files?.[0] && setPgNumFile({ id: 'pgNum', name: e.target.files[0].name, size: e.target.files[0].size, blob: e.target.files[0] })} 
                  accept="application/pdf" 
                  className="hidden" 
                />
                <button
                  onClick={() => pgNumInputRef.current?.click()}
                  className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4 text-indigo-500" />
                  <span>{pgNumFile ? pgNumFile.name : 'Select PDF Document'}</span>
                </button>

                {pgNumFile && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Number Format</label>
                        <select
                          value={pgNumFormat}
                          onChange={(e) => setPgNumFormat(e.target.value as any)}
                          className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                        >
                          <option value="page-total">Page 1 of 10</option>
                          <option value="page-only">Page 1</option>
                          <option value="num-total">1 / 10</option>
                          <option value="num-only">1</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Position</label>
                        <select
                          value={pgNumPosition}
                          onChange={(e) => setPgNumPosition(e.target.value as any)}
                          className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                        >
                          <option value="bottom-right">Bottom Right</option>
                          <option value="bottom-center">Bottom Center</option>
                          <option value="bottom-left">Bottom Left</option>
                          <option value="top-right">Top Right</option>
                          <option value="top-center">Top Center</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Font Size ({pgNumFontSize}pt)</label>
                        <input
                          type="number"
                          min={8}
                          max={24}
                          value={pgNumFontSize}
                          onChange={(e) => setPgNumFontSize(Number(e.target.value))}
                          className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Start Page Number</label>
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={pgNumStart}
                          onChange={(e) => setPgNumStart(Number(e.target.value))}
                          className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="skip-cover"
                        checked={skipCoverPage}
                        onChange={(e) => setSkipCoverPage(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="skip-cover" className="text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">
                        Skip Cover Page (Start on Page 2)
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={executeAddPageNumbers}
                disabled={!pgNumFile || isProcessing}
                className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
                <span>{isProcessing ? progressMsg : 'Apply Page Numbers'}</span>
              </button>
            </div>
          )}

          {/* PDF to JPG Tab */}
          {activeTab === 'pdfToJpg' && (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <FileImage className="w-4 h-4 text-fuchsia-500" />
                <span>Convert PDF Pages to JPG</span>
              </h3>

              <div className="space-y-4">
                <input 
                  type="file" 
                  ref={pdfJpgInputRef} 
                  onChange={(e) => e.target.files?.[0] && setPdfJpgFile({ id: 'pdfJpg', name: e.target.files[0].name, size: e.target.files[0].size, blob: e.target.files[0] })} 
                  accept="application/pdf" 
                  className="hidden" 
                />
                <button
                  onClick={() => pdfJpgInputRef.current?.click()}
                  className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-fuchsia-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4 text-fuchsia-500" />
                  <span>{pdfJpgFile ? pdfJpgFile.name : 'Select PDF Document'}</span>
                </button>
              </div>

              <button
                onClick={executePdfToJpg}
                disabled={!pdfJpgFile || isProcessing}
                className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileImage className="w-4 h-4" />}
                <span>{isProcessing ? progressMsg : 'Convert to JPG Images'}</span>
              </button>
            </div>
          )}

          {/* Lock PDF Tab */}
          {activeTab === 'lock' && (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500" />
                <span>Encrypt & Password Protect PDF</span>
              </h3>

              <div className="space-y-4">
                <input 
                  type="file" 
                  ref={lockInputRef} 
                  onChange={(e) => e.target.files?.[0] && setLockFile({ id: 'lock', name: e.target.files[0].name, size: e.target.files[0].size, blob: e.target.files[0] })} 
                  accept="application/pdf" 
                  className="hidden" 
                />
                <button
                  onClick={() => lockInputRef.current?.click()}
                  className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4 text-amber-500" />
                  <span>{lockFile ? lockFile.name : 'Select PDF to Lock'}</span>
                </button>

                {lockFile && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        User Password (Required)
                      </label>
                      <div className="relative">
                        <Key className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="password"
                          value={userPassword}
                          onChange={(e) => setUserPassword(e.target.value)}
                          placeholder="Enter password..."
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Owner Password (Optional)
                      </label>
                      <input
                        type="password"
                        value={ownerPassword}
                        onChange={(e) => setOwnerPassword(e.target.value)}
                        placeholder="Owner master password..."
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={executeLockPdf}
                disabled={!lockFile || !userPassword || isProcessing}
                className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>{isProcessing ? progressMsg : 'Encrypt & Protect PDF'}</span>
              </button>
            </div>
          )}

          {/* Unlock PDF Tab */}
          {activeTab === 'unlock' && (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Unlock className="w-4 h-4 text-emerald-500" />
                <span>Remove PDF Password Protection</span>
              </h3>

              <div className="space-y-4">
                <input 
                  type="file" 
                  ref={unlockInputRef} 
                  onChange={(e) => e.target.files?.[0] && setUnlockFile({ id: 'unlock', name: e.target.files[0].name, size: e.target.files[0].size, blob: e.target.files[0] })} 
                  accept="application/pdf" 
                  className="hidden" 
                />
                <button
                  onClick={() => unlockInputRef.current?.click()}
                  className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4 text-emerald-500" />
                  <span>{unlockFile ? unlockFile.name : 'Select Password PDF'}</span>
                </button>

                {unlockFile && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      PDF Password
                    </label>
                    <div className="relative">
                      <Key className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        value={unlockPassword}
                        onChange={(e) => setUnlockPassword(e.target.value)}
                        placeholder="Enter password..."
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={executeUnlockPdf}
                disabled={!unlockFile || isProcessing}
                className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                <span>{isProcessing ? progressMsg : 'Unlock & Save PDF'}</span>
              </button>
            </div>
          )}

          {/* Add Watermark Tab */}
          {activeTab === 'watermark' && (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Droplets className="w-4 h-4 text-blue-500" />
                <span>Add Watermark to PDF</span>
              </h3>

              <div className="space-y-4">
                <input 
                  type="file" 
                  ref={wmInputRef} 
                  onChange={(e) => e.target.files?.[0] && setWmFile({ id: 'wm', name: e.target.files[0].name, size: e.target.files[0].size, blob: e.target.files[0] })} 
                  accept="application/pdf" 
                  className="hidden" 
                />
                <button
                  onClick={() => wmInputRef.current?.click()}
                  className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 bg-white/50 dark:bg-slate-950/20 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4 text-blue-500" />
                  <span>{wmFile ? wmFile.name : 'Select PDF Document'}</span>
                </button>

                {wmFile && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setWmType('text')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1 ${
                          wmType === 'text' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Type className="w-3.5 h-3.5" />
                        <span>Text Stamp</span>
                      </button>
                      <button
                        onClick={() => setWmType('image')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1 ${
                          wmType === 'image' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Logo / Image</span>
                      </button>
                    </div>

                    {wmType === 'text' ? (
                      <>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Watermark Text</label>
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
                      </>
                    ) : (
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
                          className="w-full py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                        >
                          {wmImageFile ? wmImageFile.name : 'Upload Logo (PNG/JPG)'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={executeAddWatermark}
                disabled={!wmFile || isProcessing}
                className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Droplets className="w-4 h-4" />}
                <span>{isProcessing ? progressMsg : 'Apply Watermark'}</span>
              </button>
            </div>
          )}

        </div>

        {/* Workspace / Output Main Center & Right Area */}
        <div className="lg:col-span-7 space-y-6">


          {activeTab === 'sign' && signFile ? (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-4">
              {/* Document Page Navigation Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px] sm:max-w-[280px]">
                    {signFile.name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const newPage = Math.max(1, signCurrentPageNum - 1);
                      setSignCurrentPageNum(newPage);
                      // Scroll the container to focus on the selected page wrapper
                      const target = docViewerContainerRef.current?.querySelectorAll('.pdf-page-wrapper')[newPage - 1];
                      target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }}
                    disabled={signCurrentPageNum <= 1}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Page {signCurrentPageNum} of {signNumPages}
                  </span>
                  <button
                    onClick={() => {
                      const newPage = Math.min(signNumPages, signCurrentPageNum + 1);
                      setSignCurrentPageNum(newPage);
                      // Scroll the container to focus on the selected page wrapper
                      const target = docViewerContainerRef.current?.querySelectorAll('.pdf-page-wrapper')[newPage - 1];
                      target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }}
                    disabled={signCurrentPageNum >= signNumPages}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Real PDF Document Interactive Viewer — Scrollable Multi-Page Stack */}
              <div 
                ref={docViewerContainerRef}
                onScroll={handleViewerScroll}
                onClick={handlePageBackgroundClick}
                className="flex flex-col items-center bg-slate-900/60 dark:bg-slate-950 p-6 rounded-2xl border border-slate-800 overflow-y-auto max-h-[640px] gap-8 relative select-none w-full"
              >
                <div className="space-y-8 w-full flex flex-col items-center">
                  {Array.from({ length: signNumPages }).map((_, index) => (
                    <div 
                      key={index}
                      ref={signCurrentPageNum === index + 1 ? pdfPageContainerRef : undefined}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                      }}
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
                      className={`relative shadow-2xl rounded-lg bg-white border pdf-page-wrapper transition-all duration-200 ${
                        signCurrentPageNum === index + 1 
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                          : 'border-slate-800 hover:border-slate-600'
                      }`}
                      style={{ width: 'fit-content' }}
                    >
                      {/* Stacked PDF Page Canvas */}
                      <canvas 
                        ref={(el) => { pageCanvasesRef.current[index] = el; }} 
                        className="block max-w-full h-auto rounded-lg" 
                      />

                      {/* Display interactive overlays ONLY on the active page wrapper */}
                      {signCurrentPageNum === index + 1 && (
                        <>
                          {/* Canva-like Signature Overlay */}
                          {(sigPreviewUrl || signText.trim()) && (() => {
                            const containerEl = pdfPageContainerRef.current;
                            const overlayEl = sigOverlayRef.current;
                            let leftPx = 0;
                            let topPx = 0;
                            if (containerEl) {
                              const cW = containerEl.offsetWidth;
                              const cH = containerEl.offsetHeight;
                              const oW = overlayEl ? overlayEl.offsetWidth : 120;
                              const oH = overlayEl ? overlayEl.offsetHeight : 50;
                              const centerXpx = (signPosX / 100) * cW;
                              const centerYpx = ((100 - signPosY) / 100) * cH;
                              leftPx = Math.max(0, Math.min(cW - oW, centerXpx - oW / 2));
                              topPx = Math.max(0, Math.min(cH - oH, centerYpx - oH / 2));
                            }
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
                                  isDraggingSig 
                                    ? 'cursor-grabbing z-30' 
                                    : 'cursor-grab z-20'
                                }`}
                                style={{
                                  left: `${leftPx}px`,
                                  top: `${topPx}px`,
                                  transform: `scale(${sigScale_})`,
                                  transformOrigin: 'top left',
                                  opacity: signOpacity,
                                  transition: isDraggingSig ? 'none' : 'left 0.1s ease-out, top 0.1s ease-out',
                                }}
                              >
                                <div className={`absolute inset-0 rounded pointer-events-none transition-all ${
                                  isSigSelected 
                                    ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' 
                                    : 'ring-1 ring-slate-400/40 hover:ring-emerald-500/60'
                                }`} />
                                {isSigSelected && (
                                  <>
                                    <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm pointer-events-none" />
                                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm pointer-events-none" />
                                    <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm pointer-events-none" />
                                    <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm pointer-events-none" />
                                  </>
                                )}
                                <div className="p-1.5">
                                  {sigPreviewUrl ? (
                                    <img src={sigPreviewUrl} alt="Signature" className="max-h-20 max-w-[240px] object-contain pointer-events-none drop-shadow-sm" />
                                  ) : (
                                    <div className="font-serif italic font-extrabold text-lg text-slate-900 pointer-events-none px-2 py-1">
                                      {signText}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Canva-like Company Stamp Overlay */}
                          {includeStamp && stampPreviewUrl && (() => {
                            const containerEl = pdfPageContainerRef.current;
                            const overlayEl = stampOverlayRef.current;
                            let leftPx = 0;
                            let topPx = 0;
                            if (containerEl) {
                              const cW = containerEl.offsetWidth;
                              const cH = containerEl.offsetHeight;
                              const oW = overlayEl ? overlayEl.offsetWidth : 120;
                              const oH = overlayEl ? overlayEl.offsetHeight : 120;
                              const centerXpx = (stampPosX / 100) * cW;
                              const centerYpx = ((100 - stampPosY) / 100) * cH;
                              leftPx = Math.max(0, Math.min(cW - oW, centerXpx - oW / 2));
                              topPx = Math.max(0, Math.min(cH - oH, centerYpx - oH / 2));
                            }
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
                                  isDraggingStamp 
                                    ? 'cursor-grabbing z-30' 
                                    : 'cursor-grab z-20'
                                }`}
                                style={{
                                  left: `${leftPx}px`,
                                  top: `${topPx}px`,
                                  transform: `scale(${stampScale_})`,
                                  transformOrigin: 'top left',
                                  opacity: stampOpacity,
                                  transition: isDraggingStamp ? 'none' : 'left 0.1s ease-out, top 0.1s ease-out',
                                }}
                              >
                                <div className={`absolute inset-0 rounded pointer-events-none transition-all ${
                                  isStampSelected 
                                    ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' 
                                    : 'ring-1 ring-slate-400/40 hover:ring-sky-500/60'
                                }`} />
                                {isStampSelected && (
                                  <>
                                    <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm pointer-events-none" />
                                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm pointer-events-none" />
                                    <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm pointer-events-none" />
                                    <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm pointer-events-none" />
                                  </>
                                )}
                                <div className="p-1.5">
                                  <img src={stampPreviewUrl} alt="Company Stamp" className="max-h-20 max-w-[240px] object-contain pointer-events-none drop-shadow-sm" />
                                </div>
                              </div>
                            );
                          })()}

                          {/* Canva-like Independent Date Stamp Overlay */}
                          {includeDate && dateText.trim() && (() => {
                            const containerEl = pdfPageContainerRef.current;
                            const overlayEl = dateOverlayRef.current;
                            let leftPx = 0;
                            let topPx = 0;
                            if (containerEl) {
                              const cW = containerEl.offsetWidth;
                              const cH = containerEl.offsetHeight;
                              const oW = overlayEl ? overlayEl.offsetWidth : 100;
                              const oH = overlayEl ? overlayEl.offsetHeight : 36;
                              const centerXpx = (datePosX / 100) * cW;
                              const centerYpx = ((100 - datePosY) / 100) * cH;
                              leftPx = Math.max(0, Math.min(cW - oW, centerXpx - oW / 2));
                              topPx = Math.max(0, Math.min(cH - oH, centerYpx - oH / 2));
                            }
                            return (
                              <div
                                ref={dateOverlayRef}
                                tabIndex={0}
                                onPointerDown={handleDatePointerDown}
                                onPointerMove={handleDatePointerMove}
                                onPointerUp={handleDatePointerUp}
                                onFocus={() => setIsDateSelected(true)}
                                className={`absolute select-none rounded outline-none p-1.5 ${
                                  isDraggingDate 
                                    ? 'cursor-grabbing z-30' 
                                    : 'cursor-grab z-20'
                                }`}
                                style={{
                                  left: `${leftPx}px`,
                                  top: `${topPx}px`,
                                  fontSize: `${dateFontSize}px`,
                                  color: dateColor,
                                  opacity: signOpacity,
                                  fontWeight: 700,
                                  transition: isDraggingDate ? 'none' : 'left 0.1s ease-out, top 0.1s ease-out',
                                }}
                              >
                                <div className={`absolute inset-0 rounded pointer-events-none transition-all ${
                                  isDateSelected 
                                    ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' 
                                    : 'ring-1 ring-slate-400/40 hover:ring-emerald-500/60'
                                }`} />
                                {isDateSelected && (
                                  <>
                                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-white border-2 border-blue-500 rounded-sm pointer-events-none" />
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-white border-2 border-blue-500 rounded-sm pointer-events-none" />
                                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border-2 border-blue-500 rounded-sm pointer-events-none" />
                                    <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border-2 border-blue-500 rounded-sm pointer-events-none" />
                                  </>
                                )}
                                <span className="px-1.5 py-0.5 block pointer-events-none select-none whitespace-nowrap">
                                  {dateText}
                                </span>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span>🖱️ Drag to move</span>
                <span>⌨️ Arrow keys for fine adjustment</span>
                <span>⇧ Shift+Arrow for bigger steps</span>
                <span>Esc to deselect</span>
              </div>
            </div>
          ) : activeTab === 'edit' && editFile && editPages.length > 0 ? (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Arrange PDF Sheets</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-h-[620px] overflow-y-auto pr-1">
                {editPages.map((page, idx) => (
                  <div 
                    key={idx}
                    draggable={true}
                    onDragStart={(e) => handlePageDragStart(e, idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handlePageDrop(e, idx)}
                    className="relative border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white/35 dark:bg-slate-950/20 text-center space-y-3 group shadow-sm flex flex-col justify-between cursor-grab active:cursor-grabbing hover:border-violet-500 hover:ring-2 hover:ring-violet-500/10 transition-all duration-200"
                  >
                    <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Sheet {page.originalIndex + 1}
                    </div>
                    <div className="w-40 h-56 border border-slate-200 dark:border-slate-800 mx-auto rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center shadow-md relative overflow-hidden transition-transform duration-300 ease-out pointer-events-none"
                      style={{
                        transform: `rotate(${page.rotation}deg)`
                      }}
                    >
                      {page.previewUrl ? (
                        <img 
                          src={page.previewUrl} 
                          alt={`Page ${page.originalIndex + 1}`} 
                          className="w-full h-full object-contain pointer-events-none" 
                        />
                      ) : (
                        <FileText className="w-12 h-12 text-slate-400" />
                      )}
                      {page.rotation > 0 && (
                        <span className="absolute bottom-1 right-1 bg-violet-600 text-white text-[8px] px-1 py-0.5 rounded font-extrabold shadow leading-none z-10">
                          {page.rotation}°
                        </span>
                      )}
                    </div>

                    <div className="flex justify-center gap-2 pt-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); rotatePage(idx); }} className="p-1.5 hover:text-violet-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg" title="Rotate Page">
                        <RotateCw className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deletePage(idx); }} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg" title="Delete Page">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'pdfToJpg' && pdfJpgResults.length > 0 ? (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-md font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Converted JPG Images ({pdfJpgResults.length})</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[380px] overflow-y-auto pr-1">
                {pdfJpgResults.map(item => (
                  <div key={item.pageNum} className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-slate-950/30 space-y-2">
                    <div className="h-40 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-800">
                      <img src={item.dataUrl} alt={`Page ${item.pageNum}`} className="max-h-full object-contain" />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Page {item.pageNum}</span>
                      <span className="text-[10px] text-slate-400">{getFriendlySize(item.size)}</span>
                    </div>
                    <button
                      onClick={() => downloadSingleJpg(item)}
                      className="w-full py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center gap-1 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Page {item.pageNum}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : outputUrl ? (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="text-md font-bold text-slate-800 dark:text-slate-200">Output Document Compiled</span>
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{getFriendlySize(outputSize)}</span>
              </div>

              {/* Output Live Stacked Pages Previewer */}
              {outputPdfDoc && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900/10 dark:bg-slate-950/40 flex flex-col items-center gap-3">
                  <div className="flex justify-between items-center w-full pb-2 border-b border-slate-200/50 dark:border-slate-800/50">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Live Document Preview</span>
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
              )}

              <button
                onClick={handleDownload}
                className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Resulting PDF</span>
              </button>
            </div>
          ) : (
            <div className="h-full min-h-[380px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/20 dark:bg-slate-900/20 glass-panel flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-4">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Workspace is empty</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
                Choose a PDF operation tab on the top-right, import files on the left, and run compiler actions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
