// ============================================================
// CompressKro PDF Editor — PDF Exporter (Rasterization/Flattening)
// ============================================================
// Compiles all editor operations into a final PDF by rendering
// each page to a high-quality Canvas, overlaying edits, and
// embedding the result as a flat PNG (lossless, grayscale/color adaptive).
// ============================================================

import { PDFDocument, StandardFonts } from 'pdf-lib';
import type {
  EditorObject,
  TextObject,
  ImageObject,
  ShapeObject,
  SignatureObject,
  FreehandObject,
  ParsedDocument,
} from '../core/types';
import { pdfBoundsToViewportRect } from '../utils/geometry';
import { compressPdf } from '../../../services/pdf.service';
import { createWorker } from 'tesseract.js';
import type { Worker as TesseractWorker } from 'tesseract.js';

/**
 * Progress callback for export operations.
 */
export type ExportProgressCallback = (message: string, progress: number) => void;

/**
 * Loads an image from a URL or data URI as an HTMLImageElement.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Prevent canvas taint issues
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image: ' + url));
    img.src = url;
  });
}

/**
 * Detects if the canvas content is effectively black-and-white / grayscale
 * by sampling R, G, and B channel variance across a grid of pixels.
 */
function detectIfPageIsGrayscale(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const sampleSpacing = 15; // Grid spacing for pixel sampling
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let totalVariance = 0;
    let sampledPixelsCount = 0;

    for (let y = 0; y < height; y += sampleSpacing) {
      for (let x = 0; x < width; x += sampleSpacing) {
        const idx = (y * width + x) * 4;
        if (idx < data.length) {
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Calculate variance (average absolute difference from the mean of R/G/B)
          const mean = (r + g + b) / 3;
          const variance = (Math.abs(r - mean) + Math.abs(g - mean) + Math.abs(b - mean)) / 3;

          totalVariance += variance;
          sampledPixelsCount++;
        }
      }
    }

    if (sampledPixelsCount === 0) return true;
    const averageVariance = totalVariance / sampledPixelsCount;

    // A threshold of 6.0 reliably detects monochrome page content
    const threshold = 6.0;
    return averageVariance < threshold;
  } catch (e) {
    console.warn('Adaptive color detection failed, defaulting to grayscale:', e);
    return true;
  }
}

/**
 * Checks if a hex color code represents a non-grayscale color.
 */
function isHexColorColored(hex: string): boolean {
  if (!hex) return false;
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  if (clean.length !== 6) return false;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const avg = (r + g + b) / 3;
  const dev = (Math.abs(r - avg) + Math.abs(g - avg) + Math.abs(b - avg)) / 3;
  return dev > 10;
}

/**
 * Converts the canvas to grayscale using standard luminance weights.
 */
function convertCanvasToGrayscale(ctx: CanvasRenderingContext2D, width: number, height: number) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (e) {
    console.warn('Grayscale conversion failed:', e);
  }
}

/**
 * Export the edited PDF document by flattening all pages and edits.
 *
 * @param document   - The parsed PDF document (contains pdfjsDocument).
 * @param objects    - All editor objects.
 * @param onProgress - Optional progress callback.
 * @returns PDF bytes as Uint8Array.
 */
export async function exportPdf(
  document: ParsedDocument,
  objects: Map<string, EditorObject>,
  onProgress?: ExportProgressCallback,
  options?: { doOcr?: boolean; ocrLanguage?: string }
): Promise<Uint8Array> {
  onProgress?.('Preparing document for export...', 0);

  const totalPages = document.numPages;
  const newPdfDoc = await PDFDocument.create();

  // Embed Helvetica standard font for OCR text overlay (Phase 4)
  const ocrFont = await newPdfDoc.embedFont(StandardFonts.Helvetica);

  // Target DPI 300 for high-quality sharp text rendering (standard print/display DPI)
  const targetDpi = 300;
  const scale = targetDpi / 72;

  // Create a single reusable Tesseract worker if OCR is requested (Phase 4)
  let ocrWorker: TesseractWorker | null = null;
  if (options?.doOcr) {
    const lang = options?.ocrLanguage || 'eng';
    onProgress?.(`Initializing OCR engine (${lang})...`, 0);
    try {
      ocrWorker = await createWorker(lang, 1, {
        workerPath: '/tesseract/worker.min.js',
        corePath: '/tesseract/',
        langPath: '/tesseract/lang-data',
      });
    } catch {
      ocrWorker = await createWorker(lang);
    }
  }

  // Process and flatten each page
  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    onProgress?.(`Rendering and flattening page ${pageIdx + 1} of ${totalPages}...`, (pageIdx / totalPages) * 0.8);

    const pageData = document.pages[pageIdx];
    const page = await document.pdfjsDocument.getPage(pageData.pageIndex + 1);
    
    // Obtain original page size to calculate scale budget
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const w = unscaledViewport.width;
    const h = unscaledViewport.height;

    const maxPixels = 20 * 1000 * 1000; // 20M pixels sanity budget
    const defaultScale = targetDpi / 72;
    let scale = defaultScale;
    const areaAtDefaultScale = (w * defaultScale) * (h * defaultScale);
    if (areaAtDefaultScale > maxPixels) {
      scale = Math.sqrt(maxPixels / (w * h));
    }

    const viewport = page.getViewport({ scale });

    // Create an offscreen canvas
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error(`Failed to get canvas 2d context for page ${pageIdx + 1}`);
    }

    // Fill with solid white background to avoid transparent canvas alpha channel issues in Tesseract/Leptonica
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render PDF page content using PDF.js
    const renderTask = page.render({ canvasContext: ctx, viewport });
    await renderTask.promise;

    // Filter and sort page objects by zIndex (map to pageData's original pageIndex)
    const pageObjects = Array.from(objects.values())
      .filter((obj) => obj.pageIndex === pageData.pageIndex)
      .sort((a, b) => a.zIndex - b.zIndex);

    // Render each overlay edit object onto the canvas
    for (const obj of pageObjects) {
      ctx.save();
      ctx.globalAlpha = obj.opacity !== undefined ? obj.opacity : 1.0;

      // Translate PDF user-space bounds to viewport pixel coordinates
      const vRect = pdfBoundsToViewportRect(obj.bounds, viewport);

      if (obj.type === 'text') {
        const textObj = obj as TextObject;
        // Skip unmodified text extracted from the PDF (already rendered on the canvas background)
        if (textObj.origin === 'extracted' && !textObj.isModified) {
          ctx.restore();
          continue;
        }

        // Draw solid white background to fully cover any underlying text
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(vRect.left, vRect.top, vRect.width, vRect.height);

        // Draw the modified/new text
        ctx.fillStyle = textObj.color;
        const fontSizePx = textObj.fontSize * scale;
        
        // Build CSS font string matching the preview styling
        const styleStr = textObj.font.style === 'italic' ? 'italic' : '';
        const weightStr = textObj.font.weight === 'bold' ? 'bold' : 'normal';
        ctx.font = `${styleStr} ${weightStr} ${fontSizePx}px ${textObj.font.cssFontFamily}`;
        
        ctx.textBaseline = 'middle';
        ctx.textAlign = textObj.alignment || 'left';

        // Apply visual alignment padding
        let textX = vRect.left + 2; // Padding matching px-0.5 layout
        if (textObj.alignment === 'center') {
          textX = vRect.left + vRect.width / 2;
        } else if (textObj.alignment === 'right') {
          textX = vRect.left + vRect.width - 2;
        }

        ctx.fillText(textObj.text, textX, vRect.top + vRect.height / 2);
      } else if (obj.type === 'whiteout') {
        // Draw solid white rect
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(vRect.left, vRect.top, vRect.width, vRect.height);
      } else if (obj.type === 'shape') {
        const shapeObj = obj as ShapeObject;
        ctx.beginPath();

        if (shapeObj.shapeKind === 'circle') {
          const cx = vRect.left + vRect.width / 2;
          const cy = vRect.top + vRect.height / 2;
          const rx = vRect.width / 2;
          const ry = vRect.height / 2;
          ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        } else if (shapeObj.shapeKind === 'rectangle') {
          ctx.rect(vRect.left, vRect.top, vRect.width, vRect.height);
        } else if (shapeObj.shapeKind === 'line' || shapeObj.shapeKind === 'arrow') {
          if (shapeObj.startPoint && shapeObj.endPoint) {
            const startPt = viewport.convertToViewportPoint(shapeObj.startPoint.x, shapeObj.startPoint.y);
            const endPt = viewport.convertToViewportPoint(shapeObj.endPoint.x, shapeObj.endPoint.y);
            ctx.moveTo(startPt[0], startPt[1]);
            ctx.lineTo(endPt[0], endPt[1]);
          }
        }

        if (shapeObj.fillColor && shapeObj.shapeKind !== 'line' && shapeObj.shapeKind !== 'arrow') {
          ctx.fillStyle = shapeObj.fillColor;
          ctx.fill();
        }

        if (shapeObj.strokeColor) {
          ctx.strokeStyle = shapeObj.strokeColor;
          ctx.lineWidth = shapeObj.strokeWidth * scale;
          ctx.stroke();
        }
      } else if (obj.type === 'image') {
        const imgObj = obj as ImageObject;

        if (imgObj.origin === 'extracted') {
          if (imgObj.deleted) {
            // Draw a white rectangle to redact the extracted image
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(vRect.left, vRect.top, vRect.width, vRect.height);
          } else if (imgObj.replacementFile && imgObj.replacementDataUrl) {
            // Whiteout original image bounds, then overlay replacement
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(vRect.left, vRect.top, vRect.width, vRect.height);
            try {
              const img = await loadImage(imgObj.replacementDataUrl);
              ctx.drawImage(img, vRect.left, vRect.top, vRect.width, vRect.height);
            } catch (e) {
              console.error('Failed to draw replacement image:', e);
            }
          }
        } else if (imgObj.origin === 'inserted') {
          const displayUrl = imgObj.replacementDataUrl || imgObj.dataUrl;
          if (displayUrl) {
            try {
              const img = await loadImage(displayUrl);
              ctx.drawImage(img, vRect.left, vRect.top, vRect.width, vRect.height);
            } catch (e) {
              console.error('Failed to draw inserted image:', e);
            }
          }
        }
      } else if (obj.type === 'signature') {
        const sigObj = obj as SignatureObject;
        if (sigObj.dataUrl) {
          try {
            const img = await loadImage(sigObj.dataUrl);
            ctx.drawImage(img, vRect.left, vRect.top, vRect.width, vRect.height);
          } catch (e) {
            console.error('Failed to draw signature:', e);
          }
        }
      } else if (obj.type === 'freehand') {
        const freeObj = obj as FreehandObject;
        if (freeObj.points && freeObj.points.length >= 2) {
          ctx.beginPath();
          const startPt = viewport.convertToViewportPoint(freeObj.points[0].x, freeObj.points[0].y);
          ctx.moveTo(startPt[0], startPt[1]);
          for (let i = 1; i < freeObj.points.length; i++) {
            const pt = viewport.convertToViewportPoint(freeObj.points[i].x, freeObj.points[i].y);
            ctx.lineTo(pt[0], pt[1]);
          }
          ctx.strokeStyle = freeObj.strokeColor;
          ctx.lineWidth = freeObj.strokeWidth * scale;
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    // Check if user has added any color annotations to this page
    let hasColorAnnotation = false;
    for (const obj of pageObjects) {
      if (obj.type === 'text' && isHexColorColored((obj as TextObject).color)) {
        hasColorAnnotation = true;
      } else if (obj.type === 'shape') {
        const s = obj as ShapeObject;
        if (s.strokeColor && isHexColorColored(s.strokeColor)) hasColorAnnotation = true;
        if (s.fillColor && isHexColorColored(s.fillColor)) hasColorAnnotation = true;
      } else if (obj.type === 'freehand' && isHexColorColored((obj as FreehandObject).strokeColor)) {
        hasColorAnnotation = true;
      }
    }

    // Adaptive Color Detection (Phase 1)
    const isGrayscale = !hasColorAnnotation && detectIfPageIsGrayscale(ctx, canvas.width, canvas.height);
    if (isGrayscale) {
      convertCanvasToGrayscale(ctx, canvas.width, canvas.height);
    }

    // Convert offscreen canvas to a PNG data URL (Phase 2)
    const dataUrl = canvas.toDataURL('image/png');
    const response = await fetch(dataUrl);
    const pngBytes = await response.arrayBuffer();

    // Embed the PNG into the brand new PDF Document (Phase 2)
    const embeddedPng = await newPdfDoc.embedPng(pngBytes);

    // Compute original page dimensions in PDF points
    const originalWidth = viewport.width / scale;
    const originalHeight = viewport.height / scale;

    // Create a new page with the original dimensions and draw the image filling it
    const newPage = newPdfDoc.addPage([originalWidth, originalHeight]);
    newPage.drawImage(embeddedPng, {
      x: 0,
      y: 0,
      width: originalWidth,
      height: originalHeight,
    });

    // Run client-side OCR if requested (Phase 4)
    if (ocrWorker) {
      onProgress?.(`Running OCR on page ${pageIdx + 1} of ${totalPages}...`, 0.8 + (pageIdx / totalPages) * 0.08);
      try {
        const { data } = await ocrWorker.recognize(dataUrl);
        const lines = (data as any).lines || [];
        
        for (const line of lines) {
          try {
            // 1. Skip low-confidence noise / artifacts
            if (line.confidence !== undefined && line.confidence < 60) {
              continue;
            }

            const rawText = line.text ? line.text.trim() : '';
            if (!rawText) continue;

            // 2. Sanitize text for StandardFonts.Helvetica (WinAnsi / ASCII safe)
            const sanitizedText = rawText
              .replace(/[\u2018\u2019]/g, "'")
              .replace(/[\u201C\u201D]/g, '"')
              .replace(/[\u2013\u2014]/g, '-')
              .replace(/[\u2026]/g, '...')
              .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
              .trim();

            if (!sanitizedText) continue;

            const { x0, y0, y1 } = line.bbox;
            
            // Map canvas pixel coordinates to PDF point coordinates
            const lineHeight = (y1 - y0) / scale;
            const lineX = x0 / scale;
            const lineY = originalHeight - (y1 / scale);
            
            newPage.drawText(sanitizedText, {
              x: lineX,
              y: lineY,
              size: Math.max(4, lineHeight * 0.8), // size slightly smaller than box height
              font: ocrFont,
              opacity: 0.01, // 0.01 is invisible to the human eye but indexes perfectly on desktop & mobile
            });
          } catch (lineErr) {
            // Isolate errors to single line so one bad token doesn't kill the page text layer
            console.warn(`[OCR Exporter] Skipped line due to draw error on page ${pageIdx + 1}:`, lineErr);
          }
        }
      } catch (ocrErr) {
        console.error(`OCR failed on page ${pageIdx + 1}:`, ocrErr);
      }
    }
  }

  // Terminate OCR worker if it was created
  if (ocrWorker) {
    try {
      await ocrWorker.terminate();
    } catch {
      // Ignore termination errors
    }
  }

  // Save the new flattened document
  onProgress?.('Saving PDF...', 0.85);
  const savedBytes = await newPdfDoc.save();

  // Run the saved bytes through the existing size optimizer / compressor pipeline
  let finalBytes = savedBytes;
  try {
    onProgress?.('Optimizing file size...', 0.9);
    const tempFile = new File([savedBytes as any], document.file.name, { type: 'application/pdf' });
    // Use 'best' quality compression to avoid downsampling the 300 DPI pages or using heavy lossy compression
    const compressedResult = await compressPdf(tempFile, { level: 'best' }, (progress) => {
      onProgress?.('Optimizing file size...', 0.9 + (progress / 100) * 0.09);
    });
    finalBytes = new Uint8Array(await compressedResult.compressedBlob.arrayBuffer());
    onProgress?.('Export complete.', 1.0);
  } catch (compressErr) {
    console.warn('Compression pass failed, returning uncompressed flattened PDF:', compressErr);
    onProgress?.('Export complete.', 1.0);
  }

  return finalBytes;
}
