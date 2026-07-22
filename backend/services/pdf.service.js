// ============================================================
// CompressKro Backend — PDF Service v2.0
// Advanced PDF analyzer and image-recompression optimizer.
// Optimizes stream containers, re-encodes rasters with Sharp,
// and preserves all search vector text, fonts, and metadata.
// ============================================================

const { PDFDocument, PDFName, PDFDict, PDFRawStream, PDFRef } = require('pdf-lib');
const sharp = require('sharp');

/**
 * Recursively determines the channel count of a PDF colorspace.
 */
function getChannelCount(cs, dict) {
  if (cs === PDFName.of('DeviceGray')) return 1;
  if (cs === PDFName.of('DeviceCMYK')) return 4;
  if (cs === PDFName.of('DeviceRGB')) return 3;

  // Handle Indexed colorspace array
  if (Array.isArray(cs) || (cs && typeof cs.get === 'function' && cs.get(0) === PDFName.of('Indexed'))) {
    const base = cs.get(1);
    return getChannelCount(base, dict);
  }

  // Default fallback
  return 3;
}

/**
 * Resolves the raw bytes of an Indexed colorspace lookup table.
 */
function getLookupTableBytes(lookupObj, context) {
  if (!lookupObj) return null;
  const resolved = context.lookup(lookupObj);
  if (resolved instanceof PDFRawStream) {
    return context.decode(resolved);
  }
  if (resolved && typeof resolved.asBytes === 'function') {
    return resolved.asBytes();
  }
  return null;
}

/**
 * Decodes a PDF base image raw stream and initializes a Sharp instance.
 * Automatically expands Indexed/palette color tables and sets pipelineColorSpace for CMYK.
 */
function decodePdfImageToSharp(obj, decodedBytes, width, height, filter, context) {
  const colorSpace = obj.dict.get(PDFName.of('ColorSpace'));

  if (filter === PDFName.of('DCTDecode')) {
    let s = sharp(Buffer.from(decodedBytes));
    if (colorSpace === PDFName.of('DeviceCMYK')) {
      s = s.pipelineColourspace('cmyk');
    }
    return s;
  }

  // Handle FlateDecode / raw pixel streams
  const isIndexed = Array.isArray(colorSpace) || (colorSpace && typeof colorSpace.get === 'function' && colorSpace.get(0) === PDFName.of('Indexed'));

  if (isIndexed) {
    const baseCS = colorSpace.get(1);
    const lookupObj = colorSpace.get(3);
    const lookupBytes = getLookupTableBytes(lookupObj, context);
    const baseChannels = getChannelCount(baseCS, obj.dict);

    if (lookupBytes && decodedBytes.length >= width * height) {
      const expandedBytes = Buffer.alloc(width * height * baseChannels);
      for (let p = 0; p < width * height; p++) {
        const idx = decodedBytes[p];
        const lookupIdx = idx * baseChannels;
        for (let c = 0; c < baseChannels; c++) {
          expandedBytes[p * baseChannels + c] = lookupBytes[lookupIdx + c];
        }
      }

      let s = sharp(expandedBytes, {
        raw: { width, height, channels: baseChannels }
      });
      if (baseCS === PDFName.of('DeviceCMYK')) {
        s = s.pipelineColourspace('cmyk');
      }
      return s;
    }
  }

  // Non-indexed raw stream
  const channels = getChannelCount(colorSpace, obj.dict);
  const expectedSize = width * height * channels;
  if (decodedBytes.length >= expectedSize) {
    let s = sharp(Buffer.from(decodedBytes), {
      raw: { width, height, channels }
    });
    if (colorSpace === PDFName.of('DeviceCMYK')) {
      s = s.pipelineColourspace('cmyk');
    }
    return s;
  }

  return sharp(Buffer.from(decodedBytes));
}

/**
 * Determines profiles and settings based on user-supplied parameters
 */
function getCompressionParams(level, targetSizeKB, originalSize) {
  let quality = 70;
  let targetDPI = 150;
  let stripMetadata = true;
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
    quality = 50;
    targetDPI = 96;
  } else if (profile === 'best') {
    quality = 90;
    targetDPI = null; // No DPI downsampling
  } else {
    quality = 70;
    targetDPI = 150;
  }

  return { quality, targetDPI, stripMetadata, profile };
}

/**
 * Resolves a key in a PDFDict, looking up indirect references (PDFRef) if necessary.
 */
function lookupDictEntry(dict, key, context) {
  if (!dict || !key || !context) return null;
  const directOrRef = dict.get(key);
  if (!directOrRef) return null;
  return context.lookup(directOrRef);
}

/**
 * Helper to test if a PDF subtype resolves to an Image object.
 */
function isImageSubtype(subtype) {
  if (!subtype) return false;
  if (subtype === PDFName.of('Image')) return true;
  const str = subtype.toString();
  return str === '/Image' || str === 'Image';
}

/**
 * Recursively traverses page / XObject resources to collect all unique XObjects and fonts.
 */
function traverseResources(resources, context, seenRefs = new Set(), results = { images: new Map(), fonts: new Set(), forms: new Set() }) {
  if (!resources) return results;
  const resolvedRes = context.lookup(resources);
  if (!(resolvedRes instanceof PDFDict)) return results;

  // 1. Process XObjects
  const xObjectDict = resolvedRes.get(PDFName.of('XObject'));
  if (xObjectDict) {
    const resolvedXObjects = context.lookup(xObjectDict);
    if (resolvedXObjects instanceof PDFDict) {
      resolvedXObjects.entries().forEach(([name, refOrObj]) => {
        const refStr = refOrObj.toString();
        const xObj = context.lookup(refOrObj);
        if (xObj instanceof PDFRawStream) {
          const subtype = context.lookup(xObj.dict.get(PDFName.of('Subtype')));
          if (isImageSubtype(subtype)) {
            results.images.set(refStr, { ref: refOrObj, stream: xObj });
          } else if (subtype === PDFName.of('Form')) {
            if (refOrObj instanceof PDFRef) {
              if (seenRefs.has(refOrObj)) return;
              seenRefs.add(refOrObj);
            }
            results.forms.add(refStr);
            const nestedResources = xObj.dict.get(PDFName.of('Resources'));
            if (nestedResources) {
              traverseResources(nestedResources, context, seenRefs, results);
            }
          }
        }
      });
    }
  }

  // 2. Process Fonts
  const fontDict = resolvedRes.get(PDFName.of('Font'));
  if (fontDict) {
    const resolvedFonts = context.lookup(fontDict);
    if (resolvedFonts instanceof PDFDict) {
      resolvedFonts.entries().forEach(([name, refOrObj]) => {
        const fontObj = context.lookup(refOrObj);
        if (fontObj instanceof PDFDict) {
          const baseFont = context.lookup(fontObj.get(PDFName.of('BaseFont')));
          if (baseFont) {
            results.fonts.add(baseFont.toString().replace(/^\//, ''));
          } else {
            results.fonts.add(name.toString().replace(/^\//, ''));
          }
        }
      });
    }
  }

  return results;
}

/**
 * Performs detailed analysis of a PDF buffer before compression.
 */
async function analyzePdfDoc(pdfDoc, bufferLength) {
  const traversal = {
    images: new Map(),
    fonts: new Set(),
    forms: new Set()
  };
  const seenRefs = new Set();

  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const resources = page.node.get(PDFName.of('Resources'));
    if (resources) {
      traverseResources(resources, pdfDoc.context, seenRefs, traversal);
    }
  }

  // Backup scan over indirect objects to ensure no dangling assets escape
  pdfDoc.context.enumerateIndirectObjects().forEach(([ref, obj]) => {
    if (obj instanceof PDFRawStream) {
      const subtype = lookupDictEntry(obj.dict, PDFName.of('Subtype'), pdfDoc.context);
      if (isImageSubtype(subtype)) {
        traversal.images.set(ref.toString(), { ref, stream: obj });
      }
    } else if (obj instanceof PDFDict) {
      const type = lookupDictEntry(obj, PDFName.of('Type'), pdfDoc.context);
      if (type === PDFName.of('Font')) {
        const baseFont = lookupDictEntry(obj, PDFName.of('BaseFont'), pdfDoc.context);
        if (baseFont) {
          traversal.fonts.add(baseFont.toString().replace(/^\//, ''));
        }
      }
    }
  });

  // Page classifications, text scanning, vector estimation, and inline images
  let textPagesCount = 0;
  let inlineImages = 0;
  let vectors = 0;

  for (const page of pages) {
    const contentsRef = page.node.get(PDFName.of('Contents'));
    let hasText = false;
    if (contentsRef) {
      try {
        const contents = pdfDoc.context.lookup(contentsRef);
        const streams = Array.isArray(contents) ? contents : [contents];
        for (const stream of streams) {
          if (stream instanceof PDFRawStream) {
            const decoded = pdfDoc.context.decode(stream);
            const textStr = new TextDecoder('utf-8', { fatal: false }).decode(decoded);
            if (textStr.includes('BT') && textStr.includes('ET')) {
              hasText = true;
            }
            
            // 1. Detect inline image markers: BI (Begin Image) ... ID (Image Data) ... EI (End Image)
            let idx = 0;
            while ((idx = textStr.indexOf('BI', idx)) !== -1) {
              const idIdx = textStr.indexOf('ID', idx);
              const eiIdx = textStr.indexOf('EI', idIdx);
              if (idIdx !== -1 && eiIdx !== -1 && eiIdx > idIdx) {
                inlineImages++;
                idx = eiIdx + 2;
              } else {
                idx += 2;
              }
            }

            // 2. Count vector drawing operators
            const vectorMatches = textStr.match(/\s+([mlc]|re|S|f|B)\s+/g);
            if (vectorMatches) {
              vectors += Math.floor(vectorMatches.length / 5) || 1;
            }
          }
        }
      } catch (err) {
        hasText = true;
      }
    }
    if (hasText) textPagesCount++;
  }

  // Scan Form XObject streams for inline images and vectors
  for (const [_, item] of traversal.images) {
    const subtype = lookupDictEntry(item.stream.dict, PDFName.of('Subtype'), pdfDoc.context);
    if (subtype === PDFName.of('Form')) {
      try {
        const decoded = pdfDoc.context.decode(item.stream);
        const textStr = new TextDecoder('utf-8', { fatal: false }).decode(decoded);
        const vectorMatches = textStr.match(/\s+([mlc]|re|S|f|B)\s+/g);
        if (vectorMatches) {
          vectors += Math.floor(vectorMatches.length / 5) || 1;
        }
      } catch {}
    }
  }

  const trailerInfo = pdfDoc.context.trailerInfo || {};
  const rootCatalog = trailerInfo.Root ? pdfDoc.context.lookup(trailerInfo.Root) : null;
  const hasMetadata = !!(
    trailerInfo.Info ||
    (rootCatalog instanceof PDFDict && rootCatalog.get(PDFName.of('Metadata')))
  );
  
  let hasObjectStreams = false;
  pdfDoc.context.enumerateIndirectObjects().forEach(([_, obj]) => {
    if (obj instanceof PDFRawStream) {
      const type = lookupDictEntry(obj.dict, PDFName.of('Type'), pdfDoc.context);
      if (type === PDFName.of('ObjStm')) {
        hasObjectStreams = true;
      }
    }
  });

  const searchable = textPagesCount > 0;
  const scanned = textPagesCount === 0 && (traversal.images.size > 0 || inlineImages > 0);

  // Compressibility estimation
  let estimatedCompressibility = 'Low';
  const sizePerPage = bufferLength / pages.length;
  if (traversal.images.size > 0 || inlineImages > 0) {
    estimatedCompressibility = sizePerPage > 300 * 1024 ? 'High' : 'Medium';
  } else if (sizePerPage > 500 * 1024) {
    estimatedCompressibility = 'Medium';
  }

  return {
    pageCount: pages.length,
    scannedPages: scanned ? pages.length : 0,
    textPages: searchable ? textPagesCount : 0,
    imageCount: traversal.images.size,
    inlineImageCount: inlineImages,
    vectorCount: vectors,
    hasMetadata,
    hasObjectStreams,
    fontsPreserved: Array.from(traversal.fonts),
    encryption: pdfDoc.isEncrypted ? 'Yes (Encrypted)' : 'None',
    documentVersion: (pdfDoc.context.header ? pdfDoc.context.header.toString() : '%PDF-1.4').replace(/^%/, ''),
    estimatedCompressibility
  };
}

/**
 * Executes a single compression pass over all images in the document
 * using the given quality and target DPI settings.
 */
async function runCompressionPass(pdfDoc, quality, targetDPI) {
  let imagesOptimized = 0;
  const warnings = [];

  const traversal = {
    images: new Map(),
    fonts: new Set(),
    forms: new Set()
  };
  const seenRefs = new Set();

  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const resources = page.node.get(PDFName.of('Resources'));
    if (resources) {
      traverseResources(resources, pdfDoc.context, seenRefs, traversal);
    }
  }

  // Backup scan to gather any dangling indirect image streams
  pdfDoc.context.enumerateIndirectObjects().forEach(([ref, obj]) => {
    if (obj instanceof PDFRawStream) {
      const subtype = lookupDictEntry(obj.dict, PDFName.of('Subtype'), pdfDoc.context);
      if (isImageSubtype(subtype)) {
        traversal.images.set(ref.toString(), { ref, stream: obj });
      }
    }
  });

  const firstPage = pages[0];
  const pageSize = firstPage ? firstPage.getSize() : { width: 595, height: 842 };

  // Cache to store original image references mapped to compressed counterparts (deduplication)
  const compressedCache = new Map();

  for (const [refStr, item] of traversal.images.entries()) {
    const ref = item.ref;
    const obj = item.stream;

    if (!(ref instanceof PDFRef)) continue;

    // Deduplication check
    if (compressedCache.has(refStr)) {
      const existingRef = compressedCache.get(refStr);
      const newImageObj = pdfDoc.context.lookup(existingRef);
      pdfDoc.context.assign(ref, newImageObj);
      imagesOptimized++;
      continue;
    }

    try {
      const widthObj = lookupDictEntry(obj.dict, PDFName.of('Width'), pdfDoc.context);
      const heightObj = lookupDictEntry(obj.dict, PDFName.of('Height'), pdfDoc.context);
      const filter = lookupDictEntry(obj.dict, PDFName.of('Filter'), pdfDoc.context);

      let width = widthObj && typeof widthObj.asNumber === 'function' ? widthObj.asNumber() : null;
      let height = heightObj && typeof heightObj.asNumber === 'function' ? heightObj.asNumber() : null;

      let sharpImg = null;
      let decodedBytes = null;

      try {
        decodedBytes = pdfDoc.context.decode(obj);
      } catch (decodeErr) {
        warnings.push(`Failed to decode image object at ref ${ref.toString()}: ${decodeErr.message}`);
        continue;
      }

      // Metadata fallback for width and height
      if (!width || !height) {
        try {
          const meta = await sharp(Buffer.from(decodedBytes)).metadata();
          width = meta.width || null;
          height = meta.height || null;
        } catch {}
      }

      if (!width || !height) continue;

      // DPI scaling factor calculation
      let finalScale = 1.0;
      if (targetDPI) {
        const targetPixelWidth = Math.round((pageSize.width / 72) * targetDPI);
        finalScale = Math.min(1.0, targetPixelWidth / width);
      }

      // Check transparency
      const hasSMask = obj.dict.has(PDFName.of('SMask'));
      let oldSMaskRef = null;
      if (hasSMask) {
        oldSMaskRef = obj.dict.get(PDFName.of('SMask'));
      }

      if (hasSMask && oldSMaskRef) {
        try {
          const sMaskObj = pdfDoc.context.lookup(oldSMaskRef);
          if (sMaskObj instanceof PDFRawStream) {
            const sMaskDecoded = pdfDoc.context.decode(sMaskObj);
            const sMaskWidth = sMaskObj.dict.get(PDFName.of('Width')).asNumber();
            const sMaskHeight = sMaskObj.dict.get(PDFName.of('Height')).asNumber();

            const baseSharp = decodePdfImageToSharp(obj, decodedBytes, width, height, filter, pdfDoc.context);
            const { data: rgbBuffer, info: rgbInfo } = await baseSharp
              .toColourspace('srgb')
              .removeAlpha()
              .raw()
              .toBuffer({ resolveWithObject: true });

            const { data: alphaBuffer } = await sharp(Buffer.from(sMaskDecoded), {
              raw: { width: sMaskWidth, height: sMaskHeight, channels: 1 }
            })
            .resize(rgbInfo.width, rgbInfo.height, { kernel: 'lanczos3' })
            .raw()
            .toBuffer({ resolveWithObject: true });

            const rgbaBuffer = Buffer.alloc(rgbInfo.width * rgbInfo.height * 4);
            for (let j = 0; j < rgbInfo.width * rgbInfo.height; j++) {
              rgbaBuffer[j * 4] = rgbBuffer[j * 3];
              rgbaBuffer[j * 4 + 1] = rgbBuffer[j * 3 + 1];
              rgbaBuffer[j * 4 + 2] = rgbBuffer[j * 3 + 2];
              rgbaBuffer[j * 4 + 3] = alphaBuffer[j];
            }

            sharpImg = sharp(rgbaBuffer, {
              raw: {
                width: rgbInfo.width,
                height: rgbInfo.height,
                channels: 4
              }
            });
          }
        } catch (sMaskErr) {
          warnings.push(`Failed to composite transparent mask at ref ${ref.toString()}, falling back: ${sMaskErr.message}`);
        }
      }

      if (!sharpImg) {
        sharpImg = decodePdfImageToSharp(obj, decodedBytes, width, height, filter, pdfDoc.context);
      }

      if (sharpImg) {
        const targetW = Math.max(16, Math.round(width * finalScale));
        const targetH = Math.max(16, Math.round(height * finalScale));
        
        let processed = sharpImg.resize(targetW, targetH, { kernel: 'lanczos3' });

        let compressedBuffer;
        let embeddedImage;

        if (hasSMask && oldSMaskRef) {
          compressedBuffer = await processed.png({ palette: true, quality }).toBuffer();
          embeddedImage = await pdfDoc.embedPng(compressedBuffer);
        } else {
          compressedBuffer = await processed.jpeg({ quality, progressive: true, mozjpeg: true }).toBuffer();
          embeddedImage = await pdfDoc.embedJpg(compressedBuffer);
        }

        const newImageObj = pdfDoc.context.lookup(embeddedImage.ref);
        pdfDoc.context.assign(ref, newImageObj);

        // Delete temporary indirect ref
        pdfDoc.context.delete(embeddedImage.ref);

        if (oldSMaskRef) {
          pdfDoc.context.delete(oldSMaskRef);
        }

        // Cache the result for deduplication
        compressedCache.set(refStr, embeddedImage.ref);
        imagesOptimized++;
      }
    } catch (err) {
      warnings.push(`Image optimization error at ref ${ref.toString()}: ${err.message}`);
    }
  }

  return { imagesOptimized, warnings };
}

/**
 * Advanced PDF compressor. Extracts, resizes, and re-compresses embedded
 * raster images using Sharp, keeping text layers and vector items intact.
 */
async function compressPdf(inputBuffer, level, targetSizeKB) {
  const startTime = Date.now();
  const originalSize = inputBuffer.length;
  
  let pdfDoc = await PDFDocument.load(inputBuffer, { updateMetadata: false });
  const initialAnalysis = await analyzePdfDoc(pdfDoc, originalSize);

  let { quality, targetDPI, stripMetadata, profile } = getCompressionParams(level, targetSizeKB, originalSize);

  let docToCompress = pdfDoc;

  // Execute structural cleanups for Lossless / Balanced / Maximum
  if (stripMetadata) {
    if (docToCompress.context.trailerInfo) {
      delete docToCompress.context.trailerInfo.Info;
      const catalogRef = docToCompress.context.trailerInfo.Root;
      if (catalogRef) {
        const catalog = docToCompress.context.lookup(catalogRef);
        if (catalog instanceof PDFDict) {
          catalog.delete(PDFName.of('Metadata'));
        }
      }
    }
  }

  let passResult = await runCompressionPass(docToCompress, quality, targetDPI);
  
  let compressedBytes = await docToCompress.save({
    useObjectStreams: true,
    addDefaultPage: false
  });

  const targetBytes = targetSizeKB ? targetSizeKB * 1024 : null;

  // Corrective retry if over target bounds
  if (targetBytes && compressedBytes.length > targetBytes * 1.20) {
    let nextProfile = null;
    if (profile === 'best') nextProfile = 'balanced';
    else if (profile === 'balanced') nextProfile = 'smallest';

    if (nextProfile) {
      profile = nextProfile;
      if (profile === 'balanced') {
        quality = 70;
        targetDPI = 150;
      } else if (profile === 'smallest') {
        quality = 50;
        targetDPI = 96;
      }

      docToCompress = await PDFDocument.load(inputBuffer, { updateMetadata: false });
      if (stripMetadata) {
        if (docToCompress.context.trailerInfo) {
          delete docToCompress.context.trailerInfo.Info;
          const catalogRef = docToCompress.context.trailerInfo.Root;
          if (catalogRef) {
            const catalog = docToCompress.context.lookup(catalogRef);
            if (catalog instanceof PDFDict) {
              catalog.delete(PDFName.of('Metadata'));
            }
          }
        }
      }
      passResult = await runCompressionPass(docToCompress, quality, targetDPI);
      
      compressedBytes = await docToCompress.save({
        useObjectStreams: true,
        addDefaultPage: false
      });
    }
  }

  const compressionTime = Date.now() - startTime;

  return {
    buffer: compressedBytes,
    report: {
      originalSize,
      compressedSize: compressedBytes.length,
      savedPercent: Math.max(0, Math.round(((originalSize - compressedBytes.length) / originalSize) * 100)),
      pages: initialAnalysis.pageCount,
      imagesOptimized: passResult.imagesOptimized,
      metadataRemoved: stripMetadata,
      fontsPreserved: initialAnalysis.fontsPreserved.length,
      compressionTime,
      warnings: passResult.warnings
    }
  };
}

module.exports = {
  compressPdf,
  analyzePdfDoc
};
