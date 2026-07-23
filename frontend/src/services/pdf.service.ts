// ============================================================
// CompressKro — PDF Service
// Coordinates backend API requests and client-side fallback operations.
// ============================================================

import { PDFDocument, PDFName, PDFDict, PDFRef, PDFArray, PDFRawStream } from 'pdf-lib';
import { BACKEND_API_URL } from '../constants';
import type { PDFCompressedResult, PDFCompressionLevel } from '../types';
import { analyzePdf } from '../utils/pdf';

let activeAbortController: AbortController | null = null;

interface PDFCompressionOptions {
  level: PDFCompressionLevel;
  targetSizeKB?: number;
}

/**
 * Mark-and-sweep garbage collection: walks every reachable object
 * starting from the document catalog and deletes anything left in the
 * context that isn't reachable. pdf-lib's own save() does NOT do this —
 * it happily writes out orphaned objects it finds via
 * enumerateIndirectObjects(), even if nothing points to them anymore.
 * This matters most for text-only PDFs which have no images for any
 * image pipeline to touch — their whole compressibility depends on
 * structural cleanup like this. Real-world exported PDFs (Word, Google
 * Docs, LaTeX toolchains, Canva, etc.) frequently carry leftover
 * objects from edit/revision history that a mark-and-sweep removes for
 * free, with zero risk of visual changes since only genuinely
 * unreachable objects are ever removed.
 */
function garbageCollectPdf(pdfDoc: PDFDocument): number {
  const context = pdfDoc.context;
  const trailerRoot = context.trailerInfo && context.trailerInfo.Root;
  if (!trailerRoot) return 0;

  const reachable = new Set<string>();

  function visit(val: any): void {
    if (val == null) return;
    if (val instanceof PDFRef) {
      const key = val.toString();
      if (reachable.has(key)) return;
      reachable.add(key);
      visit(context.lookup(val));
      return;
    }
    if (val instanceof PDFRawStream) {
      visit(val.dict);
      return;
    }
    if (val instanceof PDFDict) {
      for (const [, v] of val.entries()) visit(v);
      return;
    }
    if (val instanceof PDFArray) {
      for (let i = 0; i < val.size(); i++) visit(val.get(i));
      return;
    }
  }

  visit(trailerRoot);
  if (context.trailerInfo.Info) visit(context.trailerInfo.Info);

  let removed = 0;
  context.enumerateIndirectObjects().forEach(([ref]: [PDFRef, any]) => {
    if (!reachable.has(ref.toString())) {
      context.delete(ref);
      removed++;
    }
  });

  return removed;
}

/**
 * Strips structural metadata, accessibility tag trees, and application-
 * private dictionaries document-wide. This mirrors the backend's
 * prepareDocForCompression metadata sweep.
 */
function stripMetadataAndClean(pdfDoc: PDFDocument): void {
  const context = pdfDoc.context;
  const catalog = pdfDoc.catalog;

  // Trailer Info dictionary (Author, Creator, Producer, etc.)
  if (context.trailerInfo) {
    delete context.trailerInfo.Info;
  }

  // Catalog-level bloat
  if (catalog instanceof PDFDict) {
    catalog.delete(PDFName.of('Metadata'));
    catalog.delete(PDFName.of('StructTreeRoot'));
    catalog.delete(PDFName.of('MarkInfo'));
    catalog.delete(PDFName.of('PieceInfo'));
    catalog.delete(PDFName.of('OutputIntents'));

    const names = catalog.get(PDFName.of('Names'));
    if (names) {
      const resolvedNames = context.lookup(names);
      if (resolvedNames instanceof PDFDict) {
        resolvedNames.delete(PDFName.of('EmbeddedFiles'));
      }
    }
  }

  // Document-wide sweep of all indirect objects
  context.enumerateIndirectObjects().forEach(([, obj]: [PDFRef, any]) => {
    if (obj instanceof PDFDict) {
      obj.delete(PDFName.of('Metadata'));
      obj.delete(PDFName.of('PieceInfo'));
      obj.delete(PDFName.of('StructParents'));
      obj.delete(PDFName.of('StructParent'));
    }
  });
}

/**
 * Checks if the backend server is reachable and active.
 */
export async function backendAvailabilityDetection(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_API_URL.replace(/\/api$/, '')}/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      return data.status === 'ok';
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Cancels any ongoing PDF compression network request.
 */
export function cancelCompression(): void {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
}

/**
 * Compresses a PDF file. Automatically selects between backend compression
 * and client-side browser fallback depending on backend availability.
 */
export async function compressPdf(
  file: File,
  options: PDFCompressionOptions,
  progressCallback?: (progress: number) => void
): Promise<PDFCompressedResult> {
  // Cancel any existing request
  cancelCompression();
  
  // Set up progress interval simulations to animate UI smoothly
  let progress = 10;
  if (progressCallback) progressCallback(progress);
  
  const progressInterval = setInterval(() => {
    if (progress < 90) {
      progress += 5;
      if (progressCallback) progressCallback(progress);
    }
  }, 250);

  try {
    const isBackendOnline = await backendAvailabilityDetection();
    
    if (isBackendOnline) {
      activeAbortController = new AbortController();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('level', options.level);
      if (options.targetSizeKB !== undefined && options.targetSizeKB > 0) {
        formData.append('targetSizeKB', options.targetSizeKB.toString());
      }

      const res = await fetch(`${BACKEND_API_URL}/compress-pdf`, {
        method: 'POST',
        body: formData,
        signal: activeAbortController.signal,
      });

      clearInterval(progressInterval);

      if (res.ok) {
        const compressedBlob = await res.blob();
        if (progressCallback) progressCallback(100);
        
        const originalSize = parseInt(res.headers.get('x-original-size') || file.size.toString());
        const compressedSize = parseInt(res.headers.get('x-compressed-size') || compressedBlob.size.toString());
        const savedPercent = parseInt(res.headers.get('x-saved-percent') || '0');
        const pagesCount = parseInt(res.headers.get('x-pages') || '1');
        const imagesOptimized = parseInt(res.headers.get('x-images-optimized') || '0');
        const fontsPreserved = parseInt(res.headers.get('x-fonts-preserved') || '0');
        const compressionTimeMs = parseInt(res.headers.get('x-compression-time') || '0');

        return {
          originalName: file.name,
          originalSize,
          compressedSize,
          compressedUrl: URL.createObjectURL(compressedBlob),
          compressedBlob,
          pageCount: pagesCount,
          imagesOptimized,
          fontsPreserved,
          compressionTimeMs,
          savedPercent
        };
      }
      
      console.warn('Backend PDF compression failed, falling back to local client.');
    }

    // Client-side Browser Fallback (structural cleanup + garbage collection + object stream optimization)
    clearInterval(progressInterval);
    if (progressCallback) progressCallback(30);

    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, { updateMetadata: false });

    if (progressCallback) progressCallback(50);

    // Strip structural metadata, accessibility tags, and application-private dictionaries
    stripMetadataAndClean(pdfDoc);

    if (progressCallback) progressCallback(70);

    // Mark-and-sweep garbage collection to remove all unreachable objects
    garbageCollectPdf(pdfDoc);

    if (progressCallback) progressCallback(85);
    
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });
    
    const fallbackBlob = new Blob([compressedBytes as any], { type: 'application/pdf' });
    if (progressCallback) progressCallback(100);

    return {
      originalName: file.name,
      originalSize: file.size,
      compressedSize: fallbackBlob.size,
      compressedUrl: URL.createObjectURL(fallbackBlob),
      compressedBlob: fallbackBlob,
      pageCount: pdfDoc.getPageCount(),
    };

  } catch (err: any) {
    clearInterval(progressInterval);
    if (err.name === 'AbortError') {
      throw new Error('Compression cancelled by user.');
    }
    console.error('PDF compression failed:', err);
    throw new Error(err.message || 'PDF compression encountered an unexpected error.');
  } finally {
    activeAbortController = null;
  }
}

export { analyzePdf };
