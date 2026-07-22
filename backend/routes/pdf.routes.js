// ============================================================
// CompressKro Backend — PDF Routes
// ============================================================

const express = require('express');
const multer = require('multer');
const { MAX_FILE_SIZE } = require('../config');
const limitConcurrency = require('../middlewares/concurrencyLimiter');
const { handleCompressPdf } = require('../controllers/pdf.controller');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });

router.post('/compress-pdf', upload.single('file'), limitConcurrency, handleCompressPdf);

module.exports = router;
