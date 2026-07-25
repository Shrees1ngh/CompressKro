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
  handlePdfToWord,
  handlePdfToExcel,
  handleOcrPdf,
  handleRepairPdf
} = require('../controllers/pdf.controller');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });

router.post('/compress-pdf', upload.single('file'), limitConcurrency, handleCompressPdf);
router.post('/lock-pdf', upload.single('file'), limitConcurrency, handleLockPdf);
router.post('/unlock-pdf', upload.single('file'), limitConcurrency, handleUnlockPdf);
router.post('/clean-pdf', upload.single('file'), limitConcurrency, handleCleanPdf);
router.post('/pdf-to-word', upload.single('file'), limitConcurrency, handlePdfToWord);
router.post('/pdf-to-excel', upload.single('file'), limitConcurrency, handlePdfToExcel);
router.post('/ocr-pdf', upload.single('file'), limitConcurrency, handleOcrPdf);
router.post('/repair-pdf', upload.single('file'), limitConcurrency, handleRepairPdf);

module.exports = router;
