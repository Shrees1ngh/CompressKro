// ============================================================
// CompressKro — App Routing & Core Layout (React Router 6)
// 2026 Premium UI Shell with warm light design
// ============================================================

import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  Image as ImageIcon,
  FileText,
  Maximize2,
  FileSpreadsheet,
  UserCheck, 
  Sparkles, 
  ShieldCheck, 
  Moon, 
  Sun, 
  X,
  LayoutDashboard,
  ListOrdered,
  RotateCw,
  PenTool,
  Lock,
  Unlock,
  Droplets,
  Eraser,
  Hash,
  ScanText,
  Wrench,
  Edit3,
  Crop,
  Globe,
  ChevronDown,
  Upload,
  Heart,
  Zap,
  Search
} from 'lucide-react';
import { StorageService } from './services/storage.service';
import { ToastContainer } from './components/ui/Toast';
import { useToast } from './hooks/useToast';
import { LogoIcon } from './components/ui/LogoIcon';
import { PdfWorkspaceShell } from './components/PdfWorkspaceShell/PdfWorkspaceShell';
import { ALL_PDF_TOOL_PATHS } from './constants/pdfToolsMeta';

// Page Component Imports — lazy loaded for code-splitting
const Home = React.lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const NotFound = React.lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));
const MergePdf = React.lazy(() => import('./pages/pdf/MergePdf').then(m => ({ default: m.MergePdf })));
const SplitPdf = React.lazy(() => import('./pages/pdf/SplitPdf').then(m => ({ default: m.SplitPdf })));
const RotatePdf = React.lazy(() => import('./pages/pdf/RotatePdf').then(m => ({ default: m.RotatePdf })));
const ImagesToPdf = React.lazy(() => import('./pages/pdf/ImagesToPdf').then(m => ({ default: m.ImagesToPdf })));
const LockPdf = React.lazy(() => import('./pages/pdf/LockPdf').then(m => ({ default: m.LockPdf })));
const UnlockPdf = React.lazy(() => import('./pages/pdf/UnlockPdf').then(m => ({ default: m.UnlockPdf })));
const AddWatermark = React.lazy(() => import('./pages/pdf/AddWatermark').then(m => ({ default: m.AddWatermark })));
const RemoveWatermark = React.lazy(() => import('./pages/pdf/RemoveWatermark').then(m => ({ default: m.RemoveWatermark })));
const PageNumbers = React.lazy(() => import('./pages/pdf/PageNumbers').then(m => ({ default: m.PageNumbers })));
const PdfToJpg = React.lazy(() => import('./pages/pdf/PdfToJpg').then(m => ({ default: m.PdfToJpg })));
const OcrPdf = React.lazy(() => import('./pages/pdf/OcrPdf').then(m => ({ default: m.OcrPdf })));
const RepairPdf = React.lazy(() => import('./pages/pdf/RepairPdf').then(m => ({ default: m.RepairPdf })));
const CompressPdf = React.lazy(() => import('./pages/pdf/CompressPdf').then(m => ({ default: m.CompressPdf })));
const AddSignature = React.lazy(() => import('./pages/pdf/AddSignature').then(m => ({ default: m.AddSignature })));
const PdfEditor = React.lazy(() => import('./pages/pdf/PdfEditor').then(m => ({ default: m.PdfEditor })));
const HtmlToPdf = React.lazy(() => import('./pages/pdf/HtmlToPdf').then(m => ({ default: m.HtmlToPdf })));
const ExtractImages = React.lazy(() => import('./pages/pdf/ExtractImages').then(m => ({ default: m.ExtractImages })));
const CropPdf = React.lazy(() => import('./pages/pdf/CropPdf').then(m => ({ default: m.CropPdf })));

const CompressImage = React.lazy(() => import('./pages/image/CompressImage').then(m => ({ default: m.CompressImage })));
const ResizeImage = React.lazy(() => import('./pages/image/ResizeImage').then(m => ({ default: m.ResizeImage })));
const ConvertImage = React.lazy(() => import('./pages/image/ConvertImage').then(m => ({ default: m.ConvertImage })));
const PassportMakerPage = React.lazy(() => import('./pages/image/PassportMaker').then(m => ({ default: m.PassportMakerPage })));
const GovtAssistantPage = React.lazy(() => import('./pages/image/GovtAssistant').then(m => ({ default: m.GovtAssistantPage })));
const HtmlToImage = React.lazy(() => import('./pages/image/HtmlToImage').then(m => ({ default: m.HtmlToImage })));
const EditImage = React.lazy(() => import('./pages/image/EditImage').then(m => ({ default: m.EditImage })));
const RemoveBackground = React.lazy(() => import('./pages/image/RemoveBg').then(m => ({ default: m.RemoveBg })));

// Minimal page-transition fallback shown while a lazy chunk loads
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64 w-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 rounded-full border-[2.5px] border-violet-500 border-t-transparent animate-spin" />
        <span className="text-xs font-semibold text-[var(--ck-text-muted)]">Loading...</span>
      </div>
    </div>
  );
}



function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [darkMode, setDarkMode] = useState<boolean>(() => StorageService.getTheme() === 'dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [activeDropdown, setActiveDropdown] = useState<'pdf' | 'image' | 'converters' | 'utilities' | null>(null);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [mobileActiveTab, setMobileActiveTab] = useState<'pdf' | 'image'>('pdf');
  const { showInfo } = useToast();

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    StorageService.setTheme(next ? 'dark' : 'light');
  };

  // Sync scroll to top on path change
  useEffect(() => {
    window.scrollTo(0, 0);
    setMobileMenuOpen(false);
    setActiveDropdown(null);
    setMobileSearchQuery('');
  }, [location.pathname]);

  const pdfGroups = [
    {
      title: 'Organize PDF',
      items: [
        { path: '/merge-pdf', label: 'Merge PDF', icon: ListOrdered, desc: 'Combine multiple PDFs into one.' },
        { path: '/split-pdf', label: 'Split PDF', icon: FileText, desc: 'Extract pages or split ranges.' },
        { path: '/rotate-pdf', label: 'Rotate & Order', icon: RotateCw, desc: 'Rearrange and rotate pages.' },
        { path: '/crop-pdf', label: 'Crop PDF', icon: Crop, desc: 'Crop page margins easily.' }
      ]
    },
    {
      title: 'Convert PDF',
      items: [
        { path: '/pdf-to-jpg', label: 'PDF to JPG', icon: ImageIcon, desc: 'Save PDF pages as JPEG.' },
        { path: '/images-to-pdf', label: 'Images to PDF', icon: Upload, desc: 'Convert JPG/PNG to PDF.' },
        { path: '/extract-images', label: 'Extract Images', icon: ImageIcon, desc: 'Extract inline photos.' }
      ]
    },
    {
      title: 'Edit PDF',
      items: [
        { path: '/edit-pdf', label: 'Edit PDF', icon: Edit3, desc: 'Modify text, shapes, whiteout.' },
        { path: '/sign-pdf', label: 'Sign PDF', icon: PenTool, desc: 'Sign PDFs locally.' },
        { path: '/add-watermark', label: 'Add Watermark', icon: Droplets, desc: 'Add watermark stamps.' },
        { path: '/remove-watermark', label: 'Remove Watermark', icon: Eraser, desc: 'Clean up watermarks.' },
        { path: '/page-numbers', label: 'Page Numbers', icon: Hash, desc: 'Insert page numbering.' }
      ]
    },
    {
      title: 'Security & Tools',
      items: [
        { path: '/ocr-pdf', label: 'OCR PDF', icon: ScanText, desc: 'Make scanned pages searchable.' },
        { path: '/lock-pdf', label: 'Lock PDF', icon: Lock, desc: 'Encrypt with passwords.' },
        { path: '/unlock-pdf', label: 'Unlock PDF', icon: Unlock, desc: 'Remove restrictions.' },
        { path: '/repair-pdf', label: 'Repair PDF', icon: Wrench, desc: 'Fix damaged PDF structures.' },
        { path: '/html-to-pdf', label: 'HTML to PDF', icon: Globe, desc: 'Convert link/markup to PDF.' }
      ]
    }
  ];

  const imageGroups = [
    {
      title: 'Compress & Resize',
      items: [
        { path: '/compress-image', label: 'Image Compressor', icon: ImageIcon, desc: 'Smart target-KB compression.' },
        { path: '/resize-image', label: 'Image Resizer', icon: Maximize2, desc: 'Adjust layout and dimensions.' },
        { path: '/remove-background', label: 'Remove Background', icon: Eraser, desc: 'Remove background instantly.' }
      ]
    },
    {
      title: 'Format & Edit',
      items: [
        { path: '/convert-image', label: 'Format Converter', icon: FileSpreadsheet, desc: 'JPG, PNG, WebP, HEIC conversion.' },
        { path: '/edit-image', label: 'Image Editor', icon: Edit3, desc: 'Apply filters, crops, annotations.' }
      ]
    },
    {
      title: 'Government Portal Helper',
      items: [
        { path: '/passport-maker', label: 'Passport Maker', icon: UserCheck, desc: 'Passport size photo layouts.' },
        { path: '/govt-assistant', label: 'Govt Assistant', icon: Sparkles, desc: 'Portal photo preset specs.' },
        { path: '/html-to-image', label: 'HTML to Image', icon: Globe, desc: 'Convert HTML markup to PNG/JPG.' }
      ]
    }
  ];

  const handleDummyClick = (title: string) => {
    showInfo(`${title}`, 'This capability is styled to showcase B2C SaaS experience and is currently under polish.');
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-[var(--ck-bg)] text-[var(--ck-text-primary)] transition-colors duration-300 flex flex-col">

        {/* =========== PREMIUM FLOATING NAVBAR (DESKTOP & MOBILE SPLIT) =========== */}
        <header className="sticky top-0 z-50 w-full px-4 sm:px-6 lg:px-8 pt-4 pointer-events-none">
          
          {/* Desktop Floating Capsule */}
          <div className="relative hidden lg:flex max-w-7xl mx-auto h-16 rounded-full bg-white/90 dark:bg-slate-900/80 border border-slate-950 dark:border-slate-750 backdrop-blur-xl shadow-md px-6 items-center justify-between pointer-events-auto transition-all duration-300">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 select-none flex-shrink-0 group">
              <LogoIcon className="w-8 h-8 flex-shrink-0 transition-transform duration-300 group-hover:scale-105" />
              <span className="text-lg font-black tracking-tight text-[var(--ck-text-primary)]">CompressKro</span>
            </Link>

            {/* Navigation (Only Dashboard, Image Tools, PDF Tools) */}
            <nav className="flex items-center gap-1 xl:gap-2">
              <Link 
                to="/" 
                className={`px-4 py-2 rounded-full text-xs font-bold tracking-wide uppercase transition-all duration-300 hover:scale-[1.04] active:scale-95 ${
                  location.pathname === '/' 
                    ? 'text-white bg-violet-600 shadow-sm hover:bg-violet-700' 
                    : 'text-[var(--ck-text-secondary)] hover:text-violet-600 dark:hover:text-violet-400 hover:bg-[var(--ck-bg-muted)]'
                }`}
              >
                Dashboard
              </Link>

              {/* Image Tools Dropdown */}
              <div 
                className="relative"
                onMouseEnter={() => setActiveDropdown('image')}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button 
                  className={`px-4 py-2 rounded-full text-xs font-bold tracking-wide uppercase flex items-center gap-1 transition-all duration-300 hover:scale-[1.04] active:scale-95 cursor-pointer ${
                    activeDropdown === 'image' || location.pathname.includes('image') || imageGroups.some(g => g.items.some(i => i.path === location.pathname))
                      ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30' 
                      : 'text-[var(--ck-text-secondary)] hover:text-violet-600 dark:hover:text-violet-400 hover:bg-[var(--ck-bg-muted)]'
                  }`}
                >
                  Image Tools
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${activeDropdown === 'image' ? 'rotate-180' : ''}`} />
                </button>
                
                {/* CSS Transition Dropdown Container - Perfectly centered under parent capsule with macOS animation */}
                <div className={`absolute left-1/2 -translate-x-1/2 top-full pt-3 w-[650px] z-50 transition-all duration-300 origin-top ${
                  activeDropdown === 'image' 
                    ? 'opacity-100 scale-100 translate-y-0 blur-0 pointer-events-auto' 
                    : 'opacity-0 scale-90 -translate-y-4 blur-sm pointer-events-none'
                }`}>
                  <div className="bg-white/95 dark:bg-slate-900/97 backdrop-blur-xl border border-slate-955 dark:border-slate-750 shadow-2xl rounded-2xl p-6 grid grid-cols-3 gap-6">
                    {imageGroups.map((group) => (
                      <div key={group.title} className="space-y-3">
                        <h4 className="text-[10px] font-bold text-[var(--ck-text-muted)] uppercase tracking-[0.12em] pb-1.5" style={{ borderBottom: '1px solid var(--ck-border)' }}>{group.title}</h4>
                        <div className="space-y-0.5">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            const isItemActive = location.pathname === item.path;
                            return (
                              <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-start gap-2.5 p-2.5 rounded-xl transition-all ${
                                  isItemActive
                                    ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400'
                                    : 'hover:bg-[var(--ck-bg-muted)] text-[var(--ck-text-secondary)] hover:text-violet-600 dark:hover:text-violet-400'
                                }`}
                              >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isItemActive ? 'bg-violet-100 dark:bg-violet-900/40' : 'bg-[var(--ck-bg-muted)]'}`}>
                                  <Icon className={`w-3.5 h-3.5 ${isItemActive ? 'text-violet-600 dark:text-violet-400' : 'text-[var(--ck-text-muted)]'}`} />
                                </div>
                                <div>
                                  <div className="text-[13px] font-semibold">{item.label}</div>
                                  <div className="text-[11px] text-[var(--ck-text-muted)] mt-0.5 leading-normal">{item.desc}</div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* PDF Tools Dropdown */}
              <div 
                className="relative"
                onMouseEnter={() => setActiveDropdown('pdf')}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button 
                  className={`px-4 py-2 rounded-full text-xs font-bold tracking-wide uppercase flex items-center gap-1 transition-all duration-300 hover:scale-[1.04] active:scale-95 cursor-pointer ${
                    activeDropdown === 'pdf' || location.pathname.includes('pdf') || pdfGroups.some(g => g.items.some(i => i.path === location.pathname))
                      ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30' 
                      : 'text-[var(--ck-text-secondary)] hover:text-violet-600 dark:hover:text-violet-400 hover:bg-[var(--ck-bg-muted)]'
                  }`}
                >
                  PDF Tools
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${activeDropdown === 'pdf' ? 'rotate-180' : ''}`} />
                </button>
                
                {/* CSS Transition Dropdown Container - Perfectly centered under parent capsule with macOS animation */}
                <div className={`absolute left-1/2 -translate-x-1/2 top-full pt-3 w-[800px] z-50 transition-all duration-300 origin-top ${
                  activeDropdown === 'pdf' 
                    ? 'opacity-100 scale-100 translate-y-0 blur-0 pointer-events-auto' 
                    : 'opacity-0 scale-90 -translate-y-4 blur-sm pointer-events-none'
                }`}>
                  <div className="bg-white/95 dark:bg-slate-900/97 backdrop-blur-xl border border-slate-955 dark:border-slate-750 shadow-2xl rounded-2xl p-6 grid grid-cols-4 gap-6">
                    {pdfGroups.map((group) => (
                      <div key={group.title} className="space-y-3">
                        <h4 className="text-[10px] font-bold text-[var(--ck-text-muted)] uppercase tracking-[0.12em] pb-1.5" style={{ borderBottom: '1px solid var(--ck-border)' }}>{group.title}</h4>
                        <div className="space-y-0.5">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            const isItemActive = location.pathname === item.path;
                            return (
                              <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-start gap-2.5 p-2.5 rounded-xl transition-all ${
                                  isItemActive
                                    ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400'
                                    : 'hover:bg-[var(--ck-bg-muted)] text-[var(--ck-text-secondary)] hover:text-violet-600 dark:hover:text-violet-400'
                                }`}
                              >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isItemActive ? 'bg-violet-100 dark:bg-violet-900/40' : 'bg-[var(--ck-bg-muted)]'}`}>
                                  <Icon className={`w-3.5 h-3.5 ${isItemActive ? 'text-violet-600 dark:text-violet-400' : 'text-[var(--ck-text-muted)]'}`} />
                                </div>
                                <div>
                                  <div className="text-[13px] font-semibold">{item.label}</div>
                                  <div className="text-[11px] text-[var(--ck-text-muted)] mt-0.5 leading-normal">{item.desc}</div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-3">
              {/* Dark Mode toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2.5 rounded-full text-[var(--ck-text-muted)] hover:text-[var(--ck-text-primary)] hover:bg-[var(--ck-bg-muted)] transition-all cursor-pointer"
                title="Toggle dark mode"
              >
                {darkMode ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
              </button>
            </div>
          </div>

          {/* Mobile Split Layout (Top-Left Pill, Top-Right Circle) */}
          <div className="flex lg:hidden items-center justify-between w-full">
            {/* Left Capsule Link */}
            <Link 
              to="/" 
              className="pointer-events-auto flex items-center gap-2.5 px-4.5 py-2.5 rounded-full bg-white dark:bg-slate-900 border border-slate-950 dark:border-slate-750 shadow-md transition-all active:scale-[0.98]"
            >
              <LogoIcon className="w-6 h-6 flex-shrink-0" />
              <span className="text-sm font-black tracking-tight text-[var(--ck-text-primary)]">CompressKro</span>
            </Link>

            {/* Right Circle Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="pointer-events-auto flex w-11 h-11 items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-950 dark:border-slate-750 shadow-md text-[var(--ck-text-primary)] active:scale-[0.98] transition-all cursor-pointer"
            >
              {/* Two horizontal lines representing menu */}
              <div className="flex flex-col gap-1.5 items-center justify-center">
                <div className="w-5 h-[2px] bg-current rounded-full" />
                <div className="w-5 h-[2px] bg-current rounded-full" />
              </div>
            </button>
          </div>

        </header>

        {/* =========== MOBILE MENU DRAWER =========== */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
              onClick={() => setMobileMenuOpen(false)}
            />
            
            {/* Side sheet - Redesigned to be modern, tabbed & searchable */}
            <div className="relative ml-auto w-full max-w-[325px] h-full bg-[var(--ck-bg-card)] p-5 flex flex-col shadow-2xl z-10 overflow-hidden" style={{ borderLeft: '1px solid var(--ck-border)' }}>
              
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4" style={{ borderBottom: '1px solid var(--ck-border)' }}>
                <Link to="/" className="flex items-center gap-2.5" onClick={() => setMobileMenuOpen(false)}>
                  <LogoIcon className="w-7 h-7 flex-shrink-0" />
                  <span className="text-base font-black text-[var(--ck-text-primary)]">CompressKro</span>
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-8 h-8 rounded-full bg-[var(--ck-bg-muted)] flex items-center justify-center text-[var(--ck-text-muted)] hover:text-[var(--ck-text-primary)] transition-all active:scale-95"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tool Search Bar */}
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ck-text-muted)]" />
                <input 
                  type="text"
                  placeholder="Search tools..."
                  value={mobileSearchQuery}
                  onChange={(e) => setMobileSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs font-semibold rounded-xl bg-[var(--ck-bg-muted)] border border-slate-200/60 dark:border-slate-800/85 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all text-[var(--ck-text-primary)]"
                />
                {mobileSearchQuery && (
                  <button 
                    onClick={() => setMobileSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--ck-text-muted)] hover:text-[var(--ck-text-primary)]"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Tab Selector (hidden when actively searching) */}
              {!mobileSearchQuery && (
                <div className="flex p-1 rounded-xl bg-[var(--ck-bg-muted)] border border-slate-100/50 dark:border-slate-900/50 mt-4 flex-shrink-0">
                  <button
                    onClick={() => setMobileActiveTab('pdf')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wide cursor-pointer ${
                      mobileActiveTab === 'pdf'
                        ? 'bg-[var(--ck-bg-card)] text-violet-600 dark:text-violet-400 shadow-sm'
                        : 'text-[var(--ck-text-secondary)] hover:text-violet-600 dark:hover:text-violet-400'
                    }`}
                  >
                    PDF Tools
                  </button>
                  <button
                    onClick={() => setMobileActiveTab('image')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wide cursor-pointer ${
                      mobileActiveTab === 'image'
                        ? 'bg-[var(--ck-bg-card)] text-violet-600 dark:text-violet-400 shadow-sm'
                        : 'text-[var(--ck-text-secondary)] hover:text-violet-600 dark:hover:text-violet-400'
                    }`}
                  >
                    Image Tools
                  </button>
                </div>
              )}

              {/* Tools Lists (Collapsible Grids) */}
              <div className="mt-4 flex-1 overflow-y-auto pr-1">
                
                {/* General Dashboard Link always visible at the top */}
                {!mobileSearchQuery && (
                  <Link 
                    to="/" 
                    className={`flex items-center gap-3 p-3 mb-3 rounded-2xl border transition-all text-left ${
                      location.pathname === '/' 
                        ? 'bg-violet-550/10 border-violet-500 text-violet-600 dark:text-violet-400' 
                        : 'bg-[var(--ck-bg-muted)] border-transparent text-[var(--ck-text-primary)] hover:border-[var(--ck-border-hover)]'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-600 text-white flex items-center justify-center flex-shrink-0">
                      <LayoutDashboard className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-[12px] font-black leading-tight">Dashboard</h5>
                      <p className="text-[9.5px] text-[var(--ck-text-muted)] mt-0.5">Go to central workbench</p>
                    </div>
                  </Link>
                )}

                {/* Filter and display tools */}
                {(() => {
                  const allMobileTools = [
                    ...pdfGroups.flatMap(g => g.items.map(i => ({ ...i, category: 'pdf' }))),
                    ...imageGroups.flatMap(g => g.items.map(i => ({ ...i, category: 'image' })))
                  ];

                  const filteredMobileTools = allMobileTools.filter(tool => {
                    const matchesSearch = tool.label.toLowerCase().includes(mobileSearchQuery.toLowerCase()) || 
                                          tool.desc.toLowerCase().includes(mobileSearchQuery.toLowerCase());
                    if (mobileSearchQuery) return matchesSearch;
                    return tool.category === mobileActiveTab;
                  });

                  if (filteredMobileTools.length === 0) {
                    return (
                      <div className="py-12 text-center text-xs text-[var(--ck-text-muted)] font-medium">
                        No matching tools found.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-2 gap-2">
                      {filteredMobileTools.map((tool) => {
                        const Icon = tool.icon;
                        const isToolActive = location.pathname === tool.path;
                        return (
                          <Link
                            key={tool.path}
                            to={tool.path}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex flex-col justify-between p-3 rounded-2xl border transition-all text-left min-h-[96px] ${
                              isToolActive
                                ? 'bg-violet-550/10 border-violet-500 text-violet-600 dark:text-violet-400'
                                : 'bg-[var(--ck-bg-muted)] border-transparent text-[var(--ck-text-primary)] hover:border-[var(--ck-border-hover)]'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isToolActive ? 'bg-violet-600 text-white' : 'bg-[var(--ck-bg-card)] text-[var(--ck-text-muted)]'
                            }`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="mt-2">
                              <h5 className="text-[11px] font-black leading-tight truncate">{tool.label}</h5>
                              <p className="text-[9px] text-[var(--ck-text-muted)] mt-0.5 line-clamp-1 leading-normal">{tool.desc}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })()}

              </div>

              {/* Bottom footer bar */}
              <div className="mt-auto pt-4 flex flex-col items-center gap-3 flex-shrink-0 border-t border-slate-100 dark:border-slate-800">
                
                {/* Dark Mode toggle quick switcher inside drawer */}
                <button
                  onClick={toggleDarkMode}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-[var(--ck-bg-muted)] border border-transparent hover:border-[var(--ck-border-hover)] transition-all cursor-pointer w-full justify-center text-[var(--ck-text-primary)]"
                >
                  {darkMode ? (
                    <>
                      <Sun className="w-4 h-4 text-amber-500" />
                      Switch to Light Mode
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4 text-violet-600" />
                      Switch to Dark Mode
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1.5 text-emerald-600">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">In-Browser Privacy</span>
                </div>
                <div className="text-[9px] text-[var(--ck-text-muted)] font-bold">
                  v1.0 · Open Source
                </div>
              </div>

            </div>
          </div>
        )}

        {/* =========== PAGE CONTENT =========== */}
        {(() => {
          const checkIsPdfWorkspace = (path: string) => {
            const workspacePaths = [
              '/compress-pdf', '/merge-pdf', '/split-pdf', '/rotate-pdf', '/crop-pdf',
              '/pdf-to-jpg', '/images-to-pdf', '/extract-images', '/html-to-pdf',
              '/edit-pdf', '/sign-pdf', '/add-watermark', '/remove-watermark',
              '/page-numbers', '/ocr-pdf', '/lock-pdf', '/unlock-pdf', '/repair-pdf'
            ];
            return workspacePaths.includes(path);
          };
          const isPdfWorkspace = checkIsPdfWorkspace(location.pathname);
          if (isPdfWorkspace) {
            // PDF workspace pages: full-bleed, no container/padding wrapper
            return (
              <main className="flex-1 w-full relative z-10 flex flex-col">
                {children}
              </main>
            );
          }
          return (
            <main className="flex-1 w-full relative z-10 flex flex-col">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 w-full flex-1">
                {children}
              </div>
            </main>
          );
        })()}

        {/* =========== PREMIUM FOOTER (hidden on PDF workspace pages) =========== */}
        {!(
          location.pathname === '/compress-pdf' ||
          location.pathname === '/merge-pdf' ||
          location.pathname === '/split-pdf' ||
          location.pathname === '/rotate-pdf' ||
          location.pathname === '/crop-pdf' ||
          location.pathname === '/pdf-to-jpg' ||
          location.pathname === '/images-to-pdf' ||
          location.pathname === '/extract-images' ||
          location.pathname === '/html-to-pdf' ||
          location.pathname === '/edit-pdf' ||
          location.pathname === '/sign-pdf' ||
          location.pathname === '/add-watermark' ||
          location.pathname === '/remove-watermark' ||
          location.pathname === '/page-numbers' ||
          location.pathname === '/ocr-pdf' ||
          location.pathname === '/lock-pdf' ||
          location.pathname === '/unlock-pdf' ||
          location.pathname === '/repair-pdf'
        ) && (
        <footer className="relative z-10 bg-[var(--ck-bg-card)] select-none flex-shrink-0" style={{ borderTop: '1px solid var(--ck-border)' }}>
          
          {/* Main Footer Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
              
              {/* Brand Column */}
              <div className="md:col-span-4 space-y-4">
                <div className="flex items-center gap-2.5">
                  <LogoIcon className="w-8 h-8" />
                  <span className="text-lg font-black text-[var(--ck-text-primary)]">CompressKro</span>
                </div>
                <p className="text-[13px] text-[var(--ck-text-secondary)] leading-relaxed font-medium max-w-xs">
                  Your everyday toolkit for PDFs & images. Compress, convert, edit, resize — all free, no sign-up, processed in your browser.
                </p>
                <div className="flex items-center gap-4 pt-1">
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-[11px] font-bold">Privacy-first</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-violet-600">
                    <Zap className="w-4 h-4" />
                    <span className="text-[11px] font-bold">100% Free</span>
                  </div>
                </div>
              </div>

              {/* PDF Tools Column */}
              <div className="md:col-span-3 space-y-3">
                <h3 className="text-[11px] font-bold text-[var(--ck-text-muted)] uppercase tracking-[0.12em]">PDF Tools</h3>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { path: '/compress-pdf', label: 'Compress PDF' },
                    { path: '/edit-pdf', label: 'Edit PDF' },
                    { path: '/merge-pdf', label: 'Merge PDF' },
                    { path: '/split-pdf', label: 'Split PDF' },
                    { path: '/ocr-pdf', label: 'OCR PDF' },
                    { path: '/sign-pdf', label: 'Sign PDF' }
                  ].map(item => (
                    <Link key={item.path} to={item.path} className="text-[12.5px] font-medium text-[var(--ck-text-secondary)] hover:text-violet-600 transition-colors py-0.5">{item.label}</Link>
                  ))}
                </div>
              </div>

              {/* Image Tools Column */}
              <div className="md:col-span-3 space-y-3">
                <h3 className="text-[11px] font-bold text-[var(--ck-text-muted)] uppercase tracking-[0.12em]">Image Tools</h3>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { path: '/compress-image', label: 'Compress Image' },
                    { path: '/resize-image', label: 'Resize Image' },
                    { path: '/convert-image', label: 'Convert Image' },
                    { path: '/remove-background', label: 'Remove Background' },
                    { path: '/passport-maker', label: 'Passport Maker' },
                    { path: '/edit-image', label: 'Image Editor' }
                  ].map(item => (
                    <Link key={item.path} to={item.path} className="text-[12.5px] font-medium text-[var(--ck-text-secondary)] hover:text-violet-600 transition-colors py-0.5">{item.label}</Link>
                  ))}
                </div>
              </div>

              {/* Company Column */}
              <div className="md:col-span-2 space-y-3">
                <h3 className="text-[11px] font-bold text-[var(--ck-text-muted)] uppercase tracking-[0.12em]">Company</h3>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { label: 'Terms', action: 'Terms' },
                    { label: 'Privacy Policy', action: 'Privacy' },
                    { label: 'Contact', action: 'Contact' }
                  ].map(item => (
                    <button key={item.label} onClick={() => handleDummyClick(item.action)} className="text-left text-[12.5px] font-medium text-[var(--ck-text-secondary)] hover:text-violet-600 transition-colors py-0.5">{item.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="py-4 px-4 sm:px-6 lg:px-8" style={{ borderTop: '1px solid var(--ck-border)' }}>
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-[var(--ck-text-muted)] font-medium">
                © 2026 CompressKro. All Rights Reserved.
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--ck-text-muted)] font-medium">
                Made with <Heart className="w-3 h-3 text-red-400 fill-red-400" /> in India
              </div>
            </div>
          </div>
        </footer>
        )}

      </div>
    </div>
  );
}

function App() {
  const { toasts, dismiss } = useToast();

  return (
    <BrowserRouter>
      <MainLayout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Main Dashboard Grid */}
            <Route path="/" element={<Home />} />

            {/* PDF Workspace — persistent shell with nested tool routes */}
            <Route element={<PdfWorkspaceShell />}>
              <Route path="/compress-pdf" element={<CompressPdf />} />
              <Route path="/merge-pdf" element={<MergePdf />} />
              <Route path="/split-pdf" element={<SplitPdf />} />
              <Route path="/rotate-pdf" element={<RotatePdf />} />
              <Route path="/images-to-pdf" element={<ImagesToPdf />} />
              <Route path="/lock-pdf" element={<LockPdf />} />
              <Route path="/unlock-pdf" element={<UnlockPdf />} />
              <Route path="/add-watermark" element={<AddWatermark />} />
              <Route path="/remove-watermark" element={<RemoveWatermark />} />
              <Route path="/page-numbers" element={<PageNumbers />} />
              <Route path="/pdf-to-jpg" element={<PdfToJpg />} />
              <Route path="/ocr-pdf" element={<OcrPdf />} />
              <Route path="/repair-pdf" element={<RepairPdf />} />
              <Route path="/sign-pdf" element={<AddSignature />} />
              <Route path="/edit-pdf" element={<PdfEditor />} />
              <Route path="/html-to-pdf" element={<HtmlToPdf />} />
              <Route path="/extract-images" element={<ExtractImages />} />
              <Route path="/crop-pdf" element={<CropPdf />} />
            </Route>

            {/* Image Pages */}
            <Route path="/compress-image" element={<CompressImage />} />
            <Route path="/resize-image" element={<ResizeImage />} />
            <Route path="/convert-image" element={<ConvertImage />} />
            <Route path="/passport-maker" element={<PassportMakerPage />} />
            <Route path="/govt-assistant" element={<GovtAssistantPage />} />
            <Route path="/html-to-image" element={<HtmlToImage />} />
            <Route path="/edit-image" element={<EditImage />} />
            <Route path="/remove-background" element={<RemoveBackground />} />

            {/* 404 Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <ToastContainer toasts={toasts} onDismiss={dismiss} />
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
