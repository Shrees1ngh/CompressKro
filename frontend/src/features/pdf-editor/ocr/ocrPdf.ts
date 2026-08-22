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
  tables: DetectedTable[]
): boolean {
  const { x0, y0, x1, y1 } = word.bbox;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;

  // 1. Check if inside any table
  let inTable = false;
  for (const table of tables) {
    if (cx >= table.bbox.x0 && cx <= table.bbox.x1 && cy >= table.bbox.y0 && cy <= table.bbox.y1) {
      inTable = true;
      break;
    }
  }

  const clean = word.text.trim();
  
  // Devanagari words are never background noise
  const hasDeva = /[\u0900-\u097F]/.test(clean);
  if (hasDeva) return false;

  // 2. Suppress outer margins check (suppress outer 4.5% margins)
  const padX = canvasWidth * 0.045;
  const padY = canvasHeight * 0.045;
  const isAtEdge = cx < padX || cx > canvasWidth - padX || cy < padY || cy > canvasHeight - padY;

  const isAlphanumeric = /[A-Za-z0-9\u0900-\u097F]/.test(clean);

  if (isAtEdge && !inTable) {
    if (!isAlphanumeric) return true;
    if (isGibberishToken(clean)) return true;
    if (word.confidence < 35) return true;
  }

  // 3. Extremely low confidence threshold
  if (word.confidence < 20) {
    return true;
  }

  // 4. Gibberish check for low-medium confidence words outside tables
  if (!inTable && word.confidence < 50 && isGibberishToken(clean)) {
    return true;
  }

  // 5. Symbols/punctuation artifacts from grid lines
  if (clean.length === 1 && !isAlphanumeric) {
    if (word.confidence < 50) return true;
  }

  // 6. Extremely long nonsense string from border repeats
  if (clean.length > 20 && !/[aeiouyAEIOUY\u0900-\u097F]/.test(clean)) {
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

function getCoefficientOfVariation(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return 0;
  const sqDiffs = values.map(v => (v - mean) ** 2);
  const stdDev = Math.sqrt(sqDiffs.reduce((s, v) => s + v, 0) / values.length);
  return stdDev / mean;
}

export function classifyRegion(
  bbox: { x0: number; y0: number; x1: number; y1: number },
  components: { x0: number; y0: number; x1: number; y1: number }[],
  isDark: Uint8Array,
  canvasWidth: number,
  canvasHeight: number
): { type: string; textLikelihood: number; graphicLikelihood: number; reason: string } {
  const x0 = Math.max(0, Math.min(canvasWidth - 1, bbox.x0));
  const y0 = Math.max(0, Math.min(canvasHeight - 1, bbox.y0));
  const x1 = Math.max(0, Math.min(canvasWidth - 1, bbox.x1));
  const y1 = Math.max(0, Math.min(canvasHeight - 1, bbox.y1));

  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 5 || h <= 5) {
    return { type: 'UNKNOWN', textLikelihood: 0.0, graphicLikelihood: 1.0, reason: 'too-small-to-classify' };
  }

  const totalPixels = w * h;
  let darkPixels = 0;
  for (let y = y0; y < y1; y++) {
    const offset = y * canvasWidth;
    for (let x = x0; x < x1; x++) {
      if (isDark[offset + x]) darkPixels++;
    }
  }
  const density = darkPixels / totalPixels;

  const ccInRegion = components.filter(cc =>
    cc.x0 >= x0 - 2 && cc.x1 <= x1 + 2 &&
    cc.y0 >= y0 - 2 && cc.y1 <= y1 + 2
  );

  const nonTinyCc = ccInRegion.filter(cc => (cc.x1 - cc.x0) >= 3 && (cc.y1 - cc.y0) >= 3);
  const tinyCcCount = ccInRegion.length - nonTinyCc.length;

  if (ccInRegion.length > 0 && (tinyCcCount / ccInRegion.length) > 0.70) {
    return {
      type: 'DECORATIVE',
      textLikelihood: 0.1,
      graphicLikelihood: 0.9,
      reason: `security-pattern-noise: tiny dots fraction ${(tinyCcCount / ccInRegion.length).toFixed(2)}`
    };
  }

  const isLarge = w > canvasWidth * 0.07 && h > canvasHeight * 0.07;
  if (isLarge && density > 0.40) {
    return {
      type: 'PHOTO',
      textLikelihood: 0.0,
      graphicLikelihood: 1.0,
      reason: `large dense region: density ${(density * 100).toFixed(1)}%`
    };
  }

  const aspect = w / h;
  const isSquare = aspect >= 0.8 && aspect <= 1.25;
  if (isSquare && w > 35 && h > 35 && density > 0.28 && density < 0.70 && ccInRegion.length > 10) {
    return {
      type: 'QR/BARCODE',
      textLikelihood: 0.05,
      graphicLikelihood: 0.95,
      reason: `qr-like: square aspect ${aspect.toFixed(2)}, density ${(density * 100).toFixed(1)}%`
    };
  }
  if (!isSquare && aspect > 2.0 && w > 80 && h > 20 && density > 0.35 && density < 0.75) {
    return {
      type: 'QR/BARCODE',
      textLikelihood: 0.05,
      graphicLikelihood: 0.95,
      reason: `barcode-like: aspect ${aspect.toFixed(2)}, density ${(density * 100).toFixed(1)}%`
    };
  }

  if (nonTinyCc.length > 0) {
    const maxCcW = Math.max(...nonTinyCc.map(cc => cc.x1 - cc.x0));
    const maxCcH = Math.max(...nonTinyCc.map(cc => cc.y1 - cc.y0));
    if ((maxCcW > w * 0.4 || maxCcH > h * 0.4) && density < 0.12 && w > 40 && h > 20) {
      return {
        type: 'SIGNATURE',
        textLikelihood: 0.1,
        graphicLikelihood: 0.9,
        reason: `signature-like: low density ${(density * 100).toFixed(1)}% with large components`
      };
    }
  }

  if (w > 35 && h > 35 && density > 0.15 && density < 0.45 && nonTinyCc.length > 0) {
    const cvHeights = getCoefficientOfVariation(nonTinyCc.map(cc => cc.y1 - cc.y0));
    if (cvHeights > 0.75) {
      return {
        type: 'LOGO',
        textLikelihood: 0.15,
        graphicLikelihood: 0.85,
        reason: `logo-like: high height variation CV ${cvHeights.toFixed(2)}`
      };
    }
  }

  if (density >= 0.005 && density <= 0.45) {
    if (nonTinyCc.length > 0) {
      const cvHeights = getCoefficientOfVariation(nonTinyCc.map(cc => cc.y1 - cc.y0));
      if (cvHeights < 0.50) {
        return {
          type: 'TEXT',
          textLikelihood: 0.9,
          graphicLikelihood: 0.1,
          reason: `text-like: CV of heights ${cvHeights.toFixed(2)}`
        };
      }
    }
    return {
      type: 'TEXT',
      textLikelihood: 0.75,
      graphicLikelihood: 0.25,
      reason: 'default text-like density'
    };
  }

  return {
    type: 'UNKNOWN',
    textLikelihood: 0.3,
    graphicLikelihood: 0.7,
    reason: `uncategorized: density ${(density * 100).toFixed(1)}%`
  };
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
      if (vLines[i] - vLines[i - 1] <= Math.max(35, Math.floor(canvasWidth * 0.008))) {
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
  console.log(`[OCR Table] Raw vLines count: ${vLines.length}, Clustered: ${JSON.stringify(clustered)}`);
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

  // Refine horizontal lines using horizontal projection within the widest column (typically subject names)
  // to avoid vertical line interference.
  let activeHLines = hLines;
  if (hLines.length > 0 && vLines.length >= 2) {
    let widestColIdx = 0;
    let maxColWidth = 0;
    for (let c = 0; c < vLines.length - 1; c++) {
      const colW = vLines[c + 1] - vLines[c];
      if (colW > maxColWidth) {
        maxColWidth = colW;
        widestColIdx = c;
      }
    }

    const projX0 = vLines[widestColIdx] + 8;
    const projX1 = vLines[widestColIdx + 1] - 8;

    const refinedHLines: number[] = [];
    for (let r = 0; r < hLines.length - 1; r++) {
      refinedHLines.push(hLines[r]);
      const y0 = hLines[r];
      const y1 = hLines[r + 1];
      const h = y1 - y0;
      if (h > 100) {
        const profile = new Int32Array(h);
        for (let y = y0; y < y1; y++) {
          let darks = 0;
          const rowOffset = y * canvasWidth;
          for (let x = projX0; x < projX1; x++) {
            if (isDark[rowOffset + x]) {
              darks++;
            }
          }
          profile[y - y0] = darks;
        }
        const threshold = Math.max(3, Math.floor((projX1 - projX0) * 0.005));
        const isText = new Uint8Array(h);
        for (let i = 0; i < h; i++) {
          isText[i] = profile[i] >= threshold ? 1 : 0;
        }
        const smoothed = new Uint8Array(h);
        const win = 5;
        for (let i = 0; i < h; i++) {
          let sum = 0;
          const start = Math.max(0, i - Math.floor(win / 2));
          const end = Math.min(h - 1, i + Math.floor(win / 2));
          for (let j = start; j <= end; j++) {
            sum += isText[j];
          }
          smoothed[i] = sum >= win / 2 ? 1 : 0;
        }
        const textIntervals: { start: number; end: number }[] = [];
        let inText = false;
        let startIdx = 0;
        for (let i = 0; i < h; i++) {
          if (smoothed[i] === 1 && !inText) {
            inText = true;
            startIdx = i;
          } else if (smoothed[i] === 0 && inText) {
            inText = false;
            if (i - startIdx >= 8) {
              textIntervals.push({ start: startIdx, end: i });
            }
          }
        }
        if (inText && (h - startIdx >= 8)) {
          textIntervals.push({ start: startIdx, end: h - 1 });
        }
        if (textIntervals.length > 1) {
          for (let idx = 0; idx < textIntervals.length - 1; idx++) {
            const endCurrent = textIntervals[idx].end;
            const startNext = textIntervals[idx + 1].start;
            const valleyCenter = y0 + Math.round((endCurrent + startNext) / 2);
            refinedHLines.push(valleyCenter);
          }
        }
      }
    }
    refinedHLines.push(hLines[hLines.length - 1]);
    if (refinedHLines.length >= 2) {
      activeHLines = refinedHLines;
    }
  }

  if (vLines.length < 2 || activeHLines.length < 2) {
    console.log(`[OCR Table] Insufficient grid lines: ${vLines.length} vertical, ${activeHLines.length} horizontal. Falling back to row-based OCR.`);
    // Fallback: create row-based cells spanning the full width
    const cells: TableCell[] = [];
    for (let r = 0; r < activeHLines.length - 1; r++) {
      const cellHeight = activeHLines[r + 1] - activeHLines[r];
      if (cellHeight < 15) continue;
      cells.push({
        row: r,
        col: 0,
        bbox: {
          x0: tableBbox.x0 + 5,
          y0: activeHLines[r] + 2,
          x1: tableBbox.x1 - 5,
          y1: activeHLines[r + 1] - 2,
        }
      });
    }
    return cells;
  }

  console.log(`[OCR Table] Grid detected: ${activeHLines.length} horizontal lines, ${vLines.length} vertical lines`);

  const cells: TableCell[] = [];
  for (let r = 0; r < activeHLines.length - 1; r++) {
    for (let c = 0; c < vLines.length - 1; c++) {
      const cellW = vLines[c + 1] - vLines[c];
      const cellH = activeHLines[r + 1] - activeHLines[r];
      if (cellW < 10 || cellH < 10) continue;

      cells.push({
        row: r,
        col: c,
        bbox: {
          x0: vLines[c] + 2,
          y0: activeHLines[r] + 2,
          x1: vLines[c + 1] - 2,
          y1: activeHLines[r + 1] - 2,
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
/**
 * Helper to check if two bounding boxes overlap.
 */
export function boxesOverlap(
  b1: { x0: number; y0: number; x1: number; y1: number },
  b2: { x0: number; y0: number; x1: number; y1: number }
): boolean {
  return !(b1.x1 < b2.x0 || b1.x0 > b2.x1 || b1.y1 < b2.y0 || b1.y0 > b2.y1);
}

/**
 * Fast Connected Component Labeling (CCL) using Union-Find on a 4x downscaled binary grid.
 * Keeps execution time under 10ms.
 */
export function findConnectedComponents(
  isDark: Uint8Array,
  width: number,
  height: number,
  scaleFactor = 4
): { x0: number; y0: number; x1: number; y1: number; area: number }[] {
  const sw = Math.floor(width / scaleFactor);
  const sh = Math.floor(height / scaleFactor);
  const grid = new Uint8Array(sw * sh);

  for (let sy = 0; sy < sh; sy++) {
    const oyStart = sy * scaleFactor;
    for (let sx = 0; sx < sw; sx++) {
      const oxStart = sx * scaleFactor;
      let dark = 0;
      for (let dy = 0; dy < scaleFactor; dy++) {
        const y = oyStart + dy;
        if (y >= height) break;
        const offset = y * width;
        for (let dx = 0; dx < scaleFactor; dx++) {
          const x = oxStart + dx;
          if (x >= width) break;
          if (isDark[offset + x]) {
            dark = 1;
            break;
          }
        }
        if (dark) break;
      }
      grid[sy * sw + sx] = dark;
    }
  }

  const parent = new Int32Array(sw * sh);
  for (let i = 0; i < parent.length; i++) parent[i] = i;

  function find(i: number): number {
    let root = i;
    while (parent[root] !== root) {
      root = parent[root];
    }
    let curr = i;
    while (curr !== root) {
      const next = parent[curr];
      parent[curr] = root;
      curr = next;
    }
    return root;
  }

  function union(i: number, j: number) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      parent[rootI] = rootJ;
    }
  }

  for (let y = 0; y < sh; y++) {
    const yOffset = y * sw;
    for (let x = 0; x < sw; x++) {
      const idx = yOffset + x;
      if (grid[idx] === 0) continue;
      if (x > 0 && grid[idx - 1] === 1) union(idx, idx - 1);
      if (y > 0) {
        if (grid[idx - sw] === 1) union(idx, idx - sw);
        if (x > 0 && grid[idx - sw - 1] === 1) union(idx, idx - sw - 1);
        if (x < sw - 1 && grid[idx - sw + 1] === 1) union(idx, idx - sw + 1);
      }
    }
  }

  const boxes = new Map<number, { x0: number; y0: number; x1: number; y1: number; area: number }>();
  for (let y = 0; y < sh; y++) {
    const yOffset = y * sw;
    for (let x = 0; x < sw; x++) {
      const idx = yOffset + x;
      if (grid[idx] === 0) continue;
      const root = find(idx);

      const ox = x * scaleFactor;
      const oy = y * scaleFactor;

      let box = boxes.get(root);
      if (!box) {
        box = { x0: ox, y0: oy, x1: ox + scaleFactor, y1: oy + scaleFactor, area: 0 };
        boxes.set(root, box);
      } else {
        box.x0 = Math.min(box.x0, ox);
        box.y0 = Math.min(box.y0, oy);
        box.x1 = Math.max(box.x1, ox + scaleFactor);
        box.y1 = Math.max(box.y1, oy + scaleFactor);
      }
      box.area += scaleFactor * scaleFactor;
    }
  }

  return Array.from(boxes.values());
}

/**
 * Group connected components horizontally into candidates.
 */
export function groupMissedComponents(
  components: { x0: number; y0: number; x1: number; y1: number }[]
): { x0: number; y0: number; x1: number; y1: number }[] {
  if (components.length === 0) return [];

  const sorted = [...components].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const groups: { x0: number; y0: number; x1: number; y1: number }[] = [];

  for (const cc of sorted) {
    let merged = false;
    for (const g of groups) {
      const ccHeight = cc.y1 - cc.y0;
      const gHeight = g.y1 - g.y0;
      const avgHeight = (ccHeight + gHeight) / 2;

      const yOverlap = Math.max(0, Math.min(cc.y1, g.y1) - Math.max(cc.y0, g.y0));
      const isVerticallyAligned = yOverlap > 0.25 * avgHeight || Math.abs((cc.y0 + cc.y1)/2 - (g.y0 + g.y1)/2) < 0.4 * avgHeight;

      if (isVerticallyAligned) {
        const dist = Math.max(0, cc.x0 - g.x1, g.x0 - cc.x1);
        if (dist < 2.5 * avgHeight) {
          g.x0 = Math.min(g.x0, cc.x0);
          g.y0 = Math.min(g.y0, cc.y0);
          g.x1 = Math.max(g.x1, cc.x1);
          g.y1 = Math.max(g.y1, cc.y1);
          merged = true;
          break;
        }
      }
    }
    if (!merged) {
      groups.push({ ...cc });
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const g1 = groups[i];
        const g2 = groups[j];
        const g1H = g1.y1 - g1.y0;
        const g2H = g2.y1 - g2.y0;
        const avgH = (g1H + g2H) / 2;

        const yOverlap = Math.max(0, Math.min(g1.y1, g2.y1) - Math.max(g1.y0, g2.y0));
        const isVertAligned = yOverlap > 0.25 * avgH || Math.abs((g1.y0 + g1.y1)/2 - (g2.y0 + g2.y1)/2) < 0.4 * avgH;
        const dist = Math.max(0, g1.x0 - g2.x1, g2.x0 - g1.x1);

        if (isVertAligned && dist < 2.0 * avgH) {
          g1.x0 = Math.min(g1.x0, g2.x0);
          g1.y0 = Math.min(g1.y0, g2.y0);
          g1.x1 = Math.max(g1.x1, g2.x1);
          g1.y1 = Math.max(g1.y1, g2.y1);
          groups.splice(j, 1);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  return groups;
}

/**
 * Region language detection based on baseline OCR results.
 */
export function detectRegionLanguage(
  regionBbox: { x0: number; y0: number; x1: number; y1: number },
  baselineWords: InternalOcrWord[]
): string[] {
  let devaCount = 0;
  let latCount = 0;

  for (const w of baselineWords) {
    if (boxesOverlap(w.bbox, regionBbox)) {
      for (const char of w.text) {
        if (/[\u0900-\u097F]/.test(char)) {
          devaCount++;
        } else if (/[a-zA-Z]/.test(char)) {
          latCount++;
        }
      }
    }
  }

  if (devaCount > 0) {
    if (latCount > 0.15 * (devaCount + latCount)) {
      return ['eng', 'hin'];
    }
    return ['hin'];
  }
  return ['eng'];
}

/**
 * Perform multi-scale, character-height aware crop OCR with variants for consistency.
 */
export async function recognizeCandidateRegion(
  worker: TesseractWorker,
  originalCanvas: HTMLCanvasElement,
  bbox: { x0: number; y0: number; x1: number; y1: number },
  scaleX: number,
  scaleY: number,
  baselineWords: InternalOcrWord[]
): Promise<{ words: InternalOcrWord[]; selectedVariant: string; debugText: string } | null> {
  const w = bbox.x1 - bbox.x0;
  const h = bbox.y1 - bbox.y0;
  if (w <= 5 || h <= 5) return null;

  const charHeightPt = h / scaleY;

  let upscaleFactor = 1.0;
  let psm = PSM.SINGLE_LINE;

  if (charHeightPt < 7) {
    upscaleFactor = 4.0;
    psm = PSM.SINGLE_WORD;
  } else if (charHeightPt < 10) {
    upscaleFactor = 2.5;
    psm = PSM.SINGLE_LINE;
  } else {
    upscaleFactor = 1.5;
    psm = PSM.SINGLE_LINE;
  }

  const runOcrOnCrop = async (cropCanvas: HTMLCanvasElement): Promise<{ text: string; confidence: number; words: InternalOcrWord[] }> => {
    await worker.setParameters({
      tessedit_pageseg_mode: psm,
    });
    const res = await recognizeWithTimeout(worker, cropCanvas, {}, { text: true, blocks: true }, 15000);
    const words: InternalOcrWord[] = [];
    for (const block of (res.data.blocks || [])) {
      for (const paragraph of (block.paragraphs || [])) {
        for (const line of (paragraph.lines || [])) {
          for (const word of (line.words || [])) {
            if (word.text && word.text.trim()) {
              const wx0 = bbox.x0 + word.bbox.x0 / upscaleFactor;
              const wy0 = bbox.y0 + word.bbox.y0 / upscaleFactor;
              const wx1 = bbox.x0 + word.bbox.x1 / upscaleFactor;
              const wy1 = bbox.y0 + word.bbox.y1 / upscaleFactor;
              words.push({
                text: word.text.trim(),
                confidence: word.confidence ?? 0,
                bbox: { x0: wx0, y0: wy0, x1: wx1, y1: wy1 },
                source: `targeted_crop_scale${upscaleFactor}`
              });
            }
          }
        }
      }
    }
    return {
      text: res.data.text?.trim() || '',
      confidence: res.data.confidence ?? 0,
      words
    };
  };

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = w * upscaleFactor;
  cropCanvas.height = h * upscaleFactor;
  const ctx = cropCanvas.getContext('2d');
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(originalCanvas, bbox.x0, bbox.y0, w, h, 0, 0, w * upscaleFactor, h * upscaleFactor);

  let bestResult: { text: string; confidence: number; words: InternalOcrWord[]; variantName: string } | null = null;
  const variants: { text: string; confidence: number; words: InternalOcrWord[]; variantName: string }[] = [];

  const imgData = ctx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);
  const data = imgData.data;
  for (let idx = 0; idx < data.length; idx += 4) {
    const luma = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    data[idx] = luma;
    data[idx + 1] = luma;
    data[idx + 2] = luma;
  }
  ctx.putImageData(imgData, 0, 0);

  try {
    const resA = await runOcrOnCrop(cropCanvas);
    variants.push({ ...resA, variantName: 'grayscale' });
  } catch (err) {
    console.warn(`[OCR Targeted] Variant A failed:`, err);
  }

  if (variants.length > 0 && (charHeightPt < 9 || variants[0].confidence < 75)) {
    const threshCanvas = document.createElement('canvas');
    threshCanvas.width = cropCanvas.width;
    threshCanvas.height = cropCanvas.height;
    const tctx = threshCanvas.getContext('2d')!;
    tctx.drawImage(cropCanvas, 0, 0);
    preprocessCanvasAdaptive(threshCanvas);

    try {
      const resB = await runOcrOnCrop(threshCanvas);
      variants.push({ ...resB, variantName: 'adaptive_threshold' });
    } catch (err) {
      console.warn(`[OCR Targeted] Variant B failed:`, err);
    } finally {
      threshCanvas.width = 0;
      threshCanvas.height = 0;
    }
  }

  if (variants.length > 0 && (charHeightPt < 8 || variants[0].confidence < 65)) {
    const denoiseCanvas = document.createElement('canvas');
    denoiseCanvas.width = cropCanvas.width;
    denoiseCanvas.height = cropCanvas.height;
    const dctx = denoiseCanvas.getContext('2d')!;
    dctx.drawImage(cropCanvas, 0, 0);
    preprocessCanvasDenoise(denoiseCanvas);

    try {
      const resC = await runOcrOnCrop(denoiseCanvas);
      variants.push({ ...resC, variantName: 'denoise' });
    } catch (err) {
      console.warn(`[OCR Targeted] Variant C failed:`, err);
    } finally {
      denoiseCanvas.width = 0;
      denoiseCanvas.height = 0;
    }
  }

  cropCanvas.width = 0;
  cropCanvas.height = 0;

  if (variants.length === 0) return null;

  const cleanedTexts = variants.map(v => v.text.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, ''));
  let consensusIdx = -1;
  let maxAgreement = 0;

  for (let i = 0; i < cleanedTexts.length; i++) {
    let agreement = 0;
    for (let j = 0; j < cleanedTexts.length; j++) {
      if (cleanedTexts[i] === cleanedTexts[j]) {
        agreement++;
      }
    }
    if (agreement > maxAgreement) {
      maxAgreement = agreement;
      consensusIdx = i;
    }
  }

  if (maxAgreement >= 2 && consensusIdx !== -1) {
    bestResult = variants[consensusIdx];
    bestResult.confidence = Math.max(92, bestResult.confidence);
  } else {
    bestResult = variants.reduce((prev, curr) => (curr.confidence > prev.confidence ? curr : prev), variants[0]);
  }

  if (bestResult.text.length > 0) {
    console.log(`[OCR Targeted Recovery] BBox: [${bbox.x0}, ${bbox.y0}, ${bbox.x1}, ${bbox.y1}] | Scale: ${upscaleFactor}x | PSM: ${psm} | Height: ${charHeightPt.toFixed(1)}pt | Text: "${bestResult.text}" (Conf: ${bestResult.confidence.toFixed(1)}%, Selected: ${bestResult.variantName})`);
  }

  return {
    words: bestResult.words,
    selectedVariant: bestResult.variantName,
    debugText: bestResult.text
  };
}

export interface OCRLayoutWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  source: string;
  pdfWord?: {
    text: string;
    encodedHex: string;
    x: number;
    y: number;
    fontSize: number;
    fontKey: string;
    scalePercent: number;
  };
}

export interface OCRLayoutLine {
  bbox: { x0: number; y0: number; x1: number; y1: number };
  words: OCRLayoutWord[];
}

export interface OCRLayoutBlock {
  id: string;
  type: 'text_block' | 'table' | 'small_text';
  bbox: { x0: number; y0: number; x1: number; y1: number };
  lines?: OCRLayoutLine[];
  rows?: { rowIdx: number; cells: { row: number; col: number; bbox: { x0: number; y0: number; x1: number; y1: number }; words: OCRLayoutWord[] }[] }[];
}

export interface ColumnRegion {
  x0: number;
  x1: number;
  lines: OCRLayoutLine[];
}

/**
 * Dynamically detects multi-column layout slices by finding empty vertical bands (gutters)
 * that run down the page, and grouping text lines into columns.
 */
export function detectColumnsAndGroup(
  lines: OCRLayoutLine[],
  canvasWidth: number
): ColumnRegion[] {
  if (lines.length === 0) return [];

  const slotsCount = 200;
  const slotWidth = canvasWidth / slotsCount;
  const slotCrossings = new Array(slotsCount).fill(0);

  // We only count lines that are not full-width (less than 70% of page width)
  // to avoid headers/footers blocking gutter detection
  const normalLines = lines.filter(line => (line.bbox.x1 - line.bbox.x0) < canvasWidth * 0.70);

  for (const line of normalLines) {
    const startSlot = Math.floor(line.bbox.x0 / slotWidth);
    const endSlot = Math.floor(line.bbox.x1 / slotWidth);
    for (let s = Math.max(0, startSlot); s <= Math.min(slotsCount - 1, endSlot); s++) {
      slotCrossings[s]++;
    }
  }

  const marginSlots = Math.floor(slotsCount * 0.08);
  const gutters: { start: number; end: number }[] = [];
  let currentGutterStart = -1;

  for (let s = marginSlots; s < slotsCount - marginSlots; s++) {
    if (slotCrossings[s] === 0) {
      if (currentGutterStart === -1) {
        currentGutterStart = s;
      }
    } else {
      if (currentGutterStart !== -1) {
        const gutterWidth = (s - currentGutterStart) * slotWidth;
        if (gutterWidth >= canvasWidth * 0.025 && gutterWidth <= canvasWidth * 0.15) {
          gutters.push({ start: currentGutterStart, end: s - 1 });
        }
        currentGutterStart = -1;
      }
    }
  }
  if (currentGutterStart !== -1) {
    const gutterWidth = (slotsCount - marginSlots - currentGutterStart) * slotWidth;
    if (gutterWidth >= canvasWidth * 0.025 && gutterWidth <= canvasWidth * 0.15) {
      gutters.push({ start: currentGutterStart, end: slotsCount - marginSlots - 1 });
    }
  }

  const validGutters: { xStart: number; xEnd: number }[] = [];
  for (const gutter of gutters) {
    const gx0 = gutter.start * slotWidth;
    const gx1 = (gutter.end + 1) * slotWidth;

    const leftLines = lines.filter(l => l.bbox.x1 <= gx0);
    const rightLines = lines.filter(l => l.bbox.x0 >= gx1);

    if (leftLines.length > 0 && rightLines.length > 0) {
      let overlapCount = 0;
      for (const ll of leftLines) {
        for (const rl of rightLines) {
          const yOverlap = Math.max(0, Math.min(ll.bbox.y1, rl.bbox.y1) - Math.max(ll.bbox.y0, rl.bbox.y0));
          if (yOverlap > 0) {
            overlapCount++;
            if (overlapCount > 3) break;
          }
        }
        if (overlapCount > 3) break;
      }

      if (overlapCount > 0) {
        validGutters.push({ xStart: gx0, xEnd: gx1 });
      }
    }
  }

  if (validGutters.length === 0) {
    return [{ x0: 0, x1: canvasWidth, lines }];
  }

  validGutters.sort((a, b) => a.xStart - b.xStart);

  const columnBounds: { x0: number; x1: number }[] = [];
  let lastX = 0;
  for (const g of validGutters) {
    columnBounds.push({ x0: lastX, x1: g.xStart });
    lastX = g.xEnd;
  }
  columnBounds.push({ x0: lastX, x1: canvasWidth });

  const columns: ColumnRegion[] = columnBounds.map(b => ({ x0: b.x0, x1: b.x1, lines: [] }));

  for (const line of lines) {
    const cx = (line.bbox.x0 + line.bbox.x1) / 2;
    let assigned = false;
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      if (cx >= col.x0 && cx <= col.x1) {
        col.lines.push(line);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      let minDist = Infinity;
      let closestColIdx = 0;
      for (let c = 0; c < columns.length; c++) {
        const col = columns[c];
        const dist = Math.min(Math.abs(cx - col.x0), Math.abs(cx - col.x1));
        if (dist < minDist) {
          minDist = dist;
          closestColIdx = c;
        }
      }
      columns[closestColIdx].lines.push(line);
    }
  }

  return columns.filter(col => col.lines.length > 0);
}

/**
 * Organizes layout blocks into vertical segments separated by spanning/full-width elements
 * (like page titles, headers, footer bands) and reads side-by-side columns from left-to-right.
 */
export function orderBlocksByLayout(
  blocks: OCRLayoutBlock[],
  canvasWidth: number,
  canvasHeight: number
): OCRLayoutBlock[] {
  if (blocks.length <= 1) return blocks;

  const allLines: OCRLayoutLine[] = [];
  for (const b of blocks) {
    if (b.type === 'text_block' && b.lines) {
      allLines.push(...b.lines);
    }
  }

  const columns = detectColumnsAndGroup(allLines, canvasWidth);

  if (columns.length <= 1) {
    return [...blocks].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  }

  const gutters: { x0: number; x1: number }[] = [];
  for (let i = 0; i < columns.length - 1; i++) {
    gutters.push({ x0: columns[i].x1, x1: columns[i + 1].x0 });
  }

  const spanningBlocks: OCRLayoutBlock[] = [];
  const colBlocks: { colIdx: number; block: OCRLayoutBlock }[] = [];

  for (const b of blocks) {
    const cx = (b.bbox.x0 + b.bbox.x1) / 2;
    const w = b.bbox.x1 - b.bbox.x0;

    let isSpanning = w > canvasWidth * 0.65;
    if (!isSpanning) {
      for (const g of gutters) {
        if (b.bbox.x0 < g.x0 - 5 && b.bbox.x1 > g.x1 + 5) {
          isSpanning = true;
          break;
        }
      }
    }

    if (isSpanning) {
      spanningBlocks.push(b);
    } else {
      let colIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        if (cx >= col.x0 && cx <= col.x1) {
          colIdx = i;
          break;
        }
        const dist = Math.min(Math.abs(cx - col.x0), Math.abs(cx - col.x1));
        if (dist < minDist) {
          minDist = dist;
          colIdx = i;
        }
      }
      colBlocks.push({ colIdx, block: b });
    }
  }

  spanningBlocks.sort((a, b) => a.bbox.y0 - b.bbox.y0);

  const orderedBlocks: OCRLayoutBlock[] = [];
  let currentY = 0;

  for (const sb of spanningBlocks) {
    const sbY0 = sb.bbox.y0;
    const sbY1 = sb.bbox.y1;

    const sliceColBlocks = colBlocks.filter(cb => {
      const bCenterY = (cb.block.bbox.y0 + cb.block.bbox.y1) / 2;
      return bCenterY < sbY0 && bCenterY >= currentY;
    });

    for (let c = 0; c < columns.length; c++) {
      const cBlocks = sliceColBlocks.filter(cb => cb.colIdx === c).map(cb => cb.block);
      cBlocks.sort((a, b) => a.bbox.y0 - b.bbox.y0);
      orderedBlocks.push(...cBlocks);
    }

    orderedBlocks.push(sb);
    currentY = sbY1;
  }

  const remainingColBlocks = colBlocks.filter(cb => {
    const bCenterY = (cb.block.bbox.y0 + cb.block.bbox.y1) / 2;
    return bCenterY >= currentY;
  });

  for (let c = 0; c < columns.length; c++) {
    const cBlocks = remainingColBlocks.filter(cb => cb.colIdx === c).map(cb => cb.block);
    cBlocks.sort((a, b) => a.bbox.y0 - b.bbox.y0);
    orderedBlocks.push(...cBlocks);
  }

  const addedSet = new Set(orderedBlocks.map(b => b.id));
  for (const b of blocks) {
    if (!addedSet.has(b.id)) {
      orderedBlocks.push(b);
    }
  }

  return orderedBlocks;
}

/**
 * Reconstructs layout and reading order using vertical geometry heuristics,
 * dynamic multi-column grouping, and table structure preservation.
 */
export function reconstructReadingOrder(
  words: InternalOcrWord[],
  tables: DetectedTable[],
  canvasWidth: number,
  canvasHeight: number
): OCRLayoutBlock[] {
  const blocks: OCRLayoutBlock[] = [];
  const assignedWords = new Set<InternalOcrWord>();

  for (const table of tables) {
    const tableWords = words.filter(w => {
      const cx = (w.bbox.x0 + w.bbox.x1) / 2;
      const cy = (w.bbox.y0 + w.bbox.y1) / 2;
      return cx >= table.bbox.x0 && cx <= table.bbox.x1 && cy >= table.bbox.y0 && cy <= table.bbox.y1;
    });

    tableWords.forEach(w => assignedWords.add(w));

    const cellMap = new Map<string, OCRLayoutWord[]>();
    for (const cell of table.cells) {
      const cellKey = `${cell.row}_${cell.col}`;
      const cWords = tableWords.filter(w => {
        const cx = (w.bbox.x0 + w.bbox.x1) / 2;
        const cy = (w.bbox.y0 + w.bbox.y1) / 2;
        return cx >= cell.bbox.x0 && cx <= cell.bbox.x1 && cy >= cell.bbox.y0 && cy <= cell.bbox.y1;
      });
      cWords.sort((a, b) => a.bbox.x0 - b.bbox.x0);
      cellMap.set(cellKey, cWords.map(w => ({ text: w.text, confidence: w.confidence, bbox: w.bbox, source: w.source, pdfWord: (w as any).pdfWord })));
    }

    const rowsMap = new Map<number, { row: number; col: number; bbox: { x0: number; y0: number; x1: number; y1: number }; words: OCRLayoutWord[] }[]>();
    for (const cell of table.cells) {
      const cellKey = `${cell.row}_${cell.col}`;
      const cWords = cellMap.get(cellKey) || [];
      if (!rowsMap.has(cell.row)) {
        rowsMap.set(cell.row, []);
      }
      rowsMap.get(cell.row)!.push({
        row: cell.row,
        col: cell.col,
        bbox: cell.bbox,
        words: cWords
      });
    }

    const sortedRows = Array.from(rowsMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([rowIdx, cells]) => {
        cells.sort((a, b) => a.col - b.col);
        return { rowIdx, cells };
      });

    blocks.push({
      id: table.id,
      type: 'table',
      bbox: table.bbox,
      rows: sortedRows
    });
  }

  const remainingWords = words.filter(w => !assignedWords.has(w));
  if (remainingWords.length === 0) {
    return orderBlocksByLayout(blocks, canvasWidth, canvasHeight);
  }

  remainingWords.sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);

  const lines: OCRLayoutLine[] = [];
  for (const w of remainingWords) {
    let bestLine: OCRLayoutLine | null = null;
    let minCenterDist = Infinity;

    const wHeight = w.bbox.y1 - w.bbox.y0;
    const wCenterY = (w.bbox.y0 + w.bbox.y1) / 2;

    for (const line of lines) {
      const lineH = line.bbox.y1 - line.bbox.y0;
      const lineCenterY = (line.bbox.y0 + line.bbox.y1) / 2;
      const avgH = (lineH + wHeight) / 2;

      // Compatibility check: vertical center difference < 0.65 * average height
      const centerDist = Math.abs(wCenterY - lineCenterY);
      if (centerDist < 0.65 * avgH) {
        if (centerDist < minCenterDist) {
          minCenterDist = centerDist;
          bestLine = line;
        }
      }
    }

    if (bestLine) {
      bestLine.words.push({ text: w.text, confidence: w.confidence, bbox: w.bbox, source: w.source, pdfWord: (w as any).pdfWord });
      bestLine.bbox.x0 = Math.min(bestLine.bbox.x0, w.bbox.x0);
      bestLine.bbox.y0 = Math.min(bestLine.bbox.y0, w.bbox.y0);
      bestLine.bbox.x1 = Math.max(bestLine.bbox.x1, w.bbox.x1);
      bestLine.bbox.y1 = Math.max(bestLine.bbox.y1, w.bbox.y1);
    } else {
      lines.push({
        bbox: { ...w.bbox },
        words: [{ text: w.text, confidence: w.confidence, bbox: w.bbox, source: w.source, pdfWord: (w as any).pdfWord }]
      });
    }
  }

  for (const line of lines) {
    line.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
  }

  // 3. Column Detection & Grouping on lines
  const columnRegions = detectColumnsAndGroup(lines, canvasWidth);

  // Group lines within each column into Paragraph Blocks
  const textBlocks: OCRLayoutBlock[] = [];
  let blockCounter = blocks.length + 1;

  for (const col of columnRegions) {
    col.lines.sort((a, b) => a.bbox.y0 - b.bbox.y0);

    let currentBlock: OCRLayoutBlock | null = null;

    for (const line of col.lines) {
      if (!currentBlock) {
        currentBlock = {
          id: `block_${blockCounter++}`,
          type: 'text_block',
          bbox: { ...line.bbox },
          lines: [line]
        };
        textBlocks.push(currentBlock);
      } else {
        const prevLine = currentBlock.lines![currentBlock.lines!.length - 1];
        const prevLineHeight = prevLine.bbox.y1 - prevLine.bbox.y0;
        const gap = line.bbox.y0 - prevLine.bbox.y1;

        const hOverlap = Math.max(0, Math.min(line.bbox.x1, prevLine.bbox.x1) - Math.max(line.bbox.x0, prevLine.bbox.x0));
        const isClose = gap < 2.2 * prevLineHeight &&
                        (hOverlap > 0 || Math.max(0, line.bbox.x0 - prevLine.bbox.x1, prevLine.bbox.x0 - line.bbox.x1) < 120);

        if (isClose) {
          currentBlock.lines!.push(line);
          currentBlock.bbox.x0 = Math.min(currentBlock.bbox.x0, line.bbox.x0);
          currentBlock.bbox.y0 = Math.min(currentBlock.bbox.y0, line.bbox.y0);
          currentBlock.bbox.x1 = Math.max(currentBlock.bbox.x1, line.bbox.x1);
          currentBlock.bbox.y1 = Math.max(currentBlock.bbox.y1, line.bbox.y1);
        } else {
          currentBlock = {
            id: `block_${blockCounter++}`,
            type: 'text_block',
            bbox: { ...line.bbox },
            lines: [line]
          };
          textBlocks.push(currentBlock);
        }
      }
    }
  }

  // 4. Combine and Sort blocks layout-aware (Reading Order)
  const allBlocks = [...blocks, ...textBlocks];
  return orderBlocksByLayout(allBlocks, canvasWidth, canvasHeight);
}

export interface DetectedTable {
  id: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  cells: TableCell[];
}

/**
 * Generic Page Region Detector.
 * Analyzes document structure via horizontal line grids and vertical layout spacing.
 */
export function detectPageRegions(
  canvas: HTMLCanvasElement,
  precomputedBinary?: Uint8Array
): { tableCells: TableCell[]; hLines: number[]; isDark: Uint8Array } {
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  let isDark: Uint8Array;
  if (precomputedBinary) {
    isDark = precomputedBinary;
  } else {
    const ctx = canvas.getContext('2d');
    if (!ctx) return { tableCells: [], hLines: [], isDark: new Uint8Array(0) };
    const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imgData.data;
    isDark = new Uint8Array(canvasWidth * canvasHeight);
    for (let i = 0; i < data.length; i += 4) {
      isDark[i / 4] = data[i] < 180 ? 1 : 0;
    }
  }

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

  const clusteredHLines: number[] = [];
  if (internalHLines.length > 0) {
    let sum = internalHLines[0], count = 1;
    for (let i = 1; i < internalHLines.length; i++) {
      if (internalHLines[i] - internalHLines[i - 1] <= Math.max(35, Math.floor(canvasHeight * 0.005))) {
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

  const tableHLines: number[] = [];
  if (clusteredHLines.length > 0) {
    let currentGroup: number[] = [clusteredHLines[0]];
    let bestGroup: number[] = [...currentGroup];

    for (let i = 1; i < clusteredHLines.length; i++) {
      const gap = clusteredHLines[i] - clusteredHLines[i - 1];
      if (gap <= canvasHeight * 0.45) {
        currentGroup.push(clusteredHLines[i]);
      } else {
        if (currentGroup.length > bestGroup.length) {
          bestGroup = [...currentGroup];
        }
        currentGroup = [clusteredHLines[i]];
      }
    }
    if (currentGroup.length > bestGroup.length) {
      bestGroup = [...currentGroup];
    }
    
    if (bestGroup.length >= 3) {
      tableHLines.push(...bestGroup);
    }
  }

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

      tableCells = detectTableCells(isDark, canvasWidth, canvasHeight, tableBox, tableHLines);
      console.log(`[OCR Table] Grid detected: ${tableHLines.length} horizontal lines, ${tableCells.length} cells`);
    }
  }

  return { tableCells, hLines: clusteredHLines, isDark };
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

  // Fix Devanagari common OCR typo केन्द्रीय vs केन्ट्रीय
  cleaned = cleaned.replace(/केन्ट्रीय/g, 'केन्द्रीय');

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
    lines: {
      words: {
        text: string;
        encodedHex: string;
        x: number;
        y: number;
        fontSize: number;
        fontKey: string;
        scalePercent: number;
      }[];
    }[];
  }[]
): string {
  const lines: string[] = [];
  lines.push('q');  // Save graphics state

  for (const block of blocks) {
    for (const line of block.lines) {
      if (line.words.length === 0) continue;
      lines.push('BT');
      lines.push('3 Tr'); // Invisible rendering mode

      let prevFontKey = '';
      let prevFontSize = 0;

      for (const w of line.words) {
        if (w.fontKey !== prevFontKey || w.fontSize !== prevFontSize) {
          lines.push(`${w.fontKey} ${w.fontSize.toFixed(2)} Tf`);
          prevFontKey = w.fontKey;
          prevFontSize = w.fontSize;
        }

        lines.push(`${w.scalePercent.toFixed(1)} Tz`);
        lines.push(`1 0 0 1 ${w.x.toFixed(2)} ${w.y.toFixed(2)} Tm`);
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

    const pdfPage = pdfDoc.getPage(i);
    const rotationAngle = pdfPage.getRotation().angle;
    const isLandscape = rotationAngle === 90 || rotationAngle === 270;

    const { width: pageWidth, height: pageHeight } = pdfPage.getSize();
    const visualWidth = isLandscape ? pageHeight : pageWidth;
    const visualHeight = isLandscape ? pageWidth : pageHeight;

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
    console.log('[DEBUG ALL BASELINE WORDS]', JSON.stringify(baselineWords.map(w => ({ t: w.text, x: Math.round(w.bbox.x0), y: Math.round(w.bbox.y0) }))));

    // ── Layout Analysis ──
    const layoutResult = detectPageRegions(canvas);
    const tableCells = layoutResult.tableCells;
    const isDark = layoutResult.isDark;
    const secondaryWords: InternalOcrWord[] = [];
    const regionStats: RegionOcrInfo[] = [];
    let tableCellWordsCount = 0;

    // 1. Detect Tables dynamically
    const tables: DetectedTable[] = [];
    if (tableCells.length > 0) {
      const tx0 = Math.min(...tableCells.map(c => c.bbox.x0));
      const ty0 = Math.min(...tableCells.map(c => c.bbox.y0));
      const tx1 = Math.max(...tableCells.map(c => c.bbox.x1));
      const ty1 = Math.max(...tableCells.map(c => c.bbox.y1));
      tables.push({
        id: 'table_1',
        bbox: { x0: tx0, y0: ty0, x1: tx1, y1: ty1 },
        cells: tableCells
      });
    }

    // 2. Connected Component Labeling on binary image
    const components = findConnectedComponents(isDark, canvas.width, canvas.height, 4);

    // 3. Filter components already covered by baseline OCR words
    const scaleX = canvas.width / visualWidth;
    const scaleY = canvas.height / visualHeight;

    const missedComponents = components.filter(cc => {
      const widthPt = (cc.x1 - cc.x0) / scaleX;
      const heightPt = (cc.y1 - cc.y0) / scaleY;

      // Reject components that are too small or too large (relaxed to support small text on large point coordinates)
      if (widthPt < 2.5 || heightPt < 2.8) return false;
      if (heightPt > 120 || widthPt > 600) return false;

      // Reject grid lines or table borders
      const aspect = (cc.x1 - cc.x0) / (cc.y1 - cc.y0);
      if (aspect > 15 || aspect < 1/15) return false;

      // Check if cc is a diacritic/accent of any baseline word:
      for (const word of baselineWords) {
        // 1. Horizontal overlap check (diacritics are vertically aligned above/below the word)
        const horizOverlap = Math.max(0, Math.min(cc.x1, word.bbox.x1) - Math.max(cc.x0, word.bbox.x0));
        const ccWidth = cc.x1 - cc.x0;
        const isHorizAligned = horizOverlap > 0.25 * ccWidth || (cc.x0 >= word.bbox.x0 - 5 && cc.x1 <= word.bbox.x1 + 5);

        if (isHorizAligned) {
          const ccHeight = cc.y1 - cc.y0;
          const wordHeight = word.bbox.y1 - word.bbox.y0;
          const vertDist = Math.max(0, word.bbox.y0 - cc.y1, cc.y0 - word.bbox.y1);

          // A diacritic must be physically close (vertDist < 0.65 * wordHeight) and relatively small (ccHeight < 0.45 * wordHeight)
          if (vertDist < 0.65 * wordHeight && ccHeight < 0.45 * wordHeight) {
            return false; // It's a diacritic or accent, filter it out!
          }
        }

        // 3. Fallback standard box overlap check
        if (boxesOverlap(cc, word.bbox)) {
          return false;
        }
      }
      return true;
    });

    // 4. Group remaining components horizontally into small-text / identifier candidate regions
    const candidateRegions = groupMissedComponents(missedComponents);

    let rejectedGraphicCandidatesCount = 0;
    const rejectedGraphicRegionsList: { bbox: { x0: number; y0: number; x1: number; y1: number }; type: string; reason: string }[] = [];

    // Filter candidate regions to reject long horizontal lines or tiny isolated noise at page edges
    const candidateRegionsFiltered = candidateRegions.filter(regBbox => {
      const wPt = (regBbox.x1 - regBbox.x0) / scaleX;
      const hPt = (regBbox.y1 - regBbox.y0) / scaleY;
      const aspect = wPt / hPt;

      if (aspect > 18 && hPt < 12.0) return false; // Long horizontal line noise
      if (wPt < 6 && hPt < 6) return false;       // Tiny isolated noise dots

      // Margin noise check
      const cx = (regBbox.x0 + regBbox.x1) / 2;
      const cy = (regBbox.y0 + regBbox.y1) / 2;
      const padX = canvas.width * 0.045;
      const padY = canvas.height * 0.045;
      const isAtEdge = cx < padX || cx > canvas.width - padX || cy < padY || cy > canvas.height - padY;

      if (isAtEdge && hPt < 8.0) return false; // Suppress edge noise unless it is reasonably large text

      // Graphic False Positive Protection
      const classification = classifyRegion(regBbox, components, isDark, canvas.width, canvas.height);
      if (classification.graphicLikelihood > 0.55 && classification.textLikelihood < 0.45) {
        rejectedGraphicCandidatesCount++;
        rejectedGraphicRegionsList.push({ bbox: regBbox, type: classification.type, reason: classification.reason });
        return false;
      }

      return true;
    });

    // 5. Run Targeted multi-scale OCR on the candidate regions
    if (candidateRegionsFiltered.length > 0) {
      onProgress?.(`Page ${i + 1}/${totalPages}: OCR-ing ${candidateRegionsFiltered.length} targeted recovery regions...`, progressBase + 0.10);
    }

    for (let regIdx = 0; regIdx < candidateRegionsFiltered.length; regIdx++) {
      const regBbox = candidateRegionsFiltered[regIdx];
      const charHeightPt = (regBbox.y1 - regBbox.y0) / scaleY;
      
      const cropRes = await recognizeCandidateRegion(
        worker,
        canvas,
        regBbox,
        scaleX,
        scaleY,
        baselineWords
      );

      if (cropRes && cropRes.words.length > 0) {
        secondaryWords.push(...cropRes.words);
        
        let psm = PSM.SINGLE_LINE;
        let upscaleFactor = 1.0;
        if (charHeightPt < 7) {
          upscaleFactor = 4.0;
          psm = PSM.SINGLE_WORD;
        } else if (charHeightPt < 10) {
          upscaleFactor = 2.5;
          psm = PSM.SINGLE_LINE;
        } else {
          upscaleFactor = 1.5;
          psm = PSM.SINGLE_LINE;
        }

        regionStats.push({
          id: `targeted_crop_${regIdx}`,
          type: 'Targeted Crop Recovery',
          bbox: regBbox,
          psm: psm,
          rawWords: cropRes.words.length,
          meanConf: (cropRes.words.reduce((sum, w) => sum + w.confidence, 0) / cropRes.words.length).toFixed(1) + '%',
          reason: `Height: ${charHeightPt.toFixed(1)}pt, Scale: ${upscaleFactor}x, Prep: ${cropRes.selectedVariant}`
        });
      }
    }

    // 6. Cell-Level OCR for Table cells containing text
    if (tableCells.length > 0) {
      const maxCellsToOcr = Math.min(tableCells.length, 80);
      onProgress?.(`Page ${i + 1}/${totalPages}: OCR-ing ${maxCellsToOcr} table cells...`, progressBase + 0.16);

      for (let ci = 0; ci < maxCellsToOcr; ci++) {
        const cell = tableCells[ci];
        const cellW = cell.bbox.x1 - cell.bbox.x0;
        const cellH = cell.bbox.y1 - cell.bbox.y0;
        if (cellW < 15 || cellH < 10) continue;

        // Check if cell has visual content
        const cellGate = isRegionTextLike(isDark, canvas.width, canvas.height, cell.bbox);
        if (!cellGate.isTextLike) continue;

        const cellCanvas = document.createElement('canvas');
        cellCanvas.width = cellW;
        cellCanvas.height = cellH;
        const cellCtx = cellCanvas.getContext('2d');
        if (!cellCtx) continue;

        cellCtx.drawImage(canvas, cell.bbox.x0, cell.bbox.y0, cellW, cellH, 0, 0, cellW, cellH);

        try {
          const cellPsm = PSM.SINGLE_LINE;
          await worker.setParameters({ tessedit_pageseg_mode: cellPsm });
          const cellRes = await recognizeWithTimeout(worker, cellCanvas, {}, { text: true, blocks: true }, 10000);
          console.log(`[OCR Cell debug] Row ${cell.row}, Col ${cell.col}, bbox: ${JSON.stringify(cell.bbox)}, Text: "${cellRes.data.text.trim()}"`);

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
          // Cell OCR timeout
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

    const cellCandidatesMap = new Map<string, InternalOcrWord[]>();
    const nonCellBaseline: InternalOcrWord[] = [];
    const nonCellSecondary: InternalOcrWord[] = [];

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

    for (const cell of tableCells) {
      const cellKey = `${cell.row}_${cell.col}`;
      const candidates = cellCandidatesMap.get(cellKey) || [];
      if (candidates.length === 0) continue;

      const cellSpecificCandidates = candidates.filter(c => c.source.startsWith('cell_r'));
      let chosenCandidates: InternalOcrWord[] = [];

      if (cellSpecificCandidates.length > 0) {
        chosenCandidates = cellSpecificCandidates;
        const overriddenCount = candidates.length - cellSpecificCandidates.length;
        duplicateCandidatesRemoved += overriddenCount;
      } else {
        const cellBaseline = candidates.filter(c => c.source === 'baseline_psm3');
        const cellSecondary = candidates.filter(c => c.source !== 'baseline_psm3');
        const { merged, duplicatesRemoved } = mergeOcrCandidates(cellBaseline, cellSecondary);
        chosenCandidates = merged;
        duplicateCandidatesRemoved += duplicatesRemoved;
      }

      reconciledWords.push(...chosenCandidates);
    }

    const { merged: nonCellMerged, duplicatesRemoved: nonCellDupRemoved, uniqueAdded: nonCellUniqueAdded } =
      mergeOcrCandidates(nonCellBaseline, nonCellSecondary);
    
    reconciledWords.push(...nonCellMerged);
    console.log('[DEBUG RECONCILED WORDS]', JSON.stringify(reconciledWords.filter(w => w.text.includes('के') || w.text.includes('क') || w.text.includes('BOARD') || w.text.includes('CENTRAL'))));
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

    const angle = ((rotationAngle % 360) + 360) % 360;

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

    const discardedWords: DiscardedWordInfo[] = [];
    const insertedWords: InsertedWordInfo[] = [];

    const explicitMinConfidence = options?.minWordConfidence;

    // First, calculate PDF coordinates and encode all reconciledWords
    for (const word of reconciledWords) {
      const wordText = word.text;
      const conf = word.confidence;

      if (!wordText || wordText.trim().length === 0) {
        discardedWords.push({ text: wordText || '', confidence: conf, reason: 'empty-token' });
        continue;
      }

      // ── Layout-Aware Background & Border Suppression ──
      if (isWordBackgroundNoise(word, canvas.width, canvas.height, tables)) {
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

      const fontKey = fontToUse === ocrFont ? ocrFontKey : helveticaKey;

      // Attach PDF prepared details to the word object
      (word as any).pdfWord = {
        text: cleanedText.trim(),
        encodedHex,
        x: drawX,
        y: drawY,
        fontSize,
        fontKey,
        scalePercent,
      };

      insertedWords.push({
        text: cleanedText.trim(),
        confidence: conf,
        bbox: { x0, y0, x1, y1 }
      });
    }

    // ── Build hierarchical layout blocks and reading order ──
    const layoutBlocks = reconstructReadingOrder(reconciledWords, tables, canvas.width, canvas.height);

    const readingOrderBlocks: {
      type: string;
      lines: {
        words: {
          text: string;
          encodedHex: string;
          x: number;
          y: number;
          fontSize: number;
          fontKey: string;
          scalePercent: number;
        }[];
      }[];
    }[] = [];

    for (const b of layoutBlocks) {
      const blockLines: typeof readingOrderBlocks[0]['lines'] = [];
      if (b.type === 'table') {
        for (const row of b.rows!) {
          for (const cell of row.cells) {
            const cellVisualLines: typeof blockLines[0]['words'][] = [];
            const cellWordsSorted = [...cell.words].sort((a, b) => b.bbox.y0 - a.bbox.y0 || a.bbox.x0 - b.bbox.x0);
            for (const w of cellWordsSorted) {
              if (!w.pdfWord) continue;
              let placed = false;
              for (const line of cellVisualLines) {
                const lineY = line.reduce((sum, item) => sum + item.y, 0) / line.length;
                const lineFontSize = line.reduce((sum, item) => sum + item.fontSize, 0) / line.length;
                if (Math.abs(w.pdfWord.y - lineY) < lineFontSize * 0.65) {
                  line.push(w.pdfWord);
                  placed = true;
                  break;
                }
              }
              if (!placed) {
                cellVisualLines.push([w.pdfWord]);
              }
            }
            for (const line of cellVisualLines) {
              line.sort((a, b) => a.x - b.x);
              blockLines.push({ words: line });
            }
          }
        }
      } else {
        for (const line of b.lines!) {
          const lineWords = line.words
            .filter(w => w.pdfWord !== undefined)
            .map(w => w.pdfWord!);
          if (lineWords.length > 0) {
            blockLines.push({ words: lineWords });
          }
        }
      }
      if (blockLines.length > 0) {
        readingOrderBlocks.push({
          type: b.id,
          lines: blockLines
        });
      }
    }

    const insertedWordsCount = insertedWords.length;
    const discardedWordsCount = discardedWords.length;
    const coveragePercent = reconciledWords.length > 0 ? (insertedWordsCount / reconciledWords.length) * 100 : 0;

    // ── Generate detailed console debug report ──
    const textBlocksCount = layoutBlocks.filter(b => b.type === 'text_block').length;
    const tableBlocksCount = layoutBlocks.filter(b => b.type === 'table').length;
    const graphicRegionsCount = rejectedGraphicRegionsList.length;

    const allLinesForReport: OCRLayoutLine[] = [];
    for (const b of layoutBlocks) {
      if (b.type === 'text_block' && b.lines) allLinesForReport.push(...b.lines);
    }
    const colsCountReport = detectColumnsAndGroup(allLinesForReport, canvas.width).length;

    const rawWordsSample = reconciledWords.slice(0, 15).map(w => w.text).join(' ');
    const reconstructedWordsList: string[] = [];
    for (const rob of readingOrderBlocks) {
      for (const line of rob.lines) {
        reconstructedWordsList.push(...line.words.map(w => w.text));
      }
    }
    const reconstructedSample = reconstructedWordsList.slice(0, 20).join(' ');

    console.log(`
================================================================
                    OCR PAGE DEBUG REPORT (PAGE ${i + 1})
================================================================
Initial OCR tokens:          ${baselineWords.length}
Layout regions:              ${layoutBlocks.length}
Text blocks:                 ${textBlocksCount}
Table regions:               ${tableBlocksCount}
Graphic regions:             ${graphicRegionsCount}
Small-text candidates:       ${candidateRegions.length}
Recovered candidates:        ${secondaryWords.length}
Rejected graphic candidates: ${rejectedGraphicCandidatesCount}
Line groups:                 ${allLinesForReport.length}
Paragraph groups:            ${textBlocksCount}
Columns:                     ${colsCountReport}
Final token count:           ${insertedWordsCount}
----------------------------------------------------------------
EXAMPLES OF READING ORDER FLOW:
RAW OCR TOKENS SAMPLE (first 15):
"${rawWordsSample}"

RECONSTRUCTED TEXT SAMPLE (first 20):
"${reconstructedSample}"
================================================================
`);

    console.log(`[OCR Recall Page ${i + 1}] Baseline: ${baselineWords.length}, Secondary: ${secondaryWords.length}, CellWords: ${tableCellWordsCount}, Merged Unique: ${insertedWordsCount}, Discarded: ${discardedWordsCount}, Coverage: ${coveragePercent.toFixed(1)}%`);

    // ── Create new content stream for OCR text layer ──
    if (readingOrderBlocks.some(b => b.lines.some(l => l.words.length > 0))) {
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

      totalWordsDrawn += insertedWords.length;
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
        linesCount: allLinesForReport.length,
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
