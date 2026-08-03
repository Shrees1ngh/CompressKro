// ============================================================
// CompressKro PDF Editor — PDF Parser
// ============================================================
// Orchestrates the full PDF parsing pipeline:
// 1. Load document via PDF.js
// 2. Extract text objects per page
// 3. Merge text fragments
// 4. Extract image objects per page
// 5. Return a ParsedDocument structure
// ============================================================

import type { ParsedDocument, PageData } from '../core/types';
import { extractTextObjects } from './TextExtractor';
import { mergeTextRuns } from './TextMerger';
import { extractImageObjects } from './ImageExtractor';
import { loadPdfJs } from '../../../utils/pdfLoader';

/**
 * Progress callback signature.
 * @param message - Human-readable progress message.
 * @param progress - 0–1 fractional progress.
 */
export type ParseProgressCallback = (message: string, progress: number) => void;

/**
 * Parses a PDF file into a structured ParsedDocument.
 *
 * This is a non-blocking pipeline that processes pages one at a time,
 * yielding to the main thread between pages via requestAnimationFrame.
 *
 * @param file - The PDF file to parse.
 * @param onProgress - Optional callback for progress updates.
 * @returns Parsed document structure with text and image objects per page.
 */
export async function parsePdf(
  file: File,
  onProgress?: ParseProgressCallback
): Promise<ParsedDocument> {
  onProgress?.('Loading PDF document...', 0);

  // Load PDF.js from CDN (matches the project's existing pattern)
  const pdfjsLib = await loadPdfJs();

  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = doc.numPages;

  onProgress?.(`Analyzing ${numPages} page${numPages !== 1 ? 's' : ''}...`, 0.1);

  const pages: PageData[] = [];

  for (let i = 1; i <= numPages; i++) {
    const fraction = 0.1 + (0.85 * (i - 1)) / numPages;
    onProgress?.(`Extracting page ${i} of ${numPages}...`, fraction);

    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });

    // Get page rotation from the PDF page dictionary
    const pageRotation: number = page.rotate || 0;

    // ---- Text extraction ----
    const rawTextObjects = await extractTextObjects(page, i - 1);
    const mergedTextObjects = mergeTextRuns(rawTextObjects);

    // ---- Image extraction ----
    const rawImageObjects = await extractImageObjects(page, i - 1, pdfjsLib);

    // Filter out images that are very likely watermarks or background graphics.
    // These cover a large portion of the page and block text editing.
    // Also skip very small decorative images (< 8pt in either dimension).
    const pageArea = viewport.width * viewport.height;
    const imageObjects = rawImageObjects.filter((img) => {
      const imgArea = img.bounds.width * img.bounds.height;
      // Skip images covering more than 50% of the page — likely watermarks
      if (imgArea / pageArea > 0.5) return false;
      // Skip tiny decorative images (borders, line patterns, etc.)
      if (img.bounds.width < 8 || img.bounds.height < 8) return false;
      return true;
    });

    // Build page data
    const pageData: PageData = {
      pageIndex: i - 1,
      widthPts: viewport.width,   // At scale 1.0, viewport dimensions = PDF points
      heightPts: viewport.height,
      rotation: pageRotation,
      textObjects: mergedTextObjects,
      imageObjects,
    };

    pages.push(pageData);

    // Yield to main thread between pages to prevent UI freezing.
    // This converts the synchronous loop into a cooperative one.
    if (i < numPages) {
      await yieldToMainThread();
    }
  }

  onProgress?.('PDF analysis complete.', 1.0);

  return {
    numPages,
    pages,
    pdfjsDocument: doc,
    file,
  };
}

/**
 * Yields control back to the main thread for one animation frame.
 * This prevents the UI from freezing during long parsing loops.
 */
function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}
