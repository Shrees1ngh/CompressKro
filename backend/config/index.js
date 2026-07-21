// ============================================================
// CompressKro Backend — Config
// ============================================================

module.exports = {
  PORT: process.env.PORT || 3001,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100 MB
  ALLOWED_IMAGE_MIMES: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/heic'],
  ALLOWED_PDF_MIME: 'application/pdf',
};
