// ============================================================
// CompressKro — Format Utilities
// ============================================================

/**
 * Converts a byte count into a human-readable string.
 * e.g. 1536 → "1.5 KB", 2097152 → "2.00 MB"
 */
export function getFriendlySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Safely extracts the file extension (lowercase) from a filename.
 * e.g. "photo.JPEG" → "jpeg", "file.tar.gz" → "gz"
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

/**
 * Returns the filename without its extension.
 * e.g. "photo.jpeg" → "photo", "my.file.tar.gz" → "my.file.tar"
 */
export function getFileBaseName(filename: string): string {
  const parts = filename.split('.');
  if (parts.length > 1) parts.pop();
  return parts.join('.');
}

/**
 * Computes a human-readable compression ratio.
 * e.g. 1000, 400 → "2.5x"
 */
export function getCompressionRatio(originalSize: number, compressedSize: number): string {
  if (compressedSize === 0) return '∞';
  return `${(originalSize / compressedSize).toFixed(2)}x`;
}

/**
 * Computes the percentage saved (clamped to 0–100).
 */
export function getSavedPercent(originalSize: number, compressedSize: number): number {
  if (originalSize === 0) return 0;
  return Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));
}

/**
 * Formats a Date or timestamp into a localized date string.
 */
export function formatDate(dateOrTs: Date | number | string): string {
  const d = new Date(dateOrTs);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats a Date into a relative time label (e.g. "2 minutes ago", "Today").
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return formatDate(timestamp);
}

/**
 * Returns a color class name based on quality score (0–100).
 */
export function getQualityColor(score: number): string {
  if (score >= 85) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 65) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Returns a label based on quality score.
 */
export function getQualityLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Great';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Low';
}

/**
 * Truncates a string to a max length with ellipsis.
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 3)}...`;
}

/**
 * Converts bytes → megabytes (float, 3 decimal places).
 */
export function bytesToMB(bytes: number): number {
  return parseFloat((bytes / (1024 * 1024)).toFixed(3));
}
