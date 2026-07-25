// ============================================================
// CompressKro — Convert Image Page Component Wrapper
// ============================================================

import { useLocation, useNavigate } from 'react-router-dom';
import ImageConverter from '../../components/ImageConverter';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { ImageIcon, Maximize2 } from 'lucide-react';

export function ConvertImage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};
  const initialFile = state.file || null;

  const steps: StepItem[] = [
    { step: 1, text: 'Upload the target PNG, JPG, WebP, or HEIC image to convert.' },
    { step: 2, text: 'Select your desired target export format from the dropdown menu.' },
    { step: 3, text: 'Click convert and download your converted high-fidelity image.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'HEIC to JPEG/PNG Support', desc: 'Convert modern Apple iPhone photos (HEIC/HEIF) into widely compatible web formats.' },
    { title: 'Preserves Transparency', desc: 'Maintains alpha channel transparency when exporting to PNG or WebP.' },
    { title: 'Local Speed', desc: 'Converts images directly in your browser without loading remote network resources.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'What formats can I convert between?', answer: 'You can convert between PNG, JPG, JPEG, WebP, HEIC, and PDF formats.' },
    { question: 'Does converting image formats reduce resolution?', answer: 'No. The conversion is done at the original image dimensions without pixel down-scaling.' },
    { question: 'Can I convert HEIC photos on Windows?', answer: 'Yes. CompressKro packages heic2any library so Windows, Linux, and Android users can convert Apple HEIC photos offline.' },
    { question: 'Are my photos uploaded to a converter server?', answer: 'No. Every format conversion runs on client canvas buffers locally in your browser.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Image Compressor', desc: 'Target exact KB size.', path: '/compress-image', icon: Maximize2 },
    { name: 'Image Resizer', desc: 'Scaling and cropping bounds.', path: '/resize-image', icon: ImageIcon },
    { name: 'Govt Assistant', desc: 'Portal-specific template presets.', path: '/govt-assistant', icon: ImageIcon }
  ];

  return (
    <ToolPageLayout
      title="Format Converter"
      subtitle="Convert image formats between PNG, JPG, WebP, HEIC, and PDF online for free."
      breadcrumbName="Convert Image"
      seoTitle="Convert Image Online Free - PNG, JPG, WebP, HEIC | CompressKro"
      seoDescription="Convert image formats online for free. Convert PNG to JPG, HEIC to JPG, WebP to PNG, and more. Privacy-first, local browser converter."
      canonicalPath="/convert-image"
      steps={steps}
      benefits={benefits}
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <ImageConverter
        initialFile={initialFile}
        clearInitialFile={() => {
          navigate(location.pathname, { replace: true, state: {} });
        }}
      />
    </ToolPageLayout>
  );
}
export default ConvertImage;
