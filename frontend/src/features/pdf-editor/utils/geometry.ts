// ============================================================
// CompressKro PDF Editor — Geometry Utilities
// ============================================================
// Pure functions for rectangle math, hit testing, matrix ops,
// and coordinate conversions.
// ============================================================

import type { Bounds, Point, AffineMatrix, ViewportRect } from '../core/types';

// ---- Bounds Operations ----

/** Returns true if point (px, py) is inside the given bounds. */
export function pointInBounds(px: number, py: number, b: Bounds): boolean {
  return px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height;
}

/** Returns true if bounds a and b overlap (non-zero intersection). */
export function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Returns true if bounds `inner` is fully contained within `outer`. */
export function boundsContains(outer: Bounds, inner: Bounds): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/** Returns the center point of a bounding rectangle. */
export function boundsCenter(b: Bounds): Point {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Expands bounds by `padding` on each side. */
export function expandBounds(b: Bounds, padding: number): Bounds {
  return {
    x: b.x - padding,
    y: b.y - padding,
    width: b.width + padding * 2,
    height: b.height + padding * 2,
  };
}

/** Computes the union bounding box of two bounds. */
export function unionBounds(a: Bounds, b: Bounds): Bounds {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: top - y };
}

/** Clamp a value between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---- Distance ----

/** Euclidean distance between two points. */
export function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ---- Affine Matrix Operations ----

/**
 * Multiplies two 6-element affine matrices.
 * Result = m1 × m2 (m1 applied first, then m2).
 *
 * Matrix layout: [a, b, c, d, e, f]
 *   | a  b  0 |     | a2 b2 0 |
 *   | c  d  0 |  ×  | c2 d2 0 |
 *   | e  f  1 |     | e2 f2 1 |
 */
export function multiplyMatrices(m1: AffineMatrix, m2: AffineMatrix): AffineMatrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/** Apply an affine matrix to a point, returning the transformed point. */
export function transformPoint(matrix: AffineMatrix, p: Point): Point {
  return {
    x: matrix[0] * p.x + matrix[2] * p.y + matrix[4],
    y: matrix[1] * p.x + matrix[3] * p.y + matrix[5],
  };
}

/**
 * Extracts a bounding rectangle from a CTM that represents an image placement.
 * In PDF, images are drawn into a 1×1 unit square and the CTM scales/positions them.
 * The CTM columns give the image's width vector, height vector, and origin.
 *
 * Handles negative scales and rotation (non-zero b,c components).
 */
export function boundsFromImageCTM(ctm: AffineMatrix): Bounds {
  // Transform the four corners of the unit square [0,0], [1,0], [0,1], [1,1]
  const corners: Point[] = [
    transformPoint(ctm, { x: 0, y: 0 }),
    transformPoint(ctm, { x: 1, y: 0 }),
    transformPoint(ctm, { x: 0, y: 1 }),
    transformPoint(ctm, { x: 1, y: 1 }),
  ];

  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// ---- Viewport Conversion Helpers ----

/**
 * Convert a PDF-space bounding rect to a viewport-space CSS rect,
 * using the pdfjs viewport's transform methods.
 */
export function pdfBoundsToViewportRect(
  bounds: Bounds,
  viewport: any
): ViewportRect {
  const pt1 = viewport.convertToViewportPoint(bounds.x, bounds.y);
  const pt2 = viewport.convertToViewportPoint(
    bounds.x + bounds.width,
    bounds.y + bounds.height
  );

  const left = Math.min(pt1[0], pt2[0]);
  const top = Math.min(pt1[1], pt2[1]);
  const width = Math.abs(pt2[0] - pt1[0]);
  const height = Math.abs(pt2[1] - pt1[1]);

  return { left, top, width, height };
}

/**
 * Convert a viewport-space point (from a mouse event relative to the overlay)
 * to PDF user-space coordinates.
 */
export function viewportPointToPdf(
  vx: number,
  vy: number,
  viewport: any
): Point {
  const [px, py] = viewport.convertToPdfPoint(vx, vy);
  return { x: px, y: py };
}

/**
 * Convert a viewport-space rectangle (drawn by the user via drag)
 * to PDF user-space bounds.
 */
export function viewportRectToPdfBounds(
  left: number,
  top: number,
  width: number,
  height: number,
  viewport: any
): Bounds {
  const pdfTL = viewport.convertToPdfPoint(left, top);
  const pdfBR = viewport.convertToPdfPoint(left + width, top + height);

  return {
    x: Math.min(pdfTL[0], pdfBR[0]),
    y: Math.min(pdfTL[1], pdfBR[1]),
    width: Math.abs(pdfBR[0] - pdfTL[0]),
    height: Math.abs(pdfBR[1] - pdfTL[1]),
  };
}
