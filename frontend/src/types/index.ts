// ============================================================
// CompressKro — Shared Types
// ============================================================

// ---- Navigation ----
export type TabId = 'dashboard' | 'compress' | 'resize' | 'convert' | 'passport' | 'pdf' | 'govt';

export interface NavItem {
  id: TabId;
  label: string;
  icon: React.ElementType;
  description: string;
}

// ---- Compression ----
export type CompressionMode = 'quality' | 'percentage' | 'target';

export interface CompressedFile {
  originalName: string;
  originalSize: number;
  compressedSize: number;
  compressedUrl: string;
  compressedBlob: Blob;
  qualityUsed: number;
  dimensions: { width: number; height: number };
  originalDimensions: { width: number; height: number };
  mimeType: string;
  qualityScore: number; // 0–100 derived objective score
  psnr?: number;        // Peak Signal-to-Noise Ratio in dB
}

// ---- Image Analysis ----
export interface ImageAnalysis {
  width: number;
  height: number;
  aspectRatio: string;
  fileSize: number;
  hasTransparency: boolean;
  estimatedFormat: 'jpeg' | 'png' | 'webp';
  compressionPotential: 'high' | 'medium' | 'low';
  compressionPotentialPct: number; // estimated % savings
  recommendedFormat: string;
  recommendation: string;
}

// ---- Resizer ----
export interface ResizedFile {
  originalName: string;
  originalSize: number;
  resizedSize: number;
  resizedUrl: string;
  resizedBlob: Blob;
  dimensions: { width: number; height: number };
  originalDimensions: { width: number; height: number };
}

// ---- Converter ----
export interface ConvertedResult {
  originalName: string;
  originalFormat: string;
  targetFormat: string;
  convertedUrl: string;
  convertedBlob: Blob;
  size: number;
}

// ---- Passport ----
export interface PassportResult {
  outputUrl: string;
  outputBlob: Blob;
  outputSize: number;
  format: string;
}

// ---- History ----
export interface HistoryEntry {
  id: string;
  name: string;
  tool: 'Compression' | 'Resize' | 'Format Convert' | 'Passport Maker' | 'PDF';
  details: string; // e.g. "45% Saved (23.1 KB)" or "Resized to 1080×1080"
  date: string;
  timestamp: number;
}

// ---- Statistics ----
export interface AppStats {
  filesProcessed: number;
  mbSaved: number;
  privacyScore: string;
}

// ---- Toast / Notifications ----
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, default 4000
}

// ---- Presets ----
export interface ResizePreset {
  name: string;
  width: number;
  height: number;
  lock: boolean;
}

export interface PortalPreset {
  id: string;
  portal: string;
  docType: string;
  limits: string;
  targetSizeKB: number;
  width?: number;
  height?: number;
  format: string;
  recommendedTool: string;
  toolLabel: string;
  details: string;
}

// ---- PDF ----
export interface PDFFileItem {
  id: string;
  name: string;
  size: number;
  blob: Blob;
}

export interface PDFPageItem {
  originalIndex: number;
  rotation: number;
}

export interface PDFAnalysis {
  pageCount: number;
  fileSize: number;
  name: string;
  hasImages?: boolean;
}

export type PDFCompressionLevel = 'best' | 'balanced' | 'smallest';

export interface PDFCompressedResult {
  originalName: string;
  originalSize: number;
  compressedSize: number;
  compressedUrl: string;
  compressedBlob: Blob;
  pageCount: number;
  imagesOptimized?: number;
  fontsPreserved?: number;
  compressionTimeMs?: number;
  savedPercent?: number;
}

// ---- Drag & Drop ----
export interface DragDropOptions {
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  onFiles: (files: File[]) => void;
  onError?: (msg: string) => void;
}
