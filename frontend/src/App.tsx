// ============================================================
// CompressKro — App Routing & Core Layout (React Router 6)
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
  Menu,
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
  Upload
} from 'lucide-react';
import { StorageService } from './services/storage.service';
import { ToastContainer } from './components/ui/Toast';
import { useToast } from './hooks/useToast';
import { LogoIcon } from './components/ui/LogoIcon';

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
      <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  );
}



function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [darkMode, setDarkMode] = useState<boolean>(() => StorageService.getTheme() === 'dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [activeDropdown, setActiveDropdown] = useState<'pdf' | 'image' | 'converters' | 'utilities' | null>(null);
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-300 flex flex-col">
        
        {/* Ambient background decoration */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-15%] left-[-10%] w-[60%] h-[60%] bg-violet-400/8 dark:bg-violet-700/6 rounded-full blur-[120px] animate-pulse-soft" />
          <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-400/8 dark:bg-fuchsia-700/6 rounded-full blur-[120px] animate-pulse-soft" style={{ animationDelay: '2s' }} />
        </div>

        {/* Global sticky header */}
        <header className="sticky top-0 z-50 w-full bg-white/70 dark:bg-slate-950/75 border-b border-slate-200/50 dark:border-slate-800/40 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            
            <Link to="/" className="flex items-center gap-3 select-none flex-shrink-0">
              <LogoIcon className="w-11 h-11" />
              <div className="hidden sm:block text-left">
                <div className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-50 leading-none">CompressKro</div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold tracking-wide">File Compress Kro, Edit Kro, Set Kro, Bas CompressKro!</span>
              </div>
            </Link>
            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
              
              {/* Dashboard */}
              <Link 
                to="/" 
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                  location.pathname === '/' 
                    ? 'text-violet-600 dark:text-violet-450 bg-violet-50/50 dark:bg-violet-950/20' 
                    : 'text-slate-650 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                }`}
              >
                Dashboard
              </Link>

              {/* PDF Tools Dropdown Trigger */}
              <div 
                className="relative"
                onMouseEnter={() => setActiveDropdown('pdf')}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button 
                  className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeDropdown === 'pdf' || location.pathname.includes('pdf') || pdfGroups.some(g => g.items.some(i => i.path === location.pathname))
                      ? 'text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-950/20' 
                      : 'text-slate-650 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                  }`}
                >
                  PDF Tools
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'pdf' ? 'rotate-180' : ''}`} />
                </button>

                {/* PDF Dropdown Panel */}
                {activeDropdown === 'pdf' && (
                  <div className="absolute left-1/2 -translate-x-[25%] top-[100%] pt-2 w-[820px] z-50">
                    <div className="nav-dropdown-panel rounded-2xl p-6 grid grid-cols-4 gap-6 animate-fade-in">
                      {pdfGroups.map((group) => (
                        <div key={group.title} className="space-y-3">
                          <h4 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-1.5">{group.title}</h4>
                          <div className="space-y-1">
                            {group.items.map((item) => {
                              const Icon = item.icon;
                              const isItemActive = location.pathname === item.path;
                              return (
                                <Link
                                  key={item.path}
                                  to={item.path}
                                  className={`flex items-start gap-2.5 p-2 rounded-xl transition-all ${
                                    isItemActive
                                      ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-450'
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-900/50 text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400'
                                  }`}
                                >
                                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isItemActive ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400'}`} />
                                  <div>
                                    <div className="text-sm font-semibold">{item.label}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">{item.desc}</div>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Image Tools Dropdown Trigger */}
              <div 
                className="relative"
                onMouseEnter={() => setActiveDropdown('image')}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button 
                  className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeDropdown === 'image' || location.pathname.includes('image') || imageGroups.some(g => g.items.some(i => i.path === location.pathname))
                      ? 'text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-950/20' 
                      : 'text-slate-650 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                  }`}
                >
                  Image Tools
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'image' ? 'rotate-180' : ''}`} />
                </button>

                {/* Image Dropdown Panel */}
                {activeDropdown === 'image' && (
                  <div className="absolute left-1/2 -translate-x-[40%] top-[100%] pt-2 w-[650px] z-50">
                    <div className="nav-dropdown-panel rounded-2xl p-6 grid grid-cols-3 gap-6 animate-fade-in">
                      {imageGroups.map((group) => (
                        <div key={group.title} className="space-y-3">
                          <h4 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-1.5">{group.title}</h4>
                          <div className="space-y-1">
                            {group.items.map((item) => {
                              const Icon = item.icon;
                              const isItemActive = location.pathname === item.path;
                              return (
                                <Link
                                  key={item.path}
                                  to={item.path}
                                  className={`flex items-start gap-2.5 p-2 rounded-xl transition-all ${
                                    isItemActive
                                      ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-450'
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-900/50 text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400'
                                  }`}
                                >
                                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isItemActive ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400'}`} />
                                  <div>
                                    <div className="text-sm font-semibold">{item.label}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">{item.desc}</div>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Converters Dropdown (Quick Shortcuts) */}
              <div 
                className="relative"
                onMouseEnter={() => setActiveDropdown('converters')}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button 
                  className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeDropdown === 'converters'
                      ? 'text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-950/20' 
                      : 'text-slate-650 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                  }`}
                >
                  Converters
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {activeDropdown === 'converters' && (
                  <div className="absolute left-0 top-[100%] pt-2 w-[220px] z-50">
                    <div className="nav-dropdown-panel rounded-xl p-2 flex flex-col gap-0.5 animate-fade-in">
                      <Link to="/convert-image" className="flex items-center gap-2 p-2 text-sm font-semibold rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-violet-600">
                        <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                        Image Converter
                      </Link>
                      <Link to="/pdf-to-jpg" className="flex items-center gap-2 p-2 text-sm font-semibold rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-violet-600">
                        <ImageIcon className="w-4 h-4 text-slate-400" />
                        PDF to JPG
                      </Link>
                      <Link to="/images-to-pdf" className="flex items-center gap-2 p-2 text-sm font-semibold rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-violet-600">
                        <Upload className="w-4 h-4 text-slate-400" />
                        Images to PDF
                      </Link>
                      <Link to="/html-to-pdf" className="flex items-center gap-2 p-2 text-sm font-semibold rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-violet-600">
                        <Globe className="w-4 h-4 text-slate-400" />
                        HTML to PDF
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Utilities Dropdown */}
              <div 
                className="relative"
                onMouseEnter={() => setActiveDropdown('utilities')}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button 
                  className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeDropdown === 'utilities'
                      ? 'text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-950/20' 
                      : 'text-slate-650 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                  }`}
                >
                  Utilities
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {activeDropdown === 'utilities' && (
                  <div className="absolute left-0 top-[100%] pt-2 w-[220px] z-50">
                    <div className="nav-dropdown-panel rounded-xl p-2 flex flex-col gap-0.5 animate-fade-in">
                      <Link to="/passport-maker" className="flex items-center gap-2 p-2 text-sm font-semibold rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-violet-600">
                        <UserCheck className="w-4 h-4 text-slate-400" />
                        Passport Photo Maker
                      </Link>
                      <Link to="/govt-assistant" className="flex items-center gap-2 p-2 text-sm font-semibold rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-violet-600">
                        <Sparkles className="w-4 h-4 text-slate-400" />
                        Govt Portal Presets
                      </Link>
                      <Link to="/remove-background" className="flex items-center gap-2 p-2 text-sm font-semibold rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-violet-600">
                        <Eraser className="w-4 h-4 text-slate-400" />
                        Remove BG (AI)
                      </Link>
                      <Link to="/ocr-pdf" className="flex items-center gap-2 p-2 text-sm font-semibold rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-violet-600">
                        <ScanText className="w-4 h-4 text-slate-400" />
                        OCR PDF text
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </nav>

            {/* Action buttons (Right) */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              
              {/* Dark Mode toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
                title="Toggle dark mode"
              >
                {darkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
              </button>

              {/* Mobile hamburger menu */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>

            </div>

          </div>
        </header>

        {/* Mobile Menu Drawer Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs transition-opacity duration-300"
              onClick={() => setMobileMenuOpen(false)}
            />
            
            {/* Side sheet */}
            <div className="relative ml-auto w-full max-w-xs h-full bg-white dark:bg-slate-950 p-6 flex flex-col shadow-2xl z-10 border-l border-slate-100 dark:border-slate-900/60 overflow-y-auto">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-4">
                <Link to="/" className="flex items-center gap-2.5" onClick={() => setMobileMenuOpen(false)}>
                  <LogoIcon className="w-10 h-10" />
                  <span className="text-base font-black text-slate-900 dark:text-slate-100">CompressKro</span>
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Nav links */}
              <div className="mt-6 flex-1 space-y-6">
                
                {/* General */}
                <div className="space-y-1">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2">Navigation</div>
                  <Link 
                    to="/" 
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <LayoutDashboard className="w-4 h-4 text-slate-400" />
                    Dashboard
                  </Link>
                </div>

                {/* PDF Tools */}
                <div className="space-y-1">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2">PDF Utilities</div>
                  <div className="grid grid-cols-1 gap-0.5 pl-2 max-h-48 overflow-y-auto scrollbar-thin">
                    {pdfGroups.flatMap(g => g.items).map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-900"
                        >
                          <Icon className="w-3.5 h-3.5 text-slate-450 flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Image Tools */}
                <div className="space-y-1">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2">Image Utilities</div>
                  <div className="grid grid-cols-1 gap-0.5 pl-2 max-h-48 overflow-y-auto scrollbar-thin">
                    {imageGroups.flatMap(g => g.items).map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-900"
                        >
                          <Icon className="w-3.5 h-3.5 text-slate-450 flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>


              </div>

              {/* Footer */}
              <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-900 flex flex-col items-center gap-2">
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-[10px] font-bold">100% In-Browser Privacy</span>
                </div>
                <div className="text-[9px] text-slate-400">v1.0 · Open Source</div>
              </div>

            </div>
          </div>
        )}

        {/* Scrollable Page Content */}
        <main className="flex-1 w-full relative z-10 flex flex-col">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 w-full flex-1">
            {children}
          </div>
        </main>

        {/* Minimalized Modern Footer */}
        <footer className="relative z-10 border-t border-slate-200/50 dark:border-slate-900/60 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md py-6 select-none flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <LogoIcon className="w-5 h-5" />
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">CompressKro</span>
              <span className="text-[10px] text-slate-450 dark:text-slate-400 font-bold">· File Compress Kro, Edit Kro, Set Kro, Bas CompressKro!</span>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold">
              <button onClick={() => handleDummyClick('Terms')} className="hover:text-violet-500 transition-colors">Terms</button>
              <button onClick={() => handleDummyClick('Privacy')} className="hover:text-violet-500 transition-colors">Privacy Policy</button>
              <button onClick={() => handleDummyClick('Contact')} className="hover:text-violet-500 transition-colors">Contact</button>
              <span className="text-[9px] font-normal font-sans">© 2026 CompressKro. All Rights Reserved.</span>
            </div>
          </div>
        </footer>

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

            {/* PDF Pages */}
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
            <Route path="/compress-pdf" element={<CompressPdf />} />
            <Route path="/sign-pdf" element={<AddSignature />} />
            <Route path="/edit-pdf" element={<PdfEditor />} />
            <Route path="/html-to-pdf" element={<HtmlToPdf />} />
            <Route path="/extract-images" element={<ExtractImages />} />
            <Route path="/crop-pdf" element={<CropPdf />} />

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
