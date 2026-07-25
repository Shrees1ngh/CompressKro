// ============================================================
// CompressKro — 404 Not Found Page Component
// ============================================================
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { HelpCircle, ArrowLeft } from 'lucide-react';

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 space-y-6 animate-fade-in">
      <Helmet>
        <title>404 Page Not Found — CompressKro</title>
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <div className="w-20 h-20 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-500 flex items-center justify-center shadow-lg">
        <HelpCircle className="w-10 h-10 animate-bounce" />
      </div>

      <div className="space-y-2 max-w-md">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          Page Not Found (404)
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
      </div>

      <Link
        to="/"
        className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 flex items-center gap-2 shadow-md shadow-violet-500/20 transition-all cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Homepage</span>
      </Link>
    </div>
  );
}
