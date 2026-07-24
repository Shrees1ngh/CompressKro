// ============================================================
// CompressKro Backend — PDF Analyzer Service
// Performs deep PDF structure inspection, content stream scanning,
// page resource classification, and category determination.
// ============================================================

const { PDFName, PDFDict, PDFRawStream, decodePDFRawStream } = require('pdf-lib');

const IMAGE_CODEC_FILTERS = new Set(['DCTDecode', 'CCITTFaxDecode', 'JBIG2Decode', 'JPXDecode']);

function decodeRawStream(obj) {
  if (!obj || !obj.dict || !obj.contents) return new Uint8Array();

  const filterObj = obj.dict.get(PDFName.of('Filter'));
  if (filterObj) {
    const filterStr = filterObj.toString().replace(/^\//, '');
    if (IMAGE_CODEC_FILTERS.has(filterStr)) {
      return obj.getContents ? obj.getContents() : obj.contents;
    }
  } else {
    return obj.getContents ? obj.getContents() : obj.contents;
  }

  const stream = decodePDFRawStream({ dict: obj.dict, contents: obj.contents });
  return stream.getBytes();
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
            if (seenRefs.has(refOrObj)) return;
            seenRefs.add(refOrObj);
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
 * Performs comprehensive analysis of a loaded PDFDocument.
 */
async function analyzePdfDoc(pdfDoc, bufferLength) {
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
            const decoded = decodeRawStream(stream);
            const textStr = new TextDecoder('utf-8', { fatal: false }).decode(decoded);
            if (textStr.includes('BT') && textStr.includes('ET')) {
              hasText = true;
            }
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

  let estimatedCompressibility = 'Low';
  const sizePerPage = bufferLength / Math.max(1, pages.length);
  if (traversal.images.size > 0 || inlineImages > 0) {
    estimatedCompressibility = sizePerPage > 300 * 1024 ? 'High' : 'Medium';
  } else if (sizePerPage > 500 * 1024) {
    estimatedCompressibility = 'Medium';
  }

  const fontCount = traversal.fonts.size;
  const imageCount = traversal.images.size;

  let category = 'text';
  if (scanned) {
    category = 'scanned';
  } else if (imageCount > pages.length * 2) {
    category = 'imageHeavy';
  } else if (vectors > 50) {
    category = 'vectorHeavy';
  } else if (fontCount >= 5) {
    category = 'fontHeavy';
  }

  return {
    pageCount: pages.length,
    scannedPages: scanned ? pages.length : 0,
    textPages: searchable ? textPagesCount : 0,
    imageCount,
    inlineImageCount: inlineImages,
    vectorCount: vectors,
    fontCount,
    hasMetadata,
    hasObjectStreams,
    fontsPreserved: Array.from(traversal.fonts),
    encryption: pdfDoc.isEncrypted ? 'Yes (Encrypted)' : 'None',
    documentVersion: (pdfDoc.context.header ? pdfDoc.context.header.toString() : '%PDF-1.4').replace(/^%/, ''),
    estimatedCompressibility,
    category
  };
}

module.exports = {
  analyzePdfDoc,
  decodeRawStream
};
