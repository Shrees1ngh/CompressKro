// ============================================================
// CompressKro Backend — PDF Orchestrator Service
// Modular, lightweight orchestrator routing PDF compression through
// MuPDF, Ghostscript, qpdf, OCRmyPDF, or pure JS pdf-lib/Sharp fallback.
// ============================================================

const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const { analyzePdfDoc } = require('./pdf.analyzer');
const { isGhostscriptAvailable, processGhostscript } = require('./ghostscript.service');
const { isQpdfAvailable, processQpdf } = require('./qpdf.service');
const { isMuPdfAvailable, processMuPdf } = require('./mupdf.service');
const { isOcrAvailable, processOcr } = require('./ocr.service');
const { prepareDocForCompression, runCompressionPass, getCompressionParams } = require('./pdf.optimizer');

/**
 * Executes CLI-based pipeline depending on category and available tools.
 */
function runCliPipeline(inputBuffer, profile, category, options) {
  const hasGs = isGhostscriptAvailable();
  const hasQpdf = isQpdfAvailable();
  const hasMuPdf = isMuPdfAvailable();
  const hasOcr = isOcrAvailable();

  if (!hasGs && !hasQpdf && !hasMuPdf && (!options.doOcr || !hasOcr)) {
    return null; // Fall back to pure JS optimizer
  }

  const tempDir = os.tmpdir();
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const inputTemp = path.join(tempDir, `input_${uniqueId}.pdf`);

  const createdFiles = [inputTemp];

  try {
    fs.writeFileSync(inputTemp, inputBuffer);
    let currentFile = inputTemp;

    // SCANNED PDF WITH OCR ENABLED
    if (options.doOcr && hasOcr) {
      const ocrTemp = path.join(tempDir, `ocr_${uniqueId}.pdf`);
      createdFiles.push(ocrTemp);
      if (processOcr(currentFile, ocrTemp)) {
        currentFile = ocrTemp;
      }
    }

    // TEXT / VECTOR / FONT HEAVY PDF PIPELINE: MuPDF -> qpdf -> Ghostscript
    if (category === 'text' || category === 'vectorHeavy' || category === 'fontHeavy') {
      if (hasMuPdf) {
        const muTemp = path.join(tempDir, `mu_${uniqueId}.pdf`);
        createdFiles.push(muTemp);
        if (processMuPdf(currentFile, muTemp)) {
          currentFile = muTemp;
        }
      }

      if (hasQpdf) {
        const qpdfTemp = path.join(tempDir, `qpdf_${uniqueId}.pdf`);
        createdFiles.push(qpdfTemp);
        if (processQpdf(currentFile, qpdfTemp)) {
          currentFile = qpdfTemp;
        }
      }

      if (hasGs) {
        const gsTemp = path.join(tempDir, `gs_${uniqueId}.pdf`);
        createdFiles.push(gsTemp);
        if (processGhostscript(currentFile, gsTemp, profile, category)) {
          const gsBuffer = fs.readFileSync(gsTemp);
          const currentBuffer = fs.readFileSync(currentFile);
          // Ghostscript accepted only if it actually reduced size further
          if (gsBuffer.length < currentBuffer.length) {
            currentFile = gsTemp;
          }
        }
      }
    } else {
      // IMAGE / SCANNED PDF PIPELINE: Ghostscript -> qpdf
      if (hasGs) {
        const gsTemp = path.join(tempDir, `gs_${uniqueId}.pdf`);
        createdFiles.push(gsTemp);
        if (processGhostscript(currentFile, gsTemp, profile, category)) {
          currentFile = gsTemp;
        }
      }

      if (hasQpdf) {
        const qpdfTemp = path.join(tempDir, `qpdf_${uniqueId}.pdf`);
        createdFiles.push(qpdfTemp);
        if (processQpdf(currentFile, qpdfTemp)) {
          currentFile = qpdfTemp;
        }
      }
    }

    const finalBuffer = fs.readFileSync(currentFile);
    if (finalBuffer.length < inputBuffer.length) {
      return finalBuffer;
    }
  } catch (err) {
    console.warn('[PDF Orchestrator] CLI pipeline exception, switching to pure JS engine:', err.message);
  } finally {
    createdFiles.forEach(f => {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    });
  }

  return null;
}

/**
 * Main PDF Compression Orchestrator.
 */
async function compressPdf(inputBuffer, level, targetSizeKB, options = {}) {
  const startTime = Date.now();
  const originalSize = inputBuffer.length;

  let pdfDoc;
  try {
    pdfDoc = await PDFDocument.load(inputBuffer, { updateMetadata: false });
  } catch (loadErr) {
    if (
      loadErr.message.includes('encrypted') ||
      loadErr.message.includes('password') ||
      loadErr.message.includes('Encrypted')
    ) {
      const encryptErr = new Error('Password protected or encrypted PDFs are not supported.');
      encryptErr.statusCode = 400;
      throw encryptErr;
    }
    throw loadErr;
  }

  if (pdfDoc.isEncrypted) {
    const encryptErr = new Error('Password protected or encrypted PDFs are not supported.');
    encryptErr.statusCode = 400;
    throw encryptErr;
  }

  const initialAnalysis = await analyzePdfDoc(pdfDoc, originalSize);
  const { quality, targetDPI, stripMetadata, profile } = getCompressionParams(level, targetSizeKB, originalSize);

  // Step 1 & 2: Select and attempt CLI Pipeline first
  const cliBuffer = runCliPipeline(inputBuffer, profile, initialAnalysis.category, options);
  if (cliBuffer) {
    const compressionTime = Date.now() - startTime;
    return {
      buffer: cliBuffer,
      report: {
        originalSize,
        compressedSize: cliBuffer.length,
        savedPercent: Math.max(0, Math.round(((originalSize - cliBuffer.length) / originalSize) * 100)),
        pages: initialAnalysis.pageCount,
        imagesOptimized: initialAnalysis.imageCount,
        metadataRemoved: stripMetadata,
        fontsPreserved: initialAnalysis.fontsPreserved.length,
        compressionTime,
        warnings: []
      }
    };
  }

  // Pure JS Pipeline Fallback
  let docToCompress = await prepareDocForCompression(pdfDoc, stripMetadata);
  let passResult = await runCompressionPass(docToCompress, quality, targetDPI);

  let compressedBytes = await docToCompress.save({
    useObjectStreams: true,
    addDefaultPage: false
  });

  const targetBytes = targetSizeKB ? targetSizeKB * 1024 : null;

  // Corrective retry if over target bounds
  if (targetBytes && compressedBytes.length > targetBytes * 1.10) {
    const steps = [
      { quality: 60, dpi: 110 },
      { quality: 45, dpi: 90 },
      { quality: 35, dpi: 72 },
      { quality: 28, dpi: 60 },
      { quality: 22, dpi: 50 },
    ];

    let best = { bytes: compressedBytes, report: passResult };

    for (const step of steps) {
      if (best.bytes.length <= targetBytes * 1.10) break;

      const rawAttemptDoc = await PDFDocument.load(inputBuffer, { updateMetadata: false });
      const attemptDoc = await prepareDocForCompression(rawAttemptDoc, stripMetadata);

      const attemptResult = await runCompressionPass(attemptDoc, step.quality, step.dpi);
      const attemptBytes = await attemptDoc.save({ useObjectStreams: true, addDefaultPage: false });

      if (attemptBytes.length < best.bytes.length) {
        best = { bytes: attemptBytes, report: attemptResult };
      }
    }

    compressedBytes = best.bytes;
    passResult = best.report;
  }

  const compressionTime = Date.now() - startTime;

  return {
    buffer: compressedBytes,
    report: {
      originalSize,
      compressedSize: compressedBytes.length,
      savedPercent: Math.max(0, Math.round(((originalSize - compressedBytes.length) / originalSize) * 100)),
      pages: initialAnalysis.pageCount,
      imagesOptimized: passResult.imagesOptimized,
      metadataRemoved: stripMetadata,
      fontsPreserved: initialAnalysis.fontsPreserved.length,
      compressionTime,
      warnings: passResult.warnings
    }
  };
}

module.exports = {
  compressPdf,
  analyzePdfDoc
};
