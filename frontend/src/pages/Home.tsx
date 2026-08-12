// ============================================================
// CompressKro - Homepage & Tool Finder
// 2026 Premium Redesign — Warm, human, professional
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  CloudUpload,
  Crop,
  Droplets,
  Eraser,
  FileDown,
  FileImage,
  FileSpreadsheet,
  FileText,
  Globe,
  HelpCircle,
  History,
  Image as ImageIcon,
  Layers3,
  ListOrdered,
  Lock,
  LockKeyhole,
  Maximize2,
  Minus,
  PenTool,
  Plus,
  RotateCcw,
  RotateCw,
  ScanText,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  UserCheck,
  Wand2,
  Wrench,
  X,
  Zap
} from 'lucide-react';

import heroImage from '../assets/hero.png';
import { StorageService } from '../services/storage.service';
import { useHistory } from '../hooks/useHistory';
import { useToast } from '../hooks/useToast';

// ---- Scroll Reveal Hook ----
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed');
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function RevealSection({ children, className = '', stagger = false }: { children: React.ReactNode; className?: string; stagger?: boolean }) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`animate-reveal ${stagger ? 'stagger-children' : ''} ${className}`}>
      {children}
    </div>
  );
}

interface ToolItem {
  name: string;
  desc: string;
  path: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  badge?: string;
}

interface CategoryGroup {
  title: string;
  desc: string;
  icon: React.ElementType;
  accentColor: string;
  tools: ToolItem[];
}

const TOOL_FILTER_OPTIONS = ['All', 'Compression', 'Resize', 'Format Convert', 'Passport Maker', 'PDF'] as const;

const trustPoints = [
  { title: 'Privacy first', desc: 'Most tools run directly in your browser — files never leave your device.', icon: ShieldCheck, accent: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { title: 'No sign up needed', desc: 'Open a tool, add your file, download the result. That simple.', icon: Zap, accent: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  { title: 'Portal ready', desc: 'Target exact KB limits for government forms and exam uploads.', icon: Check, accent: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30' },
  { title: 'Clean exports', desc: 'Reduce file size and strip metadata for professional output.', icon: LockKeyhole, accent: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/30' }
];

const faqs = [
  {
    question: 'Is CompressKro completely free?',
    answer: 'Yes. CompressKro is free to use, with no sign up, no watermark, and no paid gate on normal PDF and image tasks.'
  },
  {
    question: 'Are my files uploaded to a server?',
    answer: 'Most PDF and image operations run inside your browser, so files stay on your device. Tools that require heavier processing, such as OCR or repair, use encrypted transfer and temporary processing only.'
  },
  {
    question: 'Which files can I work with?',
    answer: 'You can use CompressKro for PDFs, JPG, PNG, WebP, HEIC, HTML conversions, passport photos, signatures, and government portal size presets.'
  },
  {
    question: 'Can I make files fit under 20KB, 50KB, or 100KB?',
    answer: 'Yes. The compression and government portal tools are designed around exact target sizes, so you can fit documents, photos, and signatures under common upload limits.'
  },
  {
    question: 'Does CompressKro work on mobile?',
    answer: 'Yes. The interface is responsive and built for quick use on phones, tablets, laptops, and desktops.'
  }
];

export function Home() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<string>('All');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const { history, deleteEntry, clearHistory } = useHistory();
  const { showInfo } = useToast();
  const stats = StorageService.getStats();

  useEffect(() => {
    const timer = setInterval(() => {
      setSimProgress((prev) => (prev >= 100 ? 0 : prev + 1));
    }, 55);
    return () => clearInterval(timer);
  }, []);

  const categories: CategoryGroup[] = [
    {
      title: 'PDF Tools',
      desc: 'Compress, merge, split, edit, secure, OCR, and convert PDF documents.',
      icon: FileText,
      accentColor: 'violet',
      tools: [
        { name: 'Compress PDF', desc: 'Reduce PDF size while keeping clear output.', path: '/compress-pdf', icon: FileDown, color: 'text-violet-600', bgColor: 'bg-violet-50 dark:bg-violet-950/30', badge: 'Popular' },
        { name: 'Edit PDF', desc: 'Add text, images, whiteout, shapes, and notes.', path: '/edit-pdf', icon: Wand2, color: 'text-fuchsia-600', bgColor: 'bg-fuchsia-50 dark:bg-fuchsia-950/30' },
        { name: 'Merge PDF', desc: 'Combine multiple files into one ordered PDF.', path: '/merge-pdf', icon: ListOrdered, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
        { name: 'Split PDF', desc: 'Extract pages or split a PDF into ranges.', path: '/split-pdf', icon: FileText, color: 'text-indigo-600', bgColor: 'bg-indigo-50 dark:bg-indigo-950/30' },
        { name: 'Rotate & Order', desc: 'Rotate pages and reorder them visually.', path: '/rotate-pdf', icon: RotateCw, color: 'text-sky-600', bgColor: 'bg-sky-50 dark:bg-sky-950/30' },
        { name: 'Crop PDF', desc: 'Trim page margins and adjust visible areas.', path: '/crop-pdf', icon: Crop, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/30' },
        { name: 'OCR PDF', desc: 'Make scanned pages searchable and selectable.', path: '/ocr-pdf', icon: ScanText, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30' },
        { name: 'Lock PDF', desc: 'Protect a document with a password.', path: '/lock-pdf', icon: Lock, color: 'text-slate-700 dark:text-slate-300', bgColor: 'bg-slate-100 dark:bg-slate-800/40' },
        { name: 'Unlock PDF', desc: 'Remove restrictions from your own PDFs.', path: '/unlock-pdf', icon: LockKeyhole, color: 'text-zinc-700 dark:text-zinc-300', bgColor: 'bg-zinc-100 dark:bg-zinc-800/40' },
        { name: 'Repair PDF', desc: 'Fix damaged or unreadable PDF files.', path: '/repair-pdf', icon: Wrench, color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30' },
        { name: 'Sign PDF', desc: 'Add signatures, stamps, and initials.', path: '/sign-pdf', icon: PenTool, color: 'text-rose-600', bgColor: 'bg-rose-50 dark:bg-rose-950/30' },
        { name: 'Watermark PDF', desc: 'Add or clean document watermarks.', path: '/add-watermark', icon: Droplets, color: 'text-cyan-600', bgColor: 'bg-cyan-50 dark:bg-cyan-950/30' }
      ]
    },
    {
      title: 'Image Tools',
      desc: 'Compress, resize, convert, edit, remove backgrounds, and prepare official photos.',
      icon: ImageIcon,
      accentColor: 'coral',
      tools: [
        { name: 'Compress Image', desc: 'Hit target sizes like 20KB, 50KB, or 100KB.', path: '/compress-image', icon: ImageIcon, color: 'text-pink-600', bgColor: 'bg-pink-50 dark:bg-pink-950/30', badge: 'Popular' },
        { name: 'Resize Image', desc: 'Resize by pixels, aspect ratio, or dimensions.', path: '/resize-image', icon: Maximize2, color: 'text-cyan-600', bgColor: 'bg-cyan-50 dark:bg-cyan-950/30' },
        { name: 'Convert Image', desc: 'Convert JPG, PNG, WebP, and HEIC formats.', path: '/convert-image', icon: FileSpreadsheet, color: 'text-teal-600', bgColor: 'bg-teal-50 dark:bg-teal-950/30' },
        { name: 'Image Editor', desc: 'Crop, tune, annotate, and export cleanly.', path: '/edit-image', icon: Wand2, color: 'text-violet-600', bgColor: 'bg-violet-50 dark:bg-violet-950/30' },
        { name: 'Remove Background', desc: 'Cut out product photos, signatures, and IDs.', path: '/remove-background', icon: Eraser, color: 'text-rose-600', bgColor: 'bg-rose-50 dark:bg-rose-950/30', badge: 'Popular' },
        { name: 'Passport Maker', desc: 'Create passport photo sheets and layouts.', path: '/passport-maker', icon: UserCheck, color: 'text-lime-700', bgColor: 'bg-lime-50 dark:bg-lime-950/30' },
        { name: 'Govt Assistant', desc: 'Presets for forms, exams, photos, and signatures.', path: '/govt-assistant', icon: Sparkles, color: 'text-yellow-600', bgColor: 'bg-yellow-50 dark:bg-yellow-950/30' },
        { name: 'HTML to Image', desc: 'Export HTML or webpage previews to images.', path: '/html-to-image', icon: Globe, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30' }
      ]
    },
    {
      title: 'Converters',
      desc: 'Move between documents, images, and web formats without installing apps.',
      icon: FileSpreadsheet,
      accentColor: 'teal',
      tools: [
        { name: 'PDF to JPG', desc: 'Turn PDF pages into high-quality images.', path: '/pdf-to-jpg', icon: FileImage, color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950/30' },
        { name: 'Images to PDF', desc: 'Convert photos and scans into one PDF.', path: '/images-to-pdf', icon: Upload, color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30' },
        { name: 'Extract Images', desc: 'Pull embedded images out of PDF files.', path: '/extract-images', icon: Layers3, color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950/30' },
        { name: 'HTML to PDF', desc: 'Save markup or web pages as printable PDFs.', path: '/html-to-pdf', icon: Globe, color: 'text-sky-600', bgColor: 'bg-sky-50 dark:bg-sky-950/30' }
      ]
    }
  ];

  const popularTools = [
    categories[0].tools[0],
    categories[1].tools[0],
    categories[1].tools[4],
    categories[0].tools[1],
    categories[1].tools[6],
    categories[0].tools[2]
  ];

  const flatTools = categories.flatMap((cat) => cat.tools);

  const filteredHistory = history.filter(h => {
    const matchesSearch =
      !historySearch ||
      h.name.toLowerCase().includes(historySearch.toLowerCase()) ||
      h.details.toLowerCase().includes(historySearch.toLowerCase());
    const matchesFilter = historyFilter === 'All' || h.tool === historyFilter;
    return matchesSearch && matchesFilter;
  });

  const displayedHistory = showAllHistory ? filteredHistory : filteredHistory.slice(0, 6);

  const handleClearHistory = () => {
    clearHistory();
    showInfo('History cleared', 'Your local operation history has been removed.');
  };

  const handleDummyClick = (action: string) => {
    showInfo(action, 'Preview complete. Choose any tool to process your own file.');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const navigateToTool = (path: string) => {
    if (selectedFile) navigate(path, { state: { file: selectedFile } });
  };

  const getToolOptionsForFile = () => {
    if (!selectedFile) return [];
    const name = selectedFile.name.toLowerCase();

    if (name.endsWith('.pdf')) {
      return flatTools.filter(tool =>
        ['Compress PDF', 'Edit PDF', 'Split PDF', 'Merge PDF', 'OCR PDF', 'PDF to JPG'].includes(tool.name)
      );
    }

    if (/\.(jpg|jpeg|png|webp|heic)$/i.test(name)) {
      return flatTools.filter(tool =>
        ['Compress Image', 'Resize Image', 'Convert Image', 'Remove Background', 'Passport Maker', 'Image Editor'].includes(tool.name)
      );
    }

    return flatTools.filter(tool => ['Images to PDF', 'HTML to PDF', 'HTML to Image'].includes(tool.name));
  };

  const scrollToAllTools = () => {
    document.getElementById('all-tools-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToHowItWorks = () => {
    document.getElementById('how-it-works-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const getSimProgressText = () => {
    if (simProgress < 34) return 'Reading file structure...';
    if (simProgress < 72) return 'Optimizing size and quality...';
    return 'Preparing private download...';
  };

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'CompressKro',
    url: 'https://compresskro.vercel.app/',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: 'Free browser-based PDF and image tools to compress, convert, edit, resize, remove backgrounds, OCR, merge, split, and prepare files for government portals.'
  };

  const getCategoryBorderClass = (accentColor: string) => {
    switch (accentColor) {
      case 'coral': return 'ck-card-accent-coral';
      case 'teal': return 'ck-card-accent-teal';
      case 'amber': return 'ck-card-accent-amber';
      default: return 'ck-card-accent';
    }
  };

  return (
    <div className="space-y-16 md:space-y-24 pb-12 animate-fade-in">
      <Helmet>
        <title>CompressKro - Free PDF & Image Compressor, Editor and Converter</title>
        <meta
          name="description"
          content="Use CompressKro for free PDF and image tools: compress PDF, edit PDF, merge, split, OCR, resize images, convert images, remove background, and fit files under KB limits. No sign up."
        />
        <meta name="keywords" content="CompressKro, compress PDF, PDF editor, image compressor, image editor, remove background, resize image, government portal photo, PDF converter" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://compresskro.vercel.app/" />
        <meta property="og:title" content="CompressKro - Free PDF & Image Tools" />
        <meta property="og:description" content="Compress, convert, edit, resize, OCR, and prepare PDFs and images for free. No sign up and privacy-first." />
        <meta property="og:url" content="https://compresskro.vercel.app/" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      {/* =========== HERO SECTION =========== */}
      <section className="relative overflow-hidden rounded-[var(--ck-radius-xl)] ck-grain" style={{ background: 'linear-gradient(135deg, var(--ck-bg-cream) 0%, var(--ck-bg-card) 50%, var(--ck-accent-violet-soft) 100%)' }}>
        <img
          src={heroImage}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-4 hidden h-32 w-32 opacity-[0.08] sm:block md:h-44 md:w-44"
        />

        <div className="relative z-10 px-5 py-10 sm:px-8 md:px-12 md:py-16">
          <div className="mx-auto max-w-4xl text-center">
            
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400" style={{ border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <ShieldCheck className="h-3.5 w-3.5" />
              100% free · no sign up · files stay private
            </div>

            {/* Headline */}
            <h1 className="mt-7 text-4xl font-black leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              <span className="text-[var(--ck-text-primary)]">Your everyday toolkit for</span>
              <br />
              <span className="gradient-text">PDFs & Images</span>
            </h1>

            {/* Subtitle */}
            <p className="mx-auto mt-5 max-w-2xl text-[15px] font-medium leading-7 text-[var(--ck-text-secondary)] sm:text-base">
              Compress, convert, edit, resize, OCR, and prepare files in one clean workspace.
              <br className="hidden sm:block" />
              Built for documents, portal uploads, passport photos, and quick fixes.
            </p>

            {/* CTA Buttons */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={scrollToAllTools}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition-all hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-500/25 active:scale-[0.98]"
              >
                Explore all tools
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={scrollToHowItWorks}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--ck-bg-card)] px-6 py-3 text-sm font-bold text-[var(--ck-text-secondary)] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
                style={{ border: '1px solid var(--ck-border)' }}
              >
                How it works
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Upload Zone */}
          <div
            className="mx-auto mt-10 max-w-3xl"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
          >
            <div className={`rounded-[var(--ck-radius-lg)] p-3 transition-all ${dragActive ? 'ring-4 ring-violet-200 dark:ring-violet-900/40' : ''}`} style={{ background: 'var(--ck-bg-muted)', border: '1px solid var(--ck-border)' }}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
              />

              {!selectedFile ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex min-h-[200px] w-full flex-col items-center justify-center rounded-[var(--ck-radius-md)] bg-[var(--ck-bg-card)] px-6 py-8 text-center transition-all hover:shadow-md ${dragActive ? '' : 'animate-pulse-border'}`}
                  style={{ border: '2px dashed var(--ck-border)' }}
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 dark:bg-violet-950/30 text-violet-600">
                    <CloudUpload className="h-7 w-7" />
                  </span>
                  <span className="mt-4 text-lg font-black text-[var(--ck-text-primary)]">Drop a PDF or image here</span>
                  <span className="mt-1.5 text-sm font-medium text-[var(--ck-text-secondary)]">or click to browse from your device</span>
                  <span className="mt-5 text-[11px] font-bold uppercase tracking-wide text-[var(--ck-text-muted)]">PDF, JPG, PNG, WebP, HEIC — up to 100MB</span>
                </button>
              ) : (
                <div className="space-y-3 rounded-[var(--ck-radius-md)] bg-[var(--ck-bg-card)] p-4 text-left">
                  <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'var(--ck-accent-violet-soft)', border: '1px solid rgba(124, 58, 237, 0.1)' }}>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ck-bg-card)] text-violet-600">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black text-[var(--ck-text-primary)]">{selectedFile.name}</div>
                      <div className="mt-0.5 text-xs font-medium text-[var(--ck-text-secondary)]">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB ready</div>
                    </div>
                    <button
                      onClick={clearSelectedFile}
                      className="rounded-lg p-2 text-[var(--ck-text-muted)] transition-colors hover:bg-[var(--ck-bg-card)] hover:text-red-500"
                      title="Remove selected file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {getToolOptionsForFile().map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.name}
                          onClick={() => navigateToTool(opt.path)}
                          className="group flex items-center justify-between rounded-xl bg-[var(--ck-bg-card)] p-3 text-left transition-all hover:shadow-md"
                          style={{ border: '1px solid var(--ck-border)' }}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${opt.bgColor}`}>
                              <Icon className={`h-4 w-4 ${opt.color}`} />
                            </div>
                            <span className="min-w-0">
                              <span className="block text-sm font-bold text-[var(--ck-text-primary)]">{opt.name}</span>
                              <span className="block truncate text-xs text-[var(--ck-text-muted)]">{opt.desc}</span>
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ck-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-violet-600" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Trust Pills */}
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-2 py-3 text-[11px] font-bold text-[var(--ck-text-muted)]">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Browser-first privacy</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> No watermark</span>
                <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-amber-500" /> Fast exports</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========== TRUST POINTS =========== */}
      <RevealSection stagger>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {trustPoints.map((point) => {
            const Icon = point.icon;
            return (
              <div key={point.title} className="ck-card p-5 text-left">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${point.bg}`}>
                  <Icon className={`h-5 w-5 ${point.accent}`} />
                </div>
                <h2 className="mt-4 text-sm font-black text-[var(--ck-text-primary)]">{point.title}</h2>
                <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-[var(--ck-text-secondary)]">{point.desc}</p>
              </div>
            );
          })}
        </div>
      </RevealSection>

      {/* =========== POPULAR TOOLS =========== */}
      <RevealSection>
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-violet-600">
                <Star className="h-3.5 w-3.5 fill-violet-600" />
                Most used
              </div>
              <h2 className="mt-1.5 text-2xl font-black text-[var(--ck-text-primary)]">Popular tools</h2>
            </div>
            <button
              onClick={scrollToAllTools}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-violet-600 transition-colors hover:text-violet-800"
            >
              View complete toolkit
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popularTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.name}
                  to={tool.path}
                  className="group ck-card flex min-h-[120px] items-start justify-between p-5 text-left glow-effect"
                >
                  <span className="flex min-w-0 gap-4">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tool.bgColor}`}>
                      <Icon className={`h-5 w-5 ${tool.color}`} />
                    </span>
                    <span>
                      <span className="flex items-center gap-2">
                        <span className="block text-[15px] font-black text-[var(--ck-text-primary)] group-hover:text-violet-600 transition-colors">{tool.name}</span>
                        {tool.badge && (
                          <span className="rounded-full bg-violet-100 dark:bg-violet-900/40 px-2 py-0.5 text-[9px] font-bold text-violet-700 dark:text-violet-300 uppercase">{tool.badge}</span>
                        )}
                      </span>
                      <span className="mt-1 block text-[13px] font-medium leading-relaxed text-[var(--ck-text-secondary)]">{tool.desc}</span>
                    </span>
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--ck-text-muted)] transition-all group-hover:translate-x-1 group-hover:text-violet-600" />
                </Link>
              );
            })}
          </div>
        </div>
      </RevealSection>

      {/* =========== HOW IT WORKS =========== */}
      <RevealSection>
        <section id="how-it-works-section" className="ck-card overflow-hidden">
          <div className="grid grid-cols-1 gap-8 p-6 lg:grid-cols-12 lg:p-8">
            
            {/* Left: Description */}
            <div className="lg:col-span-4">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-violet-600">
                <Zap className="h-3.5 w-3.5" />
                Simple flow
              </div>
              <h2 className="mt-2 text-2xl font-black text-[var(--ck-text-primary)]">Choose, process, download</h2>
              <p className="mt-3 text-[13px] font-medium leading-relaxed text-[var(--ck-text-secondary)]">
                Upload immediately, pick the right operation, and leave with the finished file. No account needed.
              </p>
            </div>

            {/* Center: Steps */}
            <div className="lg:col-span-5">
              <div className="grid gap-3">
                {[
                  { step: '1', title: 'Pick the tool', desc: 'Search by file type or choose from PDF, image, and converter groups.', accent: 'bg-violet-600' },
                  { step: '2', title: 'Add your file', desc: 'Drag and drop from your device. Supported tools suggest themselves.', accent: 'bg-indigo-600' },
                  { step: '3', title: 'Export cleanly', desc: 'Download optimized files without creating an account.', accent: 'bg-emerald-600' }
                ].map(({ step, title, desc, accent }) => (
                  <div key={step} className="flex gap-4 rounded-xl p-4" style={{ background: 'var(--ck-bg-muted)' }}>
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${accent} text-sm font-black text-white shadow-sm`}>{step}</div>
                    <div>
                      <h3 className="text-sm font-black text-[var(--ck-text-primary)]">{title}</h3>
                      <p className="mt-0.5 text-xs font-medium leading-5 text-[var(--ck-text-secondary)]">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Live Demo Card */}
            <div className="lg:col-span-3">
              <div className="rounded-[var(--ck-radius-lg)] p-4 text-left" style={{ background: 'var(--ck-bg-muted)', border: '1px solid var(--ck-border)' }}>
                <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--ck-border)' }}>
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-red-500" />
                    <div>
                      <div className="text-xs font-black text-[var(--ck-text-primary)]">application.pdf</div>
                      <div className="text-[11px] font-medium text-[var(--ck-text-muted)]">2.7 MB</div>
                    </div>
                  </div>
                  <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950/30 px-2 py-1 text-[11px] font-black text-emerald-700 dark:text-emerald-400">82% smaller</div>
                </div>
                <div className="my-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[var(--ck-text-secondary)]">
                    <span>{getSimProgressText()}</span>
                    <span>{simProgress}%</span>
                  </div>
                  <div className="ck-progress-bar">
                    <div style={{ width: `${simProgress}%` }} />
                  </div>
                </div>
                <button
                  onClick={() => handleDummyClick('Download preview')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white transition-all hover:bg-violet-700 active:scale-[0.98]"
                >
                  <FileDown className="h-4 w-4" />
                  Download file
                </button>
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* =========== ALL TOOLS =========== */}
      <RevealSection>
        <section id="all-tools-section" className="space-y-10 pt-4">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-violet-600">
              <Sparkles className="h-3.5 w-3.5" />
              Complete toolkit
            </div>
            <h2 className="mt-2 text-2xl font-black text-[var(--ck-text-primary)] sm:text-3xl">One place for PDFs, images, and conversions</h2>
            <p className="mt-3 text-[14px] font-medium leading-relaxed text-[var(--ck-text-secondary)]">
              Find what you need in seconds. Every tool works directly in your browser.
            </p>
          </div>

          <div className="space-y-12">
            {categories.map((cat) => {
              const CatIcon = cat.icon;
              return (
                <RevealSection key={cat.title} stagger>
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 text-left">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                        cat.accentColor === 'violet' ? 'bg-violet-50 dark:bg-violet-950/30' :
                        cat.accentColor === 'coral' ? 'bg-rose-50 dark:bg-rose-950/30' :
                        'bg-teal-50 dark:bg-teal-950/30'
                      }`}>
                        <CatIcon className={`h-4.5 w-4.5 ${
                          cat.accentColor === 'violet' ? 'text-violet-600' :
                          cat.accentColor === 'coral' ? 'text-rose-600' :
                          'text-teal-600'
                        }`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-[var(--ck-text-primary)]">{cat.title}</h3>
                        <p className="text-[13px] font-medium text-[var(--ck-text-secondary)]">{cat.desc}</p>
                      </div>
                      <span className="ml-auto rounded-full bg-[var(--ck-bg-muted)] px-2.5 py-1 text-[10px] font-bold text-[var(--ck-text-muted)]">{cat.tools.length} tools</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {cat.tools.map((tool) => {
                        const Icon = tool.icon;
                        return (
                          <Link
                            key={tool.path}
                            to={tool.path}
                            className={`group ${getCategoryBorderClass(cat.accentColor)} flex min-h-[120px] flex-col justify-between p-4 text-left glow-effect ${
                              cat.accentColor === 'coral' ? 'glow-coral' :
                              cat.accentColor === 'teal' ? 'glow-teal' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tool.bgColor}`}>
                                <Icon className={`h-5 w-5 ${tool.color}`} />
                              </div>
                              <div className="flex items-center gap-2">
                                {tool.badge && (
                                  <span className="rounded-full bg-violet-100 dark:bg-violet-900/40 px-2 py-0.5 text-[8px] font-bold text-violet-700 dark:text-violet-300 uppercase">{tool.badge}</span>
                                )}
                                <ArrowRight className="h-4 w-4 text-[var(--ck-text-muted)] transition-all group-hover:translate-x-1 group-hover:text-violet-600" />
                              </div>
                            </div>
                            <div className="mt-3">
                              <h4 className="text-sm font-black text-[var(--ck-text-primary)] group-hover:text-violet-600 transition-colors">{tool.name}</h4>
                              <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-[var(--ck-text-secondary)]">{tool.desc}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </RevealSection>
              );
            })}
          </div>
        </section>
      </RevealSection>

      {/* =========== STATS STRIP =========== */}
      <RevealSection>
        <section className="rounded-[var(--ck-radius-xl)] overflow-hidden" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 50%, #6D28D9 100%)' }}>
          <div className="grid grid-cols-1 gap-6 p-8 md:grid-cols-3 md:p-10">
            {[
              { label: 'Privacy score', value: stats.privacyScore, sub: 'Local-first processing for everyday work', icon: ShieldCheck },
              { label: 'Files optimized', value: stats.filesProcessed.toString(), sub: 'Your local activity on this device', icon: Upload },
              { label: 'Space saved', value: `${stats.mbSaved.toFixed(2)} MB`, sub: 'Storage returned from completed tasks', icon: FileDown }
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="text-center md:text-left">
                  <div className="flex items-center justify-center gap-3 md:justify-start">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">{stat.label}</div>
                      <div className="text-2xl font-black text-white">{stat.value}</div>
                    </div>
                  </div>
                  <p className="mt-2 text-[13px] font-medium text-white/60">{stat.sub}</p>
                </div>
              );
            })}
          </div>
        </section>
      </RevealSection>

      {/* =========== HISTORY =========== */}
      {history.length > 0 && (
        <RevealSection>
          <section className="ck-card space-y-4 p-5 text-left">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-black text-[var(--ck-text-primary)]">
                <History className="h-5 w-5 text-violet-600" />
                Recent activity
                <span className="text-xs font-bold text-[var(--ck-text-muted)]">({history.length})</span>
              </h2>
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ck-text-muted)]" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  placeholder="Search activity..."
                  className="w-full rounded-xl py-2.5 pl-9 pr-9 text-sm font-medium text-[var(--ck-text-primary)] outline-none transition-all focus:ring-4 focus:ring-violet-100 dark:focus:ring-violet-950/30"
                  style={{ background: 'var(--ck-bg-muted)', border: '1px solid var(--ck-border)' }}
                />
                {historySearch && (
                  <button
                    onClick={() => setHistorySearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[var(--ck-text-muted)] hover:text-[var(--ck-text-primary)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="flex gap-1 overflow-x-auto">
                {TOOL_FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setHistoryFilter(opt)}
                    className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                      historyFilter === opt
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-[var(--ck-text-secondary)] hover:bg-[var(--ck-bg-muted)]'
                    }`}
                    style={historyFilter !== opt ? { border: '1px solid var(--ck-border)' } : {}}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="py-8 text-center text-sm font-medium text-[var(--ck-text-muted)]">No matching activity found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[var(--ck-text-secondary)]">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-[var(--ck-text-muted)]" style={{ borderBottom: '1px solid var(--ck-border)' }}>
                      <th className="py-3 pr-4">File</th>
                      <th className="py-3 pr-4">Tool</th>
                      <th className="py-3 pr-4">Result</th>
                      <th className="py-3 pr-4">Time</th>
                      <th className="py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedHistory.map(item => (
                      <tr key={item.id} className="group transition-colors hover:bg-[var(--ck-bg-muted)]" style={{ borderBottom: '1px solid var(--ck-border)' }}>
                        <td className="max-w-[180px] truncate py-3 pr-4 font-black text-[var(--ck-text-primary)]">{item.name}</td>
                        <td className="py-3 pr-4">
                          <span className="whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-bold text-[var(--ck-text-secondary)]" style={{ background: 'var(--ck-bg-muted)' }}>{item.tool}</span>
                        </td>
                        <td className="py-3 pr-4 font-mono text-sm font-bold text-emerald-600">{item.details}</td>
                        <td className="flex items-center gap-1 whitespace-nowrap py-3 pr-4 text-sm font-medium text-[var(--ck-text-muted)]">
                          <Clock className="h-3 w-3" />
                          {item.date}
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => deleteEntry(item.id)}
                            className="rounded-lg p-1.5 text-[var(--ck-text-muted)] opacity-0 transition-all hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-500 group-hover:opacity-100"
                            title="Delete activity"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredHistory.length > 6 && (
                  <button
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    className="mt-3 w-full rounded-xl py-2.5 text-sm font-bold text-violet-600 transition-colors hover:bg-violet-50 dark:hover:bg-violet-950/20"
                  >
                    {showAllHistory ? 'Show less' : `Show all ${filteredHistory.length} entries`}
                  </button>
                )}
              </div>
            )}
          </section>
        </RevealSection>
      )}

      {/* =========== FAQ SECTION =========== */}
      <RevealSection>
        <section className="space-y-8 pt-4 text-left">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-violet-600">
              <HelpCircle className="h-3.5 w-3.5" />
              FAQ
            </div>
            <h2 className="mt-2 text-2xl font-black text-[var(--ck-text-primary)]">
              Frequently asked questions
            </h2>
            <p className="mt-2 text-[14px] font-medium leading-relaxed text-[var(--ck-text-secondary)]">
              Quick answers for people who need a clean file without fuss.
            </p>
          </div>

          <div className="mx-auto max-w-3xl space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div key={faq.question} className="ck-card overflow-hidden" style={{ transform: 'none' }}>
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between p-5 text-left text-sm font-black text-[var(--ck-text-primary)] transition-colors hover:text-violet-600"
                  >
                    <span className="pr-4">{faq.question}</span>
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all ${isOpen ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600' : 'bg-[var(--ck-bg-muted)] text-[var(--ck-text-muted)]'}`}>
                      {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </div>
                  </button>

                  <div className={`accordion-content ${isOpen ? 'open' : ''}`}>
                    <p className="text-[13px] font-medium leading-7 text-[var(--ck-text-secondary)]">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </RevealSection>

      {/* =========== BOTTOM TRUST STRIP =========== */}
      <RevealSection stagger>
        <section className="grid grid-cols-1 gap-5 pt-4 md:grid-cols-3">
          {[
            { title: 'Browser-first privacy', desc: 'Most tools run locally, so personal files stay on your device.', icon: ShieldCheck, accent: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
            { title: 'Unlimited daily use', desc: 'No sign up, no watermark, and no forced account before export.', icon: Zap, accent: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
            { title: 'Government portal friendly', desc: 'Resize photos, signatures, and documents to exact KB requirements.', icon: Check, accent: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30' }
          ].map(({ title, desc, icon: Icon, accent, bg }) => (
            <div key={title} className="flex items-start gap-4 text-left p-5 rounded-[var(--ck-radius-lg)]" style={{ background: 'var(--ck-bg-card)', border: '1px solid var(--ck-border)' }}>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className={`h-5 w-5 ${accent}`} />
              </div>
              <div>
                <h3 className="text-sm font-black text-[var(--ck-text-primary)]">{title}</h3>
                <p className="mt-1 text-xs font-medium leading-5 text-[var(--ck-text-secondary)]">{desc}</p>
              </div>
            </div>
          ))}
        </section>
      </RevealSection>
    </div>
  );
}
