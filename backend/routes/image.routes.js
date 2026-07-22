// ============================================================
// CompressKro Backend — Image Routes v3.0
// ============================================================

const express = require('express');
const multer = require('multer');
const { MAX_FILE_SIZE } = require('../config');
const limitConcurrency = require('../middlewares/concurrencyLimiter');
const { 
  handleCompressImage, 
  handleConvertHeic, 
  handleConvertImage, 
  handleAnalyzeImage 
} = require('../controllers/image.controller');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });

router.post('/compress-image', upload.single('file'), limitConcurrency, handleCompressImage);
router.post('/convert-heic', upload.single('file'), limitConcurrency, handleConvertHeic);
router.post('/convert-image', upload.single('file'), limitConcurrency, handleConvertImage);
router.post('/analyze-image', upload.single('file'), handleAnalyzeImage);

module.exports = router;
