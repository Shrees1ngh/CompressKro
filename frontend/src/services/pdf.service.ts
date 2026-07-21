// ============================================================
// CompressKro — PDF Service
// Coordinates backend API requests and client-side fallback operations.
// ============================================================

import { PDFDocument } from 'pdf-lib';
import { BACKEND_API_URL } from '../constants';
import type { PDFCompressedResult, PDFCompressionLevel } from '../types';
import { analyzePdf } from '../utils/pdf';

let activeAbortController: AbortController | null = null;

interface PDFCompressionOptions {
  level: PDFCompressionLevel;
  targetSizeKB?: number;
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

    // Client-side Browser Fallback (pdf-lib object stream optimization)
    clearInterval(progressInterval);
    if (progressCallback) progressCallback(50);

    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, { updateMetadata: false });
    
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
