// ============================================================
// CompressKro PDF Editor — Text Extractor
// ============================================================
// Extracts text objects from PDF pages using PDF.js
// getTextContent(). Computes accurate bounding boxes using
// font metrics and the text transform matrix.
// ============================================================

import type { TextObject, Bounds, FontProperties } from '../core/types';
import { generateId } from '../core/id';
import { DEFAULT_TEXT_COLOR, DEFAULT_LETTER_SPACING, DEFAULT_LINE_HEIGHT } from '../core/constants';
import { mapFont, measureTextWidth } from './FontMapper';

/**
 * Raw text item from PDF.js getTextContent().items[].
 * We type the relevant fields explicitly instead of using `any`.
 */
interface PdfjsTextItem {
  str: string;
  dir: string;
  transform: number[]; // [a, b, c, d, tx, ty] — the text matrix
  width: number;       // Width in text space (already scaled by font matrix)
  height: number;      // Always 0 in pdfjs-dist 3.x
  fontName: string;    // e.g. "g_d0_f1" or "BCDEEE+ArialMT"
  hasEOL: boolean;     // True if this item ends a line
}

/**
 * Extracts text objects from a single PDF page.
 *
 * Architecture notes:
 * - PDF.js returns text items with a 6-element transform matrix.
 *   The matrix is [a, b, c, d, tx, ty] where:
 *     - a, d = scale factors (may include font size)
 *     - b, c = rotation/skew
 *     - tx, ty = position in PDF user-space
 * - `item.width` is already in PDF user-space (text space × font scale).
 * - `item.height` is always 0 in pdfjs-dist 3.x — we must compute it
 *   from the font size derived from the transform matrix.
 * - Font size = sqrt(a² + b²) which is the magnitude of the first
 *   column of the transform matrix. This gives the effective font size
 *   in PDF points, which is correct for text that is uniformly scaled.
 *
 * @param page - A PDF.js page proxy (from pdfjsDoc.getPage(n)).
 * @param pageIndex - Zero-based page index.
 * @returns Array of TextObject instances.
 */
export async function extractTextObjects(
  page: any,
  pageIndex: number
): Promise<TextObject[]> {
  const textContent = await page.getTextContent();
  const items: PdfjsTextItem[] = textContent.items;
  const styles: Record<string, any> = textContent.styles || {};

  const textObjects: TextObject[] = [];

  for (const item of items) {
    // Skip empty strings and whitespace-only items
    if (!item.str || item.str.trim() === '') continue;

    const [a, b, _c, _d, tx, ty] = item.transform;

    // ---- Compute font size ----
    // The magnitude of the first column [a, b] gives the effective
    // vertical scale, which corresponds to the font size in PDF points.
    const fontSize = Math.sqrt(a * a + b * b);

    // Skip degenerate text (font size 0 or very small)
    if (fontSize < 0.5) continue;

    // ---- Compute rotation ----
    // Rotation angle in degrees from the transform matrix.
    // atan2(b, a) gives the angle of the first column vector.
    const rotationRad = Math.atan2(b, a);
    const rotationDeg = (rotationRad * 180) / Math.PI;

    // ---- Compute bounding box ----
    // item.width is in PDF user-space (already accounts for font scaling
    // and character advances). This is the correct width.
    const textWidth = item.width;

    // Height: use font size as a reasonable approximation.
    // PDF fonts typically have ascent ~0.8em and descent ~0.2em,
    // so the full glyph height ≈ fontSize.
    // For more accurate bounds, we'd need the font's ascent/descent
    // metrics, which aren't available through getTextContent().
    // We use 1.0 × fontSize as height — this tightly hugs the visible glyphs
    // without adding excessive padding.
    const textHeight = fontSize;

    // ---- Position ----
    // tx, ty is the text baseline position in PDF user-space.
    // PDF Y-axis points up, so ty is the baseline Y coordinate.
    // The bounding box bottom should be at the baseline minus descent.
    // We approximate descent as 0.2 × fontSize.
    const descent = fontSize * 0.2;
    const bounds: Bounds = {
      x: tx,
      y: ty - descent,           // Bottom of bounding box (below baseline)
      width: Math.max(textWidth, 1), // Ensure non-zero width
      height: textHeight,
    };

    // ---- Font resolution ----
    // Try to get the actual font family name from the styles dict,
    // falling back to the fontName reference key.
    let fontNameStr = item.fontName;
    const style = styles[item.fontName];
    if (style && style.fontFamily) {
      fontNameStr = style.fontFamily;
    }

    const font: FontProperties = mapFont(fontNameStr);

    // ---- Build TextObject ----
    const textObject: TextObject = {
      id: generateId('txt'),
      type: 'text',
      pageIndex,
      bounds,
      rotation: Math.abs(rotationDeg) < 0.1 ? 0 : Math.round(rotationDeg),
      opacity: 1,
      zIndex: 0,
      locked: false,
      origin: 'extracted',
      text: item.str,
      originalText: item.str,
      fontSize,
      font,
      color: DEFAULT_TEXT_COLOR, // Will be overridden by color extraction if available
      letterSpacing: DEFAULT_LETTER_SPACING,
      lineHeight: DEFAULT_LINE_HEIGHT,
      alignment: 'left',
      isModified: false,
    };

    textObjects.push(textObject);
  }

  return textObjects;
}

/**
 * Calibrates a text object's bounding box width using Canvas measureText.
 * This corrects for cases where PDF.js's reported width doesn't match
 * the rendered width with the mapped CSS font.
 *
 * Only adjusts width — doesn't modify height or position.
 *
 * @param obj - The text object to calibrate.
 * @param viewportScale - Current viewport scale for pixel conversion.
 * @returns The text object with calibrated bounds.width.
 */
export function calibrateTextWidth(
  obj: TextObject,
  viewportScale: number
): TextObject {
  const measuredPx = measureTextWidth(obj.text, obj.fontSize * viewportScale, obj.font);
  const measuredPts = measuredPx / viewportScale;

  // Only adjust if the measured width differs significantly (>10%)
  const ratio = measuredPts / obj.bounds.width;
  if (ratio > 0.9 && ratio < 1.1) {
    return obj; // Close enough, keep original
  }

  return {
    ...obj,
    bounds: {
      ...obj.bounds,
      width: measuredPts,
    },
  };
}
