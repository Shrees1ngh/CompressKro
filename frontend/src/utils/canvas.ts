// ============================================================
// CompressKro — Canvas Utilities
// ============================================================

/**
 * Loads an HTMLImageElement from a File.
 * Returns a tuple of [img, objectUrl] — caller is responsible for revoking the URL.
 */
export function loadImageFromFile(file: File): Promise<[HTMLImageElement, string]> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve([img, url]);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    img.src = url;
  });
}

/**
 * Loads an HTMLImageElement from a data URL or object URL string.
 */
export function loadImageFromUrl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image from URL'));
    img.src = src;
  });
}

/**
 * Creates a canvas + 2D context with optional high-quality image smoothing.
 */
export function createCanvas(
  width: number,
  height: number,
  smoothing: ImageSmoothingQuality = 'high'
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not acquire 2D rendering context');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = smoothing;
  return [canvas, ctx];
}

/**
 * Promisified canvas.toBlob — always resolves with a Blob or throws.
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('canvas.toBlob returned null — canvas may be tainted or empty'));
      },
      mimeType,
      quality
    );
  });
}

/**
 * Draws an image onto an existing canvas context, clearing first.
 * Uses high-quality smoothing for better downscale results.
 */
export function drawImageToContext(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  destWidth: number,
  destHeight: number
): void {
  ctx.clearRect(0, 0, destWidth, destHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, destWidth, destHeight);
}

/**
 * Detects whether a canvas has any transparent pixels (alpha < 255).
 * Samples a subset of pixels for performance on large images.
 */
export function hasTransparency(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): boolean {
  const { width, height } = canvas;
  // Sample every 4th pixel row and column for performance
  const step = Math.max(1, Math.floor(Math.min(width, height) / 100));
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] < 255) return true;
    }
  }
  return false;
}

/**
 * Applies a subtle sharpening convolution to the canvas context.
 * This counteracts the blur introduced by downscaling.
 * Uses a standard unsharp-mask approach (Laplacian of Gaussian approximation).
 */
export function applySharpening(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  amount = 0.4 // 0 = no sharpening, 1 = full sharpening
): void {
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);

  // 3×3 sharpen kernel (identity + scaled Laplacian)
  const k = amount;
  const kernel = [
    0,   -k,     0,
    -k,  1 + 4*k, -k,
    0,   -k,     0
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        let val = 0;
        val += kernel[0] * copy[((y-1) * width + (x-1)) * 4 + c];
        val += kernel[1] * copy[((y-1) * width + x    ) * 4 + c];
        val += kernel[2] * copy[((y-1) * width + (x+1)) * 4 + c];
        val += kernel[3] * copy[(y     * width + (x-1)) * 4 + c];
        val += kernel[4] * copy[(y     * width + x    ) * 4 + c];
        val += kernel[5] * copy[(y     * width + (x+1)) * 4 + c];
        val += kernel[6] * copy[((y+1) * width + (x-1)) * 4 + c];
        val += kernel[7] * copy[((y+1) * width + x    ) * 4 + c];
        val += kernel[8] * copy[((y+1) * width + (x+1)) * 4 + c];
        data[i + c] = Math.max(0, Math.min(255, val));
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Returns a human-readable aspect ratio string (e.g., "16:9", "4:3").
 */
export function getAspectRatioString(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  const w = width / divisor;
  const h = height / divisor;
  // Simplify large ratios
  if (w > 20 || h > 20) {
    const r = width / height;
    if (Math.abs(r - 16/9) < 0.05) return '16:9';
    if (Math.abs(r - 4/3) < 0.05) return '4:3';
    if (Math.abs(r - 1) < 0.05) return '1:1';
    if (Math.abs(r - 3/2) < 0.05) return '3:2';
    if (Math.abs(r - 21/9) < 0.05) return '21:9';
    return `${r.toFixed(2)}:1`;
  }
  return `${w}:${h}`;
}
