// ============================================================
// CompressKro Backend — Config
// ============================================================

module.exports = {
  PORT: process.env.PORT || 3001,
  CORS_ORIGIN: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  MAX_FILE_SIZE: 20 * 1024 * 1024, // 20 MB max file size for OOM safety on 512MB container
  ALLOWED_IMAGE_MIMES: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/heic'],
  ALLOWED_PDF_MIME: 'application/pdf',
};
