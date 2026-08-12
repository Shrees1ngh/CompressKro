// ============================================================
// CompressKro — PDF Workspace Sidebar
// Tool list with icons, grouped by category. No "Workspace"
// heading or "Active Session" — just the tools and a back link.
// ============================================================

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { PDF_TOOL_GROUPS, getPdfToolsByGroup } from '../../constants/pdfToolsMeta';
import type { PdfToolMeta } from '../../constants/pdfToolsMeta';

export function PdfSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract current tool path segment from the URL (e.g. "compress-pdf")
  const currentPath = location.pathname.replace(/^\//, '');

  const handleToolClick = (tool: PdfToolMeta, e: React.MouseEvent) => {
    e.preventDefault();
    // Client-side navigate — no full page reload
    navigate(`/${tool.path}`);
  };

  return (
    <div className="w-full lg:w-[200px] bg-[var(--ck-bg-card)] border-b lg:border-b-0 lg:border-r border-[var(--ck-border)] flex flex-col flex-shrink-0 overflow-hidden">

      {/* Tool Groups — scrollable on desktop, horizontal on mobile */}
      <nav className="flex-1 flex flex-row lg:flex-col gap-0.5 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto p-2 lg:p-3 thin-scrollbar">
        {PDF_TOOL_GROUPS.map((group) => {
          const tools = getPdfToolsByGroup(group.key as PdfToolMeta['group']);
          return (
            <div key={group.key} className="flex-shrink-0 lg:flex-shrink lg:mb-1">
              {/* Group label — hidden on mobile */}
              <span className="hidden lg:block text-[9px] font-bold text-[var(--ck-text-muted)] uppercase tracking-[0.1em] px-2.5 py-1.5">
                {group.label}
              </span>
              <div className="flex flex-row lg:flex-col gap-0.5">
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  const isActive = currentPath === tool.path;
                  return (
                    <a
                      key={tool.path}
                      href={`/${tool.path}`}
                      onClick={(e) => handleToolClick(tool, e)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11px] font-bold transition-all flex-shrink-0 whitespace-nowrap ${
                        isActive
                          ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/20'
                          : 'text-[var(--ck-text-secondary)] hover:text-violet-600 dark:hover:text-violet-400 hover:bg-[var(--ck-bg-muted)]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{tool.label}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Back to Home — bottom of sidebar */}
      <div className="hidden lg:block border-t border-[var(--ck-border)] p-3">
        <Link
          to="/"
          className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11px] font-bold text-[var(--ck-text-muted)] hover:text-violet-600 dark:hover:text-violet-400 hover:bg-[var(--ck-bg-muted)] transition-all"
        >
          <Home className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Back to Home</span>
        </Link>
      </div>
    </div>
  );
}
