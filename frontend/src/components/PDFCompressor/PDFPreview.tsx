// ============================================================
// CompressKro — PDFPreview Component
// Sleek native PDF renderer utilizing browser embed frameworks.
// ============================================================

import { useEffect, useState } from 'react';

interface PDFPreviewProps {
  file: File | Blob | null;
}

export function PDFPreview({ file }: PDFPreviewProps) {
  const [url, setUrl] = useState<string>('');

  useEffect(() => {
    if (!file) {
      setUrl('');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  if (!url) {
    return (
      <div className="w-full h-full min-h-[350px] md:min-h-[480px] bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 border-dashed flex flex-col items-center justify-center p-6 text-center">
        <span className="text-slate-400 dark:text-slate-500 text-xs">No PDF preview available</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[350px] md:min-h-[480px] bg-slate-100 dark:bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm relative">
      <iframe
        src={`${url}#toolbar=0&navpanes=0`}
        title="PDF Preview"
        className="w-full h-full min-h-[350px] md:min-h-[480px] border-none"
      />
    </div>
  );
}

export default PDFPreview;
