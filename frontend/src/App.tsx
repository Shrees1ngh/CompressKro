import React, { useState, useCallback, useEffect } from 'react';
import {
  Image,
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
  LayoutDashboard
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import ImageCompressor from './components/ImageCompressor/ImageCompressor';
import ImageResizer from './components/ImageResizer';
import ImageConverter from './components/ImageConverter';
import PassportMaker from './components/PassportMaker';
import PdfTools from './components/PdfTools';
import PDFCompressor from './components/PDFCompressor/PDFCompressor';
import GovtAssistant from './components/GovtAssistant';
import { StorageService } from './services/storage.service';

type TabId = 'dashboard' | 'compress' | 'pdf-compress' | 'resize' | 'convert' | 'passport' | 'pdf' | 'govt';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ElementType;
  description: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & Quick Access' },
  { id: 'compress', label: 'Image Compressor', icon: Image, description: 'Smart KB-target compression' },
  { id: 'pdf-compress', label: 'PDF Compressor', icon: FileDown, description: 'Optimize PDF file size' },
  { id: 'resize', label: 'Image Resizer', icon: Maximize2, description: 'Crop & dimension scaling' },
  { id: 'convert', label: 'Format Converter', icon: FileSpreadsheet, description: 'PNG, JPG, WebP, HEIC, PDF' },
  { id: 'passport', label: 'Passport Maker', icon: UserCheck, description: 'Govt-standard photo prints' },
  { id: 'pdf', label: 'PDF Utilities', icon: FileText, description: 'Merge, Split, Rotate & more' },
  { id: 'govt', label: 'Govt Assistant', icon: Sparkles, description: 'Portal-specific presets' },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [darkMode, setDarkMode] = useState<boolean>(() => StorageService.getTheme() === 'dark');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [initialFile, setInitialFile] = useState<File | null>(null);
  const [presetConfig, setPresetConfig] = useState<any>(null);

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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabId);
    setSidebarOpen(false);
  };

  const handleFileDrop = useCallback((file: File) => {
    const type = file.type;
    if (type.startsWith('image/')) {
      setInitialFile(file);
      setActiveTab('compress');
    } else if (type === 'application/pdf') {
      setInitialFile(file);
      setActiveTab('pdf-compress');
    }
  }, []);

  const handleGovtPreset = (tab: string, config: any) => {
    setPresetConfig(config);
    setActiveTab(tab as TabId);
  };

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
            <div className="px-6 py-5 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-md shadow-violet-500/20">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 leading-none">CompressKro</h1>
                  <span className="text-[10px] text-slate-400 font-medium">All-in-One Optimizer</span>
                </div>
              </div>
              <button className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600" onClick={() => setSidebarOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Privacy Badge */}
            <div className="mx-4 mt-4 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">Privacy-First Architecture</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left group ${
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
                  </button>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="px-4 py-4 border-t border-slate-200/60 dark:border-slate-800/60 space-y-2">
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
                  className="lg:hidden p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {navItems.find(n => n.id === activeTab)?.label}
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
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Toggle dark mode"
                >
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </div>
            </header>

            {/* Scrollable Page Content */}
            <main className="flex-1 overflow-y-auto p-6">
              <div className="max-w-7xl mx-auto">
                {activeTab === 'dashboard' && (
                  <Dashboard
                    setActiveTab={handleTabChange}
                    onFileDrop={handleFileDrop}
                  />
                )}
                {activeTab === 'compress' && (
                  <ImageCompressor
                    initialFile={initialFile}
                    clearInitialFile={() => setInitialFile(null)}
                    presetConfig={presetConfig}
                    onNavigateToTab={(tab, file) => {
                      handleTabChange(tab);
                      if (file) setInitialFile(file);
                    }}
                  />
                )}
                {activeTab === 'resize' && (
                  <ImageResizer
                    initialFile={initialFile}
                    clearInitialFile={() => setInitialFile(null)}
                    presetConfig={presetConfig}
                  />
                )}
                {activeTab === 'convert' && (
                  <ImageConverter
                    initialFile={initialFile}
                    clearInitialFile={() => setInitialFile(null)}
                  />
                )}
                {activeTab === 'passport' && (
                  <PassportMaker
                    initialFile={initialFile}
                    clearInitialFile={() => setInitialFile(null)}
                  />
                )}
                {activeTab === 'pdf-compress' && (
                  <PDFCompressor />
                )}
                {activeTab === 'pdf' && (
                  <PdfTools />
                )}
                {activeTab === 'govt' && (
                  <GovtAssistant onApplyPreset={handleGovtPreset} />
                )}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
