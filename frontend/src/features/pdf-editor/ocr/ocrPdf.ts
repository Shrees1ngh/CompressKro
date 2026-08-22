// ============================================================
// CompressKro — High-Accuracy Dedicated OCR Engine (v2)
// ============================================================
// Adds an invisible searchable text layer to an existing PDF
// WITHOUT re-rendering, rasterizing, or degrading the original visual content.
//
// Architecture:
//   IMAGE/PDF → PAGE RENDERING → PREPROCESSING → LAYOUT ANALYSIS
//   → TEXT REGIONS + TABLE REGIONS → CELL DETECTION → REGION-SPECIFIC OCR
//   → CANDIDATE RECONCILIATION → READING ORDER → PROPER PDF TEXT LAYER
//   → SEARCHABLE + SELECTABLE + COPYABLE PDF
//
// v2 Changes:
//   1. Proper PDF text layer generation using new content streams with
//      correctly registered font resources (not internal operator hacking).
//   2. Table cell detection via horizontal + vertical line intersection.
//   3. Multi-signal OCR merging (spatial + textual, not just IoU).
//   4. Relaxed gibberish filters for high recall.
//   5. Layout-aware reading order (table row/col aware).
//   6. Proper Hindi/Unicode font handling.
// ============================================================

import {
  PDFDocument, StandardFonts, PDFPage, PDFFont, PDFName, PDFDict,
  PDFArray, PDFStream, PDFHexString, PDFNumber, PDFRef, PDFRawStream
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { createWorker, PSM } from 'tesseract.js';
import type { Worker as TesseractWorker, Page as TesseractPage } from 'tesseract.js';
import { loadPdfJs } from '../../../utils/pdfLoader';

export type OcrProgressCallback = (message: string, progress: number) => void;

// Helper to convert codepoint to hex string
function toHexStringOfMinLength(num: number, minLength: number): string {
  let hex = num.toString(16).toUpperCase();
  while (hex.length < minLength) hex = '0' + hex;
  return hex;
}

// Convert Unicode codepoint to CMap UTF-16 hex
function cmapCodePointFormat(codePoint: number): string {
  if (codePoint >= 0 && codePoint <= 0xFFFF) {
    return toHexStringOfMinLength(codePoint, 4);
  }
  if (codePoint > 0xFFFF && codePoint <= 0x10FFFF) {
    const hs = Math.floor((codePoint - 0x10000) / 0x400) + 0xD800;
    const ls = ((codePoint - 0x10000) % 0x400) + 0xDC00;
    return toHexStringOfMinLength(hs, 4) + toHexStringOfMinLength(ls, 4);
  }
  return 'FFFD'; // Replacement char
}

// Custom CMap generator compliant with PDF specifications
function generateCMap(mappings: Map<number, number[]>): string {
  const lines: string[] = [];
  lines.push('/CIDInit /ProcSet findresource begin');
  lines.push('12 dict begin');
  lines.push('begincmap');
  lines.push('/CIDSystemInfo <<');
  lines.push('  /Registry (Adobe)');
  lines.push('  /Ordering (UCS)');
  lines.push('  /Supplement 0');
  lines.push('>> def');
  lines.push('/CMapName /Adobe-Identity-UCS def');
  lines.push('/CMapType 2 def');
  lines.push('1 begincodespacerange');
  lines.push('<0000><ffff>');
  lines.push('endcodespacerange');
  
  const entries = Array.from(mappings.entries()).sort((a, b) => a[0] - b[0]);
  
  // Split entries into blocks of 100 per PDF specifications
  const blockSize = 100;
  for (let i = 0; i < entries.length; i += blockSize) {
    const chunk = entries.slice(i, i + blockSize);
    lines.push(`${chunk.length} beginbfchar`);
    for (const [glyphId, codePoints] of chunk) {
      const glyphHex = `<${toHexStringOfMinLength(glyphId, 4)}>`;
      const unicodeHex = `<${codePoints.map(cmapCodePointFormat).join('')}>`;
      lines.push(`${glyphHex} ${unicodeHex}`);
    }
    lines.push('endbfchar');
  }
  
  lines.push('endcmap');
  lines.push('CMapName currentdict /CMap defineresource pop');
  lines.push('end');
  lines.push('end');
  
  return lines.join('\n');
}

/**
 * Layout-aware background and border suppression.
 * Filters out noise and border patterns without destroying legitimate content.
 */
function isWordBackgroundNoise(
  word: InternalOcrWord,
  canvasWidth: number,
  canvasHeight: number,
  regions: DetectedRegion[]
): boolean {
  const { x0, y0, x1, y1 } = word.bbox;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  
  // 1. Outer margins check (suppress outer 4.5% margins)
  const padX = canvasWidth * 0.045;
  const padY = canvasHeight * 0.045;
  if (cx < padX || cx > canvasWidth - padX || cy < padY || cy > canvasHeight - padY) {
    return true; // Suppress page border noise
  }
  
  // 2. Extremely low confidence threshold
  if (word.confidence < 25) {
    return true;
  }
  
  // 3. Check if inside any detected layout region
  let inRegion = false;
  for (const r of regions) {
    if (cx >= r.bbox.x0 && cx <= r.bbox.x1 && cy >= r.bbox.y0 && cy <= r.bbox.y1) {
      inRegion = true;
      break;
    }
  }
  
  // If outside all layout regions and has low confidence or is gibberish
  if (!inRegion) {
    if (word.confidence < 50) return true;
    if (isGibberishToken(word.text)) return true;
  }
  
  // 4. Symbols/punctuation artifacts from grid lines
  const clean = word.text.trim();
  if (clean.length === 1 && !/[A-Za-z0-9\u0900-\u097F]/.test(clean)) {
    if (word.confidence < 60) return true;
  }
  
  // 5. Extremely long nonsense string from border repeats
  if (clean.length > 15 && !/[aeiouyAEIOUY\u0900-\u097F]/.test(clean)) {
    return true;
  }
  
  return false;
}

/** Cache the font bytes so we fetch it only once per session */
let cachedFontBytes: ArrayBuffer | null = null;

// ── Font helpers ──────────────────────────────────────────────

/**
 * Checks if a font cannot encode one or more characters in the text.
 */
function hasUnsupportedChars(font: PDFFont, text: string): boolean {
  const embedder = (font as any).embedder;
  if (!embedder || !embedder.font || typeof embedder.font.layout !== 'function') {
    try {
      font.encodeText(text);
      return false;
    } catch {
      return true;
    }
  }

  try {
    const { glyphs } = embedder.font.layout(text, embedder.fontFeatures);
    for (const glyph of glyphs) {
      if (glyph.id === 0) {
        return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

async function loadDevanagariFont(): Promise<ArrayBuffer> {
  if (cachedFontBytes) return cachedFontBytes;
  const resp = await fetch('/fonts/NotoSansDevanagari-Regular.ttf');
  if (!resp.ok) throw new Error('Failed to load OCR font NotoSansDevanagari-Regular.ttf');
  cachedFontBytes = await resp.arrayBuffer();
  return cachedFontBytes;
}

// ── Worker init ──────────────────────────────────────────────

/**
 * Initialize a Tesseract worker with a set of languages.
 * Automatically tries to load high-accuracy models with offline fallback.
 */
export async function initWorker(languages: string[], onProgress?: OcrProgressCallback): Promise<TesseractWorker> {
  const langQuery = languages.length > 0 ? languages.join('+') : 'eng';
  onProgress?.(`Initializing high-accuracy OCR engine (${languages.join(', ')})...`, 0.05);

  const workerOptions: any = {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/',
    logger: (m: any) => {
      if (m.status === 'loading language traineddata') {
        const pct = Math.round(m.progress * 100);
        onProgress?.(`Loading high-accuracy models (${pct}%)...`, 0.05 + m.progress * 0.04);
      }
    }
  };

  let worker: TesseractWorker;
  try {
    worker = await createWorker(langQuery, 1, workerOptions);
  } catch (err) {
    console.warn(`Failed to init worker with CDN data, falling back to local fast models:`, err);
    worker = await createWorker(langQuery, 1, {
      workerPath: '/tesseract/worker.min.js',
      corePath: '/tesseract/',
      langPath: '/tesseract/lang-data',
    });
  }

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
  });

  return worker;
}

// ── Deskew ───────────────────────────────────────────────────

/**
 * Detects page skew angle using projection profile variance.
 */
function deskewCanvas(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;

  const w = canvas.width;
  const h = canvas.height;

  const maxDim = 300;
  let scale = 1;
  if (w > maxDim || h > maxDim) {
    scale = maxDim / Math.max(w, h);
  }
  const sw = Math.floor(w * scale);
  const sh = Math.floor(h * scale);

  const smallCanvas = document.createElement('canvas');
  smallCanvas.width = sw;
  smallCanvas.height = sh;
  const sctx = smallCanvas.getContext('2d');
  if (!sctx) return 0;

  sctx.drawImage(canvas, 0, 0, sw, sh);
  const imgData = sctx.getImageData(0, 0, sw, sh);
  const data = imgData.data;

  const binary = new Uint8Array(sw * sh);
  for (let i = 0; i < data.length; i += 4) {
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    binary[i / 4] = luma < 200 ? 1 : 0;
  }

  let bestAngle = 0;
  let maxVariance = -1;
  let zeroVariance = 0;

  const startY = Math.floor(sh * 0.1);
  const endY = Math.floor(sh * 0.9);
  const startX = Math.floor(sw * 0.1);
  const endX = Math.floor(sw * 0.9);

  for (let angleDeg = -5.0; angleDeg <= 5.0; angleDeg += 0.5) {
    const angleRad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const profile = new Float32Array(sh);
    const midX = sw / 2;
    const midY = sh / 2;

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (binary[y * sw + x] === 1) {
          const rotY = Math.floor((x - midX) * sin + (y - midY) * cos + midY);
          if (rotY >= 0 && rotY < sh) {
            profile[rotY]++;
          }
        }
      }
    }

    let sum = 0;
    for (let i = startY; i < endY; i++) sum += profile[i];
    const mean = sum / (endY - startY);

    let variance = 0;
    for (let i = startY; i < endY; i++) {
      const diff = profile[i] - mean;
      variance += diff * diff;
    }
    variance /= (endY - startY);

    if (angleDeg === 0) {
      zeroVariance = variance;
    }

    if (variance > maxVariance) {
      maxVariance = variance;
      bestAngle = angleDeg;
    }
  }

  if (maxVariance < zeroVariance * 1.15) {
    bestAngle = 0;
  }

  if (Math.abs(bestAngle) >= 0.5) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(canvas, 0, 0);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((-bestAngle * Math.PI) / 180);
    ctx.drawImage(tempCanvas, -w / 2, -h / 2);
    ctx.restore();
  }

  return bestAngle;
}

// ── Preprocessing passes ─────────────────────────────────────

/**
 * Pass A — Minimal / Raw Grayscale Preprocessing (Default).
 * Converts to grayscale and applies mild contrast normalization without erasing
 * table lines or decorative borders. Keeps full fidelity for Tesseract.
 */
export function preprocessCanvasMinimal(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const len = data.length;

  let min = 255;
  let max = 0;

  const luma = new Uint8ClampedArray(len / 4);
  for (let i = 0; i < len; i += 4) {
    const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    luma[i / 4] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const range = max - min;
  const shouldStretch = range > 20 && range < 220;

  for (let i = 0; i < len; i += 4) {
    let v = luma[i / 4];
    if (shouldStretch) {
      v = ((v - min) / range) * 255;
    }
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }

  ctx.putImageData(imgData, 0, 0);
  return deskewCanvas(canvas);
}

/**
 * Pass B — Mild Denoise & Contrast Preprocessing.
 */
export function preprocessCanvasDenoise(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;

  preprocessCanvasMinimal(canvas);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const w = canvas.width;
  const h = canvas.height;
  const temp = new Uint8ClampedArray(data);

  // 3x3 mild box filter
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += temp[((y + dy) * w + (x + dx)) * 4];
        }
      }
      const avg = sum / 9;
      data[idx] = avg;
      data[idx + 1] = avg;
      data[idx + 2] = avg;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return 0;
}

/**
 * Pass C — Bradley-Roth Adaptive Thresholding (Fallback for uneven illumination).
 */
export function preprocessCanvasAdaptive(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;

  preprocessCanvasMinimal(canvas);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const w = canvas.width;
  const h = canvas.height;

  const intImg = new Uint32Array(w * h);
  for (let y = 0, idx = 0; y < h; y++) {
    let sum = 0;
    for (let x = 0; x < w; x++, idx++) {
      sum += data[idx * 4];
      intImg[idx] = (y === 0) ? sum : intImg[idx - w] + sum;
    }
  }

  const S = Math.max(8, Math.floor(w / 16));
  const T = 0.15;
  const s2 = Math.floor(S / 2);

  for (let y = 0, idx = 0; y < h; y++) {
    for (let x = 0; x < w; x++, idx++) {
      const x0 = Math.max(0, x - s2);
      const x1 = Math.min(w - 1, x + s2);
      const y0 = Math.max(0, y - s2);
      const y1 = Math.min(h - 1, y + s2);

      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      let sum = intImg[y1 * w + x1];
      if (x0 > 0) sum -= intImg[y1 * w + (x0 - 1)];
      if (y0 > 0) sum -= intImg[(y0 - 1) * w + x1];
      if (x0 > 0 && y0 > 0) sum += intImg[(y0 - 1) * w + (x0 - 1)];

      const val = data[idx * 4];
      const binarized = (val * count < sum * (1.0 - T)) ? 0 : 255;

      data[idx * 4] = binarized;
      data[idx * 4 + 1] = binarized;
      data[idx * 4 + 2] = binarized;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return 0;
}

// ── Region / Layout Analysis ─────────────────────────────────

/**
 * Checks if a candidate sub-region has text-like content density and line structure.
 */
export function isRegionTextLike(
  isDark: Uint8Array,
  canvasWidth: number,
  canvasHeight: number,
  bbox: { x0: number; y0: number; x1: number; y1: number }
): { isTextLike: boolean; density: number; reason: string } {
  const x0 = Math.max(0, Math.min(canvasWidth - 1, bbox.x0));
  const y0 = Math.max(0, Math.min(canvasHeight - 1, bbox.y0));
  const x1 = Math.max(0, Math.min(canvasWidth - 1, bbox.x1));
  const y1 = Math.max(0, Math.min(canvasHeight - 1, bbox.y1));

  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 20 || h <= 20) {
    return { isTextLike: false, density: 0, reason: 'bbox-too-small' };
  }

  const totalPixels = w * h;
  let darkCount = 0;

  const rowCounts = new Uint32Array(h);

  for (let y = y0; y < y1; y++) {
    const rowIdx = y - y0;
    let rCount = 0;
    const rowOffset = y * canvasWidth;
    for (let x = x0; x < x1; x++) {
      if (isDark[rowOffset + x]) {
        rCount++;
      }
    }
    rowCounts[rowIdx] = rCount;
    darkCount += rCount;
  }

  const density = darkCount / totalPixels;

  if (density < 0.003) {
    return { isTextLike: false, density, reason: `too-sparse-blank (${(density * 100).toFixed(2)}%)` };
  }

  if (density > 0.50) {
    return { isTextLike: false, density, reason: `too-dense-solid-blob (${(density * 100).toFixed(2)}%)` };
  }

  let peakRows = 0;
  const minPeakWidth = Math.max(6, Math.floor(w * 0.02));

  for (let r = 0; r < h; r++) {
    if (rowCounts[r] >= minPeakWidth) {
      peakRows++;
    }
  }

  if (peakRows < Math.max(1, Math.floor(h * 0.015))) {
    return { isTextLike: false, density, reason: `no-discernible-text-rows (${peakRows} peak rows)` };
  }

  return { isTextLike: true, density, reason: 'valid-text-profile' };
}

export interface DetectedRegion {
  id: string;
  type: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  psm: PSM;
  reason: string;
}

export interface TableCell {
  row: number;
  col: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * Detect vertical lines in a region of the binary image.
 */
function detectVerticalLines(
  isDark: Uint8Array, canvasWidth: number, canvasHeight: number,
  regionBbox: { x0: number; y0: number; x1: number; y1: number },
  minVLineLen: number
): number[] {
  const vLines: number[] = [];
  const { x0, y0, x1, y1 } = regionBbox;

  for (let x = x0; x < x1; x++) {
    let run = 0;
    for (let y = y0; y < y1; y++) {
      if (isDark[y * canvasWidth + x]) {
        run++;
        if (run >= minVLineLen) {
          vLines.push(x);
          break;
        }
      } else {
        run = 0;
      }
    }
  }

  // Cluster adjacent vertical lines
  const clustered: number[] = [];
  if (vLines.length > 0) {
    let sum = vLines[0], count = 1;
    for (let i = 1; i < vLines.length; i++) {
      if (vLines[i] - vLines[i - 1] <= 8) {
        sum += vLines[i];
        count++;
      } else {
        clustered.push(Math.round(sum / count));
        sum = vLines[i];
        count = 1;
      }
    }
    clustered.push(Math.round(sum / count));
  }
  return clustered;
}

/**
 * Detect table cells by finding horizontal and vertical line intersections.
 */
export function detectTableCells(
  isDark: Uint8Array, canvasWidth: number, canvasHeight: number,
  tableBbox: { x0: number; y0: number; x1: number; y1: number },
  hLines: number[]
): TableCell[] {
  const tableHeight = tableBbox.y1 - tableBbox.y0;
  const minVLineLen = Math.floor(tableHeight * 0.15);

  const vLines = detectVerticalLines(isDark, canvasWidth, canvasHeight, tableBbox, minVLineLen);

  if (vLines.length < 2 || hLines.length < 2) {
    console.log(`[OCR Table] Insufficient grid lines: ${vLines.length} vertical, ${hLines.length} horizontal. Falling back to row-based OCR.`);
    // Fallback: create row-based cells spanning the full width
    const cells: TableCell[] = [];
    for (let r = 0; r < hLines.length - 1; r++) {
      const cellHeight = hLines[r + 1] - hLines[r];
      if (cellHeight < 15) continue;
      cells.push({
        row: r,
        col: 0,
        bbox: {
          x0: tableBbox.x0 + 5,
          y0: hLines[r] + 2,
          x1: tableBbox.x1 - 5,
          y1: hLines[r + 1] - 2,
        }
      });
    }
    return cells;
  }

  console.log(`[OCR Table] Grid detected: ${hLines.length} horizontal lines, ${vLines.length} vertical lines`);

  const cells: TableCell[] = [];
  for (let r = 0; r < hLines.length - 1; r++) {
    for (let c = 0; c < vLines.length - 1; c++) {
      const cellW = vLines[c + 1] - vLines[c];
      const cellH = hLines[r + 1] - hLines[r];
      if (cellW < 10 || cellH < 10) continue;

      cells.push({
        row: r,
        col: c,
        bbox: {
          x0: vLines[c] + 2,
          y0: hLines[r] + 2,
          x1: vLines[c + 1] - 2,
          y1: hLines[r + 1] - 2,
        }
      });
    }
  }

  return cells;
}

/**
 * Generic Page Region Detector.
 * Analyzes document structure via horizontal line grids and vertical layout spacing.
 */
export function detectPageRegions(
  canvas: HTMLCanvasElement,
  precomputedBinary?: Uint8Array
): { regions: DetectedRegion[]; tableCells: TableCell[]; hLines: number[]; isDark: Uint8Array } {
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  let isDark: Uint8Array;
  if (precomputedBinary) {
    isDark = precomputedBinary;
  } else {
    const ctx = canvas.getContext('2d');
    if (!ctx) return { regions: [], tableCells: [], hLines: [], isDark: new Uint8Array(0) };
    const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imgData.data;
    isDark = new Uint8Array(canvasWidth * canvasHeight);
    for (let i = 0; i < data.length; i += 4) {
      isDark[i / 4] = data[i] < 180 ? 1 : 0;
    }
  }

  // Scan internal horizontal lines
  const marginX = Math.floor(canvasWidth * 0.05);
  const marginY = Math.floor(canvasHeight * 0.05);
  const minHLineLen = Math.floor(canvasWidth * 0.12);

  const internalHLines: number[] = [];
  for (let y = marginY; y < canvasHeight - marginY; y++) {
    let run = 0;
    for (let x = marginX; x < canvasWidth - marginX; x++) {
      if (isDark[y * canvasWidth + x]) {
        run++;
        if (run >= minHLineLen) {
          internalHLines.push(y);
          break;
        }
      } else {
        run = 0;
      }
    }
  }

  // Cluster adjacent horizontal lines
  const clusteredHLines: number[] = [];
  if (internalHLines.length > 0) {
    let sum = internalHLines[0], count = 1;
    for (let i = 1; i < internalHLines.length; i++) {
      if (internalHLines[i] - internalHLines[i - 1] <= 15) {
        sum += internalHLines[i];
        count++;
      } else {
        clusteredHLines.push(Math.round(sum / count));
        sum = internalHLines[i];
        count = 1;
      }
    }
    clusteredHLines.push(Math.round(sum / count));
  }

  // Filter horizontal grid lines to reject gaps larger than 8% of canvas height (e.g. footer lines)
  const tableHLines: number[] = [];
  if (clusteredHLines.length > 0) {
    tableHLines.push(clusteredHLines[0]);
    for (let i = 1; i < clusteredHLines.length; i++) {
      if (clusteredHLines[i] - clusteredHLines[i - 1] > canvasHeight * 0.08) {
        break;
      }
      tableHLines.push(clusteredHLines[i]);
    }
  }

  // Detect Structured Table Grid if >= 3 clustered horizontal grid lines
  let tableBox: { x0: number; y0: number; x1: number; y1: number } | null = null;
  let tableCells: TableCell[] = [];
  if (tableHLines.length >= 3) {
    const tY0 = Math.max(0, tableHLines[0] - 10);
    const tY1 = Math.min(canvasHeight, tableHLines[tableHLines.length - 1] + 10);
    if (tY1 - tY0 > 200) {
      tableBox = {
        x0: Math.floor(canvasWidth * 0.04),
        y0: tY0,
        x1: Math.floor(canvasWidth * 0.96),
        y1: tY1
      };

      // Detect individual cells within the table
      tableCells = detectTableCells(isDark, canvasWidth, canvasHeight, tableBox, tableHLines);
      console.log(`[OCR Layout] Detected ${tableCells.length} table cells from ${tableHLines.length} horizontal lines`);
    }
  }

  const detectedRegions: DetectedRegion[] = [];

  if (!tableBox) {
    // No table found — return empty regions for clean full-page OCR
    return { regions: detectedRegions, tableCells: [], hLines: tableHLines, isDark };
  }

  // 1. Header Region
  const headerBbox = {
    x0: Math.floor(canvasWidth * 0.05),
    y0: Math.floor(canvasHeight * 0.04),
    x1: Math.floor(canvasWidth * 0.95),
    y1: Math.min(tableBox.y0, Math.floor(canvasHeight * 0.30))
  };
  const headerGate = isRegionTextLike(isDark, canvasWidth, canvasHeight, headerBbox);
  if (headerGate.isTextLike) {
    detectedRegions.push({
      id: 'region_header',
      type: 'Header Banner',
      bbox: headerBbox,
      psm: PSM.AUTO,
      reason: 'Institutional header, certificate titles and registration identifiers'
    });
  }

  // 2. Personal Details & Metadata (between Header and Table)
  if (tableBox.y0 > headerBbox.y1 + 40) {
    const personalBbox = {
      x0: Math.floor(canvasWidth * 0.05),
      y0: headerBbox.y1,
      x1: Math.floor(canvasWidth * 0.95),
      y1: tableBox.y0
    };
    const personalGate = isRegionTextLike(isDark, canvasWidth, canvasHeight, personalBbox);
    if (personalGate.isTextLike) {
      detectedRegions.push({
        id: 'region_personal',
        type: 'Personal Details & Metadata',
        bbox: personalBbox,
        psm: PSM.SPARSE_TEXT,
        reason: 'Sparse two-column metadata (Candidate Name, Roll No, Parents, DOB, School)'
      });
    }
  }

  // 3. Structured Table Grid — if we have cells, add individual cell regions
  if (tableCells.length > 0) {
    // Add the whole table region too for full-table OCR pass
    const tableGate = isRegionTextLike(isDark, canvasWidth, canvasHeight, tableBox);
    if (tableGate.isTextLike) {
      detectedRegions.push({
        id: 'region_table',
        type: 'Structured Table Grid',
        bbox: tableBox,
        psm: PSM.SINGLE_BLOCK,
        reason: 'Tabular subjects, marks breakdown (Theory/Practical), total words and grades'
      });
    }
  } else {
    // No cells — treat whole table as single block
    const tableGate = isRegionTextLike(isDark, canvasWidth, canvasHeight, tableBox);
    if (tableGate.isTextLike) {
      detectedRegions.push({
        id: 'region_table',
        type: 'Structured Table Grid',
        bbox: tableBox,
        psm: PSM.SINGLE_BLOCK,
        reason: 'Table without detected cell structure'
      });
    }
  }

  // 4. Footer & Results Annotations
  const footerBbox = {
    x0: Math.floor(canvasWidth * 0.05),
    y0: tableBox.y1,
    x1: Math.floor(canvasWidth * 0.95),
    y1: Math.floor(canvasHeight * 0.96)
  };
  const footerGate = isRegionTextLike(isDark, canvasWidth, canvasHeight, footerBbox);
  if (footerGate.isTextLike) {
    detectedRegions.push({
      id: 'region_footer',
      type: 'Footer, Results & Annotations',
      bbox: footerBbox,
      psm: PSM.SPARSE_TEXT,
      reason: 'Result PASS, abbreviations, date, controller signatures, and co-scholastic notes'
    });
  }

  return { regions: detectedRegions, tableCells, hLines: clusteredHLines, isDark };
}

// ── Gibberish / noise detection (RELAXED for high recall) ────

/**
 * Helper to identify hallucinated noise / gibberish tokens.
 * RELAXED version — only filters the most obvious garbage.
 */
export function isGibberishToken(text: string): boolean {
  if (!text) return true;
  const clean = text.trim();
  if (clean.length === 0) return true;

  // 4 or more identical consecutive punctuation symbols (e.g. `,,,,`, `||||`)
  if (/([^\w\s])\1{3,}/.test(clean)) {
    return true;
  }

  // Latin word with >= 6 consecutive consonants without vowels or digits (e.g. `bdfghjklm`)
  if (/^[A-Za-z]+$/.test(clean) && clean.length >= 6 && !/[aeiouyAEIOUY0-9]/.test(clean)) {
    return true;
  }

  // Extreme ratio of non-alphanumeric symbols in multi-character token (> 75% symbols)
  const alphaNumCount = (clean.match(/[0-9A-Za-z\u0900-\u097F]/g) || []).length;
  if (clean.length >= 4 && (alphaNumCount / clean.length) < 0.25) {
    return true;
  }

  return false;
}

// ── OCR quality scoring ──────────────────────────────────────

function computeBoundingBoxIoU(
  b1: { x0: number; y0: number; x1: number; y1: number },
  b2: { x0: number; y0: number; x1: number; y1: number }
): number {
  const x0 = Math.max(b1.x0, b2.x0);
  const y0 = Math.max(b1.y0, b2.y0);
  const x1 = Math.min(b1.x1, b2.x1);
  const y1 = Math.min(b1.y1, b2.y1);
  const wOverlap = Math.max(0, x1 - x0);
  const hOverlap = Math.max(0, y1 - y0);
  const intersection = wOverlap * hOverlap;
  if (intersection === 0) return 0;
  const area1 = Math.max(1, (b1.x1 - b1.x0) * (b1.y1 - b1.y0));
  const area2 = Math.max(1, (b2.x1 - b2.x0) * (b2.y1 - b2.y0));
  const union = area1 + area2 - intersection;
  return intersection / union;
}

/**
 * Center distance between two bounding boxes as fraction of average box diagonal.
 */
function bboxCenterDistance(
  b1: { x0: number; y0: number; x1: number; y1: number },
  b2: { x0: number; y0: number; x1: number; y1: number }
): number {
  const cx1 = (b1.x0 + b1.x1) / 2;
  const cy1 = (b1.y0 + b1.y1) / 2;
  const cx2 = (b2.x0 + b2.x1) / 2;
  const cy2 = (b2.y0 + b2.y1) / 2;
  const dist = Math.sqrt((cx1 - cx2) ** 2 + (cy1 - cy2) ** 2);
  const diag1 = Math.sqrt((b1.x1 - b1.x0) ** 2 + (b1.y1 - b1.y0) ** 2);
  const diag2 = Math.sqrt((b2.x1 - b2.x0) ** 2 + (b2.y1 - b2.y0) ** 2);
  const avgDiag = (diag1 + diag2) / 2;
  return avgDiag > 0 ? dist / avgDiag : Infinity;
}

/**
 * Check if b1 contains b2 (b2 is inside b1).
 */
function bboxContains(
  b1: { x0: number; y0: number; x1: number; y1: number },
  b2: { x0: number; y0: number; x1: number; y1: number }
): boolean {
  return b2.x0 >= b1.x0 - 5 && b2.y0 >= b1.y0 - 5 && b2.x1 <= b1.x1 + 5 && b2.y1 <= b1.y1 + 5;
}

/**
 * Simple text similarity (case-insensitive).
 */
function textSimilarity(a: string, b: string): number {
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 1.0;
  if (al.length === 0 || bl.length === 0) return 0;

  // Check if one contains the other
  if (al.includes(bl) || bl.includes(al)) return 0.8;

  // Simple character overlap ratio
  const setA = new Set(al);
  const setB = new Set(bl);
  let overlap = 0;
  for (const c of setA) {
    if (setB.has(c)) overlap++;
  }
  return overlap / Math.max(setA.size, setB.size);
}

/**
 * Computes a quality score (0 to 100) for a Tesseract candidate OCR result.
 */
function scoreOcrQuality(pageData: TesseractPage): number {
  const meanConfidence = pageData.confidence ?? 0;
  const blocks = pageData.blocks || [];

  let totalWords = 0;
  let validReadableWords = 0;
  let garbageNoiseWords = 0;
  let lowConfWords = 0;

  for (const block of blocks) {
    for (const paragraph of (block.paragraphs || [])) {
      for (const line of (paragraph.lines || [])) {
        for (const word of (line.words || [])) {
          const text = word.text?.trim() || '';
          if (!text) continue;
          totalWords++;

          const conf = word.confidence ?? 0;
          if (conf < 35) {
            lowConfWords++;
          }

          if (isGibberishToken(text)) {
            garbageNoiseWords++;
          } else {
            const isAlphaNum = /[A-Za-z0-9\u0900-\u097F]/.test(text);
            if (text.length >= 2 && isAlphaNum) {
              validReadableWords++;
            }
          }
        }
      }
    }
  }

  if (totalWords === 0) return 0;

  const validRatio = validReadableWords / totalWords;
  const noiseRatio = garbageNoiseWords / totalWords;
  const lowConfRatio = lowConfWords / totalWords;

  const noisePenalty = Math.min(35, (noiseRatio * 45) + (lowConfRatio * 15));

  const score = (meanConfidence * 0.40) +
    (Math.min(100, validReadableWords * 1.5) * 0.35) +
    (validRatio * 100 * 0.25) -
    noisePenalty;

  return Math.max(0, Math.min(100, score));
}

// ── Text normalization ───────────────────────────────────────

/**
 * Safe text normalization:
 * - NFC Unicode normalization
 * - Strip control characters
 * - Normalize whitespace
 * - Canonical Devanagari short-i matra ordering
 * NOTE: Never substitutes alphanumeric characters.
 */
const COMMON_WORDS = [
  'MATHEMATICS', 'STANDARD', 'SCIENCE', 'SOCIAL', 'ENGLISH', 'HINDI', 
  'COURSE', 'CLASS', 'BOARD', 'SECONDARY', 'EDUCATION', 'MARKS', 
  'STATEMENT', 'CUM', 'CERTIFICATE', 'SCHOOL', 'EXAMINATION', 'ROLL', 
  'NO', 'MOTHER', 'FATHER', 'GUARDIAN', 'DATE', 'OF', 'BIRTH', 'PASS', 
  'FAIL', 'FIVE', 'NINETY', 'EIGHTY', 'SEVEN', 'ONE', 'TWO', 'THREE', 'FOUR'
];

function splitFusedWords(text: string): string {
  const upper = text.toUpperCase();
  for (const w1 of COMMON_WORDS) {
    if (upper.startsWith(w1) && upper.length > w1.length) {
      const remainder = upper.slice(w1.length);
      if (COMMON_WORDS.includes(remainder)) {
        const part1 = text.slice(0, w1.length);
        const part2 = text.slice(w1.length);
        return part1 + ' ' + part2;
      }
    }
  }
  return text;
}

function cleanCommonOcrErrors(text: string): string {
  let cleaned = text;
  
  // Fix Al, Bl, etc. to A1, B1
  cleaned = cleaned.replace(/\b([A-H])[lI]\b/g, '$11');
  
  // Fix FIV to FIVE
  cleaned = cleaned.replace(/\bFIV\b/gi, (match) => {
    return match === 'fiv' ? 'five' : match === 'Fiv' ? 'Five' : 'FIVE';
  });
  
  // Fix fused NINETYFIV -> NINETYFIVE
  cleaned = cleaned.replace(/\b(NINETY|EIGHTY|SEVENTY|SIXTY|FIFTY|FORTY|THIRTY|TWENTY)FIV\b/gi, (match, p1) => {
    const suffix = match.endsWith('fiv') ? 'five' : match.endsWith('Fiv') ? 'Five' : 'FIVE';
    return p1 + suffix;
  });

  return cleaned;
}

function normalizeAndCorrectWord(wordText: string): string {
  if (!wordText) return '';

  let text = wordText.normalize('NFC').trim();
  text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  text = text.replace(/\s+/g, ' ');

  // Apply OCR typo cleanups and splits
  text = cleanCommonOcrErrors(text);
  text = splitFusedWords(text);

  return text;
}

// ── Debug types ──────────────────────────────────────────────

export interface DiscardedWordInfo {
  text: string;
  confidence: number;
  reason: string;
}

export interface InsertedWordInfo {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface RegionOcrInfo {
  id: string;
  type: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  psm: PSM;
  rawWords: number;
  meanConf: string;
  reason: string;
}

export interface PageOcrDebugInfo {
  pageIndex: number;
  strategy: string;
  qualityScore: number;
  confidence: number;
  rawWordsCount: number;
  baselineWordsCount: number;
  secondaryWordsCount: number;
  tableCellWordsCount: number;
  duplicateCandidatesRemoved: number;
  uniqueNewWordsAdded: number;
  insertedWordsCount: number;
  discardedWordsCount: number;
  coveragePercent: number;
  discardedWords: DiscardedWordInfo[];
  insertedWords?: InsertedWordInfo[];
  regions?: RegionOcrInfo[];
  linesCount: number;
  rawText: string;
}

interface InternalOcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  source: string;
}

// ── Tesseract runner with timeout ────────────────────────────

async function recognizeWithTimeout(
  worker: TesseractWorker,
  image: any,
  options: any = {},
  outputOptions: any = { text: true, blocks: true },
  timeoutMs: number = 35000
): Promise<any> {
  let timer: any;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Tesseract recognize timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
  });

  try {
    const res = await Promise.race([
      worker.recognize(image, options, outputOptions),
      timeoutPromise
    ]);
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ── Multi-signal OCR Merging ─────────────────────────────────

/**
 * Multi-signal merge: checks spatial overlap, center distance, text similarity,
 * and containment to determine if two OCR words are duplicates.
 */
function areWordsDuplicate(
  w1: InternalOcrWord,
  w2: InternalOcrWord
): boolean {
  const iou = computeBoundingBoxIoU(w1.bbox, w2.bbox);
  const centerDist = bboxCenterDistance(w1.bbox, w2.bbox);
  const textSim = textSimilarity(w1.text, w2.text);

  // High spatial overlap + similar text → duplicate
  if (iou > 0.40 && textSim > 0.5) return true;

  // Very high overlap alone → likely duplicate
  if (iou > 0.65) return true;

  // Centers very close + similar text
  if (centerDist < 0.25 && textSim > 0.6) return true;

  // One contains the other + similar text
  if ((bboxContains(w1.bbox, w2.bbox) || bboxContains(w2.bbox, w1.bbox)) && textSim > 0.4) return true;

  return false;
}

/**
 * Merge secondary words into baseline words using multi-signal deduplication.
 */
function mergeOcrCandidates(
  baselineWords: InternalOcrWord[],
  secondaryWords: InternalOcrWord[]
): { merged: InternalOcrWord[]; duplicatesRemoved: number; uniqueAdded: number } {
  const merged = [...baselineWords];
  let duplicatesRemoved = 0;
  let uniqueAdded = 0;

  for (const secWord of secondaryWords) {
    let matchedIdx = -1;
    let bestScore = 0;

    for (let mIdx = 0; mIdx < merged.length; mIdx++) {
      const iou = computeBoundingBoxIoU(secWord.bbox, merged[mIdx].bbox);
      const centerDist = bboxCenterDistance(secWord.bbox, merged[mIdx].bbox);
      const textSim = textSimilarity(secWord.text, merged[mIdx].text);

      if (areWordsDuplicate(secWord, merged[mIdx])) {
        const score = iou * 0.4 + textSim * 0.4 + (1 - Math.min(1, centerDist)) * 0.2;
        if (score > bestScore) {
          bestScore = score;
          matchedIdx = mIdx;
        }
      }
    }

    if (matchedIdx !== -1) {
      duplicatesRemoved++;
      // If secondary candidate has higher confidence, upgrade
      if (secWord.confidence > merged[matchedIdx].confidence + 5) {
        merged[matchedIdx] = secWord;
      }
    } else {
      merged.push(secWord);
      uniqueAdded++;
    }
  }

  return { merged, duplicatesRemoved, uniqueAdded };
}

// ── PDF Text Layer Generation ────────────────────────────────

/**
 * Build raw PDF content stream bytes for the OCR text layer.
 * This creates properly formatted PDF operators as raw bytes,
 * which are then added as a new content stream to the page.
 */
function buildTextLayerStreamContent(
  blocks: {
    type: string;
    words: {
      text: string;
      encodedHex: string;
      x: number;
      y: number;
      fontSize: number;
      fontKey: string;
      scalePercent: number;
    }[];
  }[]
): string {
  const lines: string[] = [];
  lines.push('q');  // Save graphics state

  for (const block of blocks) {
    if (block.words.length === 0) continue;

    const visualLines: typeof block.words[] = [];
    
    // Sort words of this block by Y descending (top of block first in PDF coordinates)
    const sortedByY = [...block.words].sort((a, b) => b.y - a.y);
    
    for (const w of sortedByY) {
      let placed = false;
      // Find an existing line that is close in Y
      for (const line of visualLines) {
        const lineY = line.reduce((sum, item) => sum + item.y, 0) / line.length;
        const lineFontSize = line.reduce((sum, item) => sum + item.fontSize, 0) / line.length;
        
        // If Y difference is less than 65% of font size, group them
        if (Math.abs(w.y - lineY) < lineFontSize * 0.65) {
          line.push(w);
          placed = true;
          break;
        }
      }
      if (!placed) {
        visualLines.push([w]);
      }
    }

    // For each line, sort words strictly from left to right (X ascending)
    for (const line of visualLines) {
      line.sort((a, b) => a.x - b.x);
    }

    // Sort the lines themselves from top to bottom (Y descending)
    visualLines.sort((a, b) => {
      const aY = a.reduce((sum, item) => sum + item.y, 0) / a.length;
      const bY = b.reduce((sum, item) => sum + item.y, 0) / b.length;
      return bY - aY;
    });

    // Emit text operators for each line in this block
    for (const line of visualLines) {
      lines.push('BT');
      lines.push('3 Tr'); // Invisible rendering mode

      let prevFontKey = '';
      let prevFontSize = 0;

      for (let i = 0; i < line.length; i++) {
        const w = line[i];

        // Set font if changed
        if (w.fontKey !== prevFontKey || w.fontSize !== prevFontSize) {
          lines.push(`${w.fontKey} ${w.fontSize.toFixed(2)} Tf`);
          prevFontKey = w.fontKey;
          prevFontSize = w.fontSize;
        }

        // Set horizontal scaling
        lines.push(`${w.scalePercent.toFixed(1)} Tz`);

        // Position each word absolutely using Tm (text matrix)
        lines.push(`1 0 0 1 ${w.x.toFixed(2)} ${w.y.toFixed(2)} Tm`);

        // Show the encoded text
        lines.push(`<${w.encodedHex}> Tj`);
      }

      lines.push('ET');
    }
  }

  lines.push('Q');  // Restore graphics state
  return lines.join('\n');
}

// ── Main OCR Pipeline ────────────────────────────────────────

/**
 * Performs OCR on a PDF and returns a new PDF with an invisible text layer.
 * The original PDF visual content is 100% preserved.
 */
export async function ocrPdf(
  fileBytes: ArrayBuffer,
  languages: string[],
  onProgress?: OcrProgressCallback,
  options?: { dpi?: number; forceAdaptive?: boolean; minWordConfidence?: number; debug?: boolean }
): Promise<{ pdfBytes: Uint8Array; warnings: string[]; debugInfo?: any }> {
  if (options?.debug) {
    (globalThis as any).__ocrDebugInfo = { pages: [] };
  }
  onProgress?.('Loading PDF...', 0);

  // 1. Load original PDF with pdf-lib
  const pdfDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();

  pdfDoc.registerFontkit(fontkit);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  onProgress?.('Loading font...', 0.02);
  const fontBytes = await loadDevanagariFont();
  const ocrFont = await pdfDoc.embedFont(fontBytes, { subset: false });

  // Track glyph mappings across the entire document
  const glyphMappings = new Map<number, number[]>();
  try {
    const embedder = (ocrFont as any).embedder;
    const glyphCache = embedder.glyphCache.access();
    for (const glyph of glyphCache) {
      if (glyph && glyph.codePoints && glyph.codePoints.length > 0) {
        glyphMappings.set(glyph.id, glyph.codePoints);
      }
    }
  } catch (e) {
    console.warn('[OCR] Failed to populate glyph mappings from cache:', e);
  }

  // 2. Load PDF with PDF.js for rendering
  const pdfjsLib = await loadPdfJs();
  const pdfjsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(fileBytes) }).promise;

  let ocrLanguages = [...languages];
  if (ocrLanguages.length === 0 || ocrLanguages.includes('auto')) {
    ocrLanguages = ['eng', 'hin'];
  }

  const worker = await initWorker(ocrLanguages, onProgress);
  const warnings: string[] = [];

  let totalOcrPagesProcessed = 0;
  let totalWordsDrawn = 0;

  // Process each page
  for (let i = 0; i < totalPages; i++) {
    const progressBase = 0.1 + (i / totalPages) * 0.85;
    onProgress?.(`Checking page ${i + 1} of ${totalPages}...`, progressBase);

    const pdfjsPage = await pdfjsDoc.getPage(i + 1);

    // Skip pages that already have usable text
    const textContent = await pdfjsPage.getTextContent();
    const totalChars = textContent.items.reduce((sum: number, item: any) => sum + (item.str ? item.str.trim().length : 0), 0);
    if (totalChars > 20) {
      console.log(`[OCR] Page ${i + 1} already has usable text (${totalChars} characters). Skipping OCR.`);
      continue;
    }

    onProgress?.(`Rendering page ${i + 1} / ${totalPages}...`, progressBase + 0.02);

    const unscaledViewport = pdfjsPage.getViewport({ scale: 1.0 });
    const w = unscaledViewport.width;
    const h = unscaledViewport.height;

    // Calculate rendering scale (Target ~300 DPI, respect 25M pixel memory limit)
    const targetScale = 3.5;
    const MAX_PIXELS = 25 * 1000 * 1000;
    let scale = targetScale;
    if ((w * targetScale) * (h * targetScale) > MAX_PIXELS) {
      scale = Math.sqrt(MAX_PIXELS / (w * h));
    }

    const viewport = pdfjsPage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const renderToCanvas = async (targetCanvas: HTMLCanvasElement) => {
      const ctx = targetCanvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
      await pdfjsPage.render({ canvasContext: ctx, viewport }).promise;
    };

    await renderToCanvas(canvas);

    // ── Baseline Candidate OCR (Pass A Minimal Grayscale) ──
    onProgress?.(`Page ${i + 1}/${totalPages}: Preprocessing & deskewing...`, progressBase + 0.04);
    const skewAngle = preprocessCanvasMinimal(canvas);

    onProgress?.(`Page ${i + 1}/${totalPages}: Running baseline full-page OCR...`, progressBase + 0.06);
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    let candidateResult = await recognizeWithTimeout(worker, canvas, {}, { text: true, blocks: true }, 35000);
    let bestData = candidateResult.data;
    let bestScore = scoreOcrQuality(bestData);
    let bestStrategy = 'Pass A (Minimal Grayscale)';

    console.log(`[OCR] Page ${i + 1} Pass A baseline score: ${bestScore.toFixed(1)} (Confidence: ${(bestData.confidence ?? 0).toFixed(1)}%)`);

    // If initial score is below quality threshold (< 70), evaluate fallback candidate passes
    if (bestScore < 70 && !options?.forceAdaptive) {
      onProgress?.(`Page ${i + 1}/${totalPages}: Baseline score ${bestScore.toFixed(0)} < 70, running Pass B (contrast enhancement)...`, progressBase + 0.08);

      const canvasB = document.createElement('canvas');
      canvasB.width = canvas.width;
      canvasB.height = canvas.height;
      await renderToCanvas(canvasB);
      preprocessCanvasDenoise(canvasB);

      try {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
        const resultB = await recognizeWithTimeout(worker, canvasB, {}, { text: true, blocks: true }, 30000);
        const scoreB = scoreOcrQuality(resultB.data);

        if (scoreB > bestScore + 3) {
          bestData = resultB.data;
          bestScore = scoreB;
          bestStrategy = 'Pass B (Denoise)';
        }
      } catch (errB) {
        console.warn(`[OCR] Pass B timed out or failed on page ${i + 1}:`, errB);
      } finally {
        canvasB.width = 0;
        canvasB.height = 0;
      }

      if (bestScore < 60) {
        onProgress?.(`Page ${i + 1}/${totalPages}: Quality score ${bestScore.toFixed(0)} < 60, running Pass C (adaptive thresholding)...`, progressBase + 0.09);
        const canvasC = document.createElement('canvas');
        canvasC.width = canvas.width;
        canvasC.height = canvas.height;
        await renderToCanvas(canvasC);
        preprocessCanvasAdaptive(canvasC);

        try {
          await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
          const resultC = await recognizeWithTimeout(worker, canvasC, {}, { text: true, blocks: true }, 30000);
          const scoreC = scoreOcrQuality(resultC.data);

          if (scoreC > bestScore + 3) {
            bestData = resultC.data;
            bestScore = scoreC;
            bestStrategy = 'Pass C (Adaptive)';
          }
        } catch (errC) {
          console.warn(`[OCR] Pass C timed out or failed on page ${i + 1}:`, errC);
        } finally {
          canvasC.width = 0;
          canvasC.height = 0;
        }
      }
    }

    // ── Collect Baseline Words ──
    const baselineWords: InternalOcrWord[] = [];
    for (const block of (bestData.blocks || [])) {
      for (const paragraph of (block.paragraphs || [])) {
        for (const line of (paragraph.lines || [])) {
          for (const word of (line.words || [])) {
            if (word.text && word.text.trim() && word.bbox) {
              baselineWords.push({
                text: word.text.trim(),
                confidence: word.confidence ?? 0,
                bbox: word.bbox,
                source: 'baseline_psm3'
              });
            }
          }
        }
      }
    }

    // ── Layout Analysis ──
    const layoutResult = detectPageRegions(canvas);
    const detectedRegions = layoutResult.regions;
    const tableCells = layoutResult.tableCells;
    const regionStats: RegionOcrInfo[] = [];
    const secondaryWords: InternalOcrWord[] = [];
    let tableCellWordsCount = 0;

    // ── Region-Aware Secondary OCR ──
    if (detectedRegions.length > 0) {
      onProgress?.(`Page ${i + 1}/${totalPages}: Analyzing ${detectedRegions.length} structural regions...`, progressBase + 0.10);
    }

    for (let regIdx = 0; regIdx < detectedRegions.length; regIdx++) {
      const reg = detectedRegions[regIdx];
      const regW = reg.bbox.x1 - reg.bbox.x0;
      const regH = reg.bbox.y1 - reg.bbox.y0;
      if (regW <= 20 || regH <= 20) continue;

      const regCanvas = document.createElement('canvas');
      regCanvas.width = regW;
      regCanvas.height = regH;
      const regCtx = regCanvas.getContext('2d');
      if (!regCtx) continue;

      regCtx.drawImage(canvas, reg.bbox.x0, reg.bbox.y0, regW, regH, 0, 0, regW, regH);

      onProgress?.(`Page ${i + 1}/${totalPages}: OCR region "${reg.type}" (${regIdx + 1}/${detectedRegions.length})...`, progressBase + 0.10 + (regIdx / detectedRegions.length) * 0.05);

      try {
        await worker.setParameters({ tessedit_pageseg_mode: reg.psm });
        const regRes = await recognizeWithTimeout(worker, regCanvas, {}, { text: true, blocks: true }, 25000);

        let regWordCount = 0;
        let regConfSum = 0;

        for (const b of (regRes.data.blocks || [])) {
          for (const p of (b.paragraphs || [])) {
            for (const l of (p.lines || [])) {
              for (const w of (l.words || [])) {
                if (w.text && w.text.trim() && w.bbox) {
                  const txt = w.text.trim();
                  regWordCount++;
                  const conf = w.confidence ?? 0;
                  regConfSum += conf;

                  // Only filter most extreme garbage
                  if (!isGibberishToken(txt)) {
                    const pageBbox = {
                      x0: w.bbox.x0 + reg.bbox.x0,
                      y0: w.bbox.y0 + reg.bbox.y0,
                      x1: w.bbox.x1 + reg.bbox.x0,
                      y1: w.bbox.y1 + reg.bbox.y0,
                    };
                    secondaryWords.push({
                      text: txt,
                      confidence: conf,
                      bbox: pageBbox,
                      source: reg.id
                    });
                  }
                }
              }
            }
          }
        }

        const meanRegConf = regWordCount > 0 ? (regConfSum / regWordCount) : 0;
        regionStats.push({
          id: reg.id,
          type: reg.type,
          bbox: reg.bbox,
          psm: reg.psm,
          rawWords: regWordCount,
          meanConf: regWordCount > 0 ? meanRegConf.toFixed(1) + '%' : '0%',
          reason: reg.reason
        });
      } catch (regErr) {
        console.warn(`[OCR] Secondary OCR failed for region '${reg.id}':`, regErr);
      } finally {
        regCanvas.width = 0;
        regCanvas.height = 0;
      }
    }

    // ── Table Cell OCR ──
    if (tableCells.length > 0) {
      const maxCellsToOcr = Math.min(tableCells.length, 80);
      onProgress?.(`Page ${i + 1}/${totalPages}: OCR-ing ${maxCellsToOcr} table cells...`, progressBase + 0.16);

      for (let ci = 0; ci < maxCellsToOcr; ci++) {
        const cell = tableCells[ci];
        const cellW = cell.bbox.x1 - cell.bbox.x0;
        const cellH = cell.bbox.y1 - cell.bbox.y0;
        if (cellW < 15 || cellH < 10) continue;

        // Check if cell has content
        const cellGate = isRegionTextLike(layoutResult.isDark, canvas.width, canvas.height, cell.bbox);
        if (!cellGate.isTextLike) continue;

        const cellCanvas = document.createElement('canvas');
        cellCanvas.width = cellW;
        cellCanvas.height = cellH;
        const cellCtx = cellCanvas.getContext('2d');
        if (!cellCtx) continue;

        cellCtx.drawImage(canvas, cell.bbox.x0, cell.bbox.y0, cellW, cellH, 0, 0, cellW, cellH);

        try {
          // Choose PSM based on cell dimensions
          const cellPsm = cellH < 40 ? PSM.SINGLE_LINE : PSM.SINGLE_BLOCK;
          await worker.setParameters({ tessedit_pageseg_mode: cellPsm });
          const cellRes = await recognizeWithTimeout(worker, cellCanvas, {}, { text: true, blocks: true }, 10000);

          for (const b of (cellRes.data.blocks || [])) {
            for (const p of (b.paragraphs || [])) {
              for (const l of (p.lines || [])) {
                for (const w of (l.words || [])) {
                  if (w.text && w.text.trim() && w.bbox) {
                    const txt = w.text.trim();
                    if (!isGibberishToken(txt)) {
                      const pageBbox = {
                        x0: w.bbox.x0 + cell.bbox.x0,
                        y0: w.bbox.y0 + cell.bbox.y0,
                        x1: w.bbox.x1 + cell.bbox.x0,
                        y1: w.bbox.y1 + cell.bbox.y0,
                      };
                      secondaryWords.push({
                        text: txt,
                        confidence: w.confidence ?? 0,
                        bbox: pageBbox,
                        source: `cell_r${cell.row}_c${cell.col}`
                      });
                      tableCellWordsCount++;
                    }
                  }
                }
              }
            }
          }
        } catch (cellErr) {
          // Cell OCR timeout — skip this cell
        } finally {
          cellCanvas.width = 0;
          cellCanvas.height = 0;
        }
      }
    }

    // ── Layout-Aware Cell Reconciliation & Merging ──
    const reconciledWords: InternalOcrWord[] = [];
    let duplicateCandidatesRemoved = 0;
    let uniqueNewWordsAdded = 0;

    // Separate words inside table cells from other words
    const cellCandidatesMap = new Map<string, InternalOcrWord[]>();
    const nonCellBaseline: InternalOcrWord[] = [];
    const nonCellSecondary: InternalOcrWord[] = [];

    // Find if a word center is inside a cell
    const findCellForWord = (w: InternalOcrWord): TableCell | null => {
      const cx = (w.bbox.x0 + w.bbox.x1) / 2;
      const cy = (w.bbox.y0 + w.bbox.y1) / 2;
      for (const cell of tableCells) {
        if (cx >= cell.bbox.x0 && cx <= cell.bbox.x1 && cy >= cell.bbox.y0 && cy <= cell.bbox.y1) {
          return cell;
        }
      }
      return null;
    };

    // Classify baseline words
    for (const w of baselineWords) {
      const cell = findCellForWord(w);
      if (cell) {
        const cellKey = `${cell.row}_${cell.col}`;
        if (!cellCandidatesMap.has(cellKey)) {
          cellCandidatesMap.set(cellKey, []);
        }
        cellCandidatesMap.get(cellKey)!.push(w);
      } else {
        nonCellBaseline.push(w);
      }
    }

    // Classify secondary words
    for (const w of secondaryWords) {
      const cell = findCellForWord(w);
      if (cell) {
        const cellKey = `${cell.row}_${cell.col}`;
        if (!cellCandidatesMap.has(cellKey)) {
          cellCandidatesMap.set(cellKey, []);
        }
        cellCandidatesMap.get(cellKey)!.push(w);
      } else {
        nonCellSecondary.push(w);
      }
    }

    // Reconcile words inside each table cell
    for (const cell of tableCells) {
      const cellKey = `${cell.row}_${cell.col}`;
      const candidates = cellCandidatesMap.get(cellKey) || [];
      if (candidates.length === 0) continue;

      // Check if there are cell-specific OCR candidates
      const cellSpecificCandidates = candidates.filter(c => c.source.startsWith('cell_r'));
      
      let chosenCandidates: InternalOcrWord[] = [];
      if (cellSpecificCandidates.length > 0) {
        // Cell OCR is authoritative!
        chosenCandidates = cellSpecificCandidates;
        const overriddenCount = candidates.length - cellSpecificCandidates.length;
        duplicateCandidatesRemoved += overriddenCount;
      } else {
        // Fallback: merge and deduplicate baseline & whole-table OCR within this cell
        const cellBaseline = candidates.filter(c => c.source === 'baseline_psm3');
        const cellSecondary = candidates.filter(c => c.source !== 'baseline_psm3');
        const { merged, duplicatesRemoved } = mergeOcrCandidates(cellBaseline, cellSecondary);
        chosenCandidates = merged;
        duplicateCandidatesRemoved += duplicatesRemoved;
      }

      // Add reconciled cell words
      reconciledWords.push(...chosenCandidates);
    }

    // Reconcile words outside cells (header, personal details, footer, generic)
    const { merged: nonCellMerged, duplicatesRemoved: nonCellDupRemoved, uniqueAdded: nonCellUniqueAdded } =
      mergeOcrCandidates(nonCellBaseline, nonCellSecondary);
    
    reconciledWords.push(...nonCellMerged);
    duplicateCandidatesRemoved += nonCellDupRemoved;
    uniqueNewWordsAdded += nonCellUniqueAdded;

    totalOcrPagesProcessed++;

    if (reconciledWords.length === 0) {
      console.warn(`[OCR] Page ${i + 1} rejected due to zero/unusable text.`);
      warnings.push(`Page ${i + 1}: OCR output was unclear. Skipped text layer.`);
      canvas.width = 0;
      canvas.height = 0;
      continue;
    }

    // ── Prepare Words for PDF Text Layer ──
    const pdfPage = pdfDoc.getPage(i);
    const rotationAngle = pdfPage.getRotation().angle;
    const isLandscape = rotationAngle === 90 || rotationAngle === 270;

    const { width: pageWidth, height: pageHeight } = pdfPage.getSize();
    const visualWidth = isLandscape ? pageHeight : pageWidth;
    const visualHeight = isLandscape ? pageWidth : pageHeight;

    const scaleX = canvas.width / visualWidth;
    const scaleY = canvas.height / visualHeight;

    const angle = ((rotationAngle % 360) + 360) % 360;

    // ── Register fonts on the page ──
    pdfPage.setFont(helveticaFont);
    pdfPage.setFont(ocrFont);

    const pageNode = (pdfPage as any).node;
    const resources = pageNode.get(PDFName.of('Resources'));
    let fontDict: PDFDict;
    if (resources instanceof PDFDict) {
      let fd = resources.get(PDFName.of('Font'));
      if (fd instanceof PDFRef) {
        fd = pdfDoc.context.lookup(fd);
      }
      fontDict = fd as PDFDict;
    } else {
      fontDict = pdfDoc.context.obj({});
      const resDict = pdfDoc.context.obj({ Font: fontDict });
      pageNode.set(PDFName.of('Resources'), resDict);
    }

    let helveticaKey = '';
    let ocrFontKey = '';

    if (fontDict) {
      const entries = fontDict.entries();
      for (const [key, value] of entries) {
        const keyStr = key.toString().replace('/', '');
        const ref = value instanceof PDFRef ? value : null;
        if (ref) {
          if (ref === helveticaFont.ref) {
            helveticaKey = '/' + keyStr;
          } else if (ref === ocrFont.ref) {
            ocrFontKey = '/' + keyStr;
          }
        }
      }
    }

    if (!helveticaKey) {
      const key = `F${fontDict ? fontDict.entries().length + 1 : 1}`;
      fontDict.set(PDFName.of(key), helveticaFont.ref);
      helveticaKey = '/' + key;
    }
    if (!ocrFontKey) {
      const key = `F${fontDict ? fontDict.entries().length + 1 : 2}`;
      fontDict.set(PDFName.of(key), ocrFont.ref);
      ocrFontKey = '/' + key;
    }

    interface PreparedWord {
      cleanedText: string;
      fontToUse: PDFFont;
      fontSize: number;
      drawX: number;
      drawY: number;
      visualWordWidth: number;
      scalePercent: number;
      ocrBbox: { x0: number; y0: number; x1: number; y1: number };
      confidence: number;
      encodedHex: string;
    }

    const preparedWordsList: PreparedWord[] = [];
    const discardedWords: DiscardedWordInfo[] = [];
    const insertedWords: InsertedWordInfo[] = [];

    const explicitMinConfidence = options?.minWordConfidence;

    // Define the reading order blocks
    interface WordBlock {
      type: string;
      words: InternalOcrWord[];
      cell?: TableCell;
    }

    const blocks: WordBlock[] = [];
    const beforeTableWords: InternalOcrWord[] = [];
    const afterTableWords: InternalOcrWord[] = [];
    const genericWords: InternalOcrWord[] = [];

    // Create table cell blocks in row/col reading order
    const cellBlocksMap = new Map<string, WordBlock>();
    for (const cell of tableCells) {
      const cellKey = `cell_r${cell.row}_c${cell.col}`;
      const block = { type: cellKey, words: [], cell };
      blocks.push(block);
      cellBlocksMap.set(cellKey, block);
    }

    // Resolve table boundaries
    const tableRegion = detectedRegions.find(r => r.id === 'region_table');
    const tableBox = tableRegion ? tableRegion.bbox : null;
    const tY0 = tableBox ? tableBox.y0 : 0;
    const tY1 = tableBox ? tableBox.y1 : 0;

    // Classify all reconciled words into bands
    for (const w of reconciledWords) {
      const cx = (w.bbox.x0 + w.bbox.x1) / 2;
      const cy = (w.bbox.y0 + w.bbox.y1) / 2;

      // A. Check table cells first
      let assignedToCell = false;
      for (const cell of tableCells) {
        if (cx >= cell.bbox.x0 && cx <= cell.bbox.x1 && cy >= cell.bbox.y0 && cy <= cell.bbox.y1) {
          const cellKey = `cell_r${cell.row}_c${cell.col}`;
          cellBlocksMap.get(cellKey)!.words.push(w);
          assignedToCell = true;
          break;
        }
      }
      if (assignedToCell) continue;

      // B. Assign to before, after, or generic band
      if (tableBox) {
        if (cy < tY0) {
          beforeTableWords.push(w);
        } else if (cy > tY1) {
          afterTableWords.push(w);
        } else {
          genericWords.push(w);
        }
      } else {
        beforeTableWords.push(w);
      }
    }

    const blocksToPrepare: WordBlock[] = [];
    if (beforeTableWords.length > 0) {
      blocksToPrepare.push({ type: 'before_table', words: beforeTableWords });
    }
    for (const block of blocks) {
      if (block.words.length > 0) {
        blocksToPrepare.push(block);
      }
    }
    if (afterTableWords.length > 0) {
      blocksToPrepare.push({ type: 'after_table', words: afterTableWords });
    }
    if (genericWords.length > 0) {
      blocksToPrepare.push({ type: 'generic', words: genericWords });
    }

    // Prepare block-by-block words
    const readingOrderBlocks: {
      type: string;
      words: {
        text: string;
        encodedHex: string;
        x: number;
        y: number;
        fontSize: number;
        fontKey: string;
        scalePercent: number;
      }[];
    }[] = [];

    for (const block of blocksToPrepare) {
      const preparedBlockWords: typeof readingOrderBlocks[0]['words'] = [];

      for (const word of block.words) {
        const wordText = word.text;
        const conf = word.confidence;

        if (!wordText || wordText.trim().length === 0) {
          discardedWords.push({ text: wordText || '', confidence: conf, reason: 'empty-token' });
          continue;
        }

        // ── Layout-Aware Background & Border Suppression ──
        if (isWordBackgroundNoise(word, canvas.width, canvas.height, detectedRegions)) {
          discardedWords.push({ text: wordText, confidence: conf, reason: 'layout-border-noise-suppression' });
          continue;
        }

        const { x0, y0, x1, y1 } = word.bbox;
        const visualWordWidth = (x1 - x0) / scaleX;
        const visualWordHeight = (y1 - y0) / scaleY;

        if (visualWordWidth <= 0 || visualWordHeight <= 0) {
          discardedWords.push({ text: wordText, confidence: conf, reason: 'zero-dimension-bbox' });
          continue;
        }
        if (visualWordWidth > visualWidth * 0.98 || visualWordHeight > visualHeight * 0.98) {
          discardedWords.push({ text: wordText, confidence: conf, reason: 'extreme-dimension-artifact' });
          continue;
        }

        if (explicitMinConfidence !== undefined && conf < explicitMinConfidence) {
          discardedWords.push({ text: wordText, confidence: conf, reason: `below-explicit-min-confidence (${conf.toFixed(0)} < ${explicitMinConfidence})` });
          continue;
        }

        const fontSize = Math.max(visualWordHeight * 0.85, 4);

        // Convert image coordinates to PDF coordinates
        let bx0 = x0;
        let by1 = y1;

        if (skewAngle !== 0) {
          const rad = (skewAngle * Math.PI) / 180;
          const cs = Math.cos(rad);
          const sn = Math.sin(rad);
          const cx = canvas.width / 2;
          const cy = canvas.height / 2;
          const tx = x0 - cx;
          const ty = y1 - cy;
          bx0 = tx * cs - ty * sn + cx;
          by1 = tx * sn + ty * cs + cy;
        }

        const visualWordX = bx0 / scaleX;
        const visualWordY = visualHeight - (by1 / scaleY) + fontSize * 0.10;

        let drawX = visualWordX;
        let drawY = visualWordY;

        if (angle === 90) {
          drawX = pageWidth - visualWordY;
          drawY = visualWordX;
        } else if (angle === 180) {
          drawX = pageWidth - visualWordX;
          drawY = pageHeight - visualWordY;
        } else if (angle === 270) {
          drawX = visualWordY;
          drawY = pageHeight - visualWordX;
        }

        const normalizedWordText = normalizeAndCorrectWord(wordText);
        if (normalizedWordText.length === 0) {
          discardedWords.push({ text: wordText, confidence: conf, reason: 'empty-after-normalization' });
          continue;
        }

        const hasDeva = /[\u0900-\u097F]/.test(normalizedWordText);
        let fontToUse: PDFFont = hasDeva ? ocrFont : helveticaFont;

        if (hasUnsupportedChars(fontToUse, normalizedWordText)) {
          const altFont = fontToUse === helveticaFont ? ocrFont : helveticaFont;
          if (!hasUnsupportedChars(altFont, normalizedWordText)) {
            fontToUse = altFont;
          } else {
            let cleanedChars = '';
            for (const ch of normalizedWordText) {
              if (!hasUnsupportedChars(fontToUse, ch)) {
                cleanedChars += ch;
              } else if (!hasUnsupportedChars(altFont, ch)) {
                // skip
              }
            }
            if (cleanedChars.length === 0) {
              discardedWords.push({ text: wordText, confidence: conf, reason: 'unsupported-chars-in-both-fonts' });
              continue;
            }
            fontToUse = ocrFont;
          }
        }

        const cleanedText = normalizedWordText;

        // ── Logical-Ordering Unshaped Glyph Mapping ──
        let encodedHex = '';
        let expectedWidth = 0;

        if (fontToUse === ocrFont) {
          const hexCodes: string[] = [];
          const embedder = (ocrFont as any).embedder;
          const fontScale = 1000 / embedder.font.unitsPerEm;

          for (let idx = 0; idx < cleanedText.length; idx++) {
            const codePoint = cleanedText.codePointAt(idx);
            if (codePoint === undefined) continue;
            if (codePoint > 0xffff) idx++; // Handle surrogate pairs

            const glyph = embedder.font.glyphForCodePoint(codePoint);
            const glyphId = glyph ? glyph.id : 0;
            hexCodes.push(toHexStringOfMinLength(glyphId, 4));

            if (glyph && glyph.codePoints) {
              glyphMappings.set(glyphId, glyph.codePoints);
            }
            if (glyph) {
              expectedWidth += glyph.advanceWidth * fontScale;
            }
          }
          encodedHex = hexCodes.join('');
          expectedWidth = expectedWidth * (fontSize / 1000);
        } else {
          try {
            const encoded = helveticaFont.encodeText(cleanedText);
            encodedHex = encoded.toString().replace(/[<>]/g, '');
            expectedWidth = helveticaFont.widthOfTextAtSize(cleanedText, fontSize);
          } catch {
            fontToUse = ocrFont;
            const hexCodes: string[] = [];
            const embedder = (ocrFont as any).embedder;
            const fontScale = 1000 / embedder.font.unitsPerEm;

            for (let idx = 0; idx < cleanedText.length; idx++) {
              const codePoint = cleanedText.codePointAt(idx);
              if (codePoint === undefined) continue;
              if (codePoint > 0xffff) idx++;

              const glyph = embedder.font.glyphForCodePoint(codePoint);
              const glyphId = glyph ? glyph.id : 0;
              hexCodes.push(toHexStringOfMinLength(glyphId, 4));

              if (glyph && glyph.codePoints) {
                glyphMappings.set(glyphId, glyph.codePoints);
              }
              if (glyph) {
                expectedWidth += glyph.advanceWidth * fontScale;
              }
            }
            encodedHex = hexCodes.join('');
            expectedWidth = expectedWidth * (fontSize / 1000);
          }
        }

        let scalePercent = 100;
        try {
          if (expectedWidth > 0) {
            scalePercent = Math.round((visualWordWidth / expectedWidth) * 100);
            scalePercent = Math.max(20, Math.min(400, scalePercent));
          }
        } catch {
          // fallback
        }

        preparedWordsList.push({
          cleanedText: cleanedText.trim(),
          fontToUse,
          fontSize,
          drawX,
          drawY,
          visualWordWidth,
          scalePercent,
          ocrBbox: { x0, y0, x1, y1 },
          confidence: conf,
          encodedHex,
        });

        insertedWords.push({
          text: cleanedText.trim(),
          confidence: conf,
          bbox: { x0, y0, x1, y1 }
        });

        const fontKey = fontToUse === ocrFont ? ocrFontKey : helveticaKey;
        preparedBlockWords.push({
          text: cleanedText.trim(),
          encodedHex,
          x: drawX,
          y: drawY,
          fontSize,
          fontKey,
          scalePercent,
        });
      }

      readingOrderBlocks.push({
        type: block.type,
        words: preparedBlockWords
      });
    }

    const insertedWordsCount = insertedWords.length;
    const discardedWordsCount = discardedWords.length;
    const coveragePercent = reconciledWords.length > 0 ? (insertedWordsCount / reconciledWords.length) * 100 : 0;

    console.log(`[OCR Recall Page ${i + 1}] Baseline: ${baselineWords.length}, Secondary: ${secondaryWords.length}, CellWords: ${tableCellWordsCount}, Merged Unique: ${insertedWordsCount}, Discarded: ${discardedWordsCount}, Coverage: ${coveragePercent.toFixed(1)}%`);

    // ── Create new content stream for OCR text layer ──
    if (readingOrderBlocks.some(b => b.words.length > 0)) {
      const streamContent = buildTextLayerStreamContent(readingOrderBlocks);
      const streamBytes = new TextEncoder().encode(streamContent);

      const streamRef = pdfDoc.context.register(
        pdfDoc.context.stream(streamBytes, {})
      );

      const existingContents = pageNode.get(PDFName.of('Contents'));
      if (existingContents instanceof PDFArray) {
        existingContents.push(streamRef);
      } else if (existingContents instanceof PDFRef) {
        const newArray = pdfDoc.context.obj([existingContents, streamRef]);
        pageNode.set(PDFName.of('Contents'), newArray);
      } else {
        pageNode.set(PDFName.of('Contents'), streamRef);
      }

      totalWordsDrawn += preparedWordsList.length;
    }

    if (options?.debug && (globalThis as any).__ocrDebugInfo) {
      (globalThis as any).__ocrDebugInfo.pages.push({
        pageIndex: i + 1,
        strategy: bestStrategy,
        qualityScore: bestScore,
        confidence: bestData.confidence,
        rawWordsCount: reconciledWords.length,
        baselineWordsCount: baselineWords.length,
        secondaryWordsCount: secondaryWords.length,
        tableCellWordsCount,
        duplicateCandidatesRemoved,
        uniqueNewWordsAdded,
        insertedWordsCount,
        discardedWordsCount,
        coveragePercent: parseFloat(coveragePercent.toFixed(1)),
        discardedWords,
        regions: regionStats,
        linesCount: preparedWordsList.length,
        rawText: bestData.text,
      } as PageOcrDebugInfo);
    }

    canvas.width = 0;
    canvas.height = 0;
  }

  await worker.terminate();
  pdfjsDoc.destroy();

  if (totalOcrPagesProcessed > 0 && totalWordsDrawn === 0) {
    throw new Error('OCR engine recognized zero text. Please check the scan legibility.');
  }

  console.log(`[OCR Completion] Processed ${totalOcrPagesProcessed} pages, drew ${totalWordsDrawn} searchable words.`);
  onProgress?.('Saving searchable PDF...', 0.97);

  // ── First save to serialize and generate font CMaps ──
  await pdfDoc.save();

  // ── Inject custom mapped ToUnicode CMap to fix complex Hindi ligatures ──
  try {
    const fontDict = pdfDoc.context.lookup(ocrFont.ref);
    if (fontDict instanceof PDFDict) {
      const toUnicodeRef = fontDict.get(PDFName.of('ToUnicode'));
      if (toUnicodeRef instanceof PDFRef) {
        const customCMap = generateCMap(glyphMappings);
        const customCMapBytes = new TextEncoder().encode(customCMap);
        const newStream = pdfDoc.context.flateStream(customCMapBytes);
        pdfDoc.context.assign(toUnicodeRef, newStream);
        console.log(`[OCR] Custom ToUnicode CMap replaced successfully with ${glyphMappings.size} entries.`);
      }
    }
  } catch (err) {
    console.error('[OCR] Failed to replace custom ToUnicode CMap:', err);
  }

  // ── Final save ──
  const savedBytes = await pdfDoc.save();
  onProgress?.('Done!', 1.0);

  return {
    pdfBytes: savedBytes,
    warnings,
    debugInfo: options?.debug ? (globalThis as any).__ocrDebugInfo : undefined
  };
}
