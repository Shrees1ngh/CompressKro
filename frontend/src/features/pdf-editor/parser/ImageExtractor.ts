// ============================================================
// CompressKro PDF Editor — Image Extractor
// ============================================================
// Extracts image XObject positions from PDF pages by walking
// the PDF.js operator list and tracking the current transform
// matrix (CTM).
// ============================================================

import type { ImageObject, AffineMatrix } from '../core/types';
import { IDENTITY_MATRIX } from '../core/constants';
import { generateId } from '../core/id';
import { multiplyMatrices, boundsFromImageCTM } from '../utils/geometry';

/**
 * PDF.js operator codes.
 * We reference them from pdfjsLib.OPS but provide fallbacks
 * for safety.
 */
function getOpCodes(pdfjsLib: any): {
  SAVE: number;
  RESTORE: number;
  TRANSFORM: number;
  PAINT_IMAGE: number;
  PAINT_INLINE_IMAGE: number;
  PAINT_IMAGE_MASK: number;
} {
  const OPS = pdfjsLib?.OPS || {};
  return {
    SAVE: OPS.save ?? 33,
    RESTORE: OPS.restore ?? 34,
    TRANSFORM: OPS.transform ?? 12,
    PAINT_IMAGE: OPS.paintImageXObject ?? 85,
    PAINT_INLINE_IMAGE: OPS.paintInlineImageXObject ?? 84,
    PAINT_IMAGE_MASK: OPS.paintImageMaskXObject ?? 83,
  };
}

/**
 * Extracts image objects from a single PDF page by walking its
 * operator list and tracking CTM state.
 *
 * Architecture notes:
 * - PDF images are drawn as 1×1 unit squares scaled by the CTM.
 * - The CTM at the point of a `paintImageXObject` call contains
 *   the image's position, size, and any rotation/skew.
 * - We walk every operator, maintaining a save/restore stack
 *   for the graphics state.
 * - For each image paint operation, we extract the bounding box
 *   from the current CTM using proper corner transformation
 *   (handles rotation and negative scales).
 *
 * @param page - PDF.js page proxy.
 * @param pageIndex - Zero-based page index.
 * @param pdfjsLib - The pdfjs-dist library reference (for OPS constants).
 * @returns Array of ImageObject instances.
 */
export async function extractImageObjects(
  page: any,
  pageIndex: number,
  pdfjsLib: any
): Promise<ImageObject[]> {
  const opList = await page.getOperatorList();
  const opcodes = getOpCodes(pdfjsLib);

  const images: ImageObject[] = [];
  const transformStack: AffineMatrix[] = [];
  let currentTransform: AffineMatrix = [...IDENTITY_MATRIX];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    switch (fn) {
      case opcodes.SAVE:
        transformStack.push([...currentTransform]);
        break;

      case opcodes.RESTORE:
        if (transformStack.length > 0) {
          currentTransform = transformStack.pop()!;
        }
        break;

      case opcodes.TRANSFORM: {
        // args is a 6-element array [a, b, c, d, e, f]
        // Concatenate: newCTM = currentCTM × args
        const newMatrix: AffineMatrix = [
          args[0], args[1], args[2], args[3], args[4], args[5],
        ];
        currentTransform = multiplyMatrices(currentTransform, newMatrix);
        break;
      }

      case opcodes.PAINT_IMAGE:
      case opcodes.PAINT_INLINE_IMAGE:
      case opcodes.PAINT_IMAGE_MASK: {
        // Extract name (first arg is the XObject name string or object reference)
        const nameArg = args?.[0];
        const xObjectName =
          typeof nameArg === 'string' ? nameArg : `img_${pageIndex}_${i}`;

        // Compute bounding box from the CTM.
        // This properly handles rotation and negative scales
        // by transforming all 4 corners of the unit square.
        const bounds = boundsFromImageCTM(currentTransform);

        // Skip degenerate images (zero area)
        if (bounds.width < 1 || bounds.height < 1) break;

        const imageObject: ImageObject = {
          id: generateId('img'),
          type: 'image',
          pageIndex,
          bounds,
          rotation: 0,
          opacity: 1,
          zIndex: 0,
          locked: false,
          origin: 'extracted',
          xObjectName,
          dataUrl: null,
          file: null,
          originalTransform: [...currentTransform],
          deleted: false,
          replacementFile: null,
          replacementDataUrl: null,
        };

        images.push(imageObject);
        break;
      }

      default:
        break;
    }
  }

  return images;
}
