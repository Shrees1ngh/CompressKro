// ============================================================
// CompressKro Backend — PDF Service v2.0
// Advanced PDF analyzer and image-recompression optimizer.
// Optimizes stream containers, re-encodes rasters with Sharp,
// and preserves all search vector text, fonts, and metadata.
// ============================================================

const { PDFDocument, PDFName, PDFDict, PDFRawStream } = require('pdf-lib');
const sharp = require('sharp');

/**
 * Determines profiles and settings based on user-supplied parameters
 */
function getCompressionParams(level, targetSizeKB, originalSize) {
  let quality = 65;
  let scale = 0.75;
  let profile = 'balanced';

  if (targetSizeKB && originalSize > 0) {
    const ratio = (targetSizeKB * 1024) / originalSize;
    if (ratio < 0.35) {
      profile = 'smallest';
    } else if (ratio < 0.7) {
      profile = 'balanced';
    } else {
      profile = 'best';
    }
  } else if (level) {
    profile = level.toLowerCase();
  }

  if (profile === 'smallest') {
    quality = 40;
    scale = 0.5;
  } else if (profile === 'best') {
    quality = 85;
    scale = 0.9;
  } else {
    quality = 65;
    scale = 0.75;
  }

  return { quality, scale, profile };
}

/**
 * Performs detailed analysis of a PDF buffer before compression.
 */
async function analyzePdfDoc(pdfDoc, bufferLength) {
  let imageCount = 0;
  let scannedPagesCount = 0;
  let textPagesCount = 0;
  const fontNames = new Set();
  let hasEncryption = pdfDoc.isEncrypted;

  // 1. Enumerate images and fonts from indirect objects
  pdfDoc.context.enumerateUnindirectObjects().forEach(([_, obj]) => {
    if (obj instanceof PDFRawStream) {
      const subtype = obj.dict.get(PDFName.of('Subtype'));
      if (subtype === PDFName.of('Image')) {
        imageCount++;
      }
    } else if (obj instanceof PDFDict) {
      const type = obj.get(PDFName.of('Type'));
      if (type === PDFName.of('Font')) {
        const baseFont = obj.get(PDFName.of('BaseFont'));
        if (baseFont) fontNames.add(baseFont.toString().replace(/^\//, ''));
      }
    }
  });

  // 2. Classify scanned vs text-heavy pages
  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const contentsRef = page.node.get(PDFName.of('Contents'));
    let hasText = false;
    if (contentsRef) {
      try {
        const contents = pdfDoc.context.lookup(contentsRef);
        const streams = Array.isArray(contents) ? contents : [contents];
        for (const stream of streams) {
          if (stream instanceof PDFRawStream) {
            const decoded = stream.contents;
            const textStr = new TextDecoder('utf-8', { fatal: false }).decode(decoded);
            if (textStr.includes('BT') && textStr.includes('ET')) {
              hasText = true;
              break;
            }
          }
        }
      } catch (err) {
        // Fallback to text-assumed on parsing issues
        hasText = true;
      }
    }
    if (hasText) {
      textPagesCount++;
    } else {
      scannedPagesCount++;
    }
  }

  const documentVersion = pdfDoc.context.header || '%PDF-1.4';

  return {
    pageCount: pages.length,
    scannedPages: scannedPagesCount,
    textPages: textPagesCount,
    imageCount,
    fontsPreserved: Array.from(fontNames),
    encryption: hasEncryption ? 'Yes (Encrypted)' : 'None',
    documentVersion: documentVersion.replace(/^%/, '')
  };
}

/**
 * Advanced PDF compressor. Extracts, resizes, and re-compresses embedded
 * raster images using Sharp, keeping text layers and vector items intact.
 */
async function compressPdf(inputBuffer, level, targetSizeKB) {
  const startTime = Date.now();
  const originalSize = inputBuffer.length;
  
  // Load PDF with updateMetadata disabled to preserve bookmarks & links
  const pdfDoc = await PDFDocument.load(inputBuffer, { updateMetadata: false });
  
  // Analyze input
  const initialAnalysis = await analyzePdfDoc(pdfDoc, originalSize);

  // Setup compression profiles
  const { quality, scale, profile } = getCompressionParams(level, targetSizeKB, originalSize);

  let imagesOptimized = 0;
  const warnings = [];

  // Iterate over all objects to compress XObject images
  const indirectObjects = pdfDoc.context.enumerateUnindirectObjects();

  for (let i = 0; i < indirectObjects.length; i++) {
    const [ref, obj] = indirectObjects[i];
    if (!(obj instanceof PDFRawStream)) continue;

    const subtype = obj.dict.get(PDFName.of('Subtype'));
    if (subtype !== PDFName.of('Image')) continue;

    try {
      const width = obj.dict.get(PDFName.of('Width')).asNumber();
      const height = obj.dict.get(PDFName.of('Height')).asNumber();
      const filter = obj.dict.get(PDFName.of('Filter'));

      let sharpImg = null;
      let decodedBytes = null;

      try {
        decodedBytes = pdfDoc.context.decode(obj);
      } catch (decodeErr) {
        warnings.push(`Failed to decode image object at ref ${ref.toString()}: ${decodeErr.message}`);
        continue;
      }

      // Check if image has transparency (SMask)
      const hasSMask = obj.dict.has(PDFName.of('SMask'));

      if (filter === PDFName.of('DCTDecode')) {
        // Standard JPEG image
        sharpImg = sharp(Buffer.from(decodedBytes));
      } else if (filter === PDFName.of('FlateDecode')) {
        // Lossless raw pixel image
        const colorSpace = obj.dict.get(PDFName.of('ColorSpace'));
        let channels = 3;
        if (colorSpace === PDFName.of('DeviceGray')) channels = 1;
        if (colorSpace === PDFName.of('DeviceCMYK')) channels = 4;

        const expectedSize = width * height * channels;
        if (decodedBytes.length >= expectedSize) {
          sharpImg = sharp(Buffer.from(decodedBytes), {
            raw: { width, height, channels }
          });
        } else {
          // Fallback to normal loading if stream format is custom
          sharpImg = sharp(Buffer.from(decodedBytes));
        }
      }

      if (sharpImg) {
        // Apply scaling
        const targetW = Math.max(16, Math.round(width * scale));
        const targetH = Math.max(16, Math.round(height * scale));
        
        let processed = sharpImg.resize(targetW, targetH, { kernel: 'lanczos3' });

        let compressedBuffer;
        let embeddedImage;

        if (hasSMask) {
          // Preserve transparency by compressing as PNG
          compressedBuffer = await processed.png({ palette: true, quality }).toBuffer();
          embeddedImage = await pdfDoc.embedPng(compressedBuffer);
        } else {
          // Compress as high-efficiency JPEG
          compressedBuffer = await processed.jpeg({ quality, progressive: true, mozjpeg: true }).toBuffer();
          embeddedImage = await pdfDoc.embedJpg(compressedBuffer);
        }

        // Swap the original reference with the new compressed object reference
        const newImageObj = pdfDoc.context.lookup(embeddedImage.ref);
        pdfDoc.context.assign(ref, newImageObj);

        imagesOptimized++;
      }
    } catch (err) {
      warnings.push(`Image optimization error at ref ${ref.toString()}: ${err.message}`);
    }
  }

  // Save PDF using high-efficiency object stream optimizations
  const compressedBytes = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false
  });

  const compressionTime = Date.now() - startTime;

  return {
    buffer: compressedBytes,
    report: {
      originalSize,
      compressedSize: compressedBytes.length,
      savedPercent: Math.max(0, Math.round(((originalSize - compressedBytes.length) / originalSize) * 100)),
      pages: initialAnalysis.pageCount,
      imagesOptimized,
      metadataRemoved: false, // Preserved bookmarks and properties
      fontsPreserved: initialAnalysis.fontsPreserved.length,
      compressionTime,
      warnings
    }
  };
}

module.exports = {
  compressPdf,
  analyzePdfDoc
};
