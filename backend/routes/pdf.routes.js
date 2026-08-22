// ============================================================
// CompressKro Backend — PDF Routes
// ============================================================

const express = require('express');
const multer = require('multer');
const { MAX_FILE_SIZE } = require('../config');
const limitConcurrency = require('../middlewares/concurrencyLimiter');
const { 
  handleCompressPdf,
  handleLockPdf,
  handleUnlockPdf,
  handleCleanPdf,
  handleRepairPdf,
  handleHtmlToPdf,
  handleExtractImages
} = require('../controllers/pdf.controller');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });

router.post('/compress-pdf', upload.single('file'), limitConcurrency, handleCompressPdf);
router.post('/lock-pdf', upload.single('file'), limitConcurrency, handleLockPdf);
router.post('/unlock-pdf', upload.single('file'), limitConcurrency, handleUnlockPdf);
router.post('/clean-pdf', upload.single('file'), limitConcurrency, handleCleanPdf);
router.post('/repair-pdf', upload.single('file'), limitConcurrency, handleRepairPdf);
router.post('/html-to-pdf', limitConcurrency, handleHtmlToPdf);
router.post('/extract-images', upload.single('file'), limitConcurrency, handleExtractImages);

module.exports = router;
