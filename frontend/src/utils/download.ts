// ============================================================
// CompressKro — Download Utilities
// ============================================================

import { getFileBaseName, getFileExtension } from './format';

/**
 * Triggers a browser download for a Blob with a given filename.
 * Automatically cleans up the object URL after click.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a short delay so the browser has time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Triggers a browser download using an existing object URL.
 * NOTE: Does NOT revoke the URL — caller is responsible.
 */
export function downloadUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Builds a download filename for a compressed image.
 * e.g. "photo.jpg" → "photo_optimized.jpg"
 */
export function buildCompressedFilename(originalName: string, mimeType: string): string {
  const base = getFileBaseName(originalName);
  const origExt = getFileExtension(originalName);
  const isPngOrGif = origExt === 'png' || origExt === 'gif';
  const ext = mimeType === 'image/png' || isPngOrGif ? 'png' : 'jpg';
  return `${base}_optimized.${ext}`;
}

/**
 * Builds a download filename for a resized image.
 * e.g. "photo.jpg" → "photo_resized.jpg"
 */
export function buildResizedFilename(originalName: string): string {
  const base = getFileBaseName(originalName);
  const ext = getFileExtension(originalName);
  return `${base}_resized.${ext || 'jpg'}`;
}

/**
 * Builds a download filename for a converted image.
 * e.g. "photo.jpg" converted to webp → "photo.webp"
 */
export function buildConvertedFilename(originalName: string, targetFormat: string): string {
  const base = getFileBaseName(originalName);
  return `${base}.${targetFormat}`;
}

/**
 * Revokes an array of object URLs to free memory.
 */
export function revokeObjectURLs(urls: string[]): void {
  urls.forEach(url => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  });
}

/**
 * Downloads multiple blobs sequentially with a small delay between each
 * (to prevent browser from blocking simultaneous downloads).
 */
export async function downloadMultipleBlobs(
  items: Array<{ blob: Blob; filename: string }>,
  delayMs = 150
): Promise<void> {
  for (const item of items) {
    downloadBlob(item.blob, item.filename);
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
