// ============================================================
// CompressKro — Passport Maker Page Component Wrapper
// ============================================================

import { useLocation, useNavigate } from 'react-router-dom';
import PassportMaker from '../../components/PassportMaker';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { ImageIcon, Maximize2 } from 'lucide-react';

export function PassportMakerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};
  const initialFile = state.file || null;

  const steps: StepItem[] = [
    { step: 1, text: 'Upload your portrait photo (prefer solid background).' },
    { step: 2, text: 'Select standard country passport presets (e.g. India, USA, UK) or input custom sizes.' },
    { step: 3, text: 'Preview passport print layouts and download your printable passport sheets.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Standard Country Presets', desc: 'Pre-loaded configurations for major government photo sizes (USA, UK, India, Schengen).' },
    { title: 'Print Layout Generators', desc: 'Auto-tiles multiple passport copies neatly on A4 or 4x6 print papers.' },
    { title: 'Local Canvas Alignment', desc: 'Rotate, scale, and align subject eyes and face guides interactively.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'What country sizes are supported?', answer: 'We include pre-loaded options for India (3.5x4.5cm), USA/India OCI (2x2in), UK/Europe (3.5x4.5cm), and Schengen Visas.' },
    { question: 'Does this tool remove photo backgrounds?', answer: 'We offer interactive alignment guides. For solid color passport standards, we recommend taking photos in front of a white or blue wall.' },
    { question: 'How do I print the resulting passport photo sheet?', answer: 'The tool generates standard high-resolution JPEG sheets. You can copy the file to a flash drive or print directly on photo papers using home printers.' },
    { question: 'Is my personal photo safe?', answer: 'Yes. Every eye-alignment canvas rendering runs locally. Your passport photo is never sent to external servers.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Image Resizer', desc: 'Scale and crop dimensions.', path: '/resize-image', icon: Maximize2 },
    { name: 'Image Compressor', desc: 'Target exact KB sizes.', path: '/compress-image', icon: ImageIcon },
    { name: 'Govt Assistant', desc: 'Portal-specific template presets.', path: '/govt-assistant', icon: ImageIcon }
  ];

  return (
    <ToolPageLayout
      title="Passport Photo Maker"
      subtitle="Generate print-ready passport and visa photos matching standard country formats online for free."
      breadcrumbName="Passport Maker"
      seoTitle="Passport Photo Maker Online Free - Visa Photo Generator | CompressKro"
      seoDescription="Generate print-ready visa and passport photos online for free. Standard country presets, eye alignment guidelines, and tiled print sheet grids. Privacy guaranteed."
      canonicalPath="/passport-maker"
      steps={steps}
      benefits={benefits}
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <PassportMaker
        initialFile={initialFile}
        clearInitialFile={() => {
          navigate(location.pathname, { replace: true, state: {} });
        }}
      />
    </ToolPageLayout>
  );
}
export default PassportMakerPage;
