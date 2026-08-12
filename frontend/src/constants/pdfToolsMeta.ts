// ============================================================
// CompressKro — Centralized PDF Tool SEO Metadata
// Each tool's Helmet tags, structured data, and sidebar info
// are defined here so the PdfWorkspaceShell can render them.
// ============================================================

import {
  Minimize2,
  FileText,
  ListOrdered,
  RotateCw,
  Crop,
  ImageIcon,
  Upload,
  Edit3,
  PenTool,
  Droplets,
  Eraser,
  Hash,
  ScanText,
  Lock,
  Unlock,
  Wrench,
  Globe,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PdfToolMeta {
  /** Route path segment (without leading /) */
  path: string;
  /** Display label in the sidebar */
  label: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** SEO <title> tag */
  seoTitle: string;
  /** SEO meta description */
  seoDescription: string;
  /** Canonical path (with leading /) */
  canonicalPath: string;
  /** Breadcrumb display name */
  breadcrumbName: string;
  /** Sidebar group category */
  group: 'organize' | 'convert' | 'edit' | 'security';
}

export const PDF_TOOL_GROUPS: { key: string; label: string }[] = [
  { key: 'organize', label: 'Organize' },
  { key: 'convert', label: 'Convert' },
  { key: 'edit', label: 'Edit' },
  { key: 'security', label: 'Security & Tools' },
];

export const PDF_TOOLS_META: PdfToolMeta[] = [
  // ── Organize ──
  {
    path: 'compress-pdf',
    label: 'Compress',
    icon: Minimize2,
    seoTitle: 'Compress PDF Online Free - Reduce PDF File Size | CompressKro',
    seoDescription: 'Compress PDF files online for free. Reduce PDF file sizes significantly without losing quality. Easy drag-and-drop tool, privacy-first.',
    canonicalPath: '/compress-pdf',
    breadcrumbName: 'Compress PDF',
    group: 'organize',
  },
  {
    path: 'merge-pdf',
    label: 'Merge',
    icon: ListOrdered,
    seoTitle: 'Merge PDF Online Free - Combine PDF Files | CompressKro',
    seoDescription: 'Merge PDF files online for free. Combine multiple PDF documents into one. Privacy-first local processing, no registration, no watermarks.',
    canonicalPath: '/merge-pdf',
    breadcrumbName: 'Merge PDF',
    group: 'organize',
  },
  {
    path: 'split-pdf',
    label: 'Split',
    icon: FileText,
    seoTitle: 'Split PDF Online Free - Extract PDF Pages | CompressKro',
    seoDescription: 'Split PDF files online for free. Extract specific pages or ranges from any PDF document. Fast, privacy-first local processing, no registration.',
    canonicalPath: '/split-pdf',
    breadcrumbName: 'Split PDF',
    group: 'organize',
  },
  {
    path: 'rotate-pdf',
    label: 'Rotate & Order',
    icon: RotateCw,
    seoTitle: 'Rotate PDF Pages Online Free | CompressKro',
    seoDescription: 'Rotate and reorder PDF pages online for free. Rearrange, rotate, and organize your PDF pages with an easy drag-and-drop interface.',
    canonicalPath: '/rotate-pdf',
    breadcrumbName: 'Rotate PDF',
    group: 'organize',
  },
  {
    path: 'crop-pdf',
    label: 'Crop',
    icon: Crop,
    seoTitle: 'Crop PDF Pages Online Free | CompressKro',
    seoDescription: 'Crop PDF page margins easily online for free. Adjust page boundaries visually with our privacy-first browser-based tool.',
    canonicalPath: '/crop-pdf',
    breadcrumbName: 'Crop PDF',
    group: 'organize',
  },

  // ── Convert ──
  {
    path: 'pdf-to-jpg',
    label: 'PDF to JPG',
    icon: ImageIcon,
    seoTitle: 'PDF to JPG Online Free - Convert PDF Pages to JPEG | CompressKro',
    seoDescription: 'Convert PDF pages to high-quality JPEG images online for free. Fast, privacy-first local processing.',
    canonicalPath: '/pdf-to-jpg',
    breadcrumbName: 'PDF to JPG',
    group: 'convert',
  },
  {
    path: 'images-to-pdf',
    label: 'Images to PDF',
    icon: Upload,
    seoTitle: 'Images to PDF Online Free - Convert JPG/PNG to PDF | CompressKro',
    seoDescription: 'Convert JPG, PNG, and other images to PDF online for free. Combine multiple images into a single PDF document.',
    canonicalPath: '/images-to-pdf',
    breadcrumbName: 'Images to PDF',
    group: 'convert',
  },
  {
    path: 'extract-images',
    label: 'Extract Images',
    icon: ImageIcon,
    seoTitle: 'Extract Images from PDF Online Free | CompressKro',
    seoDescription: 'Extract inline images from PDF documents online for free. Download all embedded photos from your PDF files.',
    canonicalPath: '/extract-images',
    breadcrumbName: 'Extract Images',
    group: 'convert',
  },
  {
    path: 'html-to-pdf',
    label: 'HTML to PDF',
    icon: Globe,
    seoTitle: 'HTML to PDF Online Free - Convert Web Pages to PDF | CompressKro',
    seoDescription: 'Convert HTML web pages and markup to PDF documents online for free. Privacy-first browser-based tool.',
    canonicalPath: '/html-to-pdf',
    breadcrumbName: 'HTML to PDF',
    group: 'convert',
  },

  // ── Edit ──
  {
    path: 'edit-pdf',
    label: 'Edit PDF',
    icon: Edit3,
    seoTitle: 'Edit PDF Online Free - Modify Text, Shapes, Whiteout | CompressKro',
    seoDescription: 'Edit PDF files online for free. Add text, shapes, whiteout, and annotations. Full-featured PDF editor in your browser.',
    canonicalPath: '/edit-pdf',
    breadcrumbName: 'Edit PDF',
    group: 'edit',
  },
  {
    path: 'sign-pdf',
    label: 'Sign PDF',
    icon: PenTool,
    seoTitle: 'Sign PDF Online Free - Add Signatures | CompressKro',
    seoDescription: 'Sign PDF documents online for free. Draw, type, or upload your signature and place it on any PDF page.',
    canonicalPath: '/sign-pdf',
    breadcrumbName: 'Sign PDF',
    group: 'edit',
  },
  {
    path: 'add-watermark',
    label: 'Add Watermark',
    icon: Droplets,
    seoTitle: 'Add Watermark to PDF Free - Text/Image Logo Stamp | CompressKro',
    seoDescription: 'Add watermarks to PDF files online for free. Custom text strings, brand logo images, adjustable rotation, and opacity options.',
    canonicalPath: '/add-watermark',
    breadcrumbName: 'Add Watermark',
    group: 'edit',
  },
  {
    path: 'remove-watermark',
    label: 'Remove Watermark',
    icon: Eraser,
    seoTitle: 'Remove Watermark from PDF Online Free | CompressKro',
    seoDescription: 'Remove watermarks from PDF documents online for free. Clean up text and image watermarks from your PDFs.',
    canonicalPath: '/remove-watermark',
    breadcrumbName: 'Remove Watermark',
    group: 'edit',
  },
  {
    path: 'page-numbers',
    label: 'Page Numbers',
    icon: Hash,
    seoTitle: 'Add Page Numbers to PDF Online Free | CompressKro',
    seoDescription: 'Add page numbering to PDF documents online for free. Customize position, format, and styling of page numbers.',
    canonicalPath: '/page-numbers',
    breadcrumbName: 'Page Numbers',
    group: 'edit',
  },

  // ── Security & Tools ──
  {
    path: 'ocr-pdf',
    label: 'OCR PDF',
    icon: ScanText,
    seoTitle: 'OCR PDF Online Free - Make Scanned PDFs Searchable | CompressKro',
    seoDescription: 'OCR PDF files online for free. Make scanned PDF documents searchable with optical character recognition.',
    canonicalPath: '/ocr-pdf',
    breadcrumbName: 'OCR PDF',
    group: 'security',
  },
  {
    path: 'lock-pdf',
    label: 'Lock PDF',
    icon: Lock,
    seoTitle: 'Lock PDF Online Free - Password Protect PDF | CompressKro',
    seoDescription: 'Lock PDF documents online with secure passwords. Protect your PDFs from unauthorized viewing, printing, or copying.',
    canonicalPath: '/lock-pdf',
    breadcrumbName: 'Lock PDF',
    group: 'security',
  },
  {
    path: 'unlock-pdf',
    label: 'Unlock PDF',
    icon: Unlock,
    seoTitle: 'Unlock PDF Online Free - Remove Password Protection | CompressKro',
    seoDescription: 'Unlock password-protected PDF documents online for free. Remove viewing and editing restrictions from your PDFs.',
    canonicalPath: '/unlock-pdf',
    breadcrumbName: 'Unlock PDF',
    group: 'security',
  },
  {
    path: 'repair-pdf',
    label: 'Repair PDF',
    icon: Wrench,
    seoTitle: 'Repair PDF Online Free - Fix Damaged PDF Files | CompressKro',
    seoDescription: 'Repair damaged or corrupted PDF files online for free. Fix broken PDF document structures and recover content.',
    canonicalPath: '/repair-pdf',
    breadcrumbName: 'Repair PDF',
    group: 'security',
  },
];

/**
 * Look up a tool's metadata by its route path segment.
 * Returns undefined if the path doesn't match any known PDF tool.
 */
export function getPdfToolMeta(pathSegment: string): PdfToolMeta | undefined {
  return PDF_TOOLS_META.find(t => t.path === pathSegment);
}

/**
 * Get all tool metadata entries for a specific group.
 */
export function getPdfToolsByGroup(group: PdfToolMeta['group']): PdfToolMeta[] {
  return PDF_TOOLS_META.filter(t => t.group === group);
}

/**
 * All PDF tool route paths (used for matching in App.tsx).
 */
export const ALL_PDF_TOOL_PATHS = PDF_TOOLS_META.map(t => `/${t.path}`);
