// ============================================================
// CompressKro — Resize Image Page Component Wrapper
// ============================================================
import { useLocation, useNavigate } from 'react-router-dom';
import ImageResizer from '../../components/ImageResizer';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { ImageIcon, Maximize2, FileSpreadsheet } from 'lucide-react';

export function ResizeImage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};
  const initialFile = state.file || null;
  const presetConfig = state.presetConfig || null;

  const steps: StepItem[] = [
    { step: 1, text: 'Upload the target PNG, JPG, or WebP photo to resize.' },
    { step: 2, text: 'Configure custom dimension width/height pixels, scale ratios, or aspect presets.' },
    { step: 3, text: 'Preview changes and click resize to download the scaled image.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Aspect Ratio Locks', desc: 'Lock proportions (e.g. 16:9, 4:3, 1:1) to prevent image stretching or distortion.' },
    { title: 'Precise Dimension Scale', desc: 'Input pixel values directly or scale image size by percentages.' },
    { title: 'Privacy First', desc: 'Resizing runs in-browser on client canvases. Your pictures are completely private.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'What options can I select to resize images?', answer: 'You can adjust width and height in pixels, scale images by percentage sliders, or select presets matching common screen sizes.' },
    { question: 'Will resizing reduce quality?', answer: 'Scaling up images might make them blurry, but scaling down will maintain sharp pixel interpolation.' },
    { question: 'Is bulk resizing supported?', answer: 'The Image Resizer processes single files sequentially, ensuring high-fidelity visual preview checks.' },
    { question: 'Can I crop elements?', answer: 'Yes, our resizer provides canvas cropping bounding boxes to scale and frame subjects before exporting.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Image Compressor', desc: 'Target exact KB size.', path: '/compress-image', icon: Maximize2 },
    { name: 'Format Converter', desc: 'Convert image formats.', path: '/convert-image', icon: FileSpreadsheet },
    { name: 'Govt Assistant', desc: 'Portal-specific template presets.', path: '/govt-assistant', icon: ImageIcon }
  ];

  return (
    <ToolPageLayout
      title="Image Resizer"
      subtitle="Resize pixels, crop bounds, and scale image dimensions online for free."
      breadcrumbName="Resize Image"
      seoTitle="Resize Image Online Free - Scale & Crop Photo Dimensions | CompressKro"
      seoDescription="Resize image dimensions online for free. Scale width and height in pixels, crop proportions, and lock aspect ratios. 100% private in-browser canvas tool."
      canonicalPath="/resize-image"
      steps={steps}
      benefits={benefits}
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <ImageResizer
        initialFile={initialFile}
        clearInitialFile={() => {
          navigate(location.pathname, { replace: true, state: {} });
        }}
        presetConfig={presetConfig}
      />
    </ToolPageLayout>
  );
}
export default ResizeImage;
