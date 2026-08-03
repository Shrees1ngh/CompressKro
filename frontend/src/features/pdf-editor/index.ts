// ============================================================
// CompressKro PDF Editor — Barrel Export
// ============================================================
// Re-exports all public API from the pdf-editor feature module.
// ============================================================

// Core
export * from './core/types';
export * from './core/constants';
export { generateId, generateIds } from './core/id';

// Parser
export { parsePdf } from './parser/PdfParser';
export type { ParseProgressCallback } from './parser/PdfParser';
export { mapFont, measureTextWidth, measureTextMetrics, clearFontCache } from './parser/FontMapper';
export { extractTextObjects, calibrateTextWidth } from './parser/TextExtractor';
export { extractImageObjects } from './parser/ImageExtractor';
export { mergeTextRuns } from './parser/TextMerger';

// History
export {
  HistoryEngine,
  InsertObjectsCommand,
  DeleteObjectsCommand,
  MoveObjectsCommand,
  ResizeObjectCommand,
  EditTextCommand,
  EditPropertyCommand,
  BatchCommand,
} from './history/HistoryEngine';
export type { Command } from './history/HistoryEngine';

// Exporter
export { exportPdf } from './exporter/PdfExporter';
export type { ExportProgressCallback } from './exporter/PdfExporter';

// Hooks
export { EditorProvider, useEditorStore } from './hooks/useEditorStore';
export { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Utils
export * from './utils/geometry';
export * from './utils/color';
