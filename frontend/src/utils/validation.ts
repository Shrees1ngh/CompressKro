// ============================================================
// CompressKro — File Validation Utilities
// ============================================================

import { MAX_IMAGE_SIZE_MB, MAX_PDF_SIZE_MB, SUPPORTED_IMAGE_EXTENSIONS } from '../constants';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates an image file for format and size.
 */
export function validateImageFile(file: File): ValidationResult {
  if (!file) return { valid: false, error: 'No file provided.' };

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = file.type.toLowerCase();

  // Check MIME type or extension
  const validMime = mimeType.startsWith('image/') || mimeType === 'image/heic';
  const validExt = SUPPORTED_IMAGE_EXTENSIONS.includes(
    ext as (typeof SUPPORTED_IMAGE_EXTENSIONS)[number]
  );

  if (!validMime && !validExt) {
    return {
      valid: false,
      error: `Unsupported file type "${ext.toUpperCase()}". Accepted: JPG, PNG, WebP, AVIF, GIF, HEIC, SVG.`,
    };
  }

  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_IMAGE_SIZE_MB) {
    return {
      valid: false,
      error: `File is too large (${sizeMB.toFixed(1)} MB). Maximum allowed: ${MAX_IMAGE_SIZE_MB} MB.`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File appears to be empty or corrupted.' };
  }

  return { valid: true };
}

/**
 * Validates a PDF file for format and size.
 */
export function validatePdfFile(file: File): ValidationResult {
  if (!file) return { valid: false, error: 'No file provided.' };

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = file.type.toLowerCase();

  if (mimeType !== 'application/pdf' && ext !== 'pdf') {
    return {
      valid: false,
      error: `Invalid file type. Expected a PDF file, got "${ext.toUpperCase()}".`,
    };
  }

  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_PDF_SIZE_MB) {
    return {
      valid: false,
      error: `PDF is too large (${sizeMB.toFixed(1)} MB). Maximum allowed: ${MAX_PDF_SIZE_MB} MB.`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: 'PDF appears to be empty or corrupted.' };
  }

  return { valid: true };
}

/**
 * Validates multiple image files and returns per-file results.
 */
export function validateImageFiles(files: File[]): { file: File; result: ValidationResult }[] {
  return files.map(file => ({ file, result: validateImageFile(file) }));
}

/**
 * Returns only the valid files from a list, logging warnings for invalid ones.
 */
export function filterValidImageFiles(files: File[]): {
  valid: File[];
  errors: string[];
} {
  const valid: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const result = validateImageFile(file);
    if (result.valid) {
      valid.push(file);
    } else {
      errors.push(`${file.name}: ${result.error}`);
    }
  }

  return { valid, errors };
}
