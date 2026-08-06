// ============================================================
// CompressKro — History Service
// Domain-aware history entries. Wraps StorageService.
// ============================================================

import { StorageService } from './storage.service';
import type { CompressedFile, ResizedFile, ConvertedResult } from '../types';
import { getSavedPercent, getFriendlySize } from '../utils/format';

class HistoryServiceClass {
  addCompressionEntry(result: CompressedFile): void {
    const saved = getSavedPercent(result.originalSize, result.compressedSize);
    StorageService.addHistoryEntry({
      name: result.originalName,
      tool: 'Compression',
      details: `${saved}% Saved → ${getFriendlySize(result.compressedSize)}`,
      date: new Date().toLocaleDateString(),
    });
  }

  addResizeEntry(result: ResizedFile): void {
    StorageService.addHistoryEntry({
      name: result.originalName,
      tool: 'Resize',
      details: `Resized to ${result.dimensions.width}×${result.dimensions.height} px`,
      date: new Date().toLocaleDateString(),
    });
  }

  addConversionEntry(result: ConvertedResult): void {
    StorageService.addHistoryEntry({
      name: result.originalName,
      tool: 'Format Convert',
      details: `${result.originalFormat.toUpperCase()} → ${result.targetFormat.toUpperCase()} (${getFriendlySize(result.size)})`,
      date: new Date().toLocaleDateString(),
    });
  }

  addPassportEntry(fileName: string, sizeBytes: number, format: string): void {
    StorageService.addHistoryEntry({
      name: fileName,
      tool: 'Passport Maker',
      details: `Passport Photo · ${getFriendlySize(sizeBytes)} · ${format.toUpperCase()}`,
      date: new Date().toLocaleDateString(),
    });
  }

  addPdfEntry(operation: string, fileName: string, sizeBytes: number): void {
    StorageService.addHistoryEntry({
      name: fileName,
      tool: 'PDF',
      details: `${operation} · ${getFriendlySize(sizeBytes)}`,
      date: new Date().toLocaleDateString(),
    });
  }

  addImageEntry(operation: string, fileName: string, sizeBytes: number): void {
    StorageService.addHistoryEntry({
      name: fileName,
      tool: 'Format Convert',
      details: `${operation} · ${getFriendlySize(sizeBytes)}`,
      date: new Date().toLocaleDateString(),
    });
  }
}

export const HistoryService = new HistoryServiceClass();
