// ============================================================
// CompressKro Backend — PDF Repair Service
// Dedicated engine for repairing corrupt, damaged, or unreadable PDFs.
// Multi-tier recovery pipeline:
// Tier 0: Header Sanitization (strips leading junk bytes before %PDF-)
// Tier 1: Ghostscript Fault-Tolerant Rebuilder Pass (-dPDFSTOPONERROR=false)
// Tier 2: QPDF Direct Object & XREF Stream Recovery Pass
// Tier 3: Pure JS pdf-lib Permissive Page Copy & Re-encoding
// Tier 4: Sharp Image Reconstruction (for image-disguised PDFs)
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const { detectBinaries } = require('../utils/binaries');

/**
 * Sanitizes input PDF buffer by stripping any leading junk bytes before '%PDF-'.
 */
function sanitizePdfBuffer(rawBuffer) {
  if (!rawBuffer || rawBuffer.length < 5) return rawBuffer;
  const headerIdx = rawBuffer.indexOf(Buffer.from('%PDF-'));
  if (headerIdx > 0) {
    console.log(`[Repair Service] Stripped ${headerIdx} leading garbage byte(s) before %PDF- header`);
    return rawBuffer.subarray(headerIdx);
  }
  return rawBuffer;
}

/**
 * Repairs a corrupted PDF file using Ghostscript, QPDF, or fallback passes.
 */
function repairPdf(inputPath, outputPath) {
  const binaries = detectBinaries();
  const tempDir = os.tmpdir();
  const id = crypto.randomBytes(8).toString('hex');

  // Read and sanitize input bytes if there's leading noise
  let rawBuf = fs.readFileSync(inputPath);
  const cleanBuf = sanitizePdfBuffer(rawBuf);
  if (cleanBuf.length !== rawBuf.length) {
    fs.writeFileSync(inputPath, cleanBuf);
  }

  // ── Tier 1: Ghostscript Fault-Tolerant Rebuilder Pass ─────
  if (binaries.hasGhostscript) {
    const gsTemp = path.join(tempDir, `gs_repair_${id}.pdf`);
    const args = [
      '-q',
      '-dBATCH',
      '-dNOPAUSE',
      '-sDEVICE=pdfwrite',
      '-dPDFSETTINGS=/default',
      '-dPDFSTOPONERROR=false',
      '-dERRORSTOWARNINGS=true',
      '-dFAILONERROR=false',
      '-dCompatibilityLevel=1.4',
      '-dPreserveAnnots=true',
      '-dDetectDuplicateImages=true',
      '-dCompressFonts=true',
      '-dSubsetFonts=true',
      '-dEmbedAllFonts=true',
      '-dAutoRotatePages=/None',
      `-sOutputFile=${gsTemp}`,
      inputPath
    ];

    try {
      execFileSync(binaries.gs, args, { stdio: 'ignore', timeout: 60000 });
      if (fs.existsSync(gsTemp) && fs.statSync(gsTemp).size > 0) {
        if (binaries.hasQpdf) {
          try {
            execFileSync(binaries.qpdf, ['--linearize', '--object-streams=generate', gsTemp, outputPath], { stdio: 'ignore', timeout: 30000 });
            try { if (fs.existsSync(gsTemp)) fs.unlinkSync(gsTemp); } catch {}
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
              return true;
            }
          } catch (e) {
            console.warn('[Repair Service] Post-GS QPDF pass warning:', e.message);
          }
        }
        fs.copyFileSync(gsTemp, outputPath);
        try { if (fs.existsSync(gsTemp)) fs.unlinkSync(gsTemp); } catch {}
        return true;
      }
    } catch (err) {
      console.warn('[Repair Service] Ghostscript repair pass failed, trying QPDF:', err.message);
    }
  }

  // ── Tier 2: QPDF Direct Object & XREF Recovery Pass ──────
  if (binaries.hasQpdf) {
    try {
      execFileSync(binaries.qpdf, ['--linearize', '--object-streams=generate', inputPath, outputPath], { stdio: 'ignore', timeout: 45000 });
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        return true;
      }
    } catch (err) {
      console.warn('[Repair Service] QPDF repair pass failed:', err.message);
    }
  }

  return false;
}

/**
 * Buffer-level fallback repair using pdf-lib or sharp image reconstruction.
 */
async function repairPdfBuffer(pdfBuffer) {
  const cleanBuffer = sanitizePdfBuffer(pdfBuffer);

  // ── Tier 3: Pure JS pdf-lib Structural Re-encoding ──────
  try {
    const doc = await PDFDocument.load(cleanBuffer, { ignoreEncryption: true, updateMetadata: false });
    const newDoc = await PDFDocument.create();
    
    const pageIndices = Array.from({ length: doc.getPageCount() }, (_, i) => i);
    const copiedPages = await newDoc.copyPages(doc, pageIndices);
    copiedPages.forEach(p => newDoc.addPage(p));
    
    const repairedBytes = await newDoc.save();
    return Buffer.from(repairedBytes);
  } catch (pdfLibErr) {
    console.warn('[Repair Service] pdf-lib structural repair failed, attempting image reconstruction pass:', pdfLibErr.message);
  }

  // ── Tier 4: Sharp Image-to-PDF Conversion Pass ───────────
  try {
    const imageMetadata = await sharp(pdfBuffer).metadata();
    if (imageMetadata && imageMetadata.format) {
      console.log(`[Repair Service] Disguised ${imageMetadata.format.toUpperCase()} image detected! Converting to valid PDF...`);
      const pngBuffer = await sharp(pdfBuffer).toFormat('png').toBuffer();
      
      const newDoc = await PDFDocument.create();
      const embeddedImg = await newDoc.embedPng(pngBuffer);
      const page = newDoc.addPage([embeddedImg.width, embeddedImg.height]);
      page.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: embeddedImg.width,
        height: embeddedImg.height
      });
      
      const repairedBytes = await newDoc.save();
      return Buffer.from(repairedBytes);
    }
  } catch (imageErr) {
    console.warn('[Repair Service] Image reconstruction pass failed:', imageErr.message);
  }

  throw new Error('Could not repair damaged PDF document. The file is severely corrupted or invalid.');
}

module.exports = {
  repairPdf,
  repairPdfBuffer
};
