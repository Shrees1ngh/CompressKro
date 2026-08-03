// ============================================================
// CompressKro PDF Editor — Font Mapper
// ============================================================
// Maps PDF font names to CSS font families and pdf-lib
// StandardFont keys. Uses a priority-ordered pattern table
// and Canvas measureText() for width calibration.
// ============================================================

import type { FontProperties } from '../core/types';
import { FONT_MAP, FALLBACK_FONT } from '../core/constants';

/**
 * Cache of already-resolved font mappings.
 * Key: normalized PDF font name. Value: resolved FontProperties.
 */
const fontCache = new Map<string, FontProperties>();

/**
 * Normalize a PDF font name for pattern matching.
 * Strips the common "ABCDEF+" prefix (subset tag), converts to lowercase,
 * and removes spaces/hyphens for fuzzy matching.
 */
function normalizeFontName(pdfFontName: string): string {
  // Strip subset prefix like "BCDEEE+" or "AAAAAB+"
  let name = pdfFontName.replace(/^[A-Z]{6}\+/, '');
  // Lowercase for case-insensitive matching
  name = name.toLowerCase();
  return name;
}

/**
 * Map a PDF font name to CSS + pdf-lib font properties.
 *
 * Strategy:
 * 1. Check cache.
 * 2. Normalize the font name (strip subset prefix, lowercase).
 * 3. Try each pattern in FONT_MAP (most specific first).
 * 4. If no match, infer weight/style from name keywords.
 * 5. Fall back to Helvetica.
 *
 * @param pdfFontName - The raw fontName string from PDF.js getTextContent().
 * @returns Resolved font properties.
 */
export function mapFont(pdfFontName: string): FontProperties {
  if (!pdfFontName) {
    return { pdfFontName: '', ...FALLBACK_FONT };
  }

  const cached = fontCache.get(pdfFontName);
  if (cached) return cached;

  const normalized = normalizeFontName(pdfFontName);

  // Try pattern matching from the font map
  for (const entry of FONT_MAP) {
    for (const pattern of entry.patterns) {
      if (normalized.includes(pattern)) {
        const result: FontProperties = {
          pdfFontName,
          ...entry.result,
        };
        fontCache.set(pdfFontName, result);
        return result;
      }
    }
  }

  // No direct pattern match — infer weight and style from keywords
  const isBold =
    normalized.includes('bold') ||
    normalized.includes('heavy') ||
    normalized.includes('black') ||
    normalized.includes('demi') ||
    normalized.includes('semibold');

  const isItalic =
    normalized.includes('italic') ||
    normalized.includes('oblique') ||
    normalized.includes('slant');

  // Determine family category
  let family: 'sans' | 'serif' | 'mono' = 'sans';
  if (
    normalized.includes('times') ||
    normalized.includes('georgia') ||
    normalized.includes('garamond') ||
    normalized.includes('palatino') ||
    normalized.includes('cambria') ||
    normalized.includes('serif')
  ) {
    family = 'serif';
  } else if (
    normalized.includes('courier') ||
    normalized.includes('consolas') ||
    normalized.includes('monaco') ||
    normalized.includes('mono')
  ) {
    family = 'mono';
  }

  // Build the standard font key
  let standardFontKey: string;
  let cssFontFamily: string;

  switch (family) {
    case 'serif':
      cssFontFamily = '"Times New Roman", Times, serif';
      standardFontKey = 'TimesRoman';
      if (isBold && isItalic) standardFontKey = 'TimesRomanBoldItalic';
      else if (isBold) standardFontKey = 'TimesRomanBold';
      else if (isItalic) standardFontKey = 'TimesRomanItalic';
      break;
    case 'mono':
      cssFontFamily = '"Courier New", Courier, monospace';
      standardFontKey = 'Courier';
      if (isBold && isItalic) standardFontKey = 'CourierBoldOblique';
      else if (isBold) standardFontKey = 'CourierBold';
      else if (isItalic) standardFontKey = 'CourierOblique';
      break;
    default: // sans
      cssFontFamily = 'Helvetica, Arial, sans-serif';
      standardFontKey = 'Helvetica';
      if (isBold && isItalic) standardFontKey = 'HelveticaBoldOblique';
      else if (isBold) standardFontKey = 'HelveticaBold';
      else if (isItalic) standardFontKey = 'HelveticaOblique';
      break;
  }

  const result: FontProperties = {
    pdfFontName,
    cssFontFamily,
    standardFontKey,
    weight: isBold ? 'bold' : 'normal',
    style: isItalic ? 'italic' : 'normal',
  };

  fontCache.set(pdfFontName, result);
  return result;
}

/**
 * Measures the width of a text string at a given font size using Canvas 2D.
 * Used to calibrate text widths and prevent overflow.
 *
 * @param text - The text string to measure.
 * @param fontSize - Font size in CSS pixels.
 * @param font - Resolved font properties.
 * @returns Width in CSS pixels.
 */
export function measureTextWidth(
  text: string,
  fontSize: number,
  font: FontProperties
): number {
  const canvas = getMeasureCanvas();
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${font.style} ${font.weight} ${fontSize}px ${font.cssFontFamily}`;
  return ctx.measureText(text).width;
}

/**
 * Measures detailed text metrics using Canvas 2D.
 *
 * @param text - The text string to measure.
 * @param fontSize - Font size in CSS pixels.
 * @param font - Resolved font properties.
 * @returns TextMetrics from Canvas 2D.
 */
export function measureTextMetrics(
  text: string,
  fontSize: number,
  font: FontProperties
): TextMetrics {
  const canvas = getMeasureCanvas();
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${font.style} ${font.weight} ${fontSize}px ${font.cssFontFamily}`;
  return ctx.measureText(text);
}

// Singleton offscreen canvas for text measurement
let _measureCanvas: HTMLCanvasElement | null = null;

function getMeasureCanvas(): HTMLCanvasElement {
  if (!_measureCanvas) {
    _measureCanvas = document.createElement('canvas');
    _measureCanvas.width = 1;
    _measureCanvas.height = 1;
  }
  return _measureCanvas;
}

/**
 * Clears the font cache. Useful for testing or when the user changes
 * system fonts.
 */
export function clearFontCache(): void {
  fontCache.clear();
}
