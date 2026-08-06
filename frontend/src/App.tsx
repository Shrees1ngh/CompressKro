// ============================================================
// CompressKro — App Routing & Core Layout (React Router 6)
// ============================================================

import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  Image as ImageIcon,
  FileText, 
  FileDown, 
  Maximize2, 
  FileSpreadsheet, 
  UserCheck, 
  Sparkles, 
  ShieldCheck, 
  Moon, 
  Sun, 
  Menu, 
  X, 
  Zap, 
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
  Globe
} from 'lucide-react';

import { StorageService } from './services/storage.service';
import { ToastContainer } from './components/ui/Toast';
import { useToast } from './hooks/useToast';

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
const RemoveBackground = React.lazy(() => import('./pages/RemoveBackground').then(m => ({ default: m.RemoveBackground })));

// Minimal page-transition fallback shown while a lazy chunk loads
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64 w-full">
      <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  );
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, description: 'All PDF & Image Tools' },
  { path: '/compress-pdf', label: 'PDF Compressor', icon: FileDown, description: 'Optimize PDF size' },
  { path: '/compress-image', label: 'Image Compressor', icon: ImageIcon, description: 'Target KB compression' }
];

const imageShortcuts = [
  { path: '/resize-image', label: 'Image Resizer', icon: Maximize2 },
  { path: '/convert-image', label: 'Format Converter', icon: FileSpreadsheet },
  { path: '/passport-maker', label: 'Passport Maker', icon: UserCheck },
  { path: '/govt-assistant', label: 'Govt Assistant', icon: Sparkles },
  { path: '/html-to-image', label: 'HTML to Image', icon: Globe },
  { path: '/edit-image', label: 'Image Editor', icon: Edit3 },
  { path: '/remove-background', label: 'AI Remove Background', icon: Sparkles }
];

const pdfShortcuts = [
  { path: '/merge-pdf', label: 'Merge PDF', icon: ListOrdered },
  { path: '/split-pdf', label: 'Split PDF', icon: FileText },
  { path: '/sign-pdf', label: 'Sign PDF', icon: PenTool },
  { path: '/edit-pdf', label: 'Edit PDF', icon: Edit3 },
  { path: '/crop-pdf', label: 'Crop PDF', icon: Crop },
  { path: '/rotate-pdf', label: 'Rotate & Order', icon: RotateCw },
  { path: '/ocr-pdf', label: 'OCR PDF', icon: ScanText },
  { path: '/add-watermark', label: 'Add Watermark', icon: Droplets },
  { path: '/remove-watermark', label: 'Remove Watermark', icon: Eraser },
  { path: '/page-numbers', label: 'Page Numbers', icon: Hash },
  { path: '/pdf-to-jpg', label: 'PDF to JPG', icon: ImageIcon },
  { path: '/extract-images', label: 'Extract Images', icon: ImageIcon },
  { path: '/lock-pdf', label: 'Lock PDF', icon: Lock },
  { path: '/unlock-pdf', label: 'Unlock PDF', icon: Unlock },
  { path: '/repair-pdf', label: 'Repair PDF', icon: Wrench },
  { path: '/html-to-pdf', label: 'HTML to PDF', icon: Globe },
];

function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [darkMode, setDarkMode] = useState<boolean>(() => StorageService.getTheme() === 'dark');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

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
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 text-slate-800 dark:text-slate-100 transition-colors duration-300">
        
        {/* Ambient Background Blobs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] bg-violet-400/10 dark:bg-violet-700/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] bg-fuchsia-400/10 dark:bg-fuchsia-700/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex h-screen overflow-hidden">
          {/* Mobile Overlay */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-20 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside className={`fixed top-0 left-0 h-full z-30 w-64 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col border-r border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl`}>
            {/* Brand Header */}
            <div className="px-6 py-5 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between flex-shrink-0">
              <Link to="/" className="flex items-center gap-3 cursor-pointer">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-md shadow-violet-500/20">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100 leading-none">CompressKro</div>
                  <span className="text-[10px] text-slate-400 font-medium">All-in-One Optimizer</span>
                </div>
              </Link>
              <button className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer" onClick={() => setSidebarOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Privacy Badge */}
            <div className="mx-4 mt-4 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-2 flex-shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">Privacy-First Architecture</span>
            </div>

            {/* Navigation Drawer */}
            <div className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left group cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/20'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-violet-500'}`} />
                      <div className="min-w-0">
                        <div className={`text-xs font-bold truncate ${isActive ? 'text-white' : ''}`}>{item.label}</div>
                        <div className={`text-[10px] truncate ${isActive ? 'text-violet-100' : 'text-slate-400 dark:text-slate-500'}`}>{item.description}</div>
                      </div>
                    </Link>
                  );
                })}
              </nav>

              {/* Collapsible PDF shortcuts directly in sidebar */}
              <div className="space-y-2">
                <div className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">PDF Utilities</div>
                <nav className="grid grid-cols-2 gap-1 px-1">
                  {pdfShortcuts.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center gap-1.5 px-2 py-2 rounded-lg border text-[10px] font-bold transition-all truncate cursor-pointer ${
                          isActive
                            ? 'bg-violet-50 border-violet-200 text-violet-650 dark:bg-violet-950/20 dark:border-violet-900/50 dark:text-violet-400'
                            : 'bg-white/40 dark:bg-slate-950/20 border-slate-200/50 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:border-violet-500'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 text-slate-450" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Collapsible Image shortcuts directly in sidebar */}
              <div className="space-y-2">
                <div className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Image Utilities</div>
                <nav className="grid grid-cols-2 gap-1 px-1">
                  {imageShortcuts.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center gap-1.5 px-2 py-2 rounded-lg border text-[10px] font-bold transition-all truncate cursor-pointer ${
                          isActive
                            ? 'bg-violet-50 border-violet-200 text-violet-650 dark:bg-violet-950/20 dark:border-violet-900/50 dark:text-violet-400'
                            : 'bg-white/40 dark:bg-slate-950/20 border-slate-200/50 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:border-violet-500'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 text-slate-450" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-4 border-t border-slate-200/60 dark:border-slate-800/60 space-y-2 flex-shrink-0">
              <div className="text-[9px] text-slate-400 text-center">
                v1.0 · Open-Source · Privacy-First
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Header Bar */}
            <header className="h-14 px-6 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <button 
                  className="lg:hidden p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-sans">
                  {location.pathname === '/' ? 'Dashboard' : location.pathname.substring(1).replace(/-/g, ' ')}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Privacy Indicator */}
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">Private · No Permanent Storage</span>
                </div>

                {/* Dark Mode Toggle */}
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors cursor-pointer"
                  title="Toggle dark mode"
                >
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </div>
            </header>

            {/* Scrollable Page Content */}
            <main className="flex-1 overflow-y-auto p-6">
              <div className="max-w-7xl mx-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
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
