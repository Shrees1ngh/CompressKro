// ============================================================
// CompressKro — Govt Assistant Page Component Wrapper
// ============================================================
import { useNavigate } from 'react-router-dom';
import GovtAssistant from '../../components/GovtAssistant';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { ImageIcon, Maximize2, FileSpreadsheet } from 'lucide-react';

export function GovtAssistantPage() {
  const navigate = useNavigate();

  const handleApplyPreset = (tab: string, config: any) => {
    // Map recommendedTool tab IDs to router path URLs
    let path = '/compress-image';
    if (tab === 'compress') path = '/compress-image';
    else if (tab === 'resize') path = '/resize-image';
    else if (tab === 'passport') path = '/passport-maker';
    else if (tab === 'convert') path = '/convert-image';

    navigate(path, { state: { presetConfig: config } });
  };

  const steps: StepItem[] = [
    { step: 1, text: 'Search or browse the government portal list (SSC, UPSC, SBI, etc.).' },
    { step: 2, text: 'Identify the document preset you need to upload (signature, photo, certificate).' },
    { step: 3, text: 'Click "Apply & Load Tool" to launch the correctly configured target editor.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Official Portal Guidelines', desc: 'Pre-loaded database containing official dimensions and file limits for major portals.' },
    { title: 'Zero Research Needed', desc: 'Saves you from hunting down guidelines. Simply select your portal and proceed.' },
    { title: 'Automated Tool Setup', desc: 'Configures target compressor or resizer options automatically, keeping tasks simple.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'What government portals are supported?', answer: 'We support major Indian recruitment and admissions portals, including UPSC, SSC, IBPS, SBI, NTA, JEE, NEET, and more.' },
    { question: 'Will this guarantee my files are accepted?', answer: 'Yes, our presets are built directly from the official portal instruction booklets. Re-scaling files to these limits ensures rejection-free uploads.' },
    { question: 'Do I need to sign up to use these portal tools?', answer: 'No. Every assistant preset is open, free to use, and runs locally on your browser.' },
    { question: 'Can I add custom presets?', answer: 'Currently, you can configure custom dimensions inside the Image Resizer or custom KB limits inside the Image Compressor directly.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Image Compressor', desc: 'Target exact KB sizes.', path: '/compress-image', icon: Maximize2 },
    { name: 'Passport Maker', desc: 'Tiled photo sheet print designs.', path: '/passport-maker', icon: ImageIcon },
    { name: 'Format Converter', desc: 'Convert format styles.', path: '/convert-image', icon: FileSpreadsheet }
  ];

  return (
    <ToolPageLayout
      title="Govt Portal Photo Assistant"
      subtitle="Instantly auto-configure image tools with official guidelines for SSC, UPSC, bank portals, and exams."
      breadcrumbName="Govt Assistant"
      seoTitle="Govt Portal Photo Assistant Free - SSC, UPSC Image Presets | CompressKro"
      seoDescription="Prepare photos and signatures for SSC, UPSC, IBPS, and JEE portals automatically. Auto-apply official portal dimension and KB size guidelines. Free and private."
      canonicalPath="/govt-assistant"
      steps={steps}
      benefits={benefits}
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <GovtAssistant onApplyPreset={handleApplyPreset} />
    </ToolPageLayout>
  );
}
export default GovtAssistantPage;
