// ============================================================
// CompressKro — HTML to PDF Page Component
// ============================================================

import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RefreshCw, Code, Globe } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { BACKEND_API_URL } from '../../constants';
import { usePdfWorkspace } from '../../context/PdfWorkspaceContext';
import { PdfTaskCompleted } from '../../components/PdfWorkspaceShell/PdfTaskCompleted';

export function HtmlToPdf() {
  const [activeTab, setActiveTab] = useState<'html' | 'url'>('html');
  const [htmlCode, setHtmlCode] = useState<string>('<h1>My Document Title</h1>\n<p>This is a paragraph of text compiled from raw HTML code.</p>\n<ul>\n  <li>Item number one</li>\n  <li>Item number two</li>\n</ul>');
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);

  const { showSuccess, showError } = useToast();
  const { chainOutput } = usePdfWorkspace();

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
    setOutputBlob(null);
  };

  const executeConvert = async () => {
    const isHtmlMode = activeTab === 'html';
    const payload = isHtmlMode ? { html: htmlCode } : { url: targetUrl };
    
    if (isHtmlMode && !htmlCode.trim()) return;
    if (!isHtmlMode && !targetUrl.trim()) return;

    setIsProcessing(true);
    setProgressMsg(isHtmlMode ? 'Compiling HTML into PDF pages...' : 'Fetching and rendering website URL to PDF...');

    try {
      const res = await fetch(`${BACKEND_API_URL}/html-to-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Conversion failed');
      }

      const blob = await res.blob();
      const outName = isHtmlMode ? 'compiled_web_page.pdf' : 'website_capture.pdf';
      
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(outName);
      setOutputBlob(blob);

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('HTML to PDF', outName, blob.size);

      // Chain output
      chainOutput(blob, outName);

      showSuccess('PDF compiled successfully!', `${outName} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err: any) {
      console.error(err);
      showError('Compile failed', err.message || 'Error converting HTML markup to PDF.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  return (
    <>
      <div className="space-y-6">
        {outputUrl && outputBlob ? (
          <PdfTaskCompleted
            fileName={outputName}
            fileSize={outputSize}
            outputBlob={outputBlob}
            onReset={() => {
              clearOutputs();
              setOutputBlob(null);
            }}
          />
        ) : (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm">
            <div className="flex rounded-xl bg-slate-100/80 dark:bg-slate-900/60 p-1 border border-slate-200/50 dark:border-slate-800/50 max-w-[240px]">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('html');
                  clearOutputs();
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'html'
                    ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                }`}
              >
                HTML Code
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('url');
                  clearOutputs();
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'url'
                    ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                }`}
              >
                Web URL
              </button>
            </div>

            {activeTab === 'html' ? (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Code className="w-4 h-4 text-pink-500" />
                  <span>Input HTML Code Markup</span>
                </h3>

                <div className="space-y-2">
                  <textarea
                    value={htmlCode}
                    onChange={(e) => setHtmlCode(e.target.value)}
                    rows={10}
                    className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/20 text-xs font-mono text-slate-700 dark:text-slate-350 focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 outline-hidden transition-all"
                    placeholder="<h1>Type HTML code here...</h1>"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-pink-500" />
                  <span>Input Website URL Target</span>
                </h3>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/20 text-xs text-slate-700 dark:text-slate-350 focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 outline-hidden transition-all"
                    placeholder="e.g. https://google.com"
                  />
                </div>
              </div>
            )}

            <button
              onClick={executeConvert}
              disabled={
                (activeTab === 'html' ? !htmlCode.trim() : !targetUrl.trim()) || isProcessing
              }
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-pink-500 to-pink-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              <span>{isProcessing ? progressMsg : 'Convert to PDF'}</span>
            </button>

            <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-4 space-y-3">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">How to use HTML to PDF</h4>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <span className="w-4 h-4 rounded-full bg-pink-100 dark:bg-pink-950 text-pink-600 dark:text-pink-400 flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">1</span>
                  <p className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 leading-normal">Choose between raw HTML Code entry or Web URL link.</p>
                </div>
                <div className="flex gap-2">
                  <span className="w-4 h-4 rounded-full bg-pink-100 dark:bg-pink-950 text-pink-600 dark:text-pink-400 flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">2</span>
                  <p className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 leading-normal">Input custom HTML markup or paste the target webpage address.</p>
                </div>
                <div className="flex gap-2">
                  <span className="w-4 h-4 rounded-full bg-pink-100 dark:bg-pink-950 text-pink-600 dark:text-pink-400 flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">3</span>
                  <p className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 leading-normal">Click "Convert to PDF" to generate and download the rendered document.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
