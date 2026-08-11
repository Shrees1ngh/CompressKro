// ============================================================
// CompressKro — HTML to Image Page Component
// ============================================================

import { useState } from 'react';
import confetti from 'canvas-confetti';
import { RefreshCw, Code, Globe, Image as ImageIcon, Settings } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { StorageService } from '../../services/storage.service';
import { HistoryService } from '../../services/history.service';
import { getFriendlySize } from '../../utils/format';
import { BACKEND_API_URL } from '../../constants';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { CompiledOutputView } from '../../components/CompiledOutputView';

export function HtmlToImage() {
  const [activeTab, setActiveTab] = useState<'html' | 'url'>('html');
  const [htmlCode, setHtmlCode] = useState<string>('<h1>My Design Showcase</h1>\n<p>This is a live rendered HTML element card captured as a clean PNG/JPG.</p>\n<div style="background: linear-gradient(135deg, #6366f1, #a855f7); color: white; padding: 20px; border-radius: 12px; font-weight: bold; text-align: center;">\n  Beautiful Gradient Canvas\n</div>');
  const [targetUrl, setTargetUrl] = useState<string>('');
  
  // Settings states
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [width, setWidth] = useState<number>(1200);
  const [height, setHeight] = useState<number>(800);
  const [fullPage, setFullPage] = useState<boolean>(false);

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
    const payload = {
      html: isHtmlMode ? htmlCode : '',
      url: isHtmlMode ? '' : targetUrl,
      format,
      width,
      height,
      fullPage
    };
    
    if (isHtmlMode && !htmlCode.trim()) return;
    if (!isHtmlMode && !targetUrl.trim()) return;

    setIsProcessing(true);
    setProgressMsg(isHtmlMode ? 'Compiling HTML into image capture...' : 'Capturing website URL screenshot...');

    try {
      const res = await fetch(`${BACKEND_API_URL}/html-to-image`, {
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
      const outName = isHtmlMode ? `compiled_web_page.${format}` : `website_capture.${format}`;
      
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSize(blob.size);
      setOutputName(outName);

      StorageService.updateStats(0, 1); // increment image conversion
      HistoryService.addImageEntry('HTML to Image', outName, blob.size);

      showSuccess('Image ready!', `${outName} · ${getFriendlySize(blob.size)}`);
      confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
    } catch (err: any) {
      console.error(err);
      showError('Conversion failed', err.message || 'Could not capture target to image.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Choose either HTML Code input or enter a target Web URL.' },
    { step: 2, text: 'Configure output screenshot format, dimensions, and capture modes.' },
    { step: 3, text: 'Click "Convert to Image" and download your high-fidelity screenshot.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Custom Dimensions', desc: 'Configure exact viewport width and height pixel boundaries before capture.' },
    { title: 'Full Scrollable Pages', desc: 'Optionally capture the entire webpage from top to bottom in scrollable format.' },
    { title: 'Lossless PNG Export', desc: 'Preserves sharp text layers, gradient curves, and visual graphic transparency.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'What does Full Page capture do?', answer: 'It overrides the viewport height setting to capture the entire scrollable length of the webpage, outputting it as a single tall image.' },
    { question: 'What format should I select?', answer: 'Use PNG for text-heavy documents or code captures to preserve sharp details. Use JPEG to reduce file sizes for image-heavy screenshots.' },
    { question: 'Is URL scraping secure?', answer: 'Yes, capture requests run securely on our isolated sandbox servers and transient files are purged immediately.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Image Resizer', desc: 'Scaling and cropping bounds.', path: '/resize-image', icon: ImageIcon },
    { name: 'Format Converter', desc: 'Convert image formats.', path: '/convert-image', icon: ImageIcon },
    { name: 'Image Compressor', desc: 'Smart target KB compression.', path: '/compress-image', icon: ImageIcon }
  ];

  return (
    <ToolPageLayout
      title="HTML or URL to Image"
      subtitle="Convert raw HTML code markup or capture target website URL pages as high-quality PNG or JPEG images."
      breadcrumbName="HTML & URL to Image"
      seoTitle="Compile HTML or URL to Image Online Free - Screenshot Capture | CompressKro"
      seoDescription="Convert raw HTML code or complete web URLs into high-quality JPEG or PNG images online for free. Custom viewport sizes, full page capture. Secure."
      canonicalPath="/html-to-image"
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
          <div className="space-y-6">
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
                    <Code className="w-4 h-4 text-violet-500" />
                    <span>Input HTML Code Markup</span>
                  </h3>

                  <div className="space-y-2">
                    <textarea
                      value={htmlCode}
                      onChange={(e) => setHtmlCode(e.target.value)}
                      rows={10}
                      className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/20 text-xs font-mono text-slate-700 dark:text-slate-350 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-hidden transition-all"
                      placeholder="<h1>Type HTML code here...</h1>"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-violet-500" />
                    <span>Input Website URL Target</span>
                  </h3>

                  <div className="space-y-2">
                    <input
                      type="text"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/20 text-xs text-slate-700 dark:text-slate-350 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-hidden transition-all"
                      placeholder="e.g. https://google.com"
                    />
                  </div>
                </div>
              )}

              {/* Viewport Settings Grid */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Settings className="w-3.5 h-3.5 text-violet-500" />
                  <span>Capture Configuration</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Format</label>
                    <select
                      value={format}
                      onChange={(e) => setFormat(e.target.value as 'png' | 'jpeg')}
                      className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/30 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-violet-500/20 outline-hidden cursor-pointer"
                    >
                      <option value="png">PNG (Lossless)</option>
                      <option value="jpeg">JPEG (Compressed)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Viewport Width</label>
                    <input
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(Math.max(320, Math.min(3840, parseInt(e.target.value) || 1200)))}
                      className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/30 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-violet-500/20 outline-hidden"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Viewport Height</label>
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(Math.max(200, Math.min(3840, parseInt(e.target.value) || 800)))}
                      disabled={fullPage}
                      className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/30 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-violet-500/20 outline-hidden disabled:opacity-40"
                    />
                  </div>

                  <div className="flex flex-col justify-end space-y-1.5">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none h-9">
                      <input
                        type="checkbox"
                        checked={fullPage}
                        onChange={(e) => setFullPage(e.target.checked)}
                        className="rounded-sm border-slate-300 dark:border-slate-700 text-violet-600 focus:ring-violet-500"
                      />
                      <span>Full Page Capture</span>
                    </label>
                  </div>
                </div>
              </div>

              <button
                onClick={executeConvert}
                disabled={
                  (activeTab === 'html' ? !htmlCode.trim() : !targetUrl.trim()) || isProcessing
                }
                className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                <span>{isProcessing ? progressMsg : 'Convert to Image'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
export default HtmlToImage;
