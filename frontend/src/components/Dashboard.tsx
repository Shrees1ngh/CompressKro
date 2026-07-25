// ============================================================
// CompressKro — Dashboard (Improved)
// Real-time stats, history with search/filter/delete, quick actions
// ============================================================

import React, { useState } from 'react';
import {
  Image,
  FileText,
  FileDown,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Maximize2,
  FileSpreadsheet,
  UserCheck,
  History,
  Trash2,
  Search,
  X,
  RotateCcw,
  TrendingDown,
  Clock
} from 'lucide-react';
import { StorageService } from '../services/storage.service';
import { useHistory } from '../hooks/useHistory';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from './ui/Toast';

interface DashboardProps {
  setActiveTab: (tab: string) => void;
  onFileDrop: (file: File) => void;
}

const tools = [
  {
    id: 'compress',
    title: 'Image Compressor',
    desc: 'Compress JPG, PNG, WebP to exact KB targets using smart binary-search quality.',
    icon: Image,
    color: 'from-violet-500 to-indigo-500',
    badge: 'Signature'
  },
  {
    id: 'pdf-compress',
    title: 'PDF Compressor',
    desc: 'Compress scan-heavy PDFs, optimize XObject images, and stream size metrics.',
    icon: FileDown,
    color: 'from-fuchsia-500 to-violet-650',
    badge: 'New'
  },
  {
    id: 'resize',
    title: 'Image Resizer',
    desc: 'Scale or crop to passport, Aadhaar, PAN, social media, and custom dimensions.',
    icon: Maximize2,
    color: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'convert',
    title: 'Format Converter',
    desc: 'Convert PNG ↔ JPG ↔ WebP ↔ PDF. HEIC support included.',
    icon: FileSpreadsheet,
    color: 'from-emerald-500 to-teal-500'
  },
  {
    id: 'passport',
    title: 'Passport Photo Maker',
    desc: 'Government-standard passport photos with white background and exact KB limit.',
    icon: UserCheck,
    color: 'from-amber-500 to-orange-500'
  },
  {
    id: 'pdf',
    title: 'PDF Utilities',
    desc: 'Add Digital Signature, Page Numbers, PDF to JPG, Lock/Unlock, Watermarks, Merge & Split.',
    icon: FileText,
    color: 'from-red-500 to-rose-500'
  },
  {
    id: 'govt',
    title: 'Govt Portal Assistant',
    desc: 'One-click presets for UPSC, SSC, Passport, PAN, Aadhaar portals.',
    icon: Sparkles,
    color: 'from-purple-500 to-pink-500'
  }
];

const TOOL_FILTER_OPTIONS = ['All', 'Compression', 'Resize', 'Format Convert', 'Passport Maker', 'PDF'] as const;

export default function Dashboard({ setActiveTab, onFileDrop }: DashboardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<string>('All');
  const [showAllHistory, setShowAllHistory] = useState(false);

  const { history, deleteEntry, clearHistory } = useHistory();
  const { toasts, showInfo, dismiss } = useToast();

  // Live stats from StorageService (not stale useState)
  const stats = StorageService.getStats();

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileDrop(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileDrop(e.target.files[0]);
    }
  };

  const handleClearHistory = () => {
    clearHistory();
    showInfo('History cleared', 'All operation history has been removed.');
  };

  const handleDeleteEntry = (id: string) => {
    deleteEntry(id);
  };

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
    <div className="space-y-8 animate-fade-in">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* Hero */}
      <div className="text-center py-6">
        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-violet-400 dark:to-fuchsia-400 leading-tight">
          Compress. Convert. Resize. Optimize.
        </h1>
        <p className="mt-3 text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
          One unified platform for all your file optimization needs. Most image tools run locally in your browser; advanced PDF optimization is securely processed without permanent storage.
        </p>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300 p-12 text-center group cursor-pointer ${
          isDragOver
            ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-950/20 scale-[1.01]'
            : 'border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:border-violet-400 dark:hover:border-violet-800'
        } glass-panel`}
      >
        <input
          type="file"
          id="hero-file-upload"
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,application/pdf,.heic"
        />
        <label htmlFor="hero-file-upload" className="cursor-pointer block">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg shadow-violet-500/20 group-hover:scale-110 transition-transform duration-300">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="mt-6 text-xl font-semibold text-slate-800 dark:text-slate-200">
            {isDragOver ? 'Drop it here!' : 'Drag and Drop your file here'}
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Images or PDFs. We'll detect the format and launch the right tool automatically.
          </p>
          <span className="mt-4 inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950/30 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/40 transition-colors">
            Or browse files
          </span>
        </label>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            label: 'Privacy Status',
            value: 'Privacy First',
            sub: 'No permanent file storage',
            icon: ShieldCheck,
            color: 'bg-violet-100 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400'
          },
          {
            label: 'Files Processed',
            value: stats.filesProcessed.toString(),
            sub: 'Local & transient in-memory',
            icon: Image,
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
            <div key={stat.label} className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 flex items-center gap-4">
              <div className={`p-3 rounded-xl flex-shrink-0 ${stat.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{stat.value}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{stat.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <span>Quick Actions</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Compress Image', tab: 'compress', color: 'from-violet-500 to-indigo-500' },
            { label: 'Compress PDF', tab: 'pdf-compress', color: 'from-fuchsia-500 to-violet-600' },
            { label: 'Resize Image', tab: 'resize', color: 'from-blue-500 to-cyan-500' },
            { label: 'Convert Format', tab: 'convert', color: 'from-emerald-500 to-teal-500' },
            { label: 'Passport Photo', tab: 'passport', color: 'from-amber-500 to-orange-500' },
            { label: 'PDF Utilities', tab: 'pdf', color: 'from-red-500 to-rose-500' },
            { label: 'Govt Presets', tab: 'govt', color: 'from-purple-500 to-pink-500' },
          ].map(action => (
            <button
              key={action.tab}
              onClick={() => setActiveTab(action.tab)}
              className={`py-3 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r ${action.color} hover:opacity-90 transition-opacity flex items-center justify-between group shadow-sm`}
            >
              <span>{action.label}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          ))}
        </div>
      </div>

      {/* Tools Grid */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">
          Optimization Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map(tool => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                onClick={() => setActiveTab(tool.id)}
                className="group relative p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900/80 transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/40 dark:hover:shadow-none cursor-pointer flex flex-col justify-between glow-effect"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${tool.color} text-white shadow-md`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    {tool.badge && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                        {tool.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{tool.desc}</p>
                </div>
                <div className="mt-6 flex items-center text-xs font-semibold text-slate-400 dark:text-slate-500 group-hover:text-violet-500 transition-colors">
                  <span>Open Tool</span>
                  <ArrowRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/30 dark:bg-slate-900/30 space-y-4">
          {/* History Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-violet-500" />
              <span>Recent Operations</span>
              <span className="text-xs font-normal text-slate-400">({history.length})</span>
            </h2>
            <button
              onClick={handleClearHistory}
              className="text-xs font-semibold text-red-500 hover:text-red-600 dark:text-red-400 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear All
            </button>
          </div>

          {/* Search & Filter */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                  className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg whitespace-nowrap transition-all ${
                    historyFilter === opt
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
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
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                    <th className="py-2 pr-4">File Name</th>
                    <th className="py-2 pr-4">Tool</th>
                    <th className="py-2 pr-4">Details</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {displayedHistory.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group">
                      <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-slate-300 max-w-[180px] truncate">
                        {item.name}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {item.tool}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                        {item.details}
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-slate-400 whitespace-nowrap flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.date}
                      </td>
                      <td className="py-2.5">
                        <button
                          onClick={() => handleDeleteEntry(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
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
                  className="mt-3 w-full py-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20 rounded-lg transition-colors"
                >
                  {showAllHistory ? 'Show less' : `Show all ${filteredHistory.length} entries`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
