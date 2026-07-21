// ============================================================
// CompressKro — Compression Service
//
// This is the core image compression engine.
// Significantly improved over the original:
//   • 20-step binary search (vs 8 in original)
//   • Transparency detection → keeps PNG for alpha images
//   • Gradual 5% dimension reduction (vs 10% in original)
//   • Re-search at each scale level for best quality
//   • Sharpening pass after downscale to counteract blur
//   • Smart convergence — stops when range is tiny
//   • Full quality score calculation
// ============================================================

import type { CompressedFile } from '../types';
import { COMPRESSION_CONFIG, BACKEND_API_URL } from '../constants';
import {
  loadImageFromFile,
  createCanvas,
  canvasToBlob,
  drawImageToContext,
  hasTransparency,
  applySharpening,
} from '../utils/canvas';
import { calculateQualityScore } from '../utils/image';

export type CompressionMode = 'quality' | 'percentage' | 'target';

interface CompressionOptions {
  mode: CompressionMode;
  quality?: number;       // 1–100, for 'quality' mode
  scalePercent?: number;  // 1–200, for 'percentage' mode
  targetSizeKB?: number;  // for 'target' mode
}

// ---- Internal helpers ----

/**
 * Runs a binary search over JPEG quality to find the best quality
 * that produces a blob ≤ targetBytes.
 * Returns the best blob and quality found, or null if impossible at this scale.
 */
async function binarySearchQuality(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
  mimeType: string,
  targetBytes: number,
  steps: number
): Promise<{ blob: Blob; quality: number } | null> {
  // First draw the image at this size
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  let low: number = COMPRESSION_CONFIG.MIN_QUALITY_JPEG;
  let high = 0.97;
  let bestBlob: Blob | null = null;
  let bestQuality: number = low;

  for (let step = 0; step < steps; step++) {
    const mid = (low + high) / 2;

    // For PNG, quality param is ignored — but we still try
    const blob = await canvasToBlob(canvas, mimeType, mid);

    if (blob.size <= targetBytes) {
      // This quality fits — try to improve quality further
      bestBlob = blob;
      bestQuality = mid;
      low = mid;
    } else {
      // Too large — reduce quality
      high = mid;
    }

    // Early convergence: if search range is tiny, no point continuing
    if (high - low < COMPRESSION_CONFIG.CONVERGENCE_THRESHOLD) break;
  }

  return bestBlob ? { blob: bestBlob, quality: bestQuality } : null;
}

// ---- Main compression function ----

export async function compressSingleImage(
  file: File,
  options: CompressionOptions
): Promise<CompressedFile> {
  const originalSize = file.size;

  // Load image (and track URL for cleanup)
  const [img, objectUrl] = await loadImageFromFile(file);
  URL.revokeObjectURL(objectUrl); // We have the img element now, URL can be freed

  const originalWidth = img.width;
  const originalHeight = img.height;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  // 1. Try backend compression first (highest visual quality via MozJPEG / pngquant)
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', ext); // Preserve output format: JPEG -> JPEG, PNG -> PNG, etc.

    if (options.mode === 'target' && options.targetSizeKB) {
      formData.append('targetSizeKB', options.targetSizeKB.toString());
    } else if (options.mode === 'quality' && options.quality) {
      formData.append('quality', options.quality.toString());
    } else if (options.mode === 'percentage' && options.scalePercent) {
      formData.append('scalePercent', options.scalePercent.toString());
      formData.append('quality', '82');
    }

    const res = await fetch(`${BACKEND_API_URL}/compress-image`, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const outputBlob = await res.blob();
      const outputWidth = parseInt(res.headers.get('x-compressed-width') || '0') || originalWidth;
      const outputHeight = parseInt(res.headers.get('x-compressed-height') || '0') || originalHeight;
      const qualityUsed = parseInt(res.headers.get('x-quality-used') || '82');
      const dimensionsReduced = res.headers.get('x-dimensions-reduced') === 'true';
      const psnr = parseFloat(res.headers.get('x-psnr') || '0');
      const backendScore = parseInt(res.headers.get('x-visual-quality-score') || '0');

      const qualityScore = backendScore > 0 ? backendScore : calculateQualityScore(
        originalSize,
        outputBlob.size,
        qualityUsed / 100,
        dimensionsReduced
      );

      return {
        originalName: file.name,
        originalSize,
        compressedSize: outputBlob.size,
        compressedUrl: URL.createObjectURL(outputBlob),
        compressedBlob: outputBlob,
        qualityUsed,
        dimensions: { width: outputWidth, height: outputHeight },
        originalDimensions: { width: originalWidth, height: originalHeight },
        mimeType: res.headers.get('Content-Type') || file.type,
        qualityScore,
        psnr: psnr > 0 ? psnr : undefined
      };
    }
    console.warn('Backend responded with error, falling back to browser-side compression.');
  } catch (err) {
    console.warn('Backend is offline/unreachable. Falling back to browser-side compression:', err);
  }

  // 2. Client-side browser fallback (when backend is offline)
  let outputBlob: Blob;
  let qualityUsed: number;
  let outputWidth = originalWidth;
  let outputHeight = originalHeight;
  let dimensionsReduced = false;

  // ── Determine output MIME type ──────────────────────────────────────────────
  // For PNGs: we check transparency first. If no transparency, JPEG is better.
  // For everything else: JPEG unless it's already WebP/AVIF.
  let mimeType: string;
  const isPngInput = file.type === 'image/png' || ext === 'png';
  const isWebPInput = file.type === 'image/webp' || ext === 'webp';

  // Quick canvas to check transparency
  const [checkCanvas, checkCtx] = createCanvas(
    Math.min(originalWidth, 400),
    Math.min(originalHeight, 400)
  );
  checkCtx.drawImage(img, 0, 0, checkCanvas.width, checkCanvas.height);
  const transparent = isPngInput ? hasTransparency(checkCanvas, checkCtx) : false;

  if (transparent) {
    mimeType = 'image/png';
  } else if (isWebPInput && options.mode !== 'target') {
    mimeType = 'image/webp';
  } else {
    mimeType = 'image/jpeg'; // Best compression for target-size mode
  }

  // ── Mode: Quality ────────────────────────────────────────────────────────────
  if (options.mode === 'quality') {
    const [canvas, ctx] = createCanvas(originalWidth, originalHeight);
    drawImageToContext(ctx, img, originalWidth, originalHeight);
    qualityUsed = (options.quality ?? 75) / 100;
    outputBlob = await canvasToBlob(canvas, mimeType, qualityUsed);
  }

  // ── Mode: Percentage Scale ───────────────────────────────────────────────────
  else if (options.mode === 'percentage') {
    const scale = (options.scalePercent ?? 80) / 100;
    outputWidth = Math.round(originalWidth * scale);
    outputHeight = Math.round(originalHeight * scale);

    const [canvas, ctx] = createCanvas(outputWidth, outputHeight);
    drawImageToContext(ctx, img, outputWidth, outputHeight);

    if (scale < 0.9) {
      applySharpening(canvas, ctx, 0.3);
      dimensionsReduced = true;
    }

    qualityUsed = 0.82;
    outputBlob = await canvasToBlob(canvas, mimeType, qualityUsed);
  }

  // ── Mode: Target Size (Binary Search) ───────────────────────────────────────
  else {
    const targetKB = options.targetSizeKB ?? 50;
    const targetBytes = targetKB * 1024;

    // ── Phase 1: Search quality at original dimensions ────────────────────────
    const [canvas1, ctx1] = createCanvas(originalWidth, originalHeight);
    const result1 = await binarySearchQuality(
      canvas1, ctx1, img,
      originalWidth, originalHeight,
      mimeType, targetBytes,
      COMPRESSION_CONFIG.QUALITY_SEARCH_STEPS
    );

    if (result1) {
      // Found a fitting blob at original dimensions — best case scenario
      outputBlob = result1.blob;
      qualityUsed = result1.quality;
      outputWidth = originalWidth;
      outputHeight = originalHeight;
    } else {
      // ── Phase 2: Gradually reduce dimensions and re-search ─────────────────
      // Start at 95% and go down by 5% per step (much more gradual than original 10%)
      let scale = 1 - COMPRESSION_CONFIG.SCALE_STEP;
      let foundResult: { blob: Blob; quality: number } | null = null;

      while (scale >= COMPRESSION_CONFIG.MIN_SCALE) {
        const w = Math.round(originalWidth * scale);
        const h = Math.round(originalHeight * scale);

        const [scaleCanvas, scaleCtx] = createCanvas(w, h);
        const scaleResult = await binarySearchQuality(
          scaleCanvas, scaleCtx, img,
          w, h, mimeType, targetBytes,
          COMPRESSION_CONFIG.SCALE_QUALITY_STEPS
        );

        if (scaleResult) {
          outputWidth = w;
          outputHeight = h;
          dimensionsReduced = true;
          foundResult = scaleResult;

          // Apply sharpening to counteract downscale blur
          applySharpening(scaleCanvas, scaleCtx, Math.min(0.5, 0.2 + (1 - scale)));
          // Re-encode after sharpening (sharpening changes pixel data)
          const sharpenedBlob = await canvasToBlob(scaleCanvas, mimeType, scaleResult.quality);
          if (sharpenedBlob.size <= targetBytes) {
            foundResult = { blob: sharpenedBlob, quality: scaleResult.quality };
          }
          break;
        }

        scale -= COMPRESSION_CONFIG.SCALE_STEP;
      }

      if (foundResult) {
        outputBlob = foundResult.blob;
        qualityUsed = foundResult.quality;
      } else {
        // Absolute fallback — smallest possible
        outputWidth = Math.round(originalWidth * COMPRESSION_CONFIG.MIN_SCALE);
        outputHeight = Math.round(originalHeight * COMPRESSION_CONFIG.MIN_SCALE);
        dimensionsReduced = true;
        const [fallbackCanvas, fallbackCtx] = createCanvas(outputWidth, outputHeight);
        drawImageToContext(fallbackCtx, img, outputWidth, outputHeight);
        qualityUsed = COMPRESSION_CONFIG.MIN_QUALITY_JPEG;
        outputBlob = await canvasToBlob(fallbackCanvas, mimeType, qualityUsed);
      }
    }
  }

  const qualityScore = calculateQualityScore(
    originalSize,
    outputBlob.size,
    qualityUsed,
    dimensionsReduced
  );

  return {
    originalName: file.name,
    originalSize,
    compressedSize: outputBlob.size,
    compressedUrl: URL.createObjectURL(outputBlob),
    compressedBlob: outputBlob,
    qualityUsed: Math.round(qualityUsed * 100),
    dimensions: { width: Math.round(outputWidth), height: Math.round(outputHeight) },
    originalDimensions: { width: originalWidth, height: originalHeight },
    mimeType,
    qualityScore,
  };
}

/**
 * Compresses multiple files sequentially.
 */
export async function compressFiles(
  files: File[],
  options: CompressionOptions,
  onProgress?: (done: number, total: number) => void
): Promise<CompressedFile[]> {
  const results: CompressedFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const result = await compressSingleImage(files[i], options);
    results.push(result);
    onProgress?.(i + 1, files.length);
  }
  return results;
}
