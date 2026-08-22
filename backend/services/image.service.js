// ============================================================
// CompressKro Backend — Image Service v3.5
// Super-high-quality image processing service using Sharp
// with MozJPEG, pngquant (libimagequant palette), and libwebp.
// Enforces quality floor, coarse-then-fine scaling, and BPP.
// ============================================================

const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');


/**
 * Maps a file format extension or mimetype to a standard sharp format string.
 */
function normalizeFormat(format) {
  if (!format) return 'jpeg';
  const f = format.toLowerCase();
  if (f === 'jpg' || f === 'jpeg' || f === 'image/jpeg') return 'jpeg';
  if (f === 'png' || f === 'image/png') return 'png';
  if (f === 'webp' || f === 'image/webp') return 'webp';
  if (f === 'avif' || f === 'image/avif') return 'avif';
  if (f === 'heic' || f === 'heif' || f === 'image/heic' || f === 'image/heif') return 'heif';
  if (f === 'tiff' || f === 'tif' || f === 'image/tiff') return 'tiff';
  if (f === 'gif' || f === 'image/gif') return 'gif';
  if (f === 'pdf' || f === 'application/pdf') return 'pdf';
  return 'jpeg'; // Default fallback
}

/**
 * Encodes a sharp instance with the highest quality options for the format.
 * Dynamically sets chroma subsampling based on whether the image is classified as text-heavy.
 */
function applyFormatSettings(sharpInstance, format, quality, isTextHeavy = false) {
  const norm = normalizeFormat(format);
  const q = Math.max(1, Math.min(100, Math.round(quality)));
  const chroma = isTextHeavy ? '4:4:4' : '4:2:0';

  switch (norm) {
    case 'jpeg':
      return sharpInstance.jpeg({
        quality: q,
        mozjpeg: true,
        progressive: true,
        chromaSubsampling: chroma,
        trellisQuantisation: true,
        overshootDeringing: true,
        optimizeScans: true
      });
    case 'png':
      // palette: true turns on libimagequant quantization (equivalent to pngquant)
      return sharpInstance.png({
        palette: true,
        quality: q,
        compressionLevel: 9,
        effort: 8
      });
    case 'webp':
      return sharpInstance.webp({
        quality: q,
        effort: 6,
        lossless: false
      });
    case 'avif':
      return sharpInstance.avif({
        quality: q,
        effort: 4,
        chromaSubsampling: chroma
      });
    case 'heif':
      return sharpInstance.heif({
        quality: q,
        compression: 'hevc',
        effort: 4
      });
    case 'tiff':
      return sharpInstance.tiff({
        quality: q,
        compression: 'lzw'
      });
    case 'gif':
      return sharpInstance.gif({
        colours: Math.max(2, Math.min(256, Math.round((q / 100) * 256)))
      });
    default:
      return sharpInstance.jpeg({ quality: q, mozjpeg: true, chromaSubsampling: chroma });
  }
}

/**
 * Analyzes an image and returns compression-relevant technical details.
 * Auto-applies EXIF rotation to correctly report rotated dimensions.
 */
async function analyzeImageMetadata(buffer) {
  try {
    const s = sharp(buffer).rotate();
    const metadata = await s.metadata();
    
    const format = metadata.format || 'unknown';
    let width = metadata.width || 0;
    let height = metadata.height || 0;
    const hasAlpha = metadata.hasAlpha || false;
    const size = buffer.length;

    // Swap reported width/height if EXIF orientation is rotated 90 or 270 degrees
    const orientation = metadata.orientation || 0;
    if (orientation >= 5 && orientation <= 8) {
      const tmp = width;
      width = height;
      height = tmp;
    }
    
    // Classify strictly by categories that change compression decisions
    let imageType = 'is-photo';
    let recommendation = '';
    
    if (hasAlpha) {
      imageType = 'has-transparency';
      recommendation = 'Transparent image. Preserving PNG, WebP, or AVIF format is required to maintain the alpha channel.';
    } else if (format === 'png' || metadata.space === 'b-w' || metadata.channels === 1) {
      imageType = 'is-text-heavy/document';
      recommendation = 'Opaque PNG / text-heavy document. PNG provides perfect sharpness for text, while WebP Lossless or AVIF is a great alternative.';
    } else {
      imageType = 'is-photo';
      recommendation = 'Natural photo style. AVIF or WebP next-gen format can provide superior quality at significantly lower file sizes.';
    }

    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    const aspect = divisor > 0 ? `${width / divisor}:${height / divisor}` : '1:1';

    return {
      format: format.toUpperCase(),
      width,
      height,
      aspectRatio: aspect,
      fileSize: size,
      hasTransparency: hasAlpha,
      animated: metadata.pages > 1,
      colorDepth: metadata.depth || 8,
      colorSpace: metadata.space || 'srgb',
      hasProfile: !!metadata.icc,
      imageType,
      recommendation,
      metadata: {
        density: metadata.density,
        hasExif: !!metadata.exif,
        hasXmp: !!metadata.xmp
      }
    };
  } catch (err) {
    console.error('Metadata analysis failed:', err);
    throw new Error('Unable to analyze image file. It may be corrupted or in an unsupported format.');
  }
}

/**
 * Calculates a Peak Signal-to-Noise Ratio (PSNR) and derives a visual quality score (0-100).
 * Compares raw pixel values between the original (resized to match) and compressed buffers in sRGB.
 * Both pipelines are rotated first to maintain sensor-agnostic correct rotation visual matching.
 */
async function calculatePerceptualSimilarity(originalBuffer, compressedBuffer) {
  try {
    const compMeta = await sharp(compressedBuffer).metadata();
    const compWidth = compMeta.width || 256;
    const compHeight = compMeta.height || 256;

    let targetW = compWidth;
    let targetH = compHeight;
    const maxSide = Math.max(compWidth, compHeight);
    if (maxSide > 256) {
      const ratio = 256 / maxSide;
      targetW = Math.round(compWidth * ratio);
      targetH = Math.round(compHeight * ratio);
    }

    const compImage = sharp(compressedBuffer).rotate();
    const { data: compData } = await compImage
      .resize(targetW, targetH, { kernel: 'lanczos3' })
      .toColourspace('srgb')
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const origImage = sharp(originalBuffer).rotate();
    const { data: origData } = await origImage
      .resize(targetW, targetH, { kernel: 'lanczos3' })
      .toColourspace('srgb')
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const len = Math.min(compData.length, origData.length);
    if (len === 0) return { psnr: 0, score: 100 };

    let sumSquaredError = 0;
    for (let i = 0; i < len; i++) {
      const diff = origData[i] - compData[i];
      sumSquaredError += diff * diff;
    }

    const mse = sumSquaredError / len;
    if (mse === 0) return { psnr: 99, score: 100 };

    const psnr = 10 * Math.log10((255 * 255) / mse);

    // Map PSNR to 0-100 visual quality estimate score
    let score = 0;
    if (psnr >= 40) {
      score = 95 + ((psnr - 40) / 10) * 5;
    } else if (psnr >= 32) {
      score = 80 + ((psnr - 32) / 8) * 15;
    } else if (psnr >= 25) {
      score = 60 + ((psnr - 25) / 7) * 20;
    } else {
      score = Math.max(10, (psnr / 25) * 60);
    }

    return {
      psnr: parseFloat(psnr.toFixed(2)),
      score: Math.min(100, Math.round(score))
    };
  } catch (err) {
    console.error('Error calculating perceptual similarity:', err);
    return { psnr: 0, score: 90 };
  }
}

/**
 * Lightweight encoder used during binary search trial steps.
 * Bypasses CPU-heavy rate-distortion optimization (trellis quantization & scan optimization)
 * to provide a ~20x speedup during intermediate parameter discovery.
 */
function applyFastFormatSettings(sharpInstance, format, quality, isTextHeavy = false) {
  const norm = normalizeFormat(format);
  const q = Math.max(1, Math.min(100, Math.round(quality)));
  const chroma = isTextHeavy ? '4:4:4' : '4:2:0';

  switch (norm) {
    case 'jpeg':
      return sharpInstance.jpeg({
        quality: q,
        mozjpeg: false,
        chromaSubsampling: chroma,
      });
    case 'png':
      return sharpInstance.png({
        quality: q,
        compressionLevel: 6,
        effort: 1
      });
    case 'webp':
      return sharpInstance.webp({
        quality: q,
        effort: 1,
        lossless: false
      });
    case 'avif':
      return sharpInstance.avif({
        quality: q,
        effort: 1,
        chromaSubsampling: chroma
      });
    case 'heif':
      return sharpInstance.heif({
        quality: q,
        effort: 1
      });
    default:
      return sharpInstance.jpeg({ quality: q, chromaSubsampling: chroma });
  }
}

/**
 * Helper to perform an 8-step quality binary search on a decoded raw pixel buffer.
 * Cuts redundant decodes and resizes per search iteration.
 */
async function runBinarySearchOnRaw(
  rawPixels,
  rawInfo,
  format,
  targetBytes,
  qualityFloor,
  isTextHeavy,
  isPhoto,
  isMinScale
) {
  let lowQ = qualityFloor;
  let highQ = 96;
  let bestQualityFound = null;

  // 8 binary search steps with fast trial encoding
  for (let step = 0; step < 8; step++) {
    const midQ = Math.floor((lowQ + highQ) / 2);
    
    let testBuf;
    try {
      const s = sharp(rawPixels, {
        raw: {
          width: rawInfo.width,
          height: rawInfo.height,
          channels: rawInfo.channels
        }
      });
      testBuf = await applyFastFormatSettings(s, format, midQ, isTextHeavy).toBuffer();
    } catch (err) {
      const s = sharp(rawPixels, {
        raw: {
          width: rawInfo.width,
          height: rawInfo.height,
          channels: rawInfo.channels
        }
      });
      testBuf = await s.jpeg({ quality: midQ }).toBuffer();
    }

    // Bits-Per-Pixel (BPP) Guardrail calculation
    const bpp = (testBuf.length * 8) / (rawInfo.width * rawInfo.height);
    const passesBppGuardrail = !isPhoto || isMinScale || bpp >= 0.32;

    if (testBuf.length <= targetBytes && passesBppGuardrail) {
      bestQualityFound = midQ;
      lowQ = midQ + 1; // Try higher quality
    } else {
      highQ = midQ - 1; // Need smaller size or higher BPP
    }

    if (highQ < lowQ) break;
  }

  if (bestQualityFound !== null) {
    // Re-encode ONLY the winning result once with FULL high-quality MozJPEG settings
    const s = sharp(rawPixels, {
      raw: {
        width: rawInfo.width,
        height: rawInfo.height,
        channels: rawInfo.channels
      }
    });
    const finalBuf = await applyFormatSettings(s, format, bestQualityFound, isTextHeavy).toBuffer();
    return { buffer: finalBuf, quality: bestQualityFound };
  }

  return null;
}

/**
 * Compresses an image buffer using high-quality sharp operations
 * with format-specific settings and binary search for target sizes.
 * Optimizes scale reductions using a coarse-then-fine search boundary sweep.
 */
async function compressImage(inputBuffer, targetSizeKB, quality = 82, format = null, scalePercent = null) {
  const analysis = await analyzeImageMetadata(inputBuffer);
  const isTextHeavy = analysis.imageType === 'is-text-heavy/document';
  const hasAlpha = analysis.hasTransparency;
  const isPhoto = analysis.imageType === 'is-photo';
  const inputFormat = format || analysis.format.toLowerCase();

  const originalWidth = analysis.width;
  const originalHeight = analysis.height;
  const targetBytes = targetSizeKB ? targetSizeKB * 1024 : null;

  // === PERFORMANCE FAST PATH ===
  if (targetBytes && inputBuffer.length <= targetBytes) {
    const isFormatConversionRequested = format && normalizeFormat(format) !== normalizeFormat(analysis.format);
    if (isFormatConversionRequested) {
      // Re-encode once at high quality in the requested format
      const s = sharp(inputBuffer).rotate();
      const converted = await applyFormatSettings(s, inputFormat, 90, isTextHeavy).toBuffer();
      const similarity = await calculatePerceptualSimilarity(inputBuffer, converted);
      return {
        buffer: converted,
        format: inputFormat,
        width: originalWidth,
        height: originalHeight,
        qualityUsed: 90,
        dimensionsReduced: false,
        psnr: similarity.psnr,
        visualQualityScore: similarity.score
      };
    } else {
      // Return original as-is
      return {
        buffer: inputBuffer,
        format: analysis.format.toLowerCase(),
        width: originalWidth,
        height: originalHeight,
        qualityUsed: 100,
        dimensionsReduced: false,
        psnr: 99,
        visualQualityScore: 100
      };
    }
  }

  if (targetBytes) {
    const qualityFloor = 40; // Floor threshold to prevent JPEG blocking artifacts
    
    let workingBuffer = inputBuffer;
    let workingWidth = originalWidth;
    let workingHeight = originalHeight;
    let prePassScale = 1.0;

    if (originalWidth > 4000 || originalHeight > 4000) {
      prePassScale = Math.min(4000 / originalWidth, 4000 / originalHeight);
      workingWidth = Math.round(originalWidth * prePassScale);
      workingHeight = Math.round(originalHeight * prePassScale);
      workingBuffer = await sharp(inputBuffer)
        .rotate()
        .resize(workingWidth, workingHeight, { kernel: 'lanczos3' })
        .toBuffer();
    }

    // Calculate smart initial scale estimation based on target bytes vs original file size
    const sizeRatio = targetBytes / inputBuffer.length;
    const estimatedScale = Math.min(1.0, Math.max(0.25, Math.sqrt(sizeRatio) * 1.25));

    // Streamlined coarse scale sweep (5 key checkpoints)
    const allCoarseScales = [1.0, 0.75, 0.5, 0.35, 0.25];
    const coarseScales = allCoarseScales.filter(s => s <= estimatedScale || (s > estimatedScale && s === (allCoarseScales.filter(x => x >= estimatedScale).pop() || 1.0)));
    if (coarseScales.length === 0) coarseScales.push(0.25);

    for (let i = 0; i < coarseScales.length; i++) {
      const coarseScale = coarseScales[i];
      const w = Math.round(workingWidth * coarseScale);
      const h = Math.round(workingHeight * coarseScale);

      // Decode and Resize once for this scale level
      let instance = sharp(workingBuffer).rotate();
      if (coarseScale < 1.0) {
        instance = instance.resize(w, h, { kernel: 'lanczos3' });
        // Subtle sharpen to counteract scaling blur
        instance = instance.sharpen({ sigma: 0.5, m1: 0.15, m2: 15 });
      }

      const { data: rawPixels, info: rawInfo } = await instance
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Run binary search at this scale level
      const binarySearchResult = await runBinarySearchOnRaw(
        rawPixels,
        rawInfo,
        inputFormat,
        targetBytes,
        qualityFloor,
        isTextHeavy,
        isPhoto,
        coarseScale === 0.25
      );

      if (binarySearchResult) {
        // Since this coarse scale works, let's see if we can refine the scale to a higher resolution
        // if this isn't the first step (scale 1.0)
        if (coarseScale < 1.0 && i > 0) {
          const prevCoarseScale = coarseScales[i - 1];
          // Try fine scales between coarseScale and prevCoarseScale (largest to smallest)
          const fineScales = [
            coarseScale + 0.075,
            coarseScale + 0.05,
            coarseScale + 0.025
          ];

          for (const fineScale of fineScales) {
            if (fineScale >= prevCoarseScale) continue;
            const fw = Math.round(workingWidth * fineScale);
            const fh = Math.round(workingHeight * fineScale);

            let fineInstance = sharp(workingBuffer).rotate();
            fineInstance = fineInstance.resize(fw, fh, { kernel: 'lanczos3' });
            fineInstance = fineInstance.sharpen({ sigma: 0.5, m1: 0.15, m2: 15 });

            const { data: fRaw, info: fInfo } = await fineInstance
              .raw()
              .toBuffer({ resolveWithObject: true });

            const fineSearchResult = await runBinarySearchOnRaw(
              fRaw,
              fInfo,
              inputFormat,
              targetBytes,
              qualityFloor,
              isTextHeavy,
              isPhoto,
              false
            );

            if (fineSearchResult) {
              const similarity = await calculatePerceptualSimilarity(inputBuffer, fineSearchResult.buffer);
              return {
                buffer: fineSearchResult.buffer,
                format: inputFormat,
                width: fw,
                height: fh,
                qualityUsed: fineSearchResult.quality,
                dimensionsReduced: true,
                psnr: similarity.psnr,
                visualQualityScore: similarity.score
              };
            }
          }
        }

        // Return the coarse scale result
        const similarity = await calculatePerceptualSimilarity(inputBuffer, binarySearchResult.buffer);
        return {
          buffer: binarySearchResult.buffer,
          format: inputFormat,
          width: w,
          height: h,
          qualityUsed: binarySearchResult.quality,
          dimensionsReduced: coarseScale < 1.0 || prePassScale < 1.0,
          psnr: similarity.psnr,
          visualQualityScore: similarity.score
        };
      }
    }

    // Absolute fallback: if minScale with qualityFloor still doesn't fit,
    // allow quality to drop below floor [5, qualityFloor] at minScale to meet the hard size limit
    const fallbackScale = 0.25;
    const fw = Math.round(workingWidth * fallbackScale);
    const fh = Math.round(workingHeight * fallbackScale);
    let fallbackInstance = sharp(workingBuffer).rotate().resize(fw, fh, { kernel: 'lanczos3' });
    const { data: rawPixels, info: rawInfo } = await fallbackInstance
      .raw()
      .toBuffer({ resolveWithObject: true });

    let lowQ = 5;
    let highQ = qualityFloor;
    let fallbackBuffer = null;
    let fallbackQ = 5;

    for (let step = 0; step < 8; step++) {
      const midQ = Math.floor((lowQ + highQ) / 2);
      const testBuf = await applyFormatSettings(
        sharp(rawPixels, { raw: { width: rawInfo.width, height: rawInfo.height, channels: rawInfo.channels } }),
        inputFormat,
        midQ,
        isTextHeavy
      ).toBuffer();

      if (testBuf.length <= targetBytes) {
        fallbackBuffer = testBuf;
        fallbackQ = midQ;
        lowQ = midQ + 1;
      } else {
        highQ = midQ - 1;
      }
      if (highQ < lowQ) break;
    }

    if (!fallbackBuffer) {
      fallbackBuffer = await applyFormatSettings(
        sharp(rawPixels, { raw: { width: rawInfo.width, height: rawInfo.height, channels: rawInfo.channels } }),
        inputFormat,
        5,
        isTextHeavy
      ).toBuffer();
      fallbackQ = 5;
    }

    const similarity = await calculatePerceptualSimilarity(inputBuffer, fallbackBuffer);
    return {
      buffer: fallbackBuffer,
      format: inputFormat,
      width: fw,
      height: fh,
      qualityUsed: fallbackQ,
      dimensionsReduced: true,
      psnr: similarity.psnr,
      visualQualityScore: similarity.score
    };
  }

  // Non-target size mode (Direct Quality Mode / Percentage Scale Mode)
  let instance = sharp(inputBuffer).rotate();
  let w = originalWidth;
  let h = originalHeight;
  let dimensionsReduced = false;

  if (scalePercent && scalePercent < 100) {
    const scale = scalePercent / 100;
    w = Math.round(originalWidth * scale);
    h = Math.round(originalHeight * scale);
    instance = instance.resize(w, h, { kernel: 'lanczos3' });
    // Subtle sharpen to counteract scaling blur
    instance = instance.sharpen({ sigma: 0.5, m1: 0.15, m2: 15 });
    dimensionsReduced = true;
  }

  let finalBuffer;
  try {
    finalBuffer = await applyFormatSettings(instance, inputFormat, quality, isTextHeavy).toBuffer();
  } catch (err) {
    finalBuffer = await instance.jpeg({ quality, mozjpeg: true }).toBuffer();
  }

  const similarity = await calculatePerceptualSimilarity(inputBuffer, finalBuffer);

  return {
    buffer: finalBuffer,
    format: inputFormat,
    width: w,
    height: h,
    qualityUsed: quality,
    dimensionsReduced,
    psnr: similarity.psnr,
    visualQualityScore: similarity.score
  };
}

/**
 * Handles format conversion from any format to any target format.
 */
async function convertFormat(inputBuffer, targetFormat, quality = 90) {
  const norm = normalizeFormat(targetFormat);
  if (norm === 'pdf') {
    const meta = await sharp(inputBuffer).rotate().metadata();
    const hasAlpha = meta.hasAlpha;
    const formatToUse = hasAlpha ? 'png' : 'jpeg';

    const s = sharp(inputBuffer).rotate();
    let imgBuffer;
    if (formatToUse === 'png') {
      imgBuffer = await s.png({ quality }).toBuffer();
    } else {
      imgBuffer = await s.jpeg({ quality, mozjpeg: true }).toBuffer();
    }

    const rotatedMeta = await sharp(imgBuffer).metadata();
    const width = rotatedMeta.width || meta.width;
    const height = rotatedMeta.height || meta.height;

    const dpi = rotatedMeta.density || meta.density || 150;
    const pageW = (width / dpi) * 72;
    const pageH = (height / dpi) * 72;

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([pageW, pageH]);
    
    let embeddedImg;
    if (formatToUse === 'png') {
      embeddedImg = await pdfDoc.embedPng(imgBuffer);
    } else {
      embeddedImg = await pdfDoc.embedJpg(imgBuffer);
    }

    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: pageW,
      height: pageH
    });

    const pdfBytes = await pdfDoc.save();
    return {
      buffer: Buffer.from(pdfBytes),
      format: 'pdf'
    };
  }

  const s = sharp(inputBuffer).rotate();
  const outputBuffer = await applyFormatSettings(s, targetFormat, quality).toBuffer();
  return {
    buffer: outputBuffer,
    format: norm
  };
}

module.exports = {
  compressImage,
  convertFormat,
  analyzeImageMetadata
};
