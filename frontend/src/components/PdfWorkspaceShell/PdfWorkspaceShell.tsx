// ============================================================
// CompressKro — PDF Workspace Shell
// Persistent full-screen layout wrapping all PDF tool routes.
// Sidebar + Center Canvas + Right Options Panel (via Outlet).
// SEO Helmet tags driven by pdfToolsMeta.
// ============================================================

import { Outlet, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ShieldCheck } from 'lucide-react';
import { PdfWorkspaceProvider } from '../../context/PdfWorkspaceContext';
import { PdfSidebar } from './PdfSidebar';
import { PdfCenterCanvas } from './PdfCenterCanvas';
import { getPdfToolMeta } from '../../constants/pdfToolsMeta';

import { useEffect, useRef } from 'react';
import { usePdfWorkspace } from '../../context/PdfWorkspaceContext';

function WorkspaceRouteGuard() {
  const location = useLocation();
  const pathSegment = location.pathname.replace(/^\//, '');
  const { isChained, setIsChained, clearActiveFile } = usePdfWorkspace();
  const prevPathSegmentRef = useRef(pathSegment);

  useEffect(() => {
    if (prevPathSegmentRef.current !== pathSegment) {
      prevPathSegmentRef.current = pathSegment;
      // If switching tools and file wasn't chained, clear it.
      if (!isChained) {
        clearActiveFile();
      } else {
        // Allow chained file to load on this page, then clear flag for future transitions.
        setIsChained(false);
      }
    }
  }, [pathSegment, isChained, clearActiveFile, setIsChained]);

  return null;
}

export function PdfWorkspaceShell() {
  const location = useLocation();

  // Extract tool path segment from current route
  const pathSegment = location.pathname.replace(/^\//, '');
  const toolMeta = getPdfToolMeta(pathSegment);

  const fullUrl = `https://compresskro.vercel.app${toolMeta?.canonicalPath ?? location.pathname}`;

  // JSON-LD schemas
  const softwareSchema = toolMeta ? {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    'name': toolMeta.breadcrumbName,
    'operatingSystem': 'All',
    'applicationCategory': 'UtilitiesApplication',
    'browserRequirements': 'Requires HTML5 compatible browser',
    'offers': {
      '@type': 'Offer',
      'price': '0',
      'priceCurrency': 'USD'
    }
  } : null;

  const breadcrumbSchema = toolMeta ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': 'https://compresskro.vercel.app/'
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': toolMeta.breadcrumbName,
        'item': fullUrl
      }
    ]
  } : null;

  return (
    <PdfWorkspaceProvider>
      <WorkspaceRouteGuard />
      {/* SEO Head — driven by centralized metadata */}
      {toolMeta && (
        <>
          <Helmet>
            <title>{toolMeta.seoTitle}</title>
            <meta name="description" content={toolMeta.seoDescription} />
            <meta name="robots" content="index, follow" />
            <link rel="canonical" href={fullUrl} />
            <meta property="og:title" content={toolMeta.seoTitle} />
            <meta property="og:description" content={toolMeta.seoDescription} />
            <meta property="og:url" content={fullUrl} />
            <meta property="og:type" content="website" />
            <meta property="og:image" content="https://compresskro.vercel.app/assets/og-image.png" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={toolMeta.seoTitle} />
            <meta name="twitter:description" content={toolMeta.seoDescription} />
            <meta name="twitter:image" content="https://compresskro.vercel.app/assets/og-image.png" />
          </Helmet>
          {softwareSchema && <script type="application/ld+json">{JSON.stringify(softwareSchema)}</script>}
          {breadcrumbSchema && <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>}
        </>
      )}

      {/* Full-screen 3-panel workspace */}
      <div
        className="flex flex-col lg:flex-row w-full border-t border-[var(--ck-border)]"
        style={{ height: 'calc(100vh - 80px)' }}
      >
        {/* Left Sidebar */}
        <PdfSidebar />

        {pathSegment === 'edit-pdf' || pathSegment === 'sign-pdf' || pathSegment === 'rotate-pdf' ? (
          <div className="flex-1 h-full overflow-hidden">
            <Outlet />
          </div>
        ) : (
          <>
            {/* Center Canvas */}
            <PdfCenterCanvas />

            {/* Right Options Panel — renders the active tool's UI via Outlet */}
            <div className="w-full lg:w-[320px] bg-[var(--ck-bg-card)] border-t lg:border-t-0 lg:border-l border-[var(--ck-border)] flex flex-col min-h-[250px] lg:min-h-0 overflow-y-auto thin-scrollbar flex-shrink-0">
              <div className="p-5 flex-1 flex flex-col justify-between min-h-full">
                <div className="flex-1 pb-5">
                  <Outlet />
                </div>
                <div className="flex gap-2 p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 mt-auto flex-shrink-0">
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-left">
                    <h4 className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Privacy Guaranteed</h4>
                    <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400 leading-normal font-semibold">
                      Processing runs 100% locally inside your browser. Your documents never upload to any servers.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PdfWorkspaceProvider>
  );
}
