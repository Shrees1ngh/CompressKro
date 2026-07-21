// ============================================================
// CompressKro — useDownload Hook
// ============================================================

import { useCallback } from 'react';
import { downloadBlob, downloadMultipleBlobs } from '../utils/download';

export function useDownload() {
  const download = useCallback((blob: Blob, filename: string) => {
    downloadBlob(blob, filename);
  }, []);

  const downloadAll = useCallback(
    (items: Array<{ blob: Blob; filename: string }>) => {
      downloadMultipleBlobs(items);
    },
    []
  );

  return { download, downloadAll };
}
