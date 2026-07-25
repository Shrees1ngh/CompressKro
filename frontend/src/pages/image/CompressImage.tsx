// ============================================================
// CompressKro — Compress Image Page Component Wrapper
// ============================================================
import { useLocation, useNavigate } from 'react-router-dom';
import ImageCompressor from '../../components/ImageCompressor/ImageCompressor';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { ImageIcon, Maximize2, FileSpreadsheet } from 'lucide-react';

export function CompressImage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};
  const initialFile = state.file || null;
  const presetConfig = state.presetConfig || null;

  const steps: StepItem[] = [
    { step: 1, text: 'Upload PNG, JPG, WebP, or HEIC images by clicking or dropping.' },
    { step: 2, text: 'Select compression mode: target KB size, quality percentage, or dimensions.' },
    { step: 3, text: 'Click compress and download your optimized image files.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Target KB Compression', desc: 'Allows you to target exact file sizes in KB (e.g. 20KB for govt portals).' },
    { title: 'Dual-Window Quality Slider', desc: 'Interactive split comparisons preview visual changes side-by-side.' },
    { title: 'In-Browser Hydration', desc: 'Runs offline. Your sensitive personal pictures are never uploaded to servers.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'Does CompressKro reduce the pixel dimensions of my images?', answer: 'Only if you choose to. Standard target size compression attempts to reduce file bytes by adjusting JPG/WebP quality filters first, maintaining pixel counts where possible.' },
    { question: 'Can I compress multiple images at once?', answer: 'Yes. You can select multiple files or drop folders to bulk compress images concurrently.' },
    { question: 'What formats can I upload?', answer: 'We support JPG, JPEG, PNG, WebP, and HEIC images.' },
    { question: 'Is there a limit on file sizes?', answer: 'There is no set file limit. Since compression runs in your browser, it depends on your device memory limits.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Image Resizer', desc: 'Scaling and cropping bounds.', path: '/resize-image', icon: Maximize2 },
    { name: 'Format Converter', desc: 'Convert image formats.', path: '/convert-image', icon: FileSpreadsheet },
    { name: 'Govt Assistant', desc: 'Portal-specific template presets.', path: '/govt-assistant', icon: ImageIcon }
  ];

  return (
    <ToolPageLayout
      title="Image Compressor"
      subtitle="Reduce photo file sizes to target KBs without losing visual quality."
      breadcrumbName="Compress Image"
      seoTitle="Compress Image Online Free - Reduce Image Size in KB | CompressKro"
      seoDescription="Compress JPG, PNG, WebP, and HEIC images online for free. Target specific KB sizes (20KB, 50KB, 100KB) for portals. 100% private in-browser compression."
      canonicalPath="/compress-image"
      steps={steps}
      benefits={benefits}
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <ImageCompressor
        initialFile={initialFile}
        clearInitialFile={() => {
          navigate(location.pathname, { replace: true, state: {} });
        }}
        presetConfig={presetConfig}
        onNavigateToTab={(tab) => {
          if (tab === 'resize') navigate('/resize-image', { state });
          else if (tab === 'convert') navigate('/convert-image', { state });
          else if (tab === 'passport') navigate('/passport-maker', { state });
        }}
      />
    </ToolPageLayout>
  );
}
export default CompressImage;
