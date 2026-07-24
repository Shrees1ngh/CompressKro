// ============================================================
// CompressKro Backend — Pure JS PDF Optimizer Engine
// Advanced pdf-lib + Sharp + native zlib level 9 + MD5 font dedup
// + mark-and-sweep graph garbage collector fallback optimizer.
// ============================================================

const { PDFName, PDFDict, PDFRawStream, PDFRef, PDFArray, decodePDFRawStream } = require('pdf-lib');
const sharp = require('sharp');
const crypto = require('crypto');
const zlib = require('zlib');
const { decodeRawStream } = require('./pdf.analyzer');

const IMAGE_CODEC_FILTERS = new Set(['DCTDecode', 'CCITTFaxDecode', 'JBIG2Decode', 'JPXDecode']);

function getChannelCount(cs, dict, context) {
  if (!cs) return 3;
  const resolvedCs = context ? context.lookup(cs) : cs;
  if (resolvedCs === PDFName.of('DeviceGray')) return 1;
  if (resolvedCs === PDFName.of('DeviceCMYK')) return 4;
  if (resolvedCs === PDFName.of('DeviceRGB')) return 3;

  if (Array.isArray(resolvedCs) || (resolvedCs && typeof resolvedCs.get === 'function')) {
    const name = typeof resolvedCs.get === 'function' ? resolvedCs.get(0) : resolvedCs[0];
    if (name === PDFName.of('Indexed')) {
      const base = typeof resolvedCs.get === 'function' ? resolvedCs.get(1) : resolvedCs[1];
      return getChannelCount(base, dict, context);
    }
    if (name === PDFName.of('ICCBased')) {
      const iccStreamRef = typeof resolvedCs.get === 'function' ? resolvedCs.get(1) : resolvedCs[1];
      if (iccStreamRef && context) {
        const iccStream = context.lookup(iccStreamRef);
        if (iccStream && iccStream.dict) {
          const nObj = iccStream.dict.get(PDFName.of('N'));
          if (nObj && typeof nObj.asNumber === 'function') {
            return nObj.asNumber();
          }
        }
      }
    }
    if (name === PDFName.of('DeviceN')) {
      const namesRef = typeof resolvedCs.get === 'function' ? resolvedCs.get(1) : resolvedCs[1];
      if (namesRef && context) {
        const names = context.lookup(namesRef);
        if (Array.isArray(names)) return names.length;
        if (names && typeof names.size === 'function') return names.size();
      }
    }
    if (name === PDFName.of('Separation')) return 1;
  }
  return 3;
}

function getLookupTableBytes(lookupObj, context) {
  if (!lookupObj) return null;
  const resolved = context.lookup(lookupObj);
  if (resolved instanceof PDFRawStream) return decodeRawStream(resolved);
  if (resolved && typeof resolved.asBytes === 'function') return resolved.asBytes();
  return null;
}

function decodePdfImageToSharp(obj, decodedBytes, width, height, filter, context) {
  const colorSpace = obj.dict.get(PDFName.of('ColorSpace'));
  const resolvedCS = colorSpace ? context.lookup(colorSpace) : null;

  if (filter === PDFName.of('DCTDecode')) {
    let s = sharp(Buffer.from(decodedBytes));
    if (resolvedCS === PDFName.of('DeviceCMYK') || getChannelCount(resolvedCS, obj.dict, context) === 4) {
      s = s.pipelineColourspace('cmyk');
    }
    return s;
  }

  const isIndexed = Array.isArray(resolvedCS) || (resolvedCS && typeof resolvedCS.get === 'function' && resolvedCS.get(0) === PDFName.of('Indexed'));

  if (isIndexed) {
    const baseCS = resolvedCS.get(1);
    const lookupObj = resolvedCS.get(3);
    const lookupBytes = getLookupTableBytes(lookupObj, context);
    const baseChannels = getChannelCount(baseCS, obj.dict, context);

    if (lookupBytes && decodedBytes.length >= width * height) {
      const expandedBytes = Buffer.alloc(width * height * baseChannels);
      for (let p = 0; p < width * height; p++) {
        const idx = decodedBytes[p];
        const lookupIdx = idx * baseChannels;
        for (let c = 0; c < baseChannels; c++) {
          expandedBytes[p * baseChannels + c] = lookupBytes[lookupIdx + c];
        }
      }

      let s = sharp(expandedBytes, { raw: { width, height, channels: baseChannels } });
      const resolvedBaseCS = context.lookup(baseCS);
      if (resolvedBaseCS === PDFName.of('DeviceCMYK') || baseChannels === 4) {
        s = s.pipelineColourspace('cmyk');
      }
      return s;
    }
  }

  const channels = getChannelCount(resolvedCS, obj.dict, context);
  const expectedSize = width * height * channels;
  if (decodedBytes.length >= expectedSize) {
    let s = sharp(Buffer.from(decodedBytes), { raw: { width, height, channels } });
    if (resolvedCS === PDFName.of('DeviceCMYK') || channels === 4) {
      s = s.pipelineColourspace('cmyk');
    }
    return s;
  }

  return sharp(Buffer.from(decodedBytes));
}

function lookupDictEntry(dict, key, context) {
  if (!dict || !key || !context) return null;
  const directOrRef = dict.get(key);
  if (!directOrRef) return null;
  return context.lookup(directOrRef);
}

function isImageSubtype(subtype) {
  if (!subtype) return false;
  if (subtype === PDFName.of('Image')) return true;
  const str = subtype.toString();
  return str === '/Image' || str === 'Image';
}

function traverseResources(resources, context, seenRefs = new Set(), results = { images: new Map(), fonts: new Set(), forms: new Set() }) {
  if (!resources) return results;
  const resolvedRes = context.lookup(resources);
  if (!(resolvedRes instanceof PDFDict)) return results;

  const xObjectDict = resolvedRes.get(PDFName.of('XObject'));
  if (xObjectDict) {
    const resolvedXObjects = context.lookup(xObjectDict);
    if (resolvedXObjects instanceof PDFDict) {
      resolvedXObjects.entries().forEach(([_, refOrObj]) => {
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

  return results;
}

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
    quality = 45;
    targetDPI = 72;
  } else if (profile === 'best') {
    quality = 90;
    targetDPI = null;
  } else {
    quality = 70;
    targetDPI = 150;
  }

  return { quality, targetDPI, stripMetadata, profile };
}

async function runCompressionPass(pdfDoc, quality, targetDPI) {
  let imagesOptimized = 0;
  const warnings = [];

  const traversal = { images: new Map(), fonts: new Set(), forms: new Set() };
  const seenRefs = new Set();
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const resources = page.node.get(PDFName.of('Resources'));
    if (resources) traverseResources(resources, pdfDoc.context, seenRefs, traversal);
  }

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
  const compressedCache = new Map();

  for (const [refStr, item] of traversal.images.entries()) {
    const ref = item.ref;
    const obj = item.stream;
    if (!(ref instanceof PDFRef)) continue;

    const contentHash = crypto.createHash('md5').update(obj.contents).digest('hex');
    if (compressedCache.has(contentHash)) {
      const existingRef = compressedCache.get(contentHash);
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
        decodedBytes = decodeRawStream(obj);
      } catch (decodeErr) {
        warnings.push(`Failed to decode image object at ref ${ref.toString()}: ${decodeErr.message}`);
        continue;
      }

      if (!width || !height) {
        try {
          const meta = await sharp(Buffer.from(decodedBytes)).metadata();
          width = meta.width || null;
          height = meta.height || null;
        } catch {}
      }

      if (!width || !height) continue;

      let finalScale = 1.0;
      if (targetDPI) {
        const targetPixelWidth = Math.round((pageSize.width / 72) * targetDPI);
        finalScale = Math.min(1.0, targetPixelWidth / width);
      }

      const hasSMask = obj.dict.has(PDFName.of('SMask'));
      let oldSMaskRef = hasSMask ? obj.dict.get(PDFName.of('SMask')) : null;

      if (hasSMask && oldSMaskRef) {
        try {
          const sMaskObj = pdfDoc.context.lookup(oldSMaskRef);
          if (sMaskObj instanceof PDFRawStream) {
            const sMaskDecoded = decodeRawStream(sMaskObj);
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

            sharpImg = sharp(rgbaBuffer, { raw: { width: rgbInfo.width, height: rgbInfo.height, channels: 4 } });
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
          const rgbBuffer = await processed.clone().removeAlpha().jpeg({ quality, progressive: true, mozjpeg: true }).toBuffer();
          const alphaBuffer = await processed.clone().extractChannel('alpha').jpeg({ quality, progressive: true, mozjpeg: true }).toBuffer();

          if (rgbBuffer.length + alphaBuffer.length >= obj.contents.length) continue;

          embeddedImage = await pdfDoc.embedJpg(Uint8Array.from(rgbBuffer));
          await embeddedImage.embed();

          const embeddedAlpha = await pdfDoc.embedJpg(Uint8Array.from(alphaBuffer));
          await embeddedAlpha.embed();

          const rgbStream = pdfDoc.context.lookup(embeddedImage.ref);
          rgbStream.dict.set(PDFName.of('SMask'), embeddedAlpha.ref);

          const newImageObj = pdfDoc.context.lookup(embeddedImage.ref);
          pdfDoc.context.assign(ref, newImageObj);

          pdfDoc.context.delete(embeddedImage.ref);
          if (oldSMaskRef) pdfDoc.context.delete(oldSMaskRef);
        } else {
          compressedBuffer = await processed.jpeg({ quality, progressive: true, mozjpeg: true }).toBuffer();
          if (compressedBuffer.length >= obj.contents.length) continue;

          embeddedImage = await pdfDoc.embedJpg(Uint8Array.from(compressedBuffer));
          await embeddedImage.embed();

          const newImageObj = pdfDoc.context.lookup(embeddedImage.ref);
          pdfDoc.context.assign(ref, newImageObj);
          pdfDoc.context.delete(embeddedImage.ref);
        }

        compressedCache.set(contentHash, ref);
        imagesOptimized++;
      }
    } catch (err) {
      warnings.push(`Image optimization error at ref ${ref.toString()}: ${err.message}`);
    }
  }

  return { imagesOptimized, warnings };
}

function deduplicateFontFiles(pdfDoc) {
  const context = pdfDoc.context;
  const fontFileHashMap = new Map();

  context.enumerateIndirectObjects().forEach(([ref, obj]) => {
    if (obj instanceof PDFDict && obj.get(PDFName.of('Type')) === PDFName.of('FontDescriptor')) {
      const fontFileKeys = ['FontFile', 'FontFile2', 'FontFile3'];
      for (const key of fontFileKeys) {
        const fileRef = obj.get(PDFName.of(key));
        if (fileRef instanceof PDFRef) {
          const fileStream = context.lookup(fileRef);
          if (fileStream instanceof PDFRawStream) {
            const hash = crypto.createHash('md5').update(fileStream.contents).digest('hex');
            if (fontFileHashMap.has(hash)) {
              const canonicalRef = fontFileHashMap.get(hash);
              if (canonicalRef.toString() !== fileRef.toString()) {
                obj.set(PDFName.of(key), canonicalRef);
              }
            } else {
              fontFileHashMap.set(hash, fileRef);
            }
          }
        }
      }
    }
  });
}

function recompressAllStreams(pdfDoc) {
  const context = pdfDoc.context;

  context.enumerateIndirectObjects().forEach(([ref, obj]) => {
    if (obj instanceof PDFRawStream) {
      try {
        const filter = obj.dict.get(PDFName.of('Filter'));
        let filterStr = filter ? filter.toString().replace(/^\//, '') : '';
        if (filterStr && filterStr !== 'FlateDecode') return;

        let decompressed;
        try {
          decompressed = decodeRawStream(obj);
        } catch {
          return;
        }

        if (!decompressed || decompressed.length === 0) return;

        const compressed = zlib.deflateSync(Buffer.from(decompressed), { level: 9 });

        if (compressed.length < obj.contents.length) {
          obj.contents = new Uint8Array(compressed);
          obj.dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
          obj.dict.set(PDFName.of('Length'), context.obj(compressed.length));
        }
      } catch (err) {}
    }
  });
}

function garbageCollectContext(pdfDoc) {
  const context = pdfDoc.context;
  const reachable = new Set();
  const queue = [];

  const catalogRef = context.trailerInfo.Root;
  if (catalogRef instanceof PDFRef) {
    queue.push(catalogRef);
    reachable.add(catalogRef.toString());
  }

  const encryptRef = context.trailerInfo.Encrypt;
  if (encryptRef instanceof PDFRef) {
    queue.push(encryptRef);
    reachable.add(encryptRef.toString());
  }

  function traverse(obj) {
    if (!obj) return;
    if (obj instanceof PDFRef) {
      const refStr = obj.toString();
      if (!reachable.has(refStr)) {
        reachable.add(refStr);
        queue.push(obj);
      }
    } else if (obj instanceof PDFDict) {
      obj.entries().forEach(([_, val]) => traverse(val));
    } else if (obj instanceof PDFArray) {
      obj.asArray().forEach(val => traverse(val));
    } else if (obj instanceof PDFRawStream) {
      traverse(obj.dict);
    }
  }

  while (queue.length > 0) {
    const currentRef = queue.shift();
    const obj = context.lookup(currentRef);
    traverse(obj);
  }

  context.enumerateIndirectObjects().forEach(([ref]) => {
    if (!reachable.has(ref.toString())) {
      context.delete(ref);
    }
  });
}

async function prepareDocForCompression(pdfDoc, stripMetadata) {
  if (!pdfDoc) return pdfDoc;

  if (stripMetadata) {
    if (pdfDoc.context.trailerInfo) {
      delete pdfDoc.context.trailerInfo.Info;
    }

    const catalog = pdfDoc.catalog;
    if (catalog instanceof PDFDict) {
      catalog.delete(PDFName.of('Metadata'));
      catalog.delete(PDFName.of('StructTreeRoot'));
      catalog.delete(PDFName.of('MarkInfo'));
      catalog.delete(PDFName.of('PieceInfo'));
      catalog.delete(PDFName.of('OutputIntents'));

      const names = catalog.get(PDFName.of('Names'));
      if (names) {
        const resolvedNames = pdfDoc.context.lookup(names);
        if (resolvedNames instanceof PDFDict) {
          resolvedNames.delete(PDFName.of('EmbeddedFiles'));
        }
      }
    }

    pdfDoc.context.enumerateIndirectObjects().forEach(([ref, obj]) => {
      if (obj instanceof PDFDict) {
        obj.delete(PDFName.of('Metadata'));
        obj.delete(PDFName.of('PieceInfo'));
        obj.delete(PDFName.of('StructParents'));
        obj.delete(PDFName.of('StructParent'));
      }
    });
  }

  deduplicateFontFiles(pdfDoc);
  recompressAllStreams(pdfDoc);
  garbageCollectContext(pdfDoc);

  return pdfDoc;
}

module.exports = {
  prepareDocForCompression,
  runCompressionPass,
  getCompressionParams
};
