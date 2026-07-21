// ============================================================
// CompressKro — Image Analysis Utilities
// ============================================================

import type { ImageAnalysis } from '../types';
import { ANALYSIS_CONFIG, QUALITY_SCORE_CONFIG, BACKEND_API_URL } from '../constants';
import { createCanvas, loadImageFromFile, hasTransparency, getAspectRatioString } from './canvas';

/**
 * Analyzes an uploaded image file and returns rich metadata
 * including dimensions, transparency, compression potential, and
 * intelligent format recommendations.
 */
export async function analyzeImage(file: File): Promise<ImageAnalysis> {
  // 1. Try Backend Analysis first for rich EXIF/profile data and classification
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${BACKEND_API_URL}/analyze-image`, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      
      // Calculate compression potential values based on type
      let pct = 50;
      if (data.imageType.includes('Photo')) pct = 75;
      if (data.imageType.includes('Screenshot')) pct = 60;
      if (data.imageType.includes('Transparent')) pct = 40;
      
      const potential: ImageAnalysis['compressionPotential'] = 
        pct >= 60 ? 'high' : pct >= 30 ? 'medium' : 'low';

      const estFormat = data.format.toLowerCase() === 'png' ? 'png' : 
                        data.format.toLowerCase() === 'webp' ? 'webp' : 'jpeg';

      // AVIF is our top recommendation for natural photos & modern browsers, WebP for general web compatibility.
      const recFormat = data.hasTransparency ? 'WEBP' : 'AVIF';

      return {
        width: data.width,
        height: data.height,
        aspectRatio: data.aspectRatio,
        fileSize: data.fileSize,
        hasTransparency: data.hasTransparency,
        estimatedFormat: estFormat,
        compressionPotential: potential,
        compressionPotentialPct: pct,
        recommendedFormat: recFormat,
        recommendation: `Detected as: ${data.imageType}. ${data.recommendation}`,
      };
    }
  } catch (err) {
    console.warn('Backend image analysis failed/offline. Falling back to local browser analysis:', err);
  }

  // 2. Client-side browser analysis fallback
  const [img, url] = await loadImageFromFile(file);
  const { width, height } = img;
  URL.revokeObjectURL(url);

  const [canvas, ctx] = createCanvas(width, height);
  ctx.drawImage(img, 0, 0);

  const transparency = hasTransparency(canvas, ctx);
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const isPng = ext === 'png' || file.type === 'image/png';

  // Estimate compression potential based on file type and size
  const pixelCount = width * height;
  const rawBytesEstimate = pixelCount * 3; // RGB
  const currentRatio = file.size / rawBytesEstimate;

  let compressionPotentialPct: number;
  let recommendedFormat: string;
  let recommendation: string;

  if (isPng && !transparency) {
    // PNG without transparency — JPEG will be much smaller
    compressionPotentialPct = Math.min(85, Math.round((1 - currentRatio * 3) * 100 + 50));
    recommendedFormat = 'JPEG';
    recommendation = `This PNG has no transparency. Converting to JPEG can reduce size by approximately ${compressionPotentialPct}%.`;
  } else if (isPng && transparency) {
    // Must keep PNG for transparency
    compressionPotentialPct = Math.min(50, Math.round((1 - currentRatio * 2) * 100 + 20));
    recommendedFormat = 'PNG';
    recommendation = `This PNG has transparency — keeping PNG format to preserve it. ~${compressionPotentialPct}% size reduction possible.`;
  } else if (ext === 'webp') {
    compressionPotentialPct = Math.min(40, Math.round((1 - currentRatio * 4) * 100 + 10));
    recommendedFormat = 'WebP';
    recommendation = `Already in WebP format (excellent). ~${compressionPotentialPct}% additional reduction possible via quality tuning.`;
  } else {
    // JPEG or other
    compressionPotentialPct = Math.min(70, Math.max(10, Math.round((1 - currentRatio * 5) * 100 + 30)));
    recommendedFormat = 'JPEG';
    recommendation = `~${compressionPotentialPct}% size reduction possible while maintaining visual quality.`;
  }

  compressionPotentialPct = Math.max(5, Math.min(95, compressionPotentialPct));

  const compressionPotential: ImageAnalysis['compressionPotential'] =
    compressionPotentialPct >= ANALYSIS_CONFIG.HIGH_POTENTIAL_THRESHOLD * 100
      ? 'high'
      : compressionPotentialPct >= ANALYSIS_CONFIG.MEDIUM_POTENTIAL_THRESHOLD * 100
      ? 'medium'
      : 'low';

  const estimatedFormat: ImageAnalysis['estimatedFormat'] =
    isPng && transparency ? 'png' : ext === 'webp' ? 'webp' : 'jpeg';

  return {
    width,
    height,
    aspectRatio: getAspectRatioString(width, height),
    fileSize: file.size,
    hasTransparency: transparency,
    estimatedFormat,
    compressionPotential,
    compressionPotentialPct,
    recommendedFormat,
    recommendation,
  };
}

/**
 * Computes a visual quality score (0–100) based on:
 * - The quality parameter used (higher = better)
 * - The achieved size reduction (less reduction = better preserved quality)
 * - Whether dimensions were reduced
 */
export function calculateQualityScore(
  originalSize: number,
  compressedSize: number,
  qualityUsed: number, // 0–1 float
  dimensionsReduced: boolean
): number {
  // Quality component: 0–1 → weighted contribution
  const qualityComponent = qualityUsed * QUALITY_SCORE_CONFIG.QUALITY_WEIGHT * 100;

  // Size ratio component: 1.0 means no size change, lower means more compressed
  const sizeRatio = compressedSize / originalSize;
  // Maps sizeRatio 0.05→1.0 onto a "quality score" 40→95
  const sizeComponent = Math.min(95, Math.max(40, sizeRatio * 80)) * QUALITY_SCORE_CONFIG.SIZE_WEIGHT;

  // Penalty if dimensions were forcibly reduced
  const dimensionPenalty = dimensionsReduced ? 8 : 0;

  const score = Math.round(qualityComponent + sizeComponent - dimensionPenalty);
  return Math.max(0, Math.min(100, score));
}
