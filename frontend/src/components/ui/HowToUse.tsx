import React from 'react';
import { type LucideIcon, ShieldCheck } from 'lucide-react';

interface HowToUseProps {
  title: string;
  icon: LucideIcon;
  steps: string[];
  iconColorClass?: string;
  warning?: string;
}

export function HowToUse({ title, icon: Icon, steps, iconColorClass = 'text-violet-500', warning }: HowToUseProps) {
  return (
    <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel space-y-6 shadow-sm animate-fade-in flex flex-col h-full justify-between">
      <div className="space-y-5">
        <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Icon className={`w-4 h-4 ${iconColorClass}`} />
          <span>How to use {title}</span>
        </h3>

        <div className="space-y-4">
          {steps.map((step, idx) => (
            <div key={idx} className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
                {step}
              </p>
            </div>
          ))}
        </div>

        {warning && (
          <div className="p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400 font-bold leading-normal flex gap-1.5 mt-2">
            <span className="flex-shrink-0">⚠️</span>
            <span>{warning}</span>
          </div>
        )}
      </div>
    </div>
  );
}
