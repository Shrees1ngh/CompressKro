// ============================================================
// CompressKro PDF Editor — Font Utilities
// ============================================================
// Maps selected font, weight, and style properties to standard
// PDF keys and CSS font-family strings.
// ============================================================

/**
 * Returns the correct pdf-lib StandardFonts key based on the
 * selected base font name, weight, and style.
 */
export function getStandardFontKey(fontName: string, isBold: boolean, isItalic: boolean): string {
  const base = fontName === 'TimesRoman' ? 'TimesRoman' : fontName === 'Courier' ? 'Courier' : 'Helvetica';

  if (base === 'Helvetica') {
    if (isBold && isItalic) return 'HelveticaBoldOblique';
    if (isBold) return 'HelveticaBold';
    if (isItalic) return 'HelveticaOblique';
    return 'Helvetica';
  }
  if (base === 'TimesRoman') {
    if (isBold && isItalic) return 'TimesRomanBoldItalic';
    if (isBold) return 'TimesRomanBold';
    if (isItalic) return 'TimesRomanItalic';
    return 'TimesRoman';
  }
  if (base === 'Courier') {
    if (isBold && isItalic) return 'CourierBoldOblique';
    if (isBold) return 'CourierBold';
    if (isItalic) return 'CourierOblique';
    return 'Courier';
  }
  return 'Helvetica';
}

/**
 * Returns the CSS font-family fallback matching the standard PDF font.
 */
export function getCssFontFamily(fontName: string): string {
  if (fontName === 'Courier') return '"Courier New", Courier, monospace';
  if (fontName === 'TimesRoman') return '"Times New Roman", Times, serif';
  return 'Helvetica, Arial, sans-serif';
}
