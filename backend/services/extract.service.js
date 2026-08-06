// ============================================================
// CompressKro Backend — PDF Image Extraction Service
// Locates and extracts embedded image XObjects from PDF stream context.
// ============================================================

const { PDFDocument, PDFRawStream, PDFName } = require('pdf-lib');
const AdmZip = require('adm-zip');
const sharp = require('sharp');
const { decodeRawStream } = require('./pdf.analyzer');

/**
 * Safely resolves an indirect reference or direct dictionary entry.
 */
function lookupDictEntry(dict, key, context) {
  if (!dict || !key || !context) return null;
  const directOrRef = dict.get(key);
  if (!directOrRef) return null;
  return context.lookup(directOrRef);
}

/**
 * Calculates number of color channels based on color space name or type.
 */
function getChannelCount(cs, context) {
  if (!cs) return 3;
  const resolvedCs = context.lookup(cs);
  if (resolvedCs === PDFName.of('DeviceGray')) return 1;
  if (resolvedCs === PDFName.of('DeviceCMYK')) return 4;
  if (resolvedCs === PDFName.of('DeviceRGB')) return 3;
  
  if (Array.isArray(resolvedCs) || (resolvedCs && typeof resolvedCs.get === 'function')) {
    const name = typeof resolvedCs.get === 'function' ? resolvedCs.get(0) : resolvedCs[0];
    if (name === PDFName.of('Indexed')) {
      const base = typeof resolvedCs.get === 'function' ? resolvedCs.get(1) : resolvedCs[1];
      return getChannelCount(base, context);
    }
  }
  return 3;
}

/**
 * Searches PDF stream objects and extracts embedded JPEG/PNG image assets.
 */
async function extractImagesFromPdf(pdfBuffer) {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { updateMetadata: false });
  const context = pdfDoc.context;
  const zip = new AdmZip();
  let imageCount = 0;

  const indirectObjects = context.enumerateIndirectObjects();

  for (const [ref, obj] of indirectObjects) {
    if (obj instanceof PDFRawStream) {
      const dict = obj.dict;
      const subtype = lookupDictEntry(dict, PDFName.of('Subtype'), context);
      
      if (subtype === PDFName.of('Image')) {
        const widthObj = lookupDictEntry(dict, PDFName.of('Width'), context);
        const heightObj = lookupDictEntry(dict, PDFName.of('Height'), context);
        
        if (!widthObj || !heightObj) continue;
        
        const width = typeof widthObj.asNumber === 'function' ? widthObj.asNumber() : null;
        const height = typeof heightObj.asNumber === 'function' ? heightObj.asNumber() : null;
        
        if (!width || !height) continue;

        const filter = lookupDictEntry(dict, PDFName.of('Filter'), context);
        const colorSpace = lookupDictEntry(dict, PDFName.of('ColorSpace'), context);
        
        let ext = 'png';
        let imgBuffer = null;

        // Decode raw stream using helper from analyzer
        let decodedBytes;
        try {
          decodedBytes = decodeRawStream(obj);
        } catch (err) {
          console.warn('[Extract Service] Failed to decode raw stream, skipping:', err.message);
          continue;
        }

        if (!decodedBytes || decodedBytes.length === 0) continue;

        // Check if image is encoded as DCT (JPEG format)
        const isJpeg = filter === PDFName.of('DCTDecode') || 
                       (filter && filter.toString().includes('DCTDecode'));

        if (isJpeg) {
          ext = 'jpg';
          imgBuffer = Buffer.from(decodedBytes);
        } else {
          // Process lossless / raw FlateDecode pixels
          const channels = getChannelCount(colorSpace, context);

          try {
            if (channels === 3 && decodedBytes.length >= width * height * 3) {
              imgBuffer = await sharp(Buffer.from(decodedBytes), {
                raw: { width, height, channels: 3 }
              }).png().toBuffer();
            } else if (channels === 1 && decodedBytes.length >= width * height) {
              imgBuffer = await sharp(Buffer.from(decodedBytes), {
                raw: { width, height, channels: 1 }
              }).png().toBuffer();
            } else {
              // Try general load
              imgBuffer = await sharp(Buffer.from(decodedBytes)).png().toBuffer();
            }
          } catch (err) {
            console.warn('[Extract Service] Raw image extraction failed, trying bypass:', err.message);
            continue;
          }
        }

        if (imgBuffer && imgBuffer.length > 0) {
          imageCount++;
          zip.addFile(`extracted_image_${imageCount}.${ext}`, imgBuffer);
        }
      }
    }
  }

  if (imageCount === 0) {
    throw new Error('No embedded images were found in the uploaded PDF file.');
  }

  return zip.toBuffer();
}

module.exports = {
  extractImagesFromPdf
};
