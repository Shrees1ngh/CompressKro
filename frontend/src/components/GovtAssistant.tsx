import { useState } from 'react';
import { 
  HelpCircle,
  Building,
  ArrowUpRight
} from 'lucide-react';

interface GovtAssistantProps {
  onApplyPreset: (tab: string, config: any) => void;
}

interface PortalPreset {
  id: string;
  portal: string;
  docType: string;
  limits: string;
  targetSizeKB: number;
  width?: number;
  height?: number;
  format: string;
  recommendedTool: string; // 'compress' | 'resize' | 'passport' | 'pdf'
  toolLabel: string;
  details: string;
}

export default function GovtAssistant({ onApplyPreset }: GovtAssistantProps) {
  const [selectedPortal, setSelectedPortal] = useState<string>('all');

  const presets: PortalPreset[] = [
    {
      id: 'upsc-photo',
      portal: 'UPSC Portal',
      docType: 'Applicant Photograph',
      limits: '20 KB - 300 KB',
      targetSizeKB: 200,
      width: 550,
      height: 550,
      format: 'JPG',
      recommendedTool: 'resize',
      toolLabel: 'Image Resizer',
      details: 'Min size 350×350 px. Max size 1000×1000 px. Both width & height must be equal (1:1 aspect ratio).'
    },
    {
      id: 'upsc-sign',
      portal: 'UPSC Portal',
      docType: 'Signature Scan',
      limits: '20 KB - 300 KB',
      targetSizeKB: 100,
      width: 550,
      height: 550,
      format: 'JPG',
      recommendedTool: 'resize',
      toolLabel: 'Image Resizer',
      details: 'Min size 350×350 px. Square format. Must be clear on white paper.'
    },
    {
      id: 'ssc-photo',
      portal: 'SSC Portal',
      docType: 'Applicant Photograph',
      limits: '20 KB - 50 KB',
      targetSizeKB: 45,
      width: 350,
      height: 450,
      format: 'JPG',
      recommendedTool: 'passport',
      toolLabel: 'Passport Maker',
      details: 'Standard dimensions 3.5 cm width x 4.5 cm height. Solid light background required.'
    },
    {
      id: 'ssc-sign',
      portal: 'SSC Portal',
      docType: 'Signature Scan',
      limits: '10 KB - 20 KB',
      targetSizeKB: 18,
      width: 400,
      height: 200,
      format: 'JPG',
      recommendedTool: 'resize',
      toolLabel: 'Image Resizer',
      details: 'Standard dimensions 4.0 cm width x 2.0 cm height. Black ink signature only.'
    },
    {
      id: 'passport-photo',
      portal: 'Passport India',
      docType: 'Passport Size Photograph',
      limits: '10 KB - 50 KB',
      targetSizeKB: 45,
      width: 350,
      height: 450,
      format: 'JPG',
      recommendedTool: 'passport',
      toolLabel: 'Passport Maker',
      details: 'Dimensions 350×450 pixels. Pure white background, front facial posture.'
    },
    {
      id: 'pan-sign',
      portal: 'PAN Card NSDL',
      docType: 'Signature / Photo',
      limits: '10 KB - 20 KB',
      targetSizeKB: 18,
      width: 200,
      height: 230,
      format: 'JPG',
      recommendedTool: 'resize',
      toolLabel: 'Image Resizer',
      details: 'Dimensions 200×230 pixels. Resolution 200 DPI scan.'
    },
    {
      id: 'aadhaar-doc',
      portal: 'UIDAI Aadhaar',
      docType: 'Identity / Address Proof',
      limits: 'Max 2 MB',
      targetSizeKB: 1800,
      format: 'PDF',
      recommendedTool: 'pdf',
      toolLabel: 'PDF Utilities',
      details: 'Accepts PDF. If you have document photos, compile them into A4 PDF.'
    }
  ];

  const portalsList = ['all', 'UPSC Portal', 'SSC Portal', 'Passport India', 'PAN Card NSDL', 'UIDAI Aadhaar'];

  const filteredPresets = selectedPortal === 'all' 
    ? presets 
    : presets.filter(p => p.portal === selectedPortal);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Govt Portal Assistant</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">One-click presets configuration matching official recruitment, visa, and utility website limits.</p>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {portalsList.map((portal) => (
          <button
            key={portal}
            onClick={() => setSelectedPortal(portal)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full border transition-all whitespace-nowrap ${
              (portal === 'all' && selectedPortal === 'all') || selectedPortal === portal
                ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-500/10'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
            }`}
          >
            {portal === 'all' ? 'All Portals' : portal}
          </button>
        ))}
      </div>

      {/* Presets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredPresets.map((preset) => (
          <div 
            key={preset.id}
            className="group relative p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel flex flex-col justify-between hover:bg-white dark:hover:bg-slate-900/80 transition-all duration-300 glow-effect"
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
                      {preset.portal}
                    </span>
                    <h3 className="text-md font-bold text-slate-800 dark:text-slate-200">
                      {preset.docType}
                    </h3>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
                  {preset.limits}
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                {preset.details}
              </p>

              {/* Requirement highlights */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-950/20 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-[9px] uppercase font-bold text-slate-400">Dimensions</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                    {preset.width && preset.height ? `${preset.width}×${preset.height} px` : 'Page-wise'}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase font-bold text-slate-400">File Limit</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                    {preset.targetSizeKB >= 1000 ? `${(preset.targetSizeKB / 1000).toFixed(1)} MB` : `${preset.targetSizeKB} KB`}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase font-bold text-slate-400">Format</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                    {preset.format}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between items-center">
              <span className="text-[10px] text-slate-400">
                Tool: <span className="font-bold text-violet-600 dark:text-violet-400">{preset.toolLabel}</span>
              </span>
              <button 
                onClick={() => onApplyPreset(preset.recommendedTool, {
                  targetSizeKB: preset.targetSizeKB,
                  width: preset.width,
                  height: preset.height,
                  format: preset.format.toLowerCase()
                })}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white flex items-center gap-1 shadow group-hover:bg-violet-600 transition-colors"
              >
                <span>Launch Helper</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Helpful Hint banner */}
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 glass-panel flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-violet-500 mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">How does the helper work?</h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            Clicking "Launch Helper" will automatically redirect you to the appropriate compression or sizing workspace. The width, height, and target KB bounds will be pre-configured instantly. Just load your document file and press start!
          </p>
        </div>
      </div>
    </div>
  );
}
