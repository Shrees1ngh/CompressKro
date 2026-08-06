// ============================================================
// CompressKro Backend — HTML & URL to PDF Service
// Compiles HTML markup or fetches web URLs and renders to PDF.
// Uses Puppeteer headless browser, falls back to simple parsing.
// ============================================================

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// Lazy load Puppeteer
let puppeteerModule = null;
function getPuppeteer() {
  if (!puppeteerModule) {
    try {
      puppeteerModule = require('puppeteer');
    } catch (err) {
      console.warn('[HTML Service] Puppeteer is not installed or failed to load:', err.message);
    }
  }
  return puppeteerModule;
}

/**
 * Sanitizes input text to only contain valid WinAnsi characters to prevent pdf-lib layout crashes.
 */
function sanitizeForWinAnsi(text) {
  if (!text) return '';
  return text
    .replace(/[\u201c\u201d]/g, '"') // smart double quotes
    .replace(/[\u2018\u2019]/g, "'") // smart single quotes
    .replace(/\u2014/g, '-')       // em dash
    .replace(/\u2013/g, '-')       // en dash
    .replace(/\u2022/g, '*')       // bullet
    .replace(/[^\x00-\x7F]/g, ''); // strip all other non-ASCII characters
}

/**
 * Strips HTML tags or returns elements.
 * Simple regex scanner that returns block tokens.
 */
function parseHtmlToTokens(htmlText) {
  let cleanText = htmlText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  const tokenRegex = /(<h[1-6][^>]*>.*?<\/h[1-6]>|<p[^>]*>.*?<\/p>|<li[^>]*>.*?<\/li>|<br\s*\/?>)/gi;
  let matches = cleanText.match(tokenRegex);
  
  if (!matches || matches.length === 0) {
    return cleanText.split('\n').filter(p => p.trim().length > 0).map(p => ({
      tag: 'p',
      text: sanitizeForWinAnsi(p.trim())
    }));
  }

  return matches.map(m => {
    const tagMatch = m.match(/^<([a-z0-9]+)/i);
    const tag = tagMatch ? tagMatch[1].toLowerCase() : 'p';
    let text = m.replace(/<[^>]+>/g, '').trim();
    
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ');

    return { tag, text: sanitizeForWinAnsi(text) };
  }).filter(t => t.text.length > 0 || t.tag === 'br');
}

/**
 * Fallback primitive HTML to PDF compiler using pdf-lib.
 */
async function fallbackHtmlToPdf(htmlString) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();
  const margin = 50;
  const contentWidth = width - (margin * 2);
  let yPosition = height - margin;

  const tokens = parseHtmlToTokens(htmlString);

  for (const token of tokens) {
    let size = 11;
    let useFont = font;
    let leading = 15;
    let spacingAfter = 8;
    let color = rgb(0.15, 0.15, 0.15);

    if (token.tag === 'h1') {
      size = 22;
      useFont = boldFont;
      leading = 26;
      spacingAfter = 14;
      color = rgb(0.1, 0.25, 0.5);
    } else if (token.tag === 'h2') {
      size = 18;
      useFont = boldFont;
      leading = 22;
      spacingAfter = 12;
      color = rgb(0.12, 0.28, 0.45);
    } else if (token.tag === 'h3') {
      size = 15;
      useFont = boldFont;
      leading = 18;
      spacingAfter = 10;
      color = rgb(0.15, 0.3, 0.4);
    } else if (token.tag === 'h4' || token.tag === 'h5' || token.tag === 'h6') {
      size = 12;
      useFont = boldFont;
      leading = 15;
      spacingAfter = 8;
    } else if (token.tag === 'li') {
      size = 11;
      useFont = font;
      leading = 15;
      spacingAfter = 4;
    } else if (token.tag === 'br') {
      yPosition -= 15;
      if (yPosition < margin) {
        page = pdfDoc.addPage([612, 792]);
        yPosition = height - margin;
      }
      continue;
    }

    const textToDraw = token.tag === 'li' ? `•  ${token.text}` : token.text;
    const indent = token.tag === 'li' ? 15 : 0;
    
    const words = textToDraw.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = useFont.widthOfTextAtSize(testLine, size);

      if (testWidth > contentWidth - indent) {
        page.drawText(currentLine, {
          x: margin + indent,
          y: yPosition,
          size,
          font: useFont,
          color
        });
        
        yPosition -= leading;
        if (yPosition < margin + 20) {
          page = pdfDoc.addPage([612, 792]);
          yPosition = height - margin;
        }
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      page.drawText(currentLine, {
        x: margin + indent,
        y: yPosition,
        size,
        font: useFont,
        color
      });
      yPosition -= (leading + spacingAfter);
      if (yPosition < margin + 20) {
        page = pdfDoc.addPage([612, 792]);
        yPosition = height - margin;
      }
    }
  }

  const pageCount = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();
  pages.forEach((p, idx) => {
    p.drawText(`Page ${idx + 1} of ${pageCount}`, {
      x: width / 2 - 25,
      y: 25,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5)
    });
  });

  return pdfDoc.save();
}

/**
 * Compiles HTML string or Web URL into a PDF document buffer
 */
async function convertHtmlToPdf(options) {
  const { html, url } = options;
  const puppeteer = getPuppeteer();

  if (!puppeteer) {
    if (url) {
      throw new Error('Puppeteer is not available on this server to render URLs.');
    }
    return fallbackHtmlToPdf(html);
  }

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    if (url) {
      // Ensure URL is properly formatted
      let targetUrl = url.trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'http://' + targetUrl;
      }
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    } else {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    }

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm'
      }
    });

    return pdfBuffer;
  } catch (err) {
    console.error('[HTML Service] Puppeteer rendering failed:', err.message);
    if (url) {
      throw new Error(`Failed to render URL: ${err.message}`);
    }
    // For HTML, we can fallback
    return fallbackHtmlToPdf(html);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Renders HTML markup or fetches web URLs and captures screen screenshot buffer.
 */
async function convertHtmlToImage(options) {
  const { html, url, format = 'png', width = 1200, height = 800, fullPage = false } = options;
  const puppeteer = getPuppeteer();

  if (!puppeteer) {
    throw new Error('Puppeteer engine is not available on this server to compile images.');
  }

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({
      width: parseInt(width) || 1200,
      height: parseInt(height) || 800
    });

    if (url) {
      let targetUrl = url.trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'http://' + targetUrl;
      }
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    } else {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    }

    const screenshotBuffer = await page.screenshot({
      type: format === 'png' ? 'png' : 'jpeg',
      fullPage: fullPage === 'true' || fullPage === true,
      quality: format === 'png' ? undefined : 85
    });

    return screenshotBuffer;
  } catch (err) {
    console.error('[HTML Service] Image screenshot failed:', err.message);
    throw new Error(`Failed to capture web screen: ${err.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  convertHtmlToPdf,
  convertHtmlToImage
};
