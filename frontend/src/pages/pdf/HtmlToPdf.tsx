// ============================================================
// CompressKro — HTML to PDF Page Component
// ============================================================

import { useState } from 'react';
import confetti from 'canvas-confetti';
import { RefreshCw, Code, Globe } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { BACKEND_API_URL } from '../../constants';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { CompiledOutputView } from '../../components/CompiledOutputView';

export function HtmlToPdf() {
  const [activeTab, setActiveTab] = useState<'html' | 'url'>('html');
  const [htmlCode, setHtmlCode] = useState<string>('<h1>My Document Title</h1>\n<p>This is a paragraph of text compiled from raw HTML code.</p>\n<ul>\n  <li>Item number one</li>\n  <li>Item number two</li>\n</ul>');
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');

  const { showSuccess, showError } = useToast();

  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
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

      StorageService.updateStats(1, 0);
      HistoryService.addPdfEntry('HTML to PDF', outName, blob.size);

      showSuccess('PDF Document ready!', `${outName} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err: any) {
      console.error(err);
      showError('Conversion failed', err.message || 'Could not convert input to PDF.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Choose either HTML Code input or enter a target Web URL.' },
    { step: 2, text: 'Click "Convert to PDF" to compile the tags or capture the page.' },
    { step: 3, text: 'Download the completed standard PDF document immediately.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Responsive Layouts', desc: 'Auto-fits standard A4 dimensions with clean margins.' },
    { title: 'Live Capture Rendering', desc: 'Renders stylesheets, visual graphics, and page alignments.' },
    { title: '100% Secure', desc: 'Captures webpage layout securely, preserving session sandboxing.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'What HTML tags are parsed?', answer: 'Headings, lists, breaks, divs, paragraphs, and styles are cleanly rendered into the output document.' },
    { question: 'Does URL rendering support media styles?', answer: 'Yes. Headless browsers apply print-media standard stylesheet settings to translate web layouts into document pages.' },
    { question: 'Are credentials or cookies shared?', answer: 'No. Target URLs are fetched independently by our sandbox environment without any user session parameters.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Merge PDF', desc: 'Combine multiple PDF files.', path: '/merge-pdf', icon: Globe },
    { name: 'Edit PDF', desc: 'Add text and shape annotations to PDFs.', path: '/edit-pdf', icon: Code },
    { name: 'Page Numbers', desc: 'Insert running numbers on pages.', path: '/page-numbers', icon: Code }
  ];

  return (
    <ToolPageLayout
      title="Compile HTML or URL to PDF"
      subtitle="Convert raw HTML code or capture entire webpage links into clean, standard PDF documents online for free."
      breadcrumbName="HTML & URL to PDF"
      seoTitle="Compile HTML or URL to PDF Online Free - Webpage to PDF | CompressKro"
      seoDescription="Convert raw HTML markup or target website URLs to PDF online for free. High-fidelity layouts, safe and private."
      canonicalPath="/html-to-pdf"
      steps={steps}
      benefits={benefits}
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <div className="space-y-6">
        {outputUrl ? (
          <CompiledOutputView
            outputUrl={outputUrl}
            outputSize={outputSize}
            outputName={outputName}
            onClear={() => {
              clearOutputs();
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
                  <Code className="w-4 h-4 text-cyan-500" />
                  <span>Input HTML Code Markup</span>
                </h3>

                <div className="space-y-2">
                  <textarea
                    value={htmlCode}
                    onChange={(e) => setHtmlCode(e.target.value)}
                    rows={10}
                    className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/20 text-xs font-mono text-slate-700 dark:text-slate-350 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-hidden transition-all"
                    placeholder="<h1>Type HTML code here...</h1>"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-500" />
                  <span>Input Website URL Target</span>
                </h3>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/20 text-xs text-slate-700 dark:text-slate-350 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-hidden transition-all"
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
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-cyan-500 to-blue-650 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              <span>{isProcessing ? progressMsg : 'Convert to PDF'}</span>
            </button>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
