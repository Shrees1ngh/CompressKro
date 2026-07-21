// ============================================================
// CompressKro — App-wide Constants
// ============================================================

/** Centralized localStorage key names — never scatter raw strings */
export const STORAGE_KEYS = {
  HISTORY: 'compresskro_history',
  STATS_FILES_PROCESSED: 'stats_files_processed',
  STATS_MB_SAVED: 'stats_mb_saved',
  THEME: 'compresskro_theme',
} as const;

/** Maximum number of history entries to keep */
export const HISTORY_LIMIT = 50;

/** Maximum file size accepted (MB) */
export const MAX_IMAGE_SIZE_MB = 50;
export const MAX_PDF_SIZE_MB = 100;

/** Supported image MIME types */
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/heic',
  'image/svg+xml',
] as const;

export const SUPPORTED_IMAGE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'heic', 'svg',
] as const;

/** Compression algorithm tuning */
export const COMPRESSION_CONFIG = {
  /** Number of binary search iterations for quality phase */
  QUALITY_SEARCH_STEPS: 20,
  /** Number of binary search iterations for dimension-reduced re-search */
  SCALE_QUALITY_STEPS: 12,
  /** Scale step when reducing dimensions (5% at a time — gradual, not aggressive) */
  SCALE_STEP: 0.05,
  /** Minimum scale factor before giving up */
  MIN_SCALE: 0.15,
  /** Convergence threshold for binary search — stop if range is smaller than this */
  CONVERGENCE_THRESHOLD: 0.003,
  /** Starting quality for target-size mode */
  INITIAL_QUALITY: 0.9,
  /** Minimum quality for JPEG output */
  MIN_QUALITY_JPEG: 0.03,
  /** Minimum quality for PNG (canvas.toBlob ignores quality for PNG, but used for logic) */
  MIN_QUALITY_PNG: 0.01,
} as const;

/** Image analysis thresholds */
export const ANALYSIS_CONFIG = {
  /** If estimated JPEG saving over PNG is > this, recommend JPEG */
  FORMAT_RECOMMEND_THRESHOLD: 0.3,
  /** Threshold for "high compression potential" */
  HIGH_POTENTIAL_THRESHOLD: 0.6,
  /** Threshold for "medium compression potential" */
  MEDIUM_POTENTIAL_THRESHOLD: 0.3,
} as const;

/** Quality score weights */
export const QUALITY_SCORE_CONFIG = {
  /** Weight for quality parameter (0–1) */
  QUALITY_WEIGHT: 0.6,
  /** Weight for size reduction (lower = more score) */
  SIZE_WEIGHT: 0.4,
} as const;

/** Backend API Base URL configuration */
export const BACKEND_API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/api`;

/** PDF compression level configurations */
export const PDF_COMPRESSION_CONFIGS = {
  best: {
    imageQuality: 85,
    resizeScale: 0.9,
    label: 'Best Quality',
    desc: 'High resolution images, minimal compression'
  },
  balanced: {
    imageQuality: 65,
    resizeScale: 0.75,
    label: 'Balanced',
    desc: 'Optimal size and visual quality'
  },
  smallest: {
    imageQuality: 40,
    resizeScale: 0.5,
    label: 'Smallest File',
    desc: 'Aggressive compression, lower resolution images'
  }
} as const;
