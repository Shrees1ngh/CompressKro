// ============================================================
// CompressKro — Homepage & Home Dashboard Component
// Category-grouped responsive grid layout for all PDF & Image tools
// combined with live stats and searchable operations history.
// ============================================================

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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
  FileType, 
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
  Edit3
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
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<string>('All');
  const [showAllHistory, setShowAllHistory] = useState(false);

  const { history, deleteEntry, clearHistory } = useHistory();
  const { showInfo } = useToast();

  // Get live stats
  const stats = StorageService.getStats();

  const handleClearHistory = () => {
    clearHistory();
    showInfo('History cleared', 'All operation history has been removed.');
  };

  const categories: CategoryGroup[] = [
    {
      title: 'Organize PDF',
      desc: 'Rearrange, merge, and split PDF pages with absolute ease.',
      tools: [
        { name: 'Merge PDF', desc: 'Combine multiple PDF files in any order.', path: '/merge-pdf', icon: ListOrdered, color: 'text-blue-500' },
        { name: 'Split PDF', desc: 'Extract pages or split document ranges.', path: '/split-pdf', icon: FileText, color: 'text-violet-500' },
        { name: 'Rotate & Order', desc: 'Rearrange and rotate pages with drag-and-drop.', path: '/rotate-pdf', icon: RotateCw, color: 'text-indigo-500' }
      ]
    },
    {
      title: 'Convert PDF',
      desc: 'Convert PDF files to and from other common file formats.',
      tools: [
        { name: 'PDF to Word', desc: 'Convert PDF pages into editable Word DOCX.', path: '/pdf-to-word', icon: FileType, color: 'text-blue-600' },
        { name: 'PDF to Excel', desc: 'Extract tables into Excel XLSX sheets.', path: '/pdf-to-excel', icon: FileSpreadsheet, color: 'text-emerald-500' },
        { name: 'PDF to JPG', desc: 'Save PDF pages as JPEG images.', path: '/pdf-to-jpg', icon: FileImage, color: 'text-rose-500' },
        { name: 'Images to PDF', desc: 'Convert PNG, JPG, and WebP into PDF pages.', path: '/images-to-pdf', icon: Upload, color: 'text-teal-500' }
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
        { name: 'Lock PDF', desc: 'Encrypt your document with passwords.', path: '/lock-pdf', icon: Lock, color: 'text-slate-600' },
        { name: 'Unlock PDF', desc: 'Decrypt and remove owner passwords.', path: '/unlock-pdf', icon: Unlock, color: 'text-zinc-500' }
      ]
    },
    {
      title: 'Image Tools',
      desc: 'Crop, resize, convert format, and design portal photos.',
      tools: [
        { name: 'Image Compressor', desc: 'Smart KB-targeted image compression.', path: '/compress-image', icon: ImageIcon, color: 'text-pink-500' },
        { name: 'Image Resizer', desc: 'Resize pixels, crop bounds, and dimensions.', path: '/resize-image', icon: Maximize2, color: 'text-cyan-500' },
        { name: 'Format Converter', desc: 'Convert formats between PNG, JPG, WebP, HEIC.', path: '/convert-image', icon: FileSpreadsheet, color: 'text-teal-600' },
        { name: 'Passport Maker', desc: 'Print-ready passport photo layouts.', path: '/passport-maker', icon: UserCheck, color: 'text-lime-600' },
        { name: 'Govt Assistant', desc: 'Portal presets (SSC, UPSC, etc.) templates.', path: '/govt-assistant', icon: Sparkles, color: 'text-yellow-500' }
      ]
    }
  ];

  // Filtered + searched history
  const filteredHistory = history.filter(h => {
    const matchesSearch =
      !historySearch ||
      h.name.toLowerCase().includes(historySearch.toLowerCase()) ||
      h.details.toLowerCase().includes(historySearch.toLowerCase());
    const matchesFilter = historyFilter === 'All' || h.tool === historyFilter;
    return matchesSearch && matchesFilter;
  });

  const displayedHistory = showAllHistory ? filteredHistory : filteredHistory.slice(0, 6);

  return (
    <div className="space-y-12 animate-fade-in pb-12">
      {/* Homepage SEO Head */}
      <Helmet>
        <title>CompressKro — Free Online PDF & Image Optimization Tools</title>
        <meta name="description" content="Merge, split, compress, lock, unlock, and OCR PDFs, or compress, resize, and convert images online for free. No signup, privacy-first." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://compresskro.com/" />
        <meta property="og:title" content="CompressKro — Free Online PDF & Image Optimization Tools" />
        <meta property="og:description" content="Merge, split, compress, lock, unlock, and OCR PDFs, or compress, resize, and convert images online for free. No signup, privacy-first." />
        <meta property="og:url" content="https://compresskro.com/" />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Hero Welcome Section */}
      <div className="text-center py-4 max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 text-violet-600 dark:text-violet-400">
          <Zap className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Fast, Online, Offline-Ready Tools</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
          Simplify Your PDF & Image Workflows
        </h1>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 font-medium max-w-2xl mx-auto">
          Every tool you need to compress, convert, edit, and secure your files online. 100% free, runs in-browser for complete client privacy.
        </p>
      </div>

      {/* Categories Grid */}
      <div className="space-y-12">
        {categories.map((cat, idx) => (
          <div key={idx} className="space-y-4">
            <div className="border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
              <h2 className="text-md font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">{cat.title}</h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{cat.desc}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {cat.tools.map((tool, tIdx) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tIdx}
                    to={tool.path}
                    className="p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-900/60 hover:border-violet-500 hover:ring-2 hover:ring-violet-500/10 transition-all duration-200 text-left flex flex-col justify-between h-[140px] group shadow-xs cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-950 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-50 dark:group-hover:bg-violet-950/40 transition-colors">
                      <Icon className={`w-4 h-4 ${tool.color} group-hover:scale-110 transition-transform`} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-violet-600 transition-colors">{tool.name}</h3>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-medium line-clamp-2">{tool.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Live Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            label: 'Privacy Protection',
            value: stats.privacyScore,
            sub: 'Local browser sandbox operations',
            icon: ShieldCheck,
            color: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
          },
          {
            label: 'Files Processed',
            value: stats.filesProcessed.toString(),
            sub: 'Local & transient in-memory',
            icon: ImageIcon,
            color: 'bg-fuchsia-100 dark:bg-fuchsia-950/30 text-fuchsia-600 dark:text-fuchsia-400'
          },
          {
            label: 'Space Saved',
            value: `${stats.mbSaved.toFixed(2)} MB`,
            sub: 'Saved on your device',
            icon: TrendingDown,
            color: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
          }
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 flex items-center gap-4 shadow-xs">
              <div className={`p-3 rounded-xl flex-shrink-0 ${stat.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm text-slate-550 dark:text-slate-400 font-bold">{stat.label}</div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{stat.value}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{stat.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/30 dark:bg-slate-900/30 glass-panel space-y-4 shadow-xs">
          {/* History Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-violet-500" />
              <span>Recent Operations</span>
              <span className="text-xs font-normal text-slate-450">({history.length})</span>
            </h2>
            <button
              onClick={handleClearHistory}
              className="text-xs font-bold text-red-500 hover:text-red-650 dark:text-red-400 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear All
            </button>
          </div>

          {/* Search & Filter */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-450" />
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Search history..."
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
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-450 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* History Table */}
          {filteredHistory.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">No matching history entries.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-450 uppercase">
                    <th className="py-2 pr-4">File Name</th>
                    <th className="py-2 pr-4">Tool</th>
                    <th className="py-2 pr-4">Details</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-105/50 dark:divide-slate-800/30">
                  {displayedHistory.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group">
                      <td className="py-2.5 pr-4 font-semibold text-slate-800 dark:text-slate-300 max-w-[180px] truncate">
                        {item.name}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-350 whitespace-nowrap">
                          {item.tool}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-emerald-600 dark:text-emerald-400 font-bold text-xs font-mono">
                        {item.details}
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-slate-400 whitespace-nowrap flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {item.date}
                      </td>
                      <td className="py-2.5">
                        <button
                          onClick={() => deleteEntry(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer"
                          title="Remove entry"
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
        </div>
      )}

      {/* Trust Badges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">100% Client-Side Privacy</h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-medium">Most operations compile instantly in your browser. Your sensitive files never upload to our servers.</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
            <Zap className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">No Registrations or Limits</h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-medium">Enjoy unlimited file tasks. No signups, no paywalls, and no watermarks on your compiled documents.</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800/50 rounded-xl text-slate-650 dark:text-slate-400">
            <LockKeyhole className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">End-to-End Encryption</h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-medium">When backend servers do compile complex files (like Compress and OCR), data routes are fully HTTPS encrypted.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
