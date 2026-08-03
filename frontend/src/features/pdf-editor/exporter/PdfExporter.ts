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
import Tesseract from 'tesseract.js';

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
  options?: { doOcr?: boolean }
): Promise<Uint8Array> {
  onProgress?.('Preparing document for export...', 0);

  const totalPages = document.numPages;
  const newPdfDoc = await PDFDocument.create();

  // Embed Helvetica standard font for OCR text overlay (Phase 4)
  const ocrFont = await newPdfDoc.embedFont(StandardFonts.Helvetica);

  // Target DPI 300 for high-quality sharp text rendering (standard print/display DPI)
  const targetDpi = 300;
  const scale = targetDpi / 72;

  // Process and flatten each page
  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    onProgress?.(`Rendering and flattening page ${pageIdx + 1} of ${totalPages}...`, (pageIdx / totalPages) * 0.8);

    const page = await document.pdfjsDocument.getPage(pageIdx + 1);
    const viewport = page.getViewport({ scale });

    // Create an offscreen canvas
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error(`Failed to get canvas 2d context for page ${pageIdx + 1}`);
    }

    // Render PDF page content using PDF.js
    const renderTask = page.render({ canvasContext: ctx, viewport });
    await renderTask.promise;

    // Filter and sort page objects by zIndex
    const pageObjects = Array.from(objects.values())
      .filter((obj) => obj.pageIndex === pageIdx)
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

    // Adaptive Color Detection (Phase 1)
    const isGrayscale = detectIfPageIsGrayscale(ctx, canvas.width, canvas.height);
    if (isGrayscale) {
      console.log(`[PdfExporter] Page ${pageIdx + 1} classified as Grayscale/Mono`);
      convertCanvasToGrayscale(ctx, canvas.width, canvas.height);
    } else {
      console.log(`[PdfExporter] Page ${pageIdx + 1} classified as Color`);
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
    if (options?.doOcr) {
      onProgress?.(`Running OCR on page ${pageIdx + 1} of ${totalPages}...`, 0.8 + (pageIdx / totalPages) * 0.08);
      try {
        const { data } = await Tesseract.recognize(dataUrl, 'eng');
        const words = data.words || [];
        
        for (const word of words) {
          const { x0, y0, x1, y1 } = word.bbox;
          
          // Map canvas pixel coordinates to PDF point coordinates
          const _wordWidth = (x1 - x0) / scale;
          const wordHeight = (y1 - y0) / scale;
          const wordX = x0 / scale;
          const wordY = originalHeight - (y1 / scale);
          
          newPage.drawText(word.text, {
            x: wordX,
            y: wordY,
            size: wordHeight * 0.8, // size slightly smaller than box height
            font: ocrFont,
            opacity: 0, // Invisible selectable layer
          });
        }
      } catch (ocrErr) {
        console.error(`OCR failed on page ${pageIdx + 1}:`, ocrErr);
      }
    }
  }

  // Save the new flattened document
  onProgress?.('Saving PDF...', 0.85);
  const savedBytes = await newPdfDoc.save();

  // Run the saved bytes through the existing size optimizer / compressor pipeline
  let finalBytes = savedBytes;
  try {
    onProgress?.('Optimizing file size...', 0.9);
    const tempFile = new File([savedBytes], document.file.name, { type: 'application/pdf' });
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
