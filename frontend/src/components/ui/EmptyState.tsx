// ============================================================
// CompressKro — Reusable EmptyState Component
// ============================================================

import React from 'react';
import { HelpCircle } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  minHeight?: string;
}

export function EmptyState({
  icon: Icon = HelpCircle,
  title,
  description,
  minHeight = 'min-h-[380px]',
}: EmptyStateProps) {
  return (
    <div
      className={`h-full ${minHeight} rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/20 dark:bg-slate-900/20 glass-panel flex flex-col items-center justify-center p-8 text-center`}
    >
      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">{title}</h3>
      {description && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}

export default EmptyState;
