// ============================================================
// CompressKro — Compress PDF Page Component Wrapper
// ============================================================

import PDFCompressor from '../../components/PDFCompressor/PDFCompressor';
import { ToolPageLayout } from '../../components/ToolPageLayout';
import type { StepItem, BenefitItem, FAQItem, RelatedToolItem } from '../../components/ToolPageLayout';
import { FileText, ListOrdered } from 'lucide-react';

export function CompressPdf() {
  const steps: StepItem[] = [
    { step: 1, text: 'Click "Select PDF File" or drag and drop your document into the box.' },
    { step: 2, text: 'Select a compression preset: Balanced (Recommended), Extreme, or Low.' },
    { step: 3, text: 'Click "Compress PDF" and download the optimized smaller file.' }
  ];

  const benefits: BenefitItem[] = [
    { title: 'Preserves Quality', desc: 'Maintains document readability and image resolution at optimal ratios.' },
    { title: 'Instant Compression', desc: 'Optimizes file streams locally or via fast streaming compression algorithms.' },
    { title: 'Zero File Limits', desc: 'Compress as many PDFs as you need. No signups, completely private.' }
  ];

  const faqs: FAQItem[] = [
    { question: 'Does compressing a PDF reduce text quality?', answer: 'No. Text characters and vectors remain 100% sharp. Optimization mostly targets downscaling high-DPI images and removing redundant metadata streams.' },
    { question: 'What is the recommended compression preset?', answer: 'We recommend the "Balanced" preset, which offers the best compression savings (typically 40-70%) while keeping document graphics readable.' },
    { question: 'Can I compress password-locked PDFs?', answer: 'No. You must unlock the PDF using our "Unlock PDF" tool first before compressing its file size.' },
    { question: 'Is my data secure?', answer: 'Yes, HTTPS encryption routes protect the session, and files are permanently purged from temp memory immediately after processing.' }
  ];

  const relatedTools: RelatedToolItem[] = [
    { name: 'Merge PDF', desc: 'Combine multiple PDF files.', path: '/merge-pdf', icon: ListOrdered },
    { name: 'Split PDF', desc: 'Extract pages or split ranges.', path: '/split-pdf', icon: FileText },
    { name: 'Unlock PDF', desc: 'Remove password restrictions.', path: '/unlock-pdf', icon: FileText }
  ];

  return (
    <ToolPageLayout
      title="Compress PDF Online"
      subtitle="Reduce PDF file size keeping maximum visual document quality for free."
      breadcrumbName="Compress PDF"
      seoTitle="Compress PDF Online Free - Reduce PDF File Size | CompressKro"
      seoDescription="Compress PDF files online for free. Reduce PDF file sizes significantly without losing quality. Easy drag-and-drop tool, privacy-first."
      canonicalPath="/compress-pdf"
      steps={steps}
      benefits={benefits}
      faqs={faqs}
      relatedTools={relatedTools}
    >
      <PDFCompressor />
    </ToolPageLayout>
  );
}
export default CompressPdf;
