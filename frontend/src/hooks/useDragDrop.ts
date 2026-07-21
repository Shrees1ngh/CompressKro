// ============================================================
// CompressKro — useDragDrop Hook
// Reusable drag-and-drop logic with file validation.
// ============================================================

import { useState, useCallback, useRef } from 'react';
import type { DragDropOptions } from '../types';
import { filterValidImageFiles } from '../utils/validation';

export function useDragDrop(options: DragDropOptions) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const processFiles = useCallback(
    (rawFiles: FileList | File[]) => {
      const fileArray = Array.from(rawFiles);
      if (fileArray.length === 0) return;

      if (!options.multiple && fileArray.length > 1) {
        // If multiple not allowed, take first
        const { valid, errors } = filterValidImageFiles([fileArray[0]]);
        if (errors.length > 0) {
          options.onError?.(errors[0]);
          return;
        }
        if (valid.length > 0) options.onFiles(valid);
        return;
      }

      const { valid, errors } = filterValidImageFiles(fileArray);

      if (errors.length > 0) {
        options.onError?.(errors.join('\n'));
      }

      if (valid.length > 0) {
        options.onFiles(valid);
      }
    },
    [options]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      dragCounter.current = 0;
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
        e.dataTransfer.clearData();
      }
    },
    [processFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
        // Reset input value so same file can be re-selected
        e.target.value = '';
      }
    },
    [processFiles]
  );

  return {
    isDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileInputChange,
  };
}
