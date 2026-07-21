import { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Download, 
  HelpCircle, 
  RefreshCw, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  RotateCw,
  CheckCircle2,
  ListOrdered
} from 'lucide-react';
import { PDFDocument, degrees } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { useToast } from '../hooks/useToast';
import { StorageService } from '../services/storage.service';
import { HistoryService } from '../services/history.service';
import { ToastContainer } from './ui/Toast';
import { getFriendlySize } from '../utils/format';

interface PDFFileItem {
  id: string;
  name: string;
  size: number;
  blob: Blob;
}

interface PDFPageItem {
  originalIndex: number;
  rotation: number; // 0, 90, 180, 270
}

export default function PdfTools() {
  const [activeTab, setActiveTab] = useState<'merge' | 'split' | 'edit' | 'imgToPdf'>('merge');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  const { toasts, showSuccess, showError, dismiss } = useToast();

  // Merge state
  const [mergeFiles, setMergeFiles] = useState<PDFFileItem[]>([]);
  const mergeInputRef = useRef<HTMLInputElement>(null);

  // Split state
  const [splitFile, setSplitFile] = useState<PDFFileItem | null>(null);
  const [splitRange, setSplitRange] = useState<string>('1-2');
  const splitInputRef = useRef<HTMLInputElement>(null);

  // Edit/Organize state
  const [editFile, setEditFile] = useState<PDFFileItem | null>(null);
  const [editPages, setEditPages] = useState<PDFPageItem[]>([]);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Images to PDF state
  const [images, setImages] = useState<PDFFileItem[]>([]);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  // Output URLs
  const [outputUrl, setOutputUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const [outputName, setOutputName] = useState<string>('');



  const clearOutputs = () => {
    setOutputUrl('');
    setOutputSize(0);
    setOutputName('');
  };

  // Merge Helpers
  const handleMergeFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newItems = Array.from(e.target.files).map(f => ({
        id: Math.random().toString(36).substring(2),
        name: f.name,
        size: f.size,
        blob: f
      }));
      setMergeFiles([...mergeFiles, ...newItems]);
      clearOutputs();
    }
  };

  const moveMergeItem = (index: number, direction: 'up' | 'down') => {
    const list = [...mergeFiles];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx >= 0 && targetIdx < list.length) {
      const temp = list[index];
      list[index] = list[targetIdx];
      list[targetIdx] = temp;
      setMergeFiles(list);
    }
  };

  const removeMergeItem = (id: string) => {
    setMergeFiles(mergeFiles.filter(item => item.id !== id));
    clearOutputs();
  };

  const executeMerge = async () => {
    if (mergeFiles.length < 2) return;
    setIsProcessing(true);
    setProgressMsg('Merging files...');

    try {
      const mergedPdf = await PDFDocument.create();
      for (const item of mergeFiles) {
        const arrayBuf = await item.blob.arrayBuffer();
        const doc = await PDFDocument.load(arrayBuf);
        const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
        copiedPages.forEach(p => mergedPdf.addPage(p));
      }

      const mergedBytes = await mergedPdf.save();
      const outputBlob = new Blob([mergedBytes as any], { type: 'application/pdf' });
      
      setOutputBlobData(outputBlob, 'merged_document.pdf');
    } catch (err) {
      console.error(err);
      showError('Merge failed', 'Ensure all PDFs are unencrypted and valid files.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // Split Helpers
  const handleSplitFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setSplitFile({
        id: 'split',
        name: f.name,
        size: f.size,
        blob: f
      });
      clearOutputs();
    }
  };

  const executeSplit = async () => {
    if (!splitFile) return;
    setIsProcessing(true);
    setProgressMsg('Extracting pages...');

    try {
      const arrayBuf = await splitFile.blob.arrayBuffer();
      const srcDoc = await PDFDocument.load(arrayBuf);
      const totalPages = srcDoc.getPageCount();

      const pagesToExtract: number[] = [];
      const parts = splitRange.split(',');

      for (const part of parts) {
        const range = part.trim().split('-');
        if (range.length === 2) {
          const start = Math.max(1, parseInt(range[0])) - 1;
          const end = Math.min(totalPages, parseInt(range[1])) - 1;
          for (let i = start; i <= end; i++) {
            pagesToExtract.push(i);
          }
        } else if (range.length === 1) {
          const val = parseInt(range[0]) - 1;
          if (val >= 0 && val < totalPages) {
            pagesToExtract.push(val);
          }
        }
      }

      if (pagesToExtract.length === 0) {
        showError('Split failed', 'Invalid page ranges selected.');
        setIsProcessing(false);
        return;
      }

      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(srcDoc, pagesToExtract);
      copiedPages.forEach(p => newPdf.addPage(p));

      const bytes = await newPdf.save();
      const blob = new Blob([bytes as any], { type: 'application/pdf' });

      setOutputBlobData(blob, `extracted_${splitFile.name}`);
    } catch (err) {
      console.error(err);
      showError('Split failed', 'Error splitting PDF file.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // Edit/Organize Helpers
  const handleEditFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setEditFile({
        id: 'edit',
        name: f.name,
        size: f.size,
        blob: f
      });
      clearOutputs();

      // Read page count
      try {
        const arrayBuf = await f.arrayBuffer();
        const doc = await PDFDocument.load(arrayBuf);
        const count = doc.getPageCount();
        const pages: PDFPageItem[] = Array.from({ length: count }, (_, i) => ({
          originalIndex: i,
          rotation: 0
        }));
        setEditPages(pages);
      } catch (err) {
        console.error(err);
        showError('PDF load failed', 'Error parsing pages from PDF.');
        return;
      }
    }
  };

  const rotatePage = (index: number) => {
    const list = [...editPages];
    list[index].rotation = (list[index].rotation + 90) % 360;
    setEditPages(list);
    clearOutputs();
  };

  const deletePage = (index: number) => {
    setEditPages(editPages.filter((_, i) => i !== index));
    clearOutputs();
  };

  const movePage = (index: number, dir: 'left' | 'right') => {
    const list = [...editPages];
    const targetIdx = dir === 'left' ? index - 1 : index + 1;
    if (targetIdx >= 0 && targetIdx < list.length) {
      const temp = list[index];
      list[index] = list[targetIdx];
      list[targetIdx] = temp;
      setEditPages(list);
      clearOutputs();
    }
  };

  const executeEditSave = async () => {
    if (!editFile || editPages.length === 0) return;
    setIsProcessing(true);
    setProgressMsg('Applying manipulations...');

    try {
      const arrayBuf = await editFile.blob.arrayBuffer();
      const srcDoc = await PDFDocument.load(arrayBuf);
      const outputPdf = await PDFDocument.create();

      // Copy page-by-page as configured
      for (const pageItem of editPages) {
        const [copiedPage] = await outputPdf.copyPages(srcDoc, [pageItem.originalIndex]);
        if (pageItem.rotation > 0) {
          copiedPage.setRotation(degrees(pageItem.rotation));
        }
        outputPdf.addPage(copiedPage);
      }

      const bytes = await outputPdf.save();
      const blob = new Blob([bytes as any], { type: 'application/pdf' });

      setOutputBlobData(blob, `edited_${editFile.name}`);
    } catch (err) {
      console.error(err);
      showError('Compilation failed', 'Error applying changes to PDF.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // Images to PDF Helpers
  const handleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const list = Array.from(e.target.files).map(f => ({
        id: Math.random().toString(36).substring(2),
        name: f.name,
        size: f.size,
        blob: f
      }));
      setImages([...images, ...list]);
      clearOutputs();
    }
  };

  const executeImagesToPdf = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    setProgressMsg('Compiling images into A4 pages...');

    try {
      const pdfDoc = await PDFDocument.create();
      
      for (const imgItem of images) {
        const page = pdfDoc.addPage([595.27, 841.89]); // A4 page points (72 points/inch)
        const arrayBuf = await imgItem.blob.arrayBuffer();
        
        let embeddedImg;
        if (imgItem.name.toLowerCase().endsWith('.png')) {
          embeddedImg = await pdfDoc.embedPng(arrayBuf);
        } else {
          embeddedImg = await pdfDoc.embedJpg(arrayBuf);
        }

        const imgScale = embeddedImg.scale(1.0);
        // Fit image nicely into A4 page margins
        const maxW = 535.27; // A4 width minus margin
        const maxH = 781.89; // A4 height minus margin
        
        let fitW = imgScale.width;
        let fitH = imgScale.height;
        const ratio = fitW / fitH;

        if (fitW > maxW) {
          fitW = maxW;
          fitH = fitW / ratio;
        }
        if (fitH > maxH) {
          fitH = maxH;
          fitW = fitH * ratio;
        }

        // Draw centered
        page.drawImage(embeddedImg, {
          x: (595.27 - fitW) / 2,
          y: (841.89 - fitH) / 2,
          width: fitW,
          height: fitH
        });
      }

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes as any], { type: 'application/pdf' });
      setOutputBlobData(blob, 'images_compiled.pdf');
    } catch (err) {
      console.error(err);
      showError('Conversion failed', 'Ensure images are PNG or JPG format.');
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const setOutputBlobData = (blob: Blob, defaultName: string) => {
    setOutputUrl(URL.createObjectURL(blob));
    setOutputSize(blob.size);
    setOutputName(defaultName);

    StorageService.updateStats(1, 0);
    HistoryService.addPdfEntry(defaultName.split('_')[0] || 'PDF Operation', defaultName, blob.size);

    showSuccess('PDF ready!', `${defaultName} · ${getFriendlySize(blob.size)}`);
    confetti({ particleCount: 65, spread: 50, origin: { y: 0.85 } });
  };

  const handleDownload = () => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = outputName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">PDF Utilities</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manipulate pages, merge multiple documents, extract sheets, or compile images entirely in-browser.</p>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {[
            { id: 'merge', label: 'Merge PDFs' },
            { id: 'split', label: 'Split PDF' },
            { id: 'edit', label: 'Rotate & Reorder' },
            { id: 'imgToPdf', label: 'Images to PDF' }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                clearOutputs();
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/10' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-850 dark:text-slate-300 dark:hover:bg-slate-750'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Task Controller */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
            
            {/* Merge PDF Panel */}
            {activeTab === 'merge' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ListOrdered className="w-4 h-4 text-violet-500" />
                  <span>Merge Workspace</span>
                </h3>
                <div 
                  onClick={() => mergeInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-violet-800 rounded-xl p-6 text-center cursor-pointer transition-colors"
                >
                  <input 
                    type="file" 
                    ref={mergeInputRef}
                    multiple
                    accept="application/pdf"
                    className="hidden" 
                    onChange={handleMergeFiles}
                  />
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Upload PDF documents</div>
                  <span className="text-[10px] text-slate-400">Select multiple PDF files</span>
                </div>

                {mergeFiles.length > 0 && (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {mergeFiles.map((item, idx) => (
                      <div key={item.id} className="flex justify-between items-center p-2.5 rounded-lg border border-slate-100 dark:border-slate-850 bg-white/20 dark:bg-slate-950/20 text-xs">
                        <div className="truncate font-medium text-slate-700 dark:text-slate-300 max-w-[150px]">{item.name}</div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => moveMergeItem(idx, 'up')} disabled={idx === 0} className="p-1 hover:text-violet-500 disabled:opacity-30">
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => moveMergeItem(idx, 'down')} disabled={idx === mergeFiles.length - 1} className="p-1 hover:text-violet-500 disabled:opacity-30">
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => removeMergeItem(item.id)} className="p-1 text-red-500 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={executeMerge}
                  disabled={mergeFiles.length < 2 || isProcessing}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Merge PDFs'}
                </button>
              </div>
            )}

            {/* Split PDF Panel */}
            {activeTab === 'split' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Split Document</h3>
                <div 
                  onClick={() => splitInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-violet-800 rounded-xl p-6 text-center cursor-pointer transition-colors"
                >
                  <input 
                    type="file" 
                    ref={splitInputRef}
                    accept="application/pdf"
                    className="hidden" 
                    onChange={handleSplitFile}
                  />
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {splitFile ? splitFile.name : 'Select PDF File'}
                  </div>
                  <span className="text-[10px] text-slate-400">PDF document only</span>
                </div>

                {splitFile && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Extract Page Range</label>
                      <input 
                        type="text" 
                        value={splitRange}
                        onChange={(e) => setSplitRange(e.target.value)}
                        placeholder="e.g. 1-3, 5"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-850 dark:text-slate-200"
                      />
                      <span className="text-[9px] text-slate-400">Use dashes for ranges, commas for separate pages (e.g. "1-3, 5")</span>
                    </div>

                    <button
                      onClick={executeSplit}
                      disabled={isProcessing}
                      className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                    >
                      {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Extract Pages'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Organize & Edit PDF Panel */}
            {activeTab === 'edit' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Manipulate Layout</h3>
                <div 
                  onClick={() => editInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-violet-800 rounded-xl p-6 text-center cursor-pointer transition-colors"
                >
                  <input 
                    type="file" 
                    ref={editInputRef}
                    accept="application/pdf"
                    className="hidden" 
                    onChange={handleEditFile}
                  />
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {editFile ? editFile.name : 'Select PDF File'}
                  </div>
                  <span className="text-[10px] text-slate-400">Select target PDF file</span>
                </div>

                {editFile && editPages.length > 0 && (
                  <button
                    onClick={executeEditSave}
                    disabled={isProcessing}
                    className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                  >
                    {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Compile manipulated PDF'}
                  </button>
                )}
              </div>
            )}

            {/* Images to PDF Panel */}
            {activeTab === 'imgToPdf' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Images to PDF Compiler</h3>
                <div 
                  onClick={() => imagesInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-violet-800 rounded-xl p-6 text-center cursor-pointer transition-colors"
                >
                  <input 
                    type="file" 
                    ref={imagesInputRef}
                    multiple
                    accept="image/png, image/jpeg"
                    className="hidden" 
                    onChange={handleImagesUpload}
                  />
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Select Images</div>
                  <span className="text-[10px] text-slate-400">Only PNG and JPG formats</span>
                </div>

                {images.length > 0 && (
                  <div className="max-h-[160px] overflow-y-auto border border-slate-100 dark:border-slate-800 p-2 rounded-xl bg-white/10 space-y-1.5">
                    {images.map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-xs px-2 py-1 bg-white/20 rounded">
                        <span className="truncate max-w-[150px]">{item.name}</span>
                        <button onClick={() => setImages(images.filter(x => x.id !== item.id))} className="text-red-500 hover:text-red-600 p-0.5">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={executeImagesToPdf}
                  disabled={images.length === 0 || isProcessing}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-50"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Compile Images to PDF'}
                </button>
              </div>
            )}

            {isProcessing && progressMsg && (
              <div className="text-xs text-center text-violet-600 dark:text-violet-400 animate-pulse font-medium">
                {progressMsg}
              </div>
            )}
          </div>
        </div>

        {/* Output Area */}
        <div className="lg:col-span-7">
          {activeTab === 'edit' && editFile && editPages.length > 0 ? (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Arrange PDF Sheets</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[380px] overflow-y-auto pr-1">
                {editPages.map((page, idx) => (
                  <div 
                    key={idx}
                    className="relative border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white/35 dark:bg-slate-950/20 text-center space-y-2 group"
                  >
                    <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Sheet {page.originalIndex + 1}
                    </div>
                    <div className="w-16 h-20 border border-slate-200 dark:border-slate-800 mx-auto rounded bg-slate-50 dark:bg-slate-900 flex items-center justify-center shadow-sm relative overflow-hidden transition-transform duration-200"
                      style={{
                        transform: `rotate(${page.rotation}deg)`
                      }}
                    >
                      <FileText className="w-6 h-6 text-slate-400" />
                      {page.rotation > 0 && (
                        <span className="absolute bottom-0 inset-x-0 bg-violet-600 text-white text-[8px] py-0.5 font-semibold leading-none">
                          {page.rotation}°
                        </span>
                      )}
                    </div>

                    <div className="flex justify-center gap-1 pt-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => movePage(idx, 'left')} disabled={idx === 0} className="p-1 hover:text-violet-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-30">
                        <ArrowUp className="w-3.5 h-3.5 rotate-270" />
                      </button>
                      <button onClick={() => rotatePage(idx)} className="p-1 hover:text-violet-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deletePage(idx)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => movePage(idx, 'right')} disabled={idx === editPages.length - 1} className="p-1 hover:text-violet-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-30">
                        <ArrowUp className="w-3.5 h-3.5 rotate-90" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : outputUrl ? (
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-md font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Output Document Compiled</span>
                </h3>
              </div>

              <div className="flex flex-col items-center justify-center p-8 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/20 text-center h-[260px]">
                <FileText className="w-16 h-16 text-red-500 mb-4" />
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 max-w-xs truncate">{outputName}</div>
                <div className="text-[10px] text-slate-400 mt-1">Compiled in browser • Size: {getFriendlySize(outputSize)}</div>
              </div>

              <button
                onClick={handleDownload}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 text-white bg-slate-900 hover:bg-slate-850 dark:bg-slate-800 dark:hover:bg-slate-750"
              >
                <Download className="w-4 h-4" />
                <span>Download Resulting PDF</span>
              </button>
            </div>
          ) : (
            <div className="h-full min-h-[380px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/20 dark:bg-slate-900/20 glass-panel flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-4">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Workspace is empty</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
                Choose a PDF operation tab on the top-right, import files on the left, and run compiler actions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
