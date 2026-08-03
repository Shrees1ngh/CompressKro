// ============================================================
// CompressKro PDF Editor — Color Utilities
// ============================================================
// Hex ↔ RGB conversions and color parsing.
// ============================================================

import type { RgbColor } from '../core/types';

/**
 * Parse a hex color string (e.g. "#ef4444" or "#FFF") to normalized RGB (0–1).
 * Returns black on invalid input.
 */
export function hexToRgb(hex: string): RgbColor {
  let cleaned = hex.replace('#', '');

  // Expand shorthand (#F00 → FF0000)
  if (cleaned.length === 3) {
    cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2];
  }

  const num = parseInt(cleaned, 16);
  if (isNaN(num)) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: ((num >> 16) & 0xff) / 255,
    g: ((num >> 8) & 0xff) / 255,
    b: (num & 0xff) / 255,
  };
}

/**
 * Convert normalized RGB (0–1) to a hex color string.
 */
export function rgbToHex(color: RgbColor): string {
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/**
 * Convert normalized RGB to a `rgb(r, g, b)` CSS string (0–255 range).
 */
export function rgbToCss(color: RgbColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Attempts to extract a hex color from PDF graphics state color array.
 * PDF color arrays are typically [r, g, b] in 0–1 range.
 * Returns hex string, or null if the input is not a valid color array.
 */
export function pdfColorArrayToHex(colorArray: number[] | null | undefined): string | null {
  if (!colorArray || !Array.isArray(colorArray) || colorArray.length < 3) {
    return null;
  }
  return rgbToHex({
    r: colorArray[0],
    g: colorArray[1],
    b: colorArray[2],
  });
}

/**
 * Returns true if two hex colors are visually identical
 * (ignoring case and shorthand differences).
 */
export function colorsEqual(a: string, b: string): boolean {
  return hexToRgb(a).r === hexToRgb(b).r &&
         hexToRgb(a).g === hexToRgb(b).g &&
         hexToRgb(a).b === hexToRgb(b).b;
}
