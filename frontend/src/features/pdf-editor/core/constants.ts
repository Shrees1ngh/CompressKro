// ============================================================
// CompressKro PDF Editor — Constants
// ============================================================
// Centralized configuration values, defaults, and lookup tables.
// ============================================================

import type { FontProperties, AffineMatrix } from './types';

// ---- Rendering ----

/** Default zoom level (1.0 = 100%). */
export const DEFAULT_ZOOM = 1.0;

/** Minimum allowed zoom. */
export const MIN_ZOOM = 0.25;

/** Maximum allowed zoom. */
export const MAX_ZOOM = 4.0;

/** Zoom step for Ctrl+scroll or button clicks. */
export const ZOOM_STEP = 0.1;

/** DPR-aware rendering scale multiplier. */
export const getDevicePixelRatio = (): number =>
  Math.min(window.devicePixelRatio || 1, 3);

// ---- Virtual Scrolling ----

/** Number of pages to render above/below the visible viewport. */
export const PAGE_RENDER_BUFFER = 1;

/** Thumbnail rendering scale (relative to PDF points). */
export const THUMBNAIL_SCALE = 0.2;

// ---- Editor Defaults ----

/** Default font size for new text objects (in PDF points). */
export const DEFAULT_FONT_SIZE = 14;

/** Default text color. */
export const DEFAULT_TEXT_COLOR = '#000000';

/** Default shape stroke color. */
export const DEFAULT_SHAPE_STROKE_COLOR = '#ef4444';

/** Default shape stroke width in points. */
export const DEFAULT_SHAPE_STROKE_WIDTH = 2;

/** Default opacity for new objects. */
export const DEFAULT_OPACITY = 1.0;

/** Default letter spacing for text. */
export const DEFAULT_LETTER_SPACING = 0;

/** Default line height multiplier. */
export const DEFAULT_LINE_HEIGHT = 1.2;

/** Minimum drag distance (in viewport pixels) to register as a drawn shape. */
export const MIN_DRAW_DISTANCE = 4;

/** Minimum dimension for a resized object (viewport pixels). */
export const MIN_RESIZE_DIMENSION = 10;

/** Maximum undo history depth. */
export const MAX_HISTORY_DEPTH = 100;

// ---- Identity Matrix ----

export const IDENTITY_MATRIX: AffineMatrix = [1, 0, 0, 1, 0, 0];

// ---- Font Mapping ----

/**
 * Maps common PDF font substrings to CSS font families and pdf-lib StandardFont keys.
 * Order matters: first match wins. More specific patterns should come first.
 */
export const FONT_MAP: Array<{
  /** Substring patterns to match against the PDF font name (case-insensitive). */
  patterns: string[];
  /** Resulting font properties. */
  result: Omit<FontProperties, 'pdfFontName'>;
}> = [
  // Bold Italic variants
  {
    patterns: ['helvetica-boldoblique', 'helveticaboldoblique', 'arial-bolditalic', 'arialbolditalic'],
    result: {
      cssFontFamily: 'Helvetica, Arial, sans-serif',
      standardFontKey: 'HelveticaBoldOblique',
      weight: 'bold',
      style: 'italic',
    },
  },
  {
    patterns: ['times-bolditalic', 'timesbolditalic', 'timesnewroman-bolditalic'],
    result: {
      cssFontFamily: '"Times New Roman", Times, serif',
      standardFontKey: 'TimesRomanBoldItalic',
      weight: 'bold',
      style: 'italic',
    },
  },
  {
    patterns: ['courier-boldoblique', 'courierboldoblique'],
    result: {
      cssFontFamily: '"Courier New", Courier, monospace',
      standardFontKey: 'CourierBoldOblique',
      weight: 'bold',
      style: 'italic',
    },
  },
  // Bold variants
  {
    patterns: ['helvetica-bold', 'helveticabold', 'arial-bold', 'arialbold', 'arialmt-bold'],
    result: {
      cssFontFamily: 'Helvetica, Arial, sans-serif',
      standardFontKey: 'HelveticaBold',
      weight: 'bold',
      style: 'normal',
    },
  },
  {
    patterns: ['times-bold', 'timesbold', 'timesnewroman-bold', 'timesnewromanps-boldmt'],
    result: {
      cssFontFamily: '"Times New Roman", Times, serif',
      standardFontKey: 'TimesRomanBold',
      weight: 'bold',
      style: 'normal',
    },
  },
  {
    patterns: ['courier-bold', 'courierbold', 'couriernew-bold'],
    result: {
      cssFontFamily: '"Courier New", Courier, monospace',
      standardFontKey: 'CourierBold',
      weight: 'bold',
      style: 'normal',
    },
  },
  // Italic/Oblique variants
  {
    patterns: ['helvetica-oblique', 'helveticaoblique', 'arial-italic', 'arialitalic'],
    result: {
      cssFontFamily: 'Helvetica, Arial, sans-serif',
      standardFontKey: 'HelveticaOblique',
      weight: 'normal',
      style: 'italic',
    },
  },
  {
    patterns: ['times-italic', 'timesitalic', 'timesnewroman-italic', 'timesnewromanps-italicmt'],
    result: {
      cssFontFamily: '"Times New Roman", Times, serif',
      standardFontKey: 'TimesRomanItalic',
      weight: 'normal',
      style: 'italic',
    },
  },
  {
    patterns: ['courier-oblique', 'courieroblique', 'couriernew-italic'],
    result: {
      cssFontFamily: '"Courier New", Courier, monospace',
      standardFontKey: 'CourierOblique',
      weight: 'normal',
      style: 'italic',
    },
  },
  // Regular variants (must come after bold/italic to avoid premature matching)
  {
    patterns: ['helvetica', 'arial', 'arialmt', 'sans-serif'],
    result: {
      cssFontFamily: 'Helvetica, Arial, sans-serif',
      standardFontKey: 'Helvetica',
      weight: 'normal',
      style: 'normal',
    },
  },
  {
    patterns: ['times', 'timesnewroman', 'timesroman', 'serif'],
    result: {
      cssFontFamily: '"Times New Roman", Times, serif',
      standardFontKey: 'TimesRoman',
      weight: 'normal',
      style: 'normal',
    },
  },
  {
    patterns: ['courier', 'couriernew', 'monospace'],
    result: {
      cssFontFamily: '"Courier New", Courier, monospace',
      standardFontKey: 'Courier',
      weight: 'normal',
      style: 'normal',
    },
  },
];

/**
 * Fallback font properties when no pattern matches.
 * Uses Helvetica (the PDF standard default).
 */
export const FALLBACK_FONT: Omit<FontProperties, 'pdfFontName'> = {
  cssFontFamily: 'Helvetica, Arial, sans-serif',
  standardFontKey: 'Helvetica',
  weight: 'normal',
  style: 'normal',
};

// ---- Color Presets ----

export const TEXT_COLOR_PRESETS = [
  '#000000',
  '#ef4444',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ffffff',
] as const;

export const SHAPE_COLOR_PRESETS = [
  '#ef4444',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#000000',
  '#8b5cf6',
] as const;

export const SIGNATURE_PEN_COLORS = [
  '#000000',
  '#1e3a8a',
  '#10b981',
  '#ef4444',
] as const;

// ---- PDF Standard Font Keys ----
// These correspond to pdf-lib's StandardFonts enum values.

export const STANDARD_FONT_KEYS = [
  'Helvetica',
  'HelveticaBold',
  'HelveticaOblique',
  'HelveticaBoldOblique',
  'TimesRoman',
  'TimesRomanBold',
  'TimesRomanItalic',
  'TimesRomanBoldItalic',
  'Courier',
  'CourierBold',
  'CourierOblique',
  'CourierBoldOblique',
] as const;

export type StandardFontKey = (typeof STANDARD_FONT_KEYS)[number];
