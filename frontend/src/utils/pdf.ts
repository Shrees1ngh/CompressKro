// ============================================================
// CompressKro — PDF Utilities
// Centralized helpers for analysis, validation, and metadata extraction.
// ============================================================

import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import { getFriendlySize } from './format';
import { validatePdfFile } from './validation';
import type { PDFAnalysis } from '../types';

/**
 * Validates a PDF file (e.g. extension, mimetype, size constraints)
 */
export function validatePdf(file: File) {
  return validatePdfFile(file);
}

/**
 * Formats a PDF size in bytes into a human-readable string (KB, MB, etc.)
 */
export function formatPdfSize(size: number): string {
  return getFriendlySize(size);
}

/**
 * Extracts metadata fields from a PDF file using pdf-lib
 */
export async function getPdfMetadata(file: File): Promise<any> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, { updateMetadata: false });
    
    return {
      title: pdfDoc.getTitle() || '',
      author: pdfDoc.getAuthor() || '',
      subject: pdfDoc.getSubject() || '',
      creator: pdfDoc.getCreator() || '',
      producer: pdfDoc.getProducer() || '',
      creationDate: pdfDoc.getCreationDate()?.toISOString() || '',
      modificationDate: pdfDoc.getModificationDate()?.toISOString() || '',
      pageCount: pdfDoc.getPageCount()
    };
  } catch (err) {
    console.warn('Metadata extraction failed locally:', err);
    return {};
  }
}

function lookupDictEntry(dict: any, key: any, context: any) {
  if (!dict || !key || !context) return null;
  const directOrRef = dict.get(key);
  if (!directOrRef) return null;
  return context.lookup(directOrRef);
}

function isImageSubtype(subtype: any): boolean {
  if (!subtype) return false;
  if (subtype === PDFName.of('Image')) return true;
  const str = subtype.toString();
  return str === '/Image' || str === 'Image';
}

function traverseResources(
  resources: any,
  context: any,
  seenRefs: Set<any>,
  results: { images: Map<string, any>; fonts: Set<string>; forms: Set<string> }
) {
  if (!resources) return results;
  const resolvedRes = context.lookup(resources);
  if (!(resolvedRes instanceof PDFDict)) return results;

  // XObjects
  const xObjectDict = resolvedRes.get(PDFName.of('XObject'));
  if (xObjectDict) {
    const resolvedXObjects = context.lookup(xObjectDict);
    if (resolvedXObjects instanceof PDFDict) {
      resolvedXObjects.entries().forEach(([, refOrObj]: [any, any]) => {
        const refStr = refOrObj.toString();
        const xObj = context.lookup(refOrObj);
        if (xObj && xObj.dict) {
          const subtype = context.lookup(xObj.dict.get(PDFName.of('Subtype')));
          if (isImageSubtype(subtype)) {
            results.images.set(refStr, xObj);
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

  // Fonts
  const fontDict = resolvedRes.get(PDFName.of('Font'));
  if (fontDict) {
    const resolvedFonts = context.lookup(fontDict);
    if (resolvedFonts instanceof PDFDict) {
      resolvedFonts.entries().forEach(([name, refOrObj]: [any, any]) => {
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
 * Analyzes a PDF file to return page count, size, and whether it contains image objects
 */
export async function analyzePdf(file: File): Promise<PDFAnalysis> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { updateMetadata: false });
  
  const traversal = {
    images: new Map<string, any>(),
    fonts: new Set<string>(),
    forms: new Set<string>()
  };
  const seenRefs = new Set<any>();

  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const resources = page.node.get(PDFName.of('Resources'));
    if (resources) {
      traverseResources(resources, pdfDoc.context, seenRefs, traversal);
    }
  }

  try {
    pdfDoc.context.enumerateIndirectObjects().forEach(([_, obj]) => {
      if (obj && (obj as any).dict) {
        const subtype = lookupDictEntry((obj as any).dict, PDFName.of('Subtype'), pdfDoc.context);
        if (isImageSubtype(subtype)) {
          traversal.images.set(obj.toString(), obj);
        }
      }
    });
  } catch (err) {
    console.warn('XObject enumeration failed during local analysis:', err);
  }

  return {
    pageCount: pages.length,
    fileSize: file.size,
    name: file.name,
    hasImages: traversal.images.size > 0
  };
}

/**
 * Dynamically estimates compressibility based on metadata characteristics
 */
export async function estimateCompressibility(file: File): Promise<number> {
  try {
    const analysis = await analyzePdf(file);
    if (analysis.hasImages) {
      if (file.size > 5 * 1024 * 1024) return 75; // high potential for scanned graphics
      if (file.size > 1 * 1024 * 1024) return 50;
      return 30;
    }
    return 10; // low potential for text-only stream compression
  } catch {
    return 15;
  }
}
