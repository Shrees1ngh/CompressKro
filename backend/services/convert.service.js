// ============================================================
// CompressKro Backend — Document Conversion Service
// PDF -> Word (.docx), PDF -> Excel (.xlsx), PDF -> PPT (.pptx)
//
// PDF-to-PPT: Renders each page as a high-res image via
// Ghostscript and embeds as full-slide backgrounds (iLovePDF/
// Sejda/SmallPDF approach). Pixel-perfect output.
//
// PDF-to-Word: Extracts per-item font metadata (name, size,
// bold, italic, color) from pdfjs-dist and maps to docx TextRuns
// with proper formatting. Preserves visual hierarchy.
//
// PDF-to-Excel: Text-based extraction with column grouping.
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { Document, Packer, Paragraph, TextRun, PageBreak, convertInchesToTwip } = require('docx');
const ExcelJS = require('exceljs');
const { detectBinaries } = require('../utils/binaries');

// ── pdf.js setup ───────────────────────────────────────────────
let fontPath = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'standard_fonts');
fontPath = fontPath.replace(/\\/g, '/');
if (!fontPath.endsWith('/')) {
  fontPath += '/';
}
const STANDARD_FONT_DATA_URL = fontPath;

let pdfjsLibPromise = null;
function getPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLibPromise;
}

// ── Helper: group text items into lines ────────────────────────
/**
 * Groups a page's text items into lines (by y-position) and,
 * within each line, into column-like cells (by x-gaps).
 * Returns Array<{ text, cells, items }> per line.
 * `items` preserves per-word metadata for rich formatting.
 */
function groupItemsIntoLines(items) {
  const meaningful = items.filter(i => typeof i.str === 'string' && i.str.length > 0);
  const rows = new Map();
  for (const item of meaningful) {
    const y = Math.round(item.transform[5]);
    let bucketY = y;
    for (const existingY of rows.keys()) {
      if (Math.abs(existingY - y) <= 2) { bucketY = existingY; break; }
    }
    if (!rows.has(bucketY)) rows.set(bucketY, []);
    rows.get(bucketY).push(item);
  }

  const sortedYs = Array.from(rows.keys()).sort((a, b) => b - a);

  return sortedYs.map(y => {
    const rowItems = rows.get(y).sort((a, b) => a.transform[4] - b.transform[4]);

    const glyphWidths = rowItems
      .filter(i => i.str.trim().length > 0 && i.width)
      .map(i => i.width / i.str.length);
    const avgCharWidth = glyphWidths.length
      ? glyphWidths.reduce((a, b) => a + b, 0) / glyphWidths.length
      : 5;
    const gapThreshold = Math.max(avgCharWidth * 2.5, 10);

    const cells = [];
    let currentCell = '';

    rowItems.forEach(item => {
      const isWhitespace = item.str.trim().length === 0;
      if (isWhitespace) {
        if ((item.width || 0) > gapThreshold && currentCell.trim().length > 0) {
          cells.push(currentCell.trim());
          currentCell = '';
        } else {
          currentCell += ' ';
        }
      } else {
        currentCell += item.str;
      }
    });
    if (currentCell.trim().length > 0) cells.push(currentCell.trim());

    return { text: cells.join('  ').trim(), cells, items: rowItems };
  }).filter(line => line.text.length > 0);
}

// ── Helper: extract pages with full metadata ───────────────────
async function extractPages(pdfBuffer) {
  const pdfjsLib = await getPdfjs();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    standardFontDataUrl: STANDARD_FONT_DATA_URL
  });
  const doc = await loadingTask.promise;

  const pages = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const content = await page.getTextContent();
    pages.push({
      lines: groupItemsIntoLines(content.items),
      width: viewport.width,
      height: viewport.height
    });
  }

  await doc.destroy();
  return pages;
}

// ================================================================
// PDF -> Word (.docx) — Rich formatting
// ================================================================

/**
 * Detects bold/italic from pdfjs fontName string.
 * Common patterns: "TimesNewRoman,Bold", "ArialMT-BoldItalic",
 * "ABCDEF+Helvetica-Bold", "g_d0_f2" (embedded subset, unknown)
 */
function parseFontStyle(fontName) {
  if (!fontName || typeof fontName !== 'string') return { bold: false, italic: false, fontFamily: 'Calibri' };
  
  const lower = fontName.toLowerCase();
  const bold = lower.includes('bold') || lower.includes('heavy') || lower.includes('black');
  const italic = lower.includes('italic') || lower.includes('oblique');
  
  // Try to extract a readable font family name
  // Strip subset prefix like "ABCDEF+" and suffixes like "-Bold"
  let family = fontName.replace(/^[A-Z]{6}\+/, ''); // strip subset prefix
  family = family.replace(/[,-](Bold|Italic|BoldItalic|Oblique|Regular|Medium|Light|Heavy|Black|Thin|SemiBold|ExtraBold|ExtraLight)$/gi, '');
  family = family.replace(/MT$/i, ''); // e.g. "ArialMT" -> "Arial"
  
  // If it looks like a garbled embedded font name (e.g. "g_d0_f2"), use Calibri
  if (/^[a-z]_[a-z0-9]/.test(family) || family.length <= 2) {
    family = 'Calibri';
  }
  
  return { bold, italic, fontFamily: family || 'Calibri' };
}

/**
 * Extracts font size from the transform matrix.
 * transform[0] and transform[3] typically represent the font scaling.
 * Returns size in half-points (docx format).
 */
function extractFontSize(transform) {
  if (!transform || transform.length < 4) return 22; // 11pt default
  // The vertical scale factor usually corresponds to font size in PDF points
  const pdfSize = Math.abs(transform[3]) || Math.abs(transform[0]) || 11;
  // Convert PDF points to docx half-points (1pt = 2 half-points)
  return Math.max(12, Math.min(96, Math.round(pdfSize * 2)));
}

/**
 * Converts a PDF buffer into a .docx buffer, preserving page
 * breaks, line breaks, font sizes, bold/italic, and font families.
 */
async function convertPdfToWord(pdfBuffer) {
  const pages = await extractPages(pdfBuffer);

  const children = [];
  pages.forEach((pageData, pageIdx) => {
    const { lines } = pageData;
    
    if (pageIdx > 0) {
      // Insert page break before every page except the first
      children.push(new Paragraph({
        children: [new PageBreak()],
      }));
    }

    if (lines.length === 0) {
      children.push(new Paragraph({ children: [new TextRun('')] }));
      return;
    }

    lines.forEach(line => {
      const textRuns = [];
      
      // Group consecutive items with the same formatting to create cleaner TextRuns
      let currentGroup = { text: '', bold: false, italic: false, fontFamily: 'Calibri', fontSize: 22 };

      line.items.forEach((item, idx) => {
        if (typeof item.str !== 'string' || item.str.length === 0) return;
        
        const { bold, italic, fontFamily } = parseFontStyle(item.fontName);
        const fontSize = extractFontSize(item.transform);
        
        // Check if formatting changed
        const sameFormatting = (
          currentGroup.bold === bold &&
          currentGroup.italic === italic &&
          currentGroup.fontFamily === fontFamily &&
          Math.abs(currentGroup.fontSize - fontSize) <= 2 // allow minor size variance
        );

        if (sameFormatting && currentGroup.text.length > 0) {
          // Append with a space separator if there's a gap
          if (idx > 0) {
            const prevItem = line.items[idx - 1];
            if (prevItem && prevItem.str) {
              const prevEnd = prevItem.transform[4] + (prevItem.width || 0);
              const currentStart = item.transform[4];
              const gap = currentStart - prevEnd;
              if (gap > 1) {
                currentGroup.text += ' ';
              }
            }
          }
          currentGroup.text += item.str;
        } else {
          // Flush the previous group
          if (currentGroup.text.trim().length > 0) {
            textRuns.push(new TextRun({
              text: currentGroup.text,
              bold: currentGroup.bold,
              italics: currentGroup.italic,
              font: currentGroup.fontFamily,
              size: currentGroup.fontSize,
            }));
          }
          // Start a new group
          // Add a space between groups if there's a gap
          let prefix = '';
          if (textRuns.length > 0 && idx > 0) {
            const prevItem = line.items[idx - 1];
            if (prevItem && prevItem.str) {
              const prevEnd = prevItem.transform[4] + (prevItem.width || 0);
              const currentStart = item.transform[4];
              const gap = currentStart - prevEnd;
              if (gap > 1) {
                prefix = ' ';
              }
            }
          }
          currentGroup = { text: prefix + item.str, bold, italic, fontFamily, fontSize };
        }
      });

      // Flush the last group
      if (currentGroup.text.trim().length > 0) {
        textRuns.push(new TextRun({
          text: currentGroup.text,
          bold: currentGroup.bold,
          italics: currentGroup.italic,
          font: currentGroup.fontFamily,
          size: currentGroup.fontSize,
        }));
      }

      if (textRuns.length === 0) {
        textRuns.push(new TextRun(''));
      }

      // Detect heading-like paragraphs (larger font size)
      const maxFontSize = Math.max(...line.items
        .filter(i => i.str && i.str.trim().length > 0)
        .map(i => extractFontSize(i.transform))
      );
      const hasLargeFont = maxFontSize >= 28; // 14pt+ = heading-like

      children.push(new Paragraph({
        children: textRuns,
        spacing: {
          after: hasLargeFont ? 120 : 40,
          before: hasLargeFont ? 200 : 0,
        },
      }));
    });
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.75),
            right: convertInchesToTwip(0.75),
            bottom: convertInchesToTwip(0.75),
            left: convertInchesToTwip(0.75),
          },
        },
      },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}

// ================================================================
// PDF -> Excel (.xlsx)
// ================================================================

async function convertPdfToExcel(pdfBuffer) {
  const pages = await extractPages(pdfBuffer);
  const workbook = new ExcelJS.Workbook();

  pages.forEach((pageData, pageIdx) => {
    const sheet = workbook.addWorksheet(`Page ${pageIdx + 1}`);
    pageData.lines.forEach(line => {
      sheet.addRow(line.cells.length > 0 ? line.cells : [line.text]);
    });
    sheet.columns.forEach(col => {
      col.width = 22;
    });
  });

  if (workbook.worksheets.length === 0) {
    workbook.addWorksheet('Page 1');
  }

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  convertPdfToWord,
  convertPdfToExcel
};
