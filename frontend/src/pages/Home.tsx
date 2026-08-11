// ============================================================
// CompressKro — Homepage & Home Dashboard Component
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  ListOrdered, 
  FileText, 
  RotateCw, 
  Upload, 
  Lock, 
  Unlock, 
  Droplets, 
  Eraser, 
  PenTool, 
  Hash, 
  FileImage, 
  FileSpreadsheet, 
  ScanText, 
  FileDown,
  Image as ImageIcon,
  Maximize2,
  UserCheck,
  Sparkles,
  Zap,
  ShieldCheck,
  LockKeyhole,
  TrendingDown,
  History,
  Trash2,
  Search,
  X,
  RotateCcw,
  Clock,
  Edit3,
  Wrench,
  Crop,
  Globe,
  ArrowRight,
  Play,
  Check,
  MousePointer,
  CloudUpload,
  ChevronRight,
  Folder
} from 'lucide-react';

import { StorageService } from '../services/storage.service';
import { useHistory } from '../hooks/useHistory';
import { useToast } from '../hooks/useToast';

interface ToolItem {
  name: string;
  desc: string;
  path: string;
  icon: React.ElementType;
  color: string;
}

interface CategoryGroup {
  title: string;
  desc: string;
  tools: ToolItem[];
}

const TOOL_FILTER_OPTIONS = ['All', 'Compression', 'Resize', 'Format Convert', 'Passport Maker', 'PDF'] as const;

export function Home() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<string>('All');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  const [simProgress, setSimProgress] = useState(0);

  const { history, deleteEntry, clearHistory } = useHistory();
  const { showInfo } = useToast();

  const stats = StorageService.getStats();

  const handleClearHistory = () => {
    clearHistory();
    showInfo('History cleared', 'All operation history has been removed.');
  };

  const handleDummyClick = (action: string) => {
    showInfo(`${action} triggered`, `Demo simulation of ${action} completed.`);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setSimProgress((prev) => (prev >= 100 ? 0 : prev + 1));
    }, 45);
    return () => clearInterval(timer);
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const navigateToTool = (path: string) => {
    if (selectedFile) {
      navigate(path, { state: { file: selectedFile } });
    }
  };

  const getToolOptionsForFile = () => {
    if (!selectedFile) return [];
    const name = selectedFile.name.toLowerCase();
    
    if (name.endsWith('.pdf')) {
      return [
        { name: 'Compress PDF', path: '/compress-pdf', icon: FileDown, desc: 'Reduce PDF file size.' },
        { name: 'Split PDF', path: '/split-pdf', icon: FileText, desc: 'Extract specific pages.' },
        { name: 'Merge PDF', path: '/merge-pdf', icon: ListOrdered, desc: 'Combine with other files.' },
        { name: 'Rotate PDF', path: '/rotate-pdf', icon: RotateCw, desc: 'Reorder and spin pages.' },
        { name: 'OCR PDF', path: '/ocr-pdf', icon: ScanText, desc: 'Make scanned pages searchable.' }
      ];
    }
    
    if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp') || name.endsWith('.heic')) {
      return [
        { name: 'Compress Image', path: '/compress-image', icon: ImageIcon, desc: 'Target a specific file size.' },
        { name: 'Resize Image', path: '/resize-image', icon: Maximize2, desc: 'Crop or scale dimensions.' },
        { name: 'Format Converter', path: '/convert-image', icon: FileSpreadsheet, desc: 'Convert PNG/JPG/WebP/HEIC.' },
        { name: 'Passport Photo Maker', path: '/passport-maker', icon: UserCheck, desc: 'Fit portal layouts.' },
        { name: 'Remove Background', path: '/remove-background', icon: Eraser, desc: 'Erase background instantly.' },
        { name: 'Image Editor', path: '/edit-image', icon: Edit3, desc: 'Apply filters and crops.' }
      ];
    }

    return [
      { name: 'Images to PDF', path: '/images-to-pdf', icon: Upload, desc: 'Compile documents.' },
      { name: 'HTML to PDF', path: '/html-to-pdf', icon: Globe, desc: 'Save webpages.' }
    ];
  };

  const popularTools = [
    { name: 'Compress PDF', desc: 'Reduce PDF size while preserving quality.', path: '/compress-pdf', icon: FileDown, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/20' },
    { name: 'Merge PDF', desc: 'Combine multiple files in any sequence.', path: '/merge-pdf', icon: ListOrdered, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/20' },
    { name: 'Split PDF', desc: 'Split documents or extract single pages.', path: '/split-pdf', icon: FileText, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-950/20' },
    { name: 'OCR PDF', desc: 'Convert scanned documents to searchable text.', path: '/ocr-pdf', icon: ScanText, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/20' },
    { name: 'Compress Image', desc: 'Target KB size compression for web portals.', path: '/compress-image', icon: ImageIcon, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-950/20' },
    { name: 'Remove Background', desc: 'AI background remover running fully offline.', path: '/remove-background', icon: Eraser, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-950/20' }
  ];

  const categories: CategoryGroup[] = [
    {
      title: 'Organize PDF',
      desc: 'Rearrange, merge, and split PDF pages with absolute ease.',
      tools: [
        { name: 'Merge PDF', desc: 'Combine multiple PDF files in any order.', path: '/merge-pdf', icon: ListOrdered, color: 'text-blue-500' },
        { name: 'Split PDF', desc: 'Extract pages or split document ranges.', path: '/split-pdf', icon: FileText, color: 'text-violet-500' },
        { name: 'Rotate & Order', desc: 'Rearrange and rotate pages with drag-and-drop.', path: '/rotate-pdf', icon: RotateCw, color: 'text-indigo-500' },
        { name: 'Crop PDF', desc: 'Crop page margins and define custom boundaries.', path: '/crop-pdf', icon: Crop, color: 'text-purple-500' }
      ]
    },
    {
      title: 'Convert PDF',
      desc: 'Convert PDF files to and from other common file formats.',
      tools: [
        { name: 'PDF to JPG', desc: 'Save PDF pages as JPEG images.', path: '/pdf-to-jpg', icon: FileImage, color: 'text-rose-500' },
        { name: 'Images to PDF', desc: 'Convert PNG, JPG, and WebP into PDF pages.', path: '/images-to-pdf', icon: Upload, color: 'text-teal-500' },
        { name: 'Extract Images', desc: 'Extract inline photos and assets from PDF.', path: '/extract-images', icon: ImageIcon, color: 'text-yellow-600' }
      ]
    },
    {
      title: 'Edit PDF',
      desc: 'Annotate, customize, seal, or stamp your PDF documents.',
      tools: [
        { name: 'Edit PDF', desc: 'Modify text, add shapes, images, or whiteout regions.', path: '/edit-pdf', icon: Edit3, color: 'text-pink-500' },
        { name: 'Add Signature', desc: 'Sign PDFs, draw names, or upload stamp seals.', path: '/sign-pdf', icon: PenTool, color: 'text-fuchsia-500' },
        { name: 'Add Watermark', desc: 'Add text or logo watermarks behind pages.', path: '/add-watermark', icon: Droplets, color: 'text-sky-500' },
        { name: 'Remove Watermark', desc: 'Clean annotations and watermark layers.', path: '/remove-watermark', icon: Eraser, color: 'text-red-500' },
        { name: 'Page Numbers', desc: 'Add customizable page numbers automatically.', path: '/page-numbers', icon: Hash, color: 'text-orange-500' }
      ]
    },
    {
      title: 'Security & Compression',
      desc: 'Compress size, add passwords, OCR, or decrypt PDFs.',
      tools: [
        { name: 'Compress PDF', desc: 'Reduce PDF file size keeping high quality.', path: '/compress-pdf', icon: FileDown, color: 'text-purple-500' },
        { name: 'OCR PDF', desc: 'Overlay searchable text layer on scanned pages.', path: '/ocr-pdf', icon: ScanText, color: 'text-amber-500' },
        { name: 'Lock PDF', desc: 'Encrypt your document with passwords.', path: '/lock-pdf', icon: Lock, color: 'text-slate-650' },
        { name: 'Unlock PDF', desc: 'Decrypt and remove owner passwords.', path: '/unlock-pdf', icon: Unlock, color: 'text-zinc-550' },
        { name: 'Repair PDF', desc: 'Fix corrupted, damaged, or unreadable PDF files.', path: '/repair-pdf', icon: Wrench, color: 'text-emerald-500' },
        { name: 'HTML to PDF', desc: 'Convert HTML code or web links into printable PDF.', path: '/html-to-pdf', icon: Globe, color: 'text-cyan-500' }
      ]
    },
    {
      title: 'Image Tools',
      desc: 'Crop, resize, convert format, and design portal photos.',
      tools: [
        { name: 'Image Compressor', desc: 'Smart KB-targeted image compression.', path: '/compress-image', icon: ImageIcon, color: 'text-pink-500' },
        { name: 'Image Resizer', desc: 'Resize pixels, crop bounds, and dimensions.', path: '/resize-image', icon: Maximize2, color: 'text-cyan-500' },
        { name: 'Format Converter', desc: 'Convert formats between PNG, JPG, WebP, HEIC.', path: '/convert-image', icon: FileSpreadsheet, color: 'text-teal-650' },
        { name: 'Passport Maker', desc: 'Print-ready passport photo layouts.', path: '/passport-maker', icon: UserCheck, color: 'text-lime-600' },
        { name: 'Govt Assistant', desc: 'Portal presets (SSC, UPSC, etc.) templates.', path: '/govt-assistant', icon: Sparkles, color: 'text-yellow-500' },
        { name: 'HTML to Image', desc: 'Convert HTML code markup or web URLs to PNG/JPG.', path: '/html-to-image', icon: Globe, color: 'text-violet-500' },
        { name: 'Image Editor', desc: 'Filters, cropping, drawing, adjustments.', path: '/edit-image', icon: Edit3, color: 'text-pink-500' },
        { name: 'Remove Background', desc: 'Erase backgrounds from signatures, logos, or green screens locally.', path: '/remove-background', icon: Eraser, color: 'text-rose-500' }
      ]
    }
  ];

  const filteredHistory = history.filter(h => {
    const matchesSearch =
      !historySearch ||
      h.name.toLowerCase().includes(historySearch.toLowerCase()) ||
      h.details.toLowerCase().includes(historySearch.toLowerCase());
    const matchesFilter = historyFilter === 'All' || h.tool === historyFilter;
    return matchesSearch && matchesFilter;
  });

  const displayedHistory = showAllHistory ? filteredHistory : filteredHistory.slice(0, 6);

  const getSimProgressText = () => {
    if (simProgress < 30) return 'Analyzing layout structure...';
    if (simProgress >= 30 && simProgress < 75) return 'Downscaling in-memory buffers...';
    return 'Re-assembling binary descriptors...';
  };

  const scrollToAllTools = () => {
    document.getElementById('all-tools-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToHowItWorks = () => {
    document.getElementById('how-it-works-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-16 md:space-y-24 animate-fade-in pb-12 select-none">
      
      <Helmet>
        <title>CompressKro — Free Online PDF & Image Optimization Tools</title>
        <meta name="description" content="Merge, split, compress, lock, unlock, and OCR PDFs, or compress, resize, and convert images online for free. No signup, privacy-first." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://compresskro.vercel.app/" />
        <meta property="og:title" content="CompressKro — Free Online PDF & Image Optimization Tools" />
        <meta property="og:description" content="Merge, split, compress, lock, unlock, and OCR PDFs, or compress, resize, and convert images online for free. No signup, privacy-first." />
        <meta property="og:url" content="https://compresskro.vercel.app/" />
        <meta property="og:type" content="website" />
      </Helmet>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center pt-2 md:pt-6">
        
        <div className="lg:col-span-7 space-y-6 text-left">
          
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 text-violet-600 dark:text-violet-400">
            <ShieldCheck className="w-4 h-4 text-violet-500" />
            <span className="text-[10px] font-black uppercase tracking-wider">100% Free · No Sign up · Your files stay private</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
            Make files <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">lighter.</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-semibold leading-relaxed max-w-xl">
            Compress, convert, edit and optimize your PDFs and images — fast, free and private. Everything runs in-browser so your documents never touch a remote server.
          </p>

          <div className="grid grid-cols-2 gap-4 max-w-lg">
            
            <div className="flex gap-2.5 items-start">
              <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-650 flex-shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Local processing</h4>
                <p className="text-[9.5px] text-slate-450 mt-0.5 leading-normal">Runs fully in-browser.</p>
              </div>
            </div>

            <div className="flex gap-2.5 items-start">
              <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-650 flex-shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">No limitations</h4>
                <p className="text-[9.5px] text-slate-450 mt-0.5 leading-normal">Unlimited uploads & page tasks.</p>
              </div>
            </div>

            <div className="flex gap-2.5 items-start">
              <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-650 flex-shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Govt Portal ready</h4>
                <p className="text-[9.5px] text-slate-450 mt-0.5 leading-normal">Presets to fit exactly under KB bounds.</p>
              </div>
            </div>

            <div className="flex gap-2.5 items-start">
              <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-650 flex-shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Clean metadata</h4>
                <p className="text-[9.5px] text-slate-450 mt-0.5 leading-normal">Removes tracking and author tags.</p>
              </div>
            </div>

          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button 
              onClick={scrollToAllTools}
              className="px-6 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-md shadow-violet-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              Explore All Tools
            </button>
            <button 
              onClick={scrollToHowItWorks}
              className="px-5 py-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-350 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-850 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              How it works
            </button>
          </div>

        </div>

        <div className="lg:col-span-5 relative flex justify-center py-6 lg:py-0">
          
          <div className="hidden sm:block absolute -top-4 left-6 z-20 animate-pulse pointer-events-auto">
            <div className="bg-white dark:bg-slate-900 shadow-lg rounded-2xl p-2.5 border border-slate-200/50 dark:border-slate-800 flex items-center gap-2.5 max-w-[130px] hover:scale-105 transition-transform duration-300">
              <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/20 flex items-center justify-center text-red-500">
                <FileText className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-black text-slate-800 dark:text-slate-200 truncate">Report.pdf</div>
                <div className="text-[8px] font-bold text-slate-400">2.4 MB</div>
              </div>
            </div>
          </div>

          <div className="hidden sm:block absolute bottom-12 -left-6 z-20 animate-pulse pointer-events-auto">
            <div className="bg-white dark:bg-slate-900 shadow-lg rounded-2xl p-2.5 border border-slate-200/50 dark:border-slate-800 flex items-center gap-2.5 max-w-[130px] hover:scale-105 transition-transform duration-300">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center text-blue-500">
                <ImageIcon className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-black text-slate-800 dark:text-slate-200 truncate">Photo.jpg</div>
                <div className="text-[8px] font-bold text-slate-400">1.6 MB</div>
              </div>
            </div>
          </div>

          <div className="hidden sm:block absolute -top-8 right-6 z-20 animate-pulse pointer-events-auto">
            <div className="bg-white dark:bg-slate-900 shadow-lg rounded-2xl p-2.5 border border-slate-200/50 dark:border-slate-800 flex items-center gap-2.5 max-w-[130px] hover:scale-105 transition-transform duration-300">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-500">
                <FileText className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-black text-slate-800 dark:text-slate-200 truncate">Essay.docx</div>
                <div className="text-[8px] font-bold text-slate-400">2.1 MB</div>
              </div>
            </div>
          </div>

          <div className="hidden sm:block absolute bottom-8 -right-4 z-20 animate-pulse pointer-events-auto">
            <div className="bg-white dark:bg-slate-900 shadow-lg rounded-2xl p-2.5 border border-slate-200/50 dark:border-slate-800 flex items-center gap-2.5 max-w-[130px] hover:scale-105 transition-transform duration-300">
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/20 flex items-center justify-center text-purple-500">
                <Folder className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-black text-slate-800 dark:text-slate-200 truncate">Archive.zip</div>
                <div className="text-[8px] font-bold text-slate-400">4.3 MB</div>
              </div>
            </div>
          </div>

          <div 
            className="w-full max-w-[370px] z-10"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
          >
            <div className={`bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/40 rounded-3xl p-6 md:p-8 shadow-xl transition-all duration-300 ${dragActive ? 'scale-105 border-violet-500 ring-4 ring-violet-500/5' : ''}`}>
              
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
              />

              {!selectedFile ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-violet-500 dark:border-slate-800 dark:hover:border-violet-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all h-[240px] select-none"
                >
                  <div className="w-12 h-12 rounded-full bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center text-violet-600 mb-4 animate-bounce">
                    <CloudUpload className="w-6 h-6" />
                  </div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200">Drop your files here</h3>
                  <p className="text-[10px] text-slate-450 mt-1">or click to <span className="text-violet-600 font-bold">browse</span></p>
                  <span className="text-[9px] text-slate-400 mt-4 leading-normal">PDF, JPG, PNG, WEBP and more<br />Up to 100MB per file</span>
                </div>
              ) : (
                <div className="space-y-4 text-left">
                  <div className="flex items-center gap-3 p-3 bg-violet-50/50 dark:bg-violet-950/20 rounded-2xl border border-violet-100/40 dark:border-violet-900/20">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-violet-650 flex-shrink-0">
                      <FileText className="w-5.5 h-5.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-black text-slate-800 dark:text-slate-200 truncate">{selectedFile.name}</div>
                      <div className="text-[9px] font-bold text-slate-400 mt-0.5">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</div>
                    </div>
                    <button 
                      onClick={clearSelectedFile}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Choose a utility:</div>
                    <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
                      {getToolOptionsForFile().map((opt) => {
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.name}
                            onClick={() => navigateToTool(opt.path)}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-violet-500 dark:border-slate-800 dark:hover:border-violet-500 bg-white/40 dark:bg-slate-900/30 hover:bg-violet-50/20 dark:hover:bg-violet-950/10 hover:shadow-xs transition-all text-left group cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon className="w-4 h-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <div className="text-[10px] font-black text-slate-850 dark:text-slate-100 group-hover:text-violet-600 transition-colors">{opt.name}</div>
                                <div className="text-[8.5px] text-slate-400 mt-0.5 truncate">{opt.desc}</div>
                              </div>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center justify-center gap-1.5 text-[9px] font-bold text-slate-400 select-none">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Your files are safe with us</span>
              </div>

            </div>
          </div>

        </div>

      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500 animate-pulse" />
            <span>Popular Tools</span>
          </h2>
          <button 
            onClick={scrollToAllTools}
            className="text-xs font-bold text-violet-600 hover:text-violet-750 dark:text-violet-400 flex items-center gap-1 transition-colors cursor-pointer"
          >
            View all tools
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {popularTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.name}
                to={tool.path}
                className="p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 bg-white/70 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 hover:border-violet-500 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${tool.bg} group-hover:scale-105 transition-transform`}>
                    <Icon className={`w-5 h-5 ${tool.color}`} />
                  </div>
                  <div className="min-w-0 text-left">
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 group-hover:text-violet-600 transition-colors">{tool.name}</h3>
                    <p className="text-[10px] text-slate-450 mt-0.5 leading-relaxed truncate max-w-[200px]">{tool.desc}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-violet-600 group-hover:translate-x-1 transition-all" />
              </Link>
            );
          })}
        </div>
      </section>

      <section id="how-it-works-section" className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center bg-violet-50/20 dark:bg-violet-950/5 border border-slate-200/40 dark:border-slate-800/20 rounded-3xl p-6 sm:p-8 md:p-12 relative overflow-hidden">
        
        <div className="lg:col-span-6 space-y-8 text-left z-10">
          <div className="space-y-2">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <MousePointer className="w-5 h-5 text-violet-500" />
              <span>How it works</span>
            </h2>
            <p className="text-xs text-slate-400 font-semibold">Convert or compress documents in three simple steps.</p>
          </div>

          <div className="space-y-6">
            
            <div className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-violet-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm shadow-violet-500/10">
                1
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">Choose a tool</h4>
                <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">Select the utility matching your current optimization task from our list.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-violet-650 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm shadow-violet-500/10">
                2
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">Upload your file</h4>
                <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">Upload your file and our high-performance in-browser compilation takes care of the rest.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-violet-700 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm shadow-violet-500/10">
                3
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">Get result instantly</h4>
                <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">Download your compiled output file instantly, without wait times or watermarks.</p>
              </div>
            </div>

          </div>
        </div>

        <div className="lg:col-span-6 flex justify-center z-10">
          <div className="w-full max-w-[380px] bg-white dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/40 rounded-3xl p-5 shadow-lg relative text-left">
            
            <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7.5 h-7.5 rounded-lg bg-red-100 dark:bg-red-950/20 flex items-center justify-center text-red-500">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10.5px] font-black text-slate-800 dark:text-slate-200">Compressed.pdf</div>
                  <div className="text-[8.5px] font-bold text-slate-400">2.7 MB</div>
                </div>
              </div>
              <div className="text-[9.5px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                <TrendingDown className="w-3 h-3" />
                82% smaller
              </div>
            </div>

            <div className="my-5 space-y-2">
              <div className="flex items-center justify-between text-[9px] font-bold text-slate-450">
                <span>{getSimProgressText()}</span>
                <span>{simProgress}%</span>
              </div>
              
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-850 overflow-hidden relative border border-slate-200/10">
                <div 
                  className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full transition-all duration-100"
                  style={{ width: `${simProgress}%` }}
                />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button 
                onClick={() => handleDummyClick('Download')}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 flex items-center justify-center gap-2 hover:opacity-95 transition-opacity cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                Download File
              </button>
              
              <button 
                onClick={() => setSimProgress(0)}
                className="w-full text-center text-[10px] font-bold text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                Compress another
              </button>
            </div>

          </div>
        </div>

      </section>

      <section id="all-tools-section" className="space-y-8 border-t border-slate-200/50 dark:border-slate-900/60 pt-16">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-50">All Tool Utilities</h2>
          <p className="text-xs text-slate-450 font-semibold leading-relaxed">Select any utility cataloged below to start optimization instantly in your browser sandbox.</p>
        </div>

        <div className="space-y-12">
          {categories.map((cat, idx) => (
            <div key={idx} className="space-y-4">
              <div className="border-b border-slate-200/60 dark:border-slate-800/40 pb-2 text-left">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">{cat.title}</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-505 font-semibold mt-0.5">{cat.desc}</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {cat.tools.map((tool, tIdx) => {
                  const Icon = tool.icon;
                  return (
                    <Link
                      key={tIdx}
                      to={tool.path}
                      className="p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-900 hover:border-violet-500 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all text-left flex flex-col justify-between h-[135px] group cursor-pointer"
                    >
                      <div className="w-8.5 h-8.5 rounded-lg bg-slate-50 dark:bg-slate-950 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-50 dark:group-hover:bg-violet-950/20 transition-colors">
                        <Icon className={`w-4 h-4 ${tool.color} group-hover:scale-110 transition-transform`} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-violet-600 transition-colors truncate">{tool.name}</h4>
                        <p className="text-[9.5px] text-slate-400 dark:text-slate-500 leading-normal font-semibold line-clamp-2">{tool.desc}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
        {[
          {
            label: 'Privacy Sandbox Protection',
            value: stats.privacyScore,
            sub: 'Local operations inside browser container',
            icon: ShieldCheck,
            color: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/20'
          },
          {
            label: 'Files Optimizations',
            value: stats.filesProcessed.toString(),
            sub: 'Transient memory execution cycles',
            icon: Upload,
            color: 'bg-fuchsia-50 dark:bg-fuchsia-950/20 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-100/50 dark:border-fuchsia-900/20'
          },
          {
            label: 'Disk Bytes Liberated',
            value: `${stats.mbSaved.toFixed(2)} MB`,
            sub: 'Storage capacity returned to your device',
            icon: TrendingDown,
            color: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/20'
          }
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40 flex items-center gap-4 text-left shadow-xs">
              <div className={`p-3 rounded-xl flex-shrink-0 ${stat.color}`}>
                <Icon className="w-5.5 h-5.5" />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">{stat.label}</div>
                <div className="text-xl font-black text-slate-850 dark:text-slate-100 mt-0.5">{stat.value}</div>
                <div className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold leading-normal">{stat.sub}</div>
              </div>
            </div>
          );
        })}
      </section>

      {history.length > 0 && (
        <section className="p-6 rounded-2xl border border-slate-200 dark:border-slate-850 bg-white/30 dark:bg-slate-900/30 glass-panel space-y-4 text-left shadow-xs">
          
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-md font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-violet-500" />
              <span>Recent Activity Logs</span>
              <span className="text-xs font-normal text-slate-400">({history.length})</span>
            </h2>
            <button
              onClick={handleClearHistory}
              className="text-xs font-bold text-red-500 hover:text-red-650 dark:text-red-400 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear Logs
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-450" />
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Search activity history..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
              />
              {historySearch && (
                <button
                  onClick={() => setHistorySearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-650"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {TOOL_FILTER_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setHistoryFilter(opt)}
                  className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                    historyFilter === opt
                      ? 'bg-violet-650 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-450 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 font-semibold">No activity logs recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-850 text-xs font-bold text-slate-450 uppercase">
                    <th className="py-2 pr-4">File Descriptor</th>
                    <th className="py-2 pr-4">Utility Type</th>
                    <th className="py-2 pr-4">Result Details</th>
                    <th className="py-2 pr-4">Timestamp</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/30">
                  {displayedHistory.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group">
                      <td className="py-2.5 pr-4 font-black text-slate-800 dark:text-slate-200 max-w-[180px] truncate">
                        {item.name}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-350 whitespace-nowrap">
                          {item.tool}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-emerald-600 dark:text-emerald-400 font-bold text-xs font-mono">
                        {item.details}
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-slate-400 whitespace-nowrap flex items-center gap-1 font-semibold">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {item.date}
                      </td>
                      <td className="py-2.5">
                        <button
                          onClick={() => deleteEntry(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer"
                          title="Purge activity log"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredHistory.length > 6 && (
                <button
                  onClick={() => setShowAllHistory(!showAllHistory)}
                  className="mt-3 w-full py-1.5 text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20 rounded-lg transition-colors cursor-pointer"
                >
                  {showAllHistory ? 'Show less' : `Show all ${filteredHistory.length} entries`}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-200/50 dark:border-slate-900/60">
        <div className="flex items-start gap-3 text-left">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-emerald-650">
            <ShieldCheck className="w-5.5 h-5.5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">100% Client-Side Privacy</h4>
            <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">Most operations compile instantly in your browser sandbox. Your sensitive files never upload to our servers.</p>
          </div>
        </div>

        <div className="flex items-start gap-3 text-left">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl text-blue-650">
            <Zap className="w-5.5 h-5.5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">No Registrations or Limits</h4>
            <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">Enjoy unlimited file tasks. No signups, no paywalls, and no watermarks on your compiled documents.</p>
          </div>
        </div>

        <div className="flex items-start gap-3 text-left">
          <div className="p-2 bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 rounded-xl text-violet-650">
            <LockKeyhole className="w-5.5 h-5.5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">Secure Transmission Lines</h4>
            <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">When backend processing is required (like OCR or PDF repair), data routes are fully HTTPS encrypted.</p>
          </div>
        </div>
      </section>

    </div>
  );
}
