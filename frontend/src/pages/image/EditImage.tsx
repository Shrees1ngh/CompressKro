// ============================================================
// CompressKro — Pro Image Editor Page Component
// ============================================================

import { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  Edit3, 
  RotateCw, 
  RotateCcw, 
  Sliders, 
  Download, 
  Undo2,  
  Redo2, 
  RefreshCw, 
  Paintbrush, 
  Type, 
  Crop as CropIcon, 
  Sparkles, 
  Trash2,
  Check,
  ArrowUpRight,
  Square,
  Circle,
  Minus
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';

export interface EditorObject {
  id: string;
  type: 'text' | 'watermark' | 'shape';
  x: number; // in internal canvas pixels (top-left x)
  y: number; // in internal canvas pixels (top-left y)
  w: number; // width in canvas pixels
  h: number; // height in canvas pixels
  text?: string;
  textSize?: number;
  textColor?: string;
  shapeType?: 'line' | 'arrow' | 'rect' | 'circle';
  color?: string;
  size?: number; // brush size / thickness
  watermarkImg?: HTMLImageElement;
  opacity?: number;
}

export function EditImage() {
  const [file, setFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);

  // Tab Control
  const [activeSubTab, setActiveSubTab] = useState<'adjust' | 'filter' | 'transform' | 'annotate' | 'crop' | 'watermark'>('adjust');

  // Adjustment States
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);
  const [hueRotate, setHueRotate] = useState<number>(0);
  const [blur, setBlur] = useState<number>(0);
  const [grayscale, setGrayscale] = useState<number>(0);
  const [sepia, setSepia] = useState<number>(0);

  // Flagship Advanced Adjustments
  const [exposure, setExposure] = useState<number>(100); // 0 to 200 (100 is neutral)
  const [temperature, setTemperature] = useState<number>(0); // -100 to 100
  const [tint, setTint] = useState<number>(0); // -100 to 100
  const [vignette, setVignette] = useState<number>(0); // 0 to 100

  // Vector Objects/Layers Engine States
  const [objects, setObjects] = useState<EditorObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggedHandle, setDraggedHandle] = useState<'nw' | 'ne' | 'se' | 'sw' | 'move' | null>(null);
  const [draggedStartPos, setDraggedStartPos] = useState<{ x: number; y: number } | null>(null);
  const [draggedStartBounds, setDraggedStartBounds] = useState<{ x: number; y: number; w: number; h: number; textSize?: number } | null>(null);

  // Annotation Tool Defaults
  const [drawMode, setDrawMode] = useState<boolean>(false);
  const [brushColor, setBrushColor] = useState<string>('#6366f1');
  const [brushSize, setBrushSize] = useState<number>(8);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [annotateTool] = useState<'brush' | 'line' | 'arrow' | 'rect' | 'circle'>('brush');
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [, setDrawingSnapshot] = useState<ImageData | null>(null);

  // Text Tool Selection/Builder States
  const [, setTextMode] = useState<boolean>(false);
  const [textString, setTextString] = useState<string>('');
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [textSize, setTextSize] = useState<number>(36);

  // Crop States
  const [cropWidth, setCropWidth] = useState<number>(100);
  const [cropHeight, setCropHeight] = useState<number>(100);
  const [cropX, setCropX] = useState<number>(0);
  const [cropY, setCropY] = useState<number>(0);
  const [cropAspectRatio, setCropAspectRatio] = useState<string>('free');
  const [cropDragMode, setCropDragMode] = useState<'move' | 'nw' | 'ne' | 'se' | 'sw' | null>(null);
  const [cropDragStart, setCropDragStart] = useState<{ mouseX: number; mouseY: number; cropX: number; cropY: number; cropW: number; cropH: number } | null>(null);

  // Watermark States
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(85);
  const [watermarkScale] = useState<number>(30); // % of canvas width

  // Duo-tone and Dominant Palette states
  const [activeDuoTone, setActiveDuoTone] = useState<{ color1: string; color2: string } | null>(null);
  const [dominantColors, setDominantColors] = useState<string[]>(['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#3b82f6']);

  // Undo / Redo History Stack (Canvas DataURLs)
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const { showSuccess, showError } = useToast();

  // Load Image File
  const handleFileSetup = (uploadedFile: File) => {
    setFile(uploadedFile);
    const url = URL.createObjectURL(uploadedFile);
    setImageSrc(url);
    
    // Reset Settings
    resetAdjustments();
    setHistoryStack([]);
    setHistoryIndex(-1);
    setObjects([]);
    setSelectedId(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSetup(e.target.files[0]);
    }
  };

  // Reset to Defaults
  const resetAdjustments = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setHueRotate(0);
    setBlur(0);
    setGrayscale(0);
    setSepia(0);
    setExposure(100);
    setTemperature(0);
    setTint(0);
    setVignette(0);
    setDrawMode(false);
    setTextMode(false);
    setTextString('');
    setActiveDuoTone(null);
    setCropAspectRatio('free');
    setObjects([]);
    setSelectedId(null);
  };

  // Aspect ratio crop bounding preset
  const handleAspectPreset = (preset: string) => {
    setCropAspectRatio(preset);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    let w = canvas.width * 0.8;
    let h = canvas.height * 0.8;
    
    if (preset === '1:1') {
      const size = Math.min(canvas.width, canvas.height) * 0.8;
      w = size;
      h = size;
    } else if (preset === '16:9') {
      h = w * (9 / 16);
      if (h > canvas.height) {
        h = canvas.height * 0.8;
        w = h * (16 / 9);
      }
    } else if (preset === '9:16') {
      w = h * (9 / 16);
      if (w > canvas.width) {
        w = canvas.width * 0.8;
        h = w * (16 / 9);
      }
    } else if (preset === '4:3') {
      h = w * (3 / 4);
      if (h > canvas.height) {
        h = canvas.height * 0.8;
        w = h * (4 / 3);
      }
    }
    
    w = Math.round(w);
    h = Math.round(h);
    
    setCropWidth(w);
    setCropHeight(h);
    setCropX(Math.round((canvas.width - w) / 2));
    setCropY(Math.round((canvas.height - h) / 2));
  };

  // Extractor utility for dominant colors
  const extractDominantColors = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const w = canvas.width;
      const h = canvas.height;
      const grid = 15;
      const stepX = Math.max(1, Math.floor(w / grid));
      const stepY = Math.max(1, Math.floor(h / grid));
      const colors: { [hex: string]: number } = {};

      for (let y = 0; y < h; y += stepY) {
        for (let x = 0; x < w; x += stepX) {
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          if (pixel[3] < 50) continue; // skip transparent
          
          const r = Math.round(pixel[0] / 16) * 16;
          const g = Math.round(pixel[1] / 16) * 16;
          const b = Math.round(pixel[2] / 16) * 16;
          
          const rgbToHex = (num: number) => {
            const hex = Math.min(255, Math.max(0, num)).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
          };
          const hex = `#${rgbToHex(r)}${rgbToHex(g)}${rgbToHex(b)}`;
          colors[hex] = (colors[hex] || 0) + 1;
        }
      }

      const sorted = Object.entries(colors)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);

      if (sorted.length >= 5) {
        setDominantColors(sorted.slice(0, 5));
      } else {
        const defaultPalette = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#3b82f6'];
        const filled = [...sorted, ...defaultPalette.filter(c => !sorted.includes(c))].slice(0, 5);
        setDominantColors(filled);
      }
    } catch (err) {
      console.warn('Failed to extract color palette:', err);
    }
  };

  // Initialize Canvas Image
  useEffect(() => {
    if (!imageSrc) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Default Crop size
      setCropWidth(Math.round(img.width * 0.8));
      setCropHeight(Math.round(img.height * 0.8));
      setCropX(Math.round(img.width * 0.1));
      setCropY(Math.round(img.height * 0.1));

      // Draw base
      ctx.drawImage(img, 0, 0);
      saveState(canvas.toDataURL());
      extractDominantColors(); // Extract dominant colors on load
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Save State to History Stack
  const saveState = (dataUrl: string) => {
    const newStack = historyStack.slice(0, historyIndex + 1);
    newStack.push(dataUrl);
    setHistoryStack(newStack);
    setHistoryIndex(newStack.length - 1);
  };

  // Sleek Falcon Arrowhead drawing helper
  const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, color: string, size: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const headLength = Math.max(16, size * 3);
    
    // Draw line shaft slightly shortened to avoid overflow at tip
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX - headLength * 0.4 * Math.cos(angle), toY - headLength * 0.4 * Math.sin(angle));
    ctx.stroke();
    
    // Sleek Falcon delta solid arrowhead
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      toX - headLength * 0.7 * Math.cos(angle),
      toY - headLength * 0.7 * Math.sin(angle)
    );
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // Apply CSS Filters to Canvas Context and Draw the Current Stack State
  const renderCanvas = (useExitingStateUrl?: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const targetStateUrl = useExitingStateUrl || (historyIndex >= 0 ? historyStack[historyIndex] : imageSrc);
    if (!targetStateUrl) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Apply filters ONLY if we are drawing the base image
      if (activeDuoTone) {
        ctx.filter = 'grayscale(100%)';
      } else {
        ctx.filter = `
          brightness(${(brightness * exposure) / 100}%)
          contrast(${contrast}%)
          saturate(${saturation}%)
          hue-rotate(${hueRotate}deg)
          blur(${blur}px)
          grayscale(${grayscale}%)
          sepia(${sepia}%)
        `;
      }
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none'; // reset filter for other annotations

      // Apply Duo-tone blending
      if (activeDuoTone) {
        ctx.save();
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, activeDuoTone.color1);
        grad.addColorStop(1, activeDuoTone.color2);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'lighten';
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      // Apply Temperature and Tint
      if (temperature !== 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'color';
        ctx.fillStyle = temperature > 0 ? 'rgba(251, 146, 60, 0.15)' : 'rgba(96, 165, 250, 0.15)';
        ctx.globalAlpha = Math.abs(temperature) / 200;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      if (tint !== 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'color';
        ctx.fillStyle = tint > 0 ? 'rgba(236, 72, 153, 0.15)' : 'rgba(34, 197, 94, 0.15)';
        ctx.globalAlpha = Math.abs(tint) / 200;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      // Apply Vignette
      if (vignette > 0) {
        ctx.save();
        const w = canvas.width;
        const h = canvas.height;
        const grad = ctx.createRadialGradient(
          w / 2, h / 2, Math.min(w, h) * 0.35,
          w / 2, h / 2, Math.max(w, h) * 0.8
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${vignette / 100})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      // Render all visual layers/objects dynamically
      objects.forEach(obj => {
        ctx.save();
        if (obj.type === 'text' && obj.text) {
          ctx.globalAlpha = 1;
          ctx.font = `bold ${obj.textSize || 36}px sans-serif`;
          ctx.fillStyle = obj.textColor || '#ffffff';
          ctx.textBaseline = 'top';
          ctx.textAlign = 'left';
          ctx.fillText(obj.text, obj.x, obj.y);
        } else if (obj.type === 'watermark' && obj.watermarkImg) {
          ctx.globalAlpha = (obj.opacity ?? 85) / 100;
          ctx.drawImage(obj.watermarkImg, obj.x, obj.y, obj.w, obj.h);
        } else if (obj.type === 'shape') {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = obj.color || '#6366f1';
          ctx.lineWidth = obj.size || 8;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.fillStyle = (obj.color || '#6366f1') + '20'; // light fill for shapes

          const tool = obj.shapeType;
          if (tool === 'line') {
            ctx.beginPath();
            ctx.moveTo(obj.x, obj.y);
            ctx.lineTo(obj.x + obj.w, obj.y + obj.h);
            ctx.stroke();
          } else if (tool === 'arrow') {
            drawArrow(ctx, obj.x, obj.y, obj.x + obj.w, obj.y + obj.h, obj.color || '#6366f1', obj.size || 8);
          } else if (tool === 'rect') {
            ctx.beginPath();
            ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
            ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
          } else if (tool === 'circle') {
            ctx.beginPath();
            const r = Math.sqrt(obj.w * obj.w + obj.h * obj.h);
            ctx.arc(obj.x, obj.y, r, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.fill();
          }
        }
        ctx.restore();
      });

      // Render selection outline and corners around selected object
      if (selectedId && activeSubTab !== 'crop') {
        const activeObj = objects.find(o => o.id === selectedId);
        if (activeObj) {
          ctx.save();
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = Math.max(2, canvas.width * 0.002);
          
          let bx = activeObj.x;
          let by = activeObj.y;
          let bw = activeObj.w;
          let bh = activeObj.h;
          
          if (activeObj.type === 'shape' && activeObj.shapeType === 'circle') {
            const r = Math.sqrt(activeObj.w * activeObj.w + activeObj.h * activeObj.h);
            bx = activeObj.x - r;
            by = activeObj.y - r;
            bw = r * 2;
            bh = r * 2;
          }
          
          // Dashed border selection outline
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(bx, by, bw, bh);
          ctx.setLineDash([]);
          
          // Selection corner handles
          const handleSize = Math.max(8, canvas.width * 0.012);
          ctx.fillStyle = '#6366f1';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          
          const corners = [
            { x: bx, y: by }, // NW
            { x: bx + bw, y: by }, // NE
            { x: bx + bw, y: by + bh }, // SE
            { x: bx, y: by + bh } // SW
          ];
          
          corners.forEach(c => {
            ctx.fillRect(c.x - handleSize/2, c.y - handleSize/2, handleSize, handleSize);
            ctx.strokeRect(c.x - handleSize/2, c.y - handleSize/2, handleSize, handleSize);
          });
          ctx.restore();
        }
      }

      // Draw active crop box overlay and corner handles
      if (activeSubTab === 'crop') {
        ctx.save();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = Math.max(3, canvas.width * 0.004);
        ctx.setLineDash([8, 8]);
        ctx.strokeRect(cropX, cropY, cropWidth, cropHeight);
        ctx.setLineDash([]);

        const handleSize = Math.max(10, canvas.width * 0.015);
        ctx.fillStyle = '#6366f1';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;

        const corners = [
          { x: cropX, y: cropY }, // NW
          { x: cropX + cropWidth, y: cropY }, // NE
          { x: cropX + cropWidth, y: cropY + cropHeight }, // SE
          { x: cropX, y: cropY + cropHeight } // SW
        ];

        corners.forEach(c => {
          ctx.fillRect(c.x - handleSize/2, c.y - handleSize/2, handleSize, handleSize);
          ctx.strokeRect(c.x - handleSize/2, c.y - handleSize/2, handleSize, handleSize);
        });
        ctx.restore();
      }
    };
    img.src = targetStateUrl;
  };

  // Trigger render when adjustments change
  useEffect(() => {
    renderCanvas();
  }, [brightness, contrast, saturation, hueRotate, blur, grayscale, sepia, activeSubTab, cropWidth, cropHeight, cropX, cropY, exposure, temperature, tint, vignette, activeDuoTone, objects, selectedId]);

  // Undo Action
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      // Redraw the saved state at index
      drawStateOnCanvas(historyStack[prevIndex]);
    }
  };

  // Redo Action
  const handleRedo = () => {
    if (historyIndex < historyStack.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      drawStateOnCanvas(historyStack[nextIndex]);
    }
  };

  // Draw State URL directly to Canvas
  const drawStateOnCanvas = (stateUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      extractDominantColors(); // Update palette
    };
    img.src = stateUrl;
  };

  // Burn/Commit Adjustments into a static history state
  const commitAdjustments = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Trigger redraw, save new baseline state, reset filters
    const currentUrl = canvas.toDataURL();
    saveState(currentUrl);
    resetAdjustments();
    extractDominantColors(); // Update palette
    showSuccess('Filter settings merged!', 'You can now apply more edits or undo this change.');
  };

  // Brush Drawing Controls
  const getCanvasMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Scale client mouse coordinates to actual internal canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasMousePos(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (activeSubTab === 'crop') {
      const handleSize = Math.max(10, canvas.width * 0.015);
      const isNear = (x1: number, y1: number, x2: number, y2: number) => {
        return Math.abs(x1 - x2) < handleSize && Math.abs(y1 - y2) < handleSize;
      };
      
      let dragMode: 'move' | 'nw' | 'ne' | 'se' | 'sw' | null = null;
      if (isNear(pos.x, pos.y, cropX, cropY)) dragMode = 'nw';
      else if (isNear(pos.x, pos.y, cropX + cropWidth, cropY)) dragMode = 'ne';
      else if (isNear(pos.x, pos.y, cropX + cropWidth, cropY + cropHeight)) dragMode = 'se';
      else if (isNear(pos.x, pos.y, cropX, cropY + cropHeight)) dragMode = 'sw';
      else if (pos.x >= cropX && pos.x <= cropX + cropWidth && pos.y >= cropY && pos.y <= cropY + cropHeight) {
        dragMode = 'move';
      }
      
      if (dragMode) {
        setCropDragMode(dragMode);
        setCropDragStart({
          mouseX: pos.x,
          mouseY: pos.y,
          cropX,
          cropY,
          cropW: cropWidth,
          cropH: cropHeight
        });
      }
      return;
    }

    // 1. Check if clicked a handle of the currently selected layer object
    if (selectedId) {
      const activeObj = objects.find(o => o.id === selectedId);
      if (activeObj) {
        let bx = activeObj.x;
        let by = activeObj.y;
        let bw = activeObj.w;
        let bh = activeObj.h;
        if (activeObj.type === 'shape' && activeObj.shapeType === 'circle') {
          const r = Math.sqrt(activeObj.w * activeObj.w + activeObj.h * activeObj.h);
          bx = activeObj.x - r;
          by = activeObj.y - r;
          bw = r * 2;
          bh = r * 2;
        }

        const handleSize = Math.max(10, canvas.width * 0.015);
        const isNear = (hx: number, hy: number) => {
          return Math.abs(pos.x - hx) < handleSize && Math.abs(pos.y - hy) < handleSize;
        };

        let handle: 'nw' | 'ne' | 'se' | 'sw' | null = null;
        if (isNear(bx, by)) handle = 'nw';
        else if (isNear(bx + bw, by)) handle = 'ne';
        else if (isNear(bx + bw, by + bh)) handle = 'se';
        else if (isNear(bx, by + bh)) handle = 'sw';

        if (handle) {
          setDraggedHandle(handle);
          setDraggedStartPos(pos);
          setDraggedStartBounds({
            x: activeObj.x,
            y: activeObj.y,
            w: activeObj.w,
            h: activeObj.h,
            textSize: activeObj.textSize
          });
          return;
        }
      }
    }

    // 2. Check if clicked inside any layer object (topmost first)
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      let bx = obj.x;
      let by = obj.y;
      let bw = obj.w;
      let bh = obj.h;
      if (obj.type === 'shape' && obj.shapeType === 'circle') {
        const r = Math.sqrt(obj.w * obj.w + obj.h * obj.h);
        bx = obj.x - r;
        by = obj.y - r;
        bw = r * 2;
        bh = r * 2;
      }

      if (pos.x >= bx && pos.x <= bx + bw && pos.y >= by && pos.y <= by + bh) {
        setSelectedId(obj.id);
        
        // Load settings to sidebar
        if (obj.type === 'text') {
          setTextString(obj.text || '');
          setTextColor(obj.textColor || '#ffffff');
          setTextSize(obj.textSize || 36);
        } else if (obj.type === 'watermark') {
          setWatermarkOpacity(obj.opacity || 85);
        }

        setDraggedHandle('move');
        setDraggedStartPos(pos);
        setDraggedStartBounds({
          x: obj.x,
          y: obj.y,
          w: obj.w,
          h: obj.h
        });
        return;
      }
    }

    // 3. Clicked empty canvas space
    setSelectedId(null);

    if (activeSubTab === 'annotate' && drawMode) {
      if (annotateTool === 'brush') {
        setIsDrawing(true);
        setShapeStart(pos);
        setDrawingSnapshot(ctx.getImageData(0, 0, canvas.width, canvas.height));
        
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      } else {
        // Draw shape layer object dynamically
        const newId = `shape_${Date.now()}`;
        const newObj: EditorObject = {
          id: newId,
          type: 'shape',
          shapeType: annotateTool,
          x: pos.x,
          y: pos.y,
          w: 1,
          h: 1,
          color: brushColor,
          size: brushSize
        };
        setObjects(prev => [...prev, newObj]);
        setSelectedId(newId);
        setDraggedHandle('se');
        setDraggedStartPos(pos);
        setDraggedStartBounds({ x: pos.x, y: pos.y, w: 1, h: 1 });
        setIsDrawing(true);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasMousePos(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (activeSubTab === 'crop') {
      const handleSize = Math.max(10, canvas.width * 0.015);
      const isNear = (x1: number, y1: number, x2: number, y2: number) => {
        return Math.abs(x1 - x2) < handleSize && Math.abs(y1 - y2) < handleSize;
      };
      
      if (isNear(pos.x, pos.y, cropX, cropY) || isNear(pos.x, pos.y, cropX + cropWidth, cropY + cropHeight)) {
        canvas.style.cursor = 'nwse-resize';
      } else if (isNear(pos.x, pos.y, cropX + cropWidth, cropY) || isNear(pos.x, pos.y, cropX, cropY + cropHeight)) {
        canvas.style.cursor = 'nesw-resize';
      } else if (pos.x >= cropX && pos.x <= cropX + cropWidth && pos.y >= cropY && pos.y <= cropY + cropHeight) {
        canvas.style.cursor = 'move';
      } else {
        canvas.style.cursor = 'default';
      }

      if (cropDragMode && cropDragStart) {
        const dx = pos.x - cropDragStart.mouseX;
        const dy = pos.y - cropDragStart.mouseY;
        
        if (cropDragMode === 'move') {
          const newX = Math.max(0, Math.min(canvas.width - cropDragStart.cropW, cropDragStart.cropX + dx));
          const newY = Math.max(0, Math.min(canvas.height - cropDragStart.cropH, cropDragStart.cropY + dy));
          setCropX(newX);
          setCropY(newY);
        } else if (cropDragMode === 'se') {
          let newW = Math.max(20, Math.min(canvas.width - cropDragStart.cropX, cropDragStart.cropW + dx));
          let newH = Math.max(20, Math.min(canvas.height - cropDragStart.cropY, cropDragStart.cropH + dy));
          
          if (cropAspectRatio !== 'free') {
            const ratio = cropAspectRatio === '1:1' ? 1 : cropAspectRatio === '16:9' ? 16/9 : cropAspectRatio === '9:16' ? 9/16 : 4/3;
            newH = newW / ratio;
            if (cropDragStart.cropY + newH > canvas.height) {
              newH = canvas.height - cropDragStart.cropY;
              newW = newH * ratio;
            }
          }
          setCropWidth(Math.round(newW));
          setCropHeight(Math.round(newH));
        } else if (cropDragMode === 'sw') {
          let newW = Math.max(20, cropDragStart.cropW - dx);
          let newX = cropDragStart.cropX + dx;
          if (newX < 0) {
            newW = cropDragStart.cropW + cropDragStart.cropX;
            newX = 0;
          }
          let newH = Math.max(20, cropDragStart.cropH + dy);
          
          if (cropAspectRatio !== 'free') {
            const ratio = cropAspectRatio === '1:1' ? 1 : cropAspectRatio === '16:9' ? 16/9 : cropAspectRatio === '9:16' ? 9/16 : 4/3;
            newH = newW / ratio;
            if (cropDragStart.cropY + newH > canvas.height) {
              newH = canvas.height - cropDragStart.cropY;
              newW = newH * ratio;
              newX = cropDragStart.cropX + (cropDragStart.cropW - newW);
            }
          }
          setCropX(Math.round(newX));
          setCropWidth(Math.round(newW));
          setCropHeight(Math.round(newH));
        } else if (cropDragMode === 'nw') {
          let newW = Math.max(20, cropDragStart.cropW - dx);
          let newH = Math.max(20, cropDragStart.cropH - dy);
          let newX = cropDragStart.cropX + dx;
          let newY = cropDragStart.cropY + dy;
          if (newX < 0) {
            newW = cropDragStart.cropW + cropDragStart.cropX;
            newX = 0;
          }
          if (newY < 0) {
            newH = cropDragStart.cropH + cropDragStart.cropY;
            newY = 0;
          }
          
          if (cropAspectRatio !== 'free') {
            const ratio = cropAspectRatio === '1:1' ? 1 : cropAspectRatio === '16:9' ? 16/9 : cropAspectRatio === '9:16' ? 9/16 : 4/3;
            newH = newW / ratio;
            newY = cropDragStart.cropY + (cropDragStart.cropH - newH);
            if (newY < 0) {
              newY = 0;
              newH = cropDragStart.cropH + cropDragStart.cropY;
              newW = newH * ratio;
              newX = cropDragStart.cropX + (cropDragStart.cropW - newW);
            }
          }
          setCropX(Math.round(newX));
          setCropY(Math.round(newY));
          setCropWidth(Math.round(newW));
          setCropHeight(Math.round(newH));
        } else if (cropDragMode === 'ne') {
          let newW = Math.max(20, cropDragStart.cropW + dx);
          let newH = Math.max(20, cropDragStart.cropH - dy);
          let newY = cropDragStart.cropY + dy;
          if (newY < 0) {
            newH = cropDragStart.cropH + cropDragStart.cropY;
            newY = 0;
          }
          
          if (cropAspectRatio !== 'free') {
            const ratio = cropAspectRatio === '1:1' ? 1 : cropAspectRatio === '16:9' ? 16/9 : cropAspectRatio === '9:16' ? 9/16 : 4/3;
            newH = newW / ratio;
            newY = cropDragStart.cropY + (cropDragStart.cropH - newH);
            if (newY < 0) {
              newY = 0;
              newH = cropDragStart.cropH + cropDragStart.cropY;
              newW = newH * ratio;
            }
          }
          setCropY(Math.round(newY));
          setCropWidth(Math.round(newW));
          setCropHeight(Math.round(newH));
        }
      }
      return;
    }

    if (activeSubTab === 'annotate' && drawMode && isDrawing && annotateTool === 'brush' && shapeStart) {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      return;
    }

    // Moving / Resizing selected visual layer object
    if (selectedId && draggedHandle && draggedStartPos && draggedStartBounds) {
      const dx = pos.x - draggedStartPos.x;
      const dy = pos.y - draggedStartPos.y;

      setObjects(prev => prev.map(obj => {
        if (obj.id !== selectedId) return obj;

        if (draggedHandle === 'move') {
          return {
            ...obj,
            x: Math.round(draggedStartBounds.x + dx),
            y: Math.round(draggedStartBounds.y + dy)
          };
        }

        if (obj.type === 'text') {
          const newSize = Math.max(12, Math.round((draggedStartBounds.textSize || 36) * (1 + dy / 100)));
          return {
            ...obj,
            textSize: newSize
          };
        }

        let newX = obj.x;
        let newY = obj.y;
        let newW = obj.w;
        let newH = obj.h;

        if (draggedHandle === 'se') {
          newW = Math.max(5, draggedStartBounds.w + dx);
          newH = Math.max(5, draggedStartBounds.h + dy);
        } else if (draggedHandle === 'sw') {
          newW = Math.max(5, draggedStartBounds.w - dx);
          newX = draggedStartBounds.x + dx;
          newH = Math.max(5, draggedStartBounds.h + dy);
        } else if (draggedHandle === 'nw') {
          newW = Math.max(5, draggedStartBounds.w - dx);
          newX = draggedStartBounds.x + dx;
          newH = Math.max(5, draggedStartBounds.h - dy);
          newY = draggedStartBounds.y + dy;
        } else if (draggedHandle === 'ne') {
          newW = Math.max(5, draggedStartBounds.w + dx);
          newH = Math.max(5, draggedStartBounds.h - dy);
          newY = draggedStartBounds.y + dy;
        }

        return {
          ...obj,
          x: Math.round(newX),
          y: Math.round(newY),
          w: Math.round(newW),
          h: Math.round(newH)
        };
      }));
    }
  };

  const handleMouseUp = () => {
    if (cropDragMode) {
      setCropDragMode(null);
      setCropDragStart(null);
    }
    
    if (draggedHandle) {
      setDraggedHandle(null);
      setDraggedStartPos(null);
      setDraggedStartBounds(null);
    }

    if (isDrawing) {
      setIsDrawing(false);
      setShapeStart(null);
      setDrawingSnapshot(null);
      
      const canvas = canvasRef.current;
      if (canvas && annotateTool === 'brush') {
        saveState(canvas.toDataURL());
        extractDominantColors();
      }
    }
  };

  // Add Interactive Layers
  const handleAddText = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const newId = `text_${Date.now()}`;
    const newObj: EditorObject = {
      id: newId,
      type: 'text',
      text: 'Double click to edit',
      textSize: 36,
      textColor: '#ffffff',
      x: Math.round(canvas.width / 4),
      y: Math.round(canvas.height / 3),
      w: 300,
      h: 50
    };
    setObjects(prev => [...prev, newObj]);
    setSelectedId(newId);
    setTextString('Double click to edit');
    setTextColor('#ffffff');
    setTextSize(36);
    showSuccess('Text layer added!');
  };

  const handleAddShape = (type: 'arrow' | 'line' | 'rect' | 'circle') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const newId = `shape_${Date.now()}`;
    const newObj: EditorObject = {
      id: newId,
      type: 'shape',
      shapeType: type,
      x: Math.round(canvas.width / 3),
      y: Math.round(canvas.height / 3),
      w: 120,
      h: type === 'line' || type === 'arrow' ? 80 : 120,
      color: brushColor,
      size: brushSize
    };
    setObjects(prev => [...prev, newObj]);
    setSelectedId(newId);
    showSuccess(`${type} shape layer added!`);
  };

  const handleDeleteSelected = () => {
    if (!selectedId) return;
    setObjects(prev => prev.filter(o => o.id !== selectedId));
    setSelectedId(null);
    showSuccess('Layer deleted');
  };

  const updateSelectedText = (updates: Partial<EditorObject>) => {
    if (!selectedId) return;
    setObjects(prev => prev.map(o => o.id === selectedId ? { ...o, ...updates } : o));
  };

  // Watermark handlers
  const handleWatermarkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const imgFile = e.target.files[0];
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const wmW = (watermarkScale / 100) * canvas.width;
        const wmH = wmW * (img.height / img.width);
        
        const newId = `watermark_${Date.now()}`;
        const newObj: EditorObject = {
          id: newId,
          type: 'watermark',
          x: Math.round((canvas.width - wmW) / 2),
          y: Math.round((canvas.height - wmH) / 2),
          w: Math.round(wmW),
          h: Math.round(wmH),
          watermarkImg: img,
          opacity: watermarkOpacity
        };
        
        setObjects(prev => [...prev, newObj]);
        setSelectedId(newId);
        showSuccess('Watermark layer added!', 'You can now drag and scale it directly.');
      };
      img.src = URL.createObjectURL(imgFile);
    }
  };

  // Transformations
  const handleRotate = (angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Keep current image
    const img = new Image();
    img.onload = () => {
      // Create a temporary canvas with flipped width/height for 90 degree rotations
      const is90 = Math.abs(angle) === 90;
      const targetWidth = is90 ? canvas.height : canvas.width;
      const targetHeight = is90 ? canvas.width : canvas.height;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = targetWidth;
      tempCanvas.height = targetHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      // Translate coordinates to center, rotate, and draw
      tempCtx.translate(targetWidth / 2, targetHeight / 2);
      tempCtx.rotate((angle * Math.PI) / 180);
      tempCtx.drawImage(img, -canvas.width / 2, -canvas.height / 2);

      // Copy back to main canvas
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.drawImage(tempCanvas, 0, 0);

      // Save state
      saveState(canvas.toDataURL());
      showSuccess('Rotation applied!');
    };
    img.src = canvas.toDataURL();
  };

  const handleFlip = (horizontal: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      if (horizontal) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      } else {
        ctx.translate(0, canvas.height);
        ctx.scale(1, -1);
      }

      ctx.drawImage(img, 0, 0);
      ctx.restore();

      // Save state
      saveState(canvas.toDataURL());
      showSuccess(horizontal ? 'Flipped Horizontally!' : 'Flipped Vertically!');
    };
    img.src = canvas.toDataURL();
  };

  // Crop Action
  const applyCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Create cropped context
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = cropWidth;
      tempCanvas.height = cropHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      tempCtx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      // Copy back
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      ctx.drawImage(tempCanvas, 0, 0);

      // Update crop states bounds
      setCropWidth(Math.round(cropWidth * 0.8));
      setCropHeight(Math.round(cropHeight * 0.8));
      setCropX(Math.round(cropWidth * 0.1));
      setCropY(Math.round(cropHeight * 0.1));

      // Save and alert
      saveState(canvas.toDataURL());
      extractDominantColors(); // Update palette
      showSuccess('Canvas cropped successfully!');
    };
    img.src = historyStack[historyIndex];
  };

  // Set Preset Filter
  const applyPresetFilter = (preset: string) => {
    resetAdjustments();
    setActiveDuoTone(null);
    switch (preset) {
      case 'grayscale':
        setGrayscale(100);
        break;
      case 'sepia':
        setSepia(100);
        break;
      case 'invert':
        setContrast(100);
        setHueRotate(180);
        break;
      case 'blur':
        setBlur(5);
        break;
      case 'vintage':
        setSepia(35);
        setContrast(115);
        setBrightness(95);
        break;
      case 'cool':
        setSaturation(120);
        setHueRotate(10);
        break;
      case 'dramatic':
        setContrast(130);
        setSaturation(80);
        break;
      case 'polaroid':
        setSepia(20);
        setContrast(90);
        setBrightness(110);
        break;
      case 'duotone_cyber':
        setActiveDuoTone({ color1: '#00f2fe', color2: '#f35588' });
        break;
      case 'duotone_golden':
        setActiveDuoTone({ color1: '#2b0938', color2: '#ffaa00' });
        break;
      case 'duotone_neon':
        setActiveDuoTone({ color1: '#0d1b2a', color2: '#00ff66' });
        break;
    }
  };

  // Export Download Image File
  const handleExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !file) return;
    setIsProcessing(true);

    // Hide layer bounding selection borders for a clean download export
    const prevSelectedId = selectedId;
    setSelectedId(null);

    setTimeout(async () => {
      try {
        const mimeType = file.type || 'image/png';
        const ext = mimeType.split('/')[1] || 'png';
        const outName = `edited_${file.name.replace(/\.[a-z0-9]+$/i, '')}.${ext}`;

        const dataUrl = canvas.toDataURL(mimeType, 0.95);
        const res = await fetch(dataUrl);
        const blob = await res.blob();

        // Download
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = outName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        StorageService.updateStats(0, 1);
        HistoryService.addImageEntry('Image Editor', outName, blob.size);

        showSuccess('Image exported successfully!', `${outName} · ${getFriendlySize(blob.size)}`);
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.85 } });
      } catch (err: any) {
        console.error(err);
        showError('Export failed', 'Could not save the edited canvas.');
      } finally {
        setIsProcessing(false);
        setSelectedId(prevSelectedId);
      }
    }, 50);
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Upload any PNG, JPG, WebP, or HEIC image.' },
    { step: 2, text: 'Apply preset filters, draw annotations, rotate, crop, or adjust colors.' },
    { step: 3, text: 'Undo/redo edits at any time, then click Download to save.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Canvas Layers Rendering', desc: 'Edits, annotations, text bounding boxes, and crop windows are rendered in-browser.' },
    { title: 'Offline-Ready Sandbox', desc: 'No network required. Canvas adjustments process locally inside your browser memory.' },
    { title: 'Undo Action History', desc: 'Robust timeline state-tracking lets you step backward or forward through operations.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'What formats can I edit?', answer: 'We support JPG, PNG, WebP, SVG, and browser-mappable image buffers.' },
    { question: 'Are my images stored on the server?', answer: 'No. The image editor runs completely client-side in your sandbox browser memory. No files upload online.' },
    { question: 'Does cropping reduce resolution?', answer: 'Cropping trims the pixel dimensions to the selected box boundary, preserving pixel quality for the cropped section.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Image Compressor', desc: 'Target exact KB size.', path: '/compress-image', icon: ImageIcon },
    { name: 'Image Resizer', desc: 'Scale width and height.', path: '/resize-image', icon: ImageIcon },
    { name: 'Format Converter', desc: 'Convert image formats.', path: '/convert-image', icon: ImageIcon }
  ];

  const subTabs = [
    { id: 'adjust', label: 'Adjust', icon: Sliders },
    { id: 'filter', label: 'Filters', icon: Sparkles },
    { id: 'transform', label: 'Transform', icon: RotateCw },
    { id: 'annotate', label: 'Annotate', icon: Paintbrush },
    { id: 'crop', label: 'Crop', icon: CropIcon },
    { id: 'watermark', label: 'Watermark', icon: Upload }
  ] as const;

  const isUndoDisabled = historyIndex <= 0;
  const isRedoDisabled = historyIndex >= historyStack.length - 1;

  // Render Image Icon for related tools
  function ImageIcon() {
    return <Edit3 className="w-3.5 h-3.5" />;
  }

  return (
    <ToolPageLayout
      title="Pro Image Editor"
      subtitle="Apply adjustments, preset filters, drawings, text overlays, and crop bounding boxes online for free."
      breadcrumbName="Image Editor"
      seoTitle="Pro Image Editor Online Free - Edit Photo Canvas | CompressKro"
      seoDescription="Edit images online for free. Visual adjustments, filters, rotate, flip, draw annotations, text overlays, and cropping. 100% private client-side editor."
      canonicalPath="/edit-image"
      steps={steps}
      benefits={benefits}
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <div className="space-y-6">
        {!imageSrc ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center hover:border-violet-500 hover:bg-violet-50/10 transition-all cursor-pointer space-y-4"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-xl bg-violet-50 dark:bg-violet-950/20 text-violet-650 dark:text-violet-400 flex items-center justify-center mx-auto shadow-xs">
              <Upload className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Upload image to edit</p>
              <p className="text-xs text-slate-400">Supports PNG, JPG, WebP, GIF, and HEIC files</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Canvas Preview Window - Dark themed PicsArt styling */}
            <div className="lg:col-span-8 space-y-4">
              <div className="p-5 rounded-3xl border border-slate-800/80 bg-slate-900 backdrop-blur-xl shadow-2xl flex flex-col items-center">
                
                {/* Canvas Toolbar Controls */}
                <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4 text-xs font-semibold text-slate-400">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleUndo}
                      disabled={isUndoDisabled}
                      className="p-2 rounded-lg border border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-300 disabled:opacity-20 cursor-pointer transition-all"
                      title="Undo"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={isRedoDisabled}
                      className="p-2 rounded-lg border border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-300 disabled:opacity-20 cursor-pointer transition-all"
                      title="Redo"
                    >
                      <Redo2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedId && (
                      <button
                        onClick={handleDeleteSelected}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-900/40 text-rose-400 bg-rose-950/20 hover:bg-rose-950/50 cursor-pointer transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Selected Layer</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        resetAdjustments();
                        if (imageSrc) drawStateOnCanvas(imageSrc);
                        setHistoryStack(historyStack.slice(0, 1));
                        setHistoryIndex(0);
                        showSuccess('Canvas reset to original!');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-rose-450 hover:bg-slate-800/40 cursor-pointer transition-all"
                    >
                      <span>Reset All</span>
                    </button>

                    <button
                      onClick={() => {
                        setFile(null);
                        setImageSrc('');
                        setObjects([]);
                        setSelectedId(null);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-800 cursor-pointer transition-all"
                    >
                      Close File
                    </button>
                  </div>
                </div>

                {/* Canvas Bounding Area */}
                <div className="w-full max-h-[520px] overflow-auto flex items-center justify-center bg-slate-950/60 rounded-2xl p-6 border border-slate-800/40 select-none">
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    className={`max-w-full shadow-2xl rounded-lg border border-slate-800/20 transition-all ${
                      activeSubTab === 'crop' || activeSubTab === 'watermark'
                        ? 'cursor-default'
                        : drawMode
                        ? 'cursor-crosshair'
                        : 'cursor-default'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Editing Tools Control Center */}
            <div className="lg:col-span-4 space-y-4">
              <div className="p-5 rounded-3xl border border-slate-800/80 bg-slate-900 backdrop-blur-xl shadow-2xl space-y-6 text-slate-200">
                
                {/* Horizontal Tool Toggles */}
                <div className="flex overflow-x-auto gap-1 border-b border-slate-800/80 pb-2.5 scrollbar-none">
                  {subTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveSubTab(tab.id);
                          setDrawMode(tab.id === 'annotate');
                          if (tab.id !== 'annotate') {
                            setTextMode(false);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                          activeSubTab === tab.id
                            ? 'bg-violet-600 text-white shadow-md'
                            : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Sub-panels */}
                <div className="space-y-4 min-h-[260px]">
                  
                  {/* ADJUST TAB */}
                  {activeSubTab === 'adjust' && (
                    <div className="space-y-4">
                      {/* Exposure */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold text-slate-400">
                          <span>Exposure</span>
                          <span>{exposure}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={exposure}
                          onChange={(e) => setExposure(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        />
                      </div>

                      {/* Brightness */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold text-slate-400">
                          <span>Brightness</span>
                          <span>{brightness}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={brightness}
                          onChange={(e) => setBrightness(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        />
                      </div>

                      {/* Contrast */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold text-slate-400">
                          <span>Contrast</span>
                          <span>{contrast}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={contrast}
                          onChange={(e) => setContrast(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        />
                      </div>

                      {/* Saturation */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold text-slate-400">
                          <span>Saturation</span>
                          <span>{saturation}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={saturation}
                          onChange={(e) => setSaturation(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        />
                      </div>

                      {/* Temperature */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold text-slate-400">
                          <span>Temperature</span>
                          <span>{temperature > 0 ? `+${temperature} (Warm)` : temperature < 0 ? `${temperature} (Cool)` : '0 (Neutral)'}</span>
                        </div>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={temperature}
                          onChange={(e) => setTemperature(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        />
                      </div>

                      {/* Tint */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold text-slate-400">
                          <span>Tint</span>
                          <span>{tint > 0 ? `+${tint} (Magenta)` : tint < 0 ? `${tint} (Green)` : '0 (Neutral)'}</span>
                        </div>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={tint}
                          onChange={(e) => setTint(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        />
                      </div>

                      {/* Vignette */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold text-slate-400">
                          <span>Vignette</span>
                          <span>{vignette}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={vignette}
                          onChange={(e) => setVignette(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        />
                      </div>

                      {/* Hue Rotate */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold text-slate-400">
                          <span>Hue Rotate</span>
                          <span>{hueRotate}°</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          value={hueRotate}
                          onChange={(e) => setHueRotate(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        />
                      </div>

                      {/* Blur */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold text-slate-400">
                          <span>Blur</span>
                          <span>{blur}px</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="20"
                          value={blur}
                          onChange={(e) => setBlur(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        />
                      </div>

                      <button
                        onClick={commitAdjustments}
                        className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-750 flex items-center justify-center gap-1.5 cursor-pointer transition-all border border-slate-700/40"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Commit Adjustments</span>
                      </button>
                    </div>
                  )}

                  {/* FILTERS PRESETS */}
                  {activeSubTab === 'filter' && (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'original', name: 'Original' },
                        { id: 'grayscale', name: 'Monochrome' },
                        { id: 'sepia', name: 'Sepia' },
                        { id: 'invert', name: 'Invert' },
                        { id: 'vintage', name: 'Vintage' },
                        { id: 'cool', name: 'Cool' },
                        { id: 'dramatic', name: 'Dramatic' },
                        { id: 'polaroid', name: 'Polaroid' },
                        { id: 'duotone_cyber', name: 'Duo Cyberpunk' },
                        { id: 'duotone_golden', name: 'Duo Golden Hour' },
                        { id: 'duotone_neon', name: 'Duo Toxic Neon' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => applyPresetFilter(item.id)}
                          className={`py-2.5 px-3 text-[11px] font-bold rounded-xl border cursor-pointer transition-all ${
                            (activeDuoTone && item.id.startsWith('duotone_') && (
                              (activeDuoTone.color1 === '#00f2fe' && item.id === 'duotone_cyber') ||
                              (activeDuoTone.color1 === '#2b0938' && item.id === 'duotone_golden') ||
                              (activeDuoTone.color1 === '#0d1b2a' && item.id === 'duotone_neon')
                            ))
                              ? 'bg-violet-600 border-violet-600 text-white shadow-md'
                              : 'border-slate-800 bg-slate-950/40 text-slate-350 hover:border-violet-500 hover:bg-slate-850'
                          }`}
                        >
                          {item.name}
                        </button>
                      ))}

                      <button
                        onClick={commitAdjustments}
                        className="col-span-2 mt-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-750 flex items-center justify-center gap-1.5 cursor-pointer transition-all border border-slate-700/40"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Apply Selected Filter</span>
                      </button>
                    </div>
                  )}

                  {/* TRANSFORM */}
                  {activeSubTab === 'transform' && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rotate Canvas</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRotate(-90)}
                            className="flex-1 py-2.5 px-3 text-xs font-semibold rounded-xl border border-slate-800 bg-slate-950/40 flex items-center justify-center gap-1.5 hover:bg-slate-850 cursor-pointer transition-all text-slate-300"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>90° Left</span>
                          </button>
                          <button
                            onClick={() => handleRotate(90)}
                            className="flex-1 py-2.5 px-3 text-xs font-semibold rounded-xl border border-slate-800 bg-slate-950/40 flex items-center justify-center gap-1.5 hover:bg-slate-850 cursor-pointer transition-all text-slate-300"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>90° Right</span>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Flip Direction</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleFlip(true)}
                            className="flex-1 py-2.5 px-3 text-xs font-semibold rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-850 text-slate-300 cursor-pointer transition-all"
                          >
                            Flip Horizontal
                          </button>
                          <button
                            onClick={() => handleFlip(false)}
                            className="flex-1 py-2.5 px-3 text-xs font-semibold rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-850 text-slate-300 cursor-pointer transition-all"
                          >
                            Flip Vertical
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ANNOTATIONS (Interactive Objects Draw / Text / Layers) */}
                  {activeSubTab === 'annotate' && (
                    <div className="space-y-4">
                      
                      {/* Bounding Layer Adders */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Add Layer Studio</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={handleAddText}
                            className="py-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/20 hover:bg-slate-850 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                          >
                            <Type className="w-4 h-4 text-violet-400" />
                            <span>+ Add Text</span>
                          </button>
                          
                          <button
                            onClick={() => setDrawMode(!drawMode)}
                            className={`py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                              drawMode 
                                ? 'bg-violet-600 border-violet-600 text-white shadow-md' 
                                : 'border-slate-800 bg-slate-950/40 text-slate-350 hover:bg-slate-850'
                            }`}
                          >
                            <Paintbrush className="w-4 h-4 text-violet-400" />
                            <span>Freehand Paint</span>
                          </button>
                        </div>
                      </div>

                      {/* Vector Shapes Selector */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Add Shapes</span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { id: 'arrow', label: 'Arrow', icon: ArrowUpRight },
                            { id: 'line', label: 'Line', icon: Minus },
                            { id: 'rect', label: 'Rect', icon: Square },
                            { id: 'circle', label: 'Circle', icon: Circle }
                          ].map(t => (
                            <button
                              key={t.id}
                              onClick={() => handleAddShape(t.id as any)}
                              className="py-2 rounded-xl border border-slate-800 bg-slate-950/40 text-slate-350 hover:bg-slate-850 hover:text-violet-400 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all text-[10px] font-bold"
                            >
                              <t.icon className="w-4.5 h-4.5" />
                              <span>{t.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Freehand Brush Editor settings */}
                      {drawMode && (
                        <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-3">
                          <span className="text-[10px] text-violet-400 font-bold uppercase block tracking-wider">Freehand Paint Brush Settings</span>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-500 font-semibold">Size</span>
                              <input
                                type="range"
                                min="2"
                                max="40"
                                value={brushSize}
                                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                className="w-full cursor-pointer accent-violet-600"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-500 font-semibold block">Color</span>
                              <input
                                type="color"
                                value={brushColor}
                                onChange={(e) => setBrushColor(e.target.value)}
                                className="h-7 w-full rounded-md border border-slate-800 bg-slate-900 cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Selected Interactive Text Customizer */}
                      {selectedId && objects.find(o => o.id === selectedId)?.type === 'text' && (
                        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-violet-500/30 space-y-3 shadow-md animate-in fade-in duration-200">
                          <span className="text-[10px] text-violet-400 font-bold uppercase tracking-wider block">Modify Selected Text</span>
                          <input
                            type="text"
                            value={textString}
                            onChange={(e) => {
                              setTextString(e.target.value);
                              updateSelectedText({ text: e.target.value });
                            }}
                            className="w-full p-2 text-xs rounded-lg border border-slate-800 bg-slate-900 text-slate-100 outline-hidden focus:ring-1 focus:ring-violet-500"
                            placeholder="Enter text..."
                          />

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-500 font-bold block">Size (px)</span>
                              <input
                                type="number"
                                value={textSize}
                                onChange={(e) => {
                                  const sz = Math.max(10, parseInt(e.target.value) || 20);
                                  setTextSize(sz);
                                  updateSelectedText({ textSize: sz });
                                }}
                                className="w-full p-1.5 text-xs rounded-md border border-slate-800 bg-slate-900 text-slate-100"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-500 font-bold block">Color</span>
                              <input
                                type="color"
                                value={textColor}
                                onChange={(e) => {
                                  setTextColor(e.target.value);
                                  updateSelectedText({ textColor: e.target.value });
                                }}
                                className="h-8 w-full rounded-md border border-slate-800 bg-slate-900 cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Selected Interactive Shape Customizer */}
                      {selectedId && objects.find(o => o.id === selectedId)?.type === 'shape' && (
                        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-violet-500/30 space-y-3 shadow-md animate-in fade-in duration-200">
                          <span className="text-[10px] text-violet-400 font-bold uppercase tracking-wider block">Modify Selected Shape</span>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-500 font-bold block">Stroke Weight</span>
                              <input
                                type="range"
                                min="2"
                                max="40"
                                value={objects.find(o => o.id === selectedId)?.size || 8}
                                onChange={(e) => {
                                  const sz = parseInt(e.target.value);
                                  setBrushSize(sz);
                                  setObjects(prev => prev.map(o => o.id === selectedId ? { ...o, size: sz } : o));
                                }}
                                className="w-full accent-violet-600"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-500 font-bold block">Fill/Stroke Color</span>
                              <input
                                type="color"
                                value={objects.find(o => o.id === selectedId)?.color || '#6366f1'}
                                onChange={(e) => {
                                  const clr = e.target.value;
                                  setBrushColor(clr);
                                  setObjects(prev => prev.map(o => o.id === selectedId ? { ...o, color: clr } : o));
                                }}
                                className="h-8 w-full rounded-md border border-slate-800 bg-slate-900 cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Interactive Visual Layers List */}
                      {objects.length > 0 && (
                        <div className="space-y-2 pt-2.5 border-t border-slate-800">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Studio Layers Timeline</span>
                          <div className="space-y-1.5 max-h-[140px] overflow-y-auto scrollbar-thin">
                            {objects.map((obj, idx) => (
                              <div
                                key={obj.id}
                                onClick={() => setSelectedId(obj.id)}
                                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer border transition-all ${
                                  selectedId === obj.id
                                    ? 'bg-violet-650/20 border-violet-500 text-violet-300 font-bold'
                                    : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-850'
                                }`}
                              >
                                <span className="capitalize">
                                  {obj.type === 'shape' ? `${obj.shapeType} Shape` : obj.type} Layer #{idx + 1}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setObjects(prev => prev.filter(o => o.id !== obj.id));
                                    if (selectedId === obj.id) setSelectedId(null);
                                  }}
                                  className="p-1 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Extracted Dominant Colors Swatches */}
                      <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">Extracted Image Swatches</span>
                        <div className="flex gap-2">
                          {dominantColors.map((color, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setBrushColor(color);
                                setTextColor(color);
                                if (selectedId) {
                                  setObjects(prev => prev.map(o => o.id === selectedId ? { ...o, color, textColor: color } : o));
                                }
                              }}
                              className={`w-7 h-7 rounded-lg border hover:scale-110 transition-transform cursor-pointer ${
                                brushColor === color ? 'border-violet-650 ring-2 ring-violet-500/25' : 'border-slate-800'
                              }`}
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* CROP BOX */}
                  {activeSubTab === 'crop' && (
                    <div className="space-y-4">
                      
                      {/* Aspect Ratio Presets */}
                      <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">Aspect Ratio Preset</span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { id: 'free', label: 'Free' },
                            { id: '1:1', label: '1:1 Sq' },
                            { id: '16:9', label: '16:9 W' },
                            { id: '9:16', label: '9:16 P' },
                            { id: '4:3', label: '4:3 Cl' }
                          ].map(preset => (
                            <button
                              key={preset.id}
                              onClick={() => handleAspectPreset(preset.id)}
                              className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border cursor-pointer transition-all ${
                                cropAspectRatio === preset.id
                                  ? 'bg-violet-600 border-violet-600 text-white shadow-md'
                                  : 'border-slate-850 bg-slate-950/40 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-4">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Crop Fine-Tuning</div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-[11px] font-bold text-slate-400">
                            <span>Box Width</span>
                            <span>{cropWidth}px</span>
                          </div>
                          <input
                            type="range"
                            min="20"
                            max={canvasRef.current?.width || 800}
                            value={cropWidth}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setCropWidth(val);
                              const limit = (canvasRef.current?.width || 800) - cropX;
                              if (val > limit) setCropX(Math.max(0, (canvasRef.current?.width || 800) - val));
                            }}
                            className="w-full accent-violet-600"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-[11px] font-bold text-slate-400">
                            <span>Box Height</span>
                            <span>{cropHeight}px</span>
                          </div>
                          <input
                            type="range"
                            min="20"
                            max={canvasRef.current?.height || 800}
                            value={cropHeight}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setCropHeight(val);
                              const limit = (canvasRef.current?.height || 800) - cropY;
                              if (val > limit) setCropY(Math.max(0, (canvasRef.current?.height || 800) - val));
                            }}
                            className="w-full accent-violet-600"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-[11px] font-bold text-slate-400">
                            <span>Horizontal offset X</span>
                            <span>{cropX}px</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max={Math.max(0, (canvasRef.current?.width || 800) - cropWidth)}
                            value={cropX}
                            onChange={(e) => setCropX(parseInt(e.target.value))}
                            className="w-full accent-violet-600"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-[11px] font-bold text-slate-400">
                            <span>Vertical offset Y</span>
                            <span>{cropY}px</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max={Math.max(0, (canvasRef.current?.height || 800) - cropHeight)}
                            value={cropY}
                            onChange={(e) => setCropY(parseInt(e.target.value))}
                            className="w-full accent-violet-600"
                          />
                        </div>

                        <div className="text-[10px] text-slate-450 leading-snug">
                          💡 Drag the crop box outline or handles directly on the canvas to visually edit the area.
                        </div>

                        <button
                          onClick={applyCrop}
                          className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-violet-650 hover:bg-violet-700 flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all"
                        >
                          <CropIcon className="w-4 h-4" />
                          <span>Apply Crop Selection</span>
                        </button>
                      </div>

                    </div>
                  )}

                  {/* WATERMARK OVERLAY */}
                  {activeSubTab === 'watermark' && (
                    <div className="space-y-4">
                      <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-3">
                        <div className="text-xs font-bold text-slate-400">Load Watermark Logo</div>
                        <input
                          type="file"
                          ref={watermarkInputRef}
                          onChange={handleWatermarkUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          onClick={() => watermarkInputRef.current?.click()}
                          className="w-full py-2.5 border border-dashed border-slate-700 hover:bg-slate-850 text-slate-300 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Select Watermark Logo File</span>
                        </button>

                        {selectedId && objects.find(o => o.id === selectedId)?.type === 'watermark' ? (
                          <div className="space-y-3 pt-2.5 border-t border-slate-800/80">
                            <span className="text-[10px] text-violet-400 font-bold block uppercase tracking-wider">Modify Selected Watermark</span>
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                <span>Logo Opacity</span>
                                <span>{objects.find(o => o.id === selectedId)?.opacity || 85}%</span>
                              </div>
                              <input
                                type="range"
                                min="10"
                                max="100"
                                value={objects.find(o => o.id === selectedId)?.opacity || 85}
                                onChange={(e) => {
                                  const opacityVal = parseInt(e.target.value);
                                  setWatermarkOpacity(opacityVal);
                                  setObjects(prev => prev.map(o => o.id === selectedId ? { ...o, opacity: opacityVal } : o));
                                }}
                                className="w-full accent-violet-600"
                              />
                            </div>

                            <div className="text-[10px] text-slate-450 leading-snug">
                              💡 Drag the watermark boundaries or handles directly on the canvas to position and scale it.
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-500 text-center py-2">
                            Select a watermark layer in the timeline or upload a file to start editing.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>

                {/* Final Export Download Button */}
                <button
                  onClick={handleExport}
                  disabled={isProcessing}
                  className="w-full py-3.5 rounded-2xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>Export & Download Image</span>
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
export default EditImage;
