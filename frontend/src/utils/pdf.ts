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

/**
 * Analyzes a PDF file to return page count, size, and whether it contains image objects
 */
export async function analyzePdf(file: File): Promise<PDFAnalysis> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { updateMetadata: false });
  
  let hasImages = false;
  try {
    pdfDoc.context.enumerateIndirectObjects().forEach(([_, obj]) => {
      if (obj instanceof PDFDict) {
        const subtype = obj.get(PDFName.of('Subtype'));
        if (subtype === PDFName.of('Image')) {
          hasImages = true;
        }
      }
    });
  } catch (err) {
    console.warn('XObject enumeration failed during local analysis:', err);
  }

  return {
    pageCount: pdfDoc.getPageCount(),
    fileSize: file.size,
    name: file.name,
    hasImages
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
