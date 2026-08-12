// ============================================================
// CompressKro — Unified Tool Page Layout Component
// Implements consistent SEO, Structured Data schemas, FAQ,
// Steps, Benefits, and Related Tools sections across all pages.
// ============================================================

import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight } from 'lucide-react';

export interface FAQItem {
  question: string;
  answer: string;
}

export interface StepItem {
  step: number;
  text: string;
}

export interface BenefitItem {
  title: string;
  desc: string;
}

export interface RelatedToolItem {
  name: string;
  path: string;
  desc: string;
  icon: React.ElementType;
}

interface ToolPageLayoutProps {
  title: string;
  subtitle: string;
  breadcrumbName: string;
  seoTitle: string;
  seoDescription: string;
  canonicalPath: string;
  steps: StepItem[];
  benefits: BenefitItem[];
  faqs: FAQItem[];
  relatedTools: RelatedToolItem[];
  children: React.ReactNode;
  maxWidthClass?: string;
}

export function ToolPageLayout({
  title,
  subtitle,
  breadcrumbName,
  seoTitle,
  seoDescription,
  canonicalPath,
  steps,
  benefits,
  faqs,
  relatedTools,
  children,
  maxWidthClass,
}: ToolPageLayoutProps) {
  const fullUrl = `https://compresskro.vercel.app${canonicalPath}`;

  // Structured Data (JSON-LD)
  // 1. SoftwareApplication Schema
  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    'name': title,
    'operatingSystem': 'All',
    'applicationCategory': 'UtilitiesApplication',
    'browserRequirements': 'Requires HTML5 compatible browser',
    'offers': {
      '@type': 'Offer',
      'price': '0',
      'priceCurrency': 'USD'
    }
  };

  // 2. FAQPage Schema
  const faqSchema = faqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.map(faq => ({
      '@type': 'Question',
      'name': faq.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': faq.answer
      }
    }))
  } : null;

  // 3. BreadcrumbList Schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': 'https://compresskro.vercel.app/'
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': breadcrumbName,
        'item': fullUrl
      }
    ]
  };

  return (
    <div className="space-y-10 animate-fade-in pb-16">
      {/* React Helmet SEO Head Tags */}
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={fullUrl} />
        
        {/* Open Graph Tags */}
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:url" content={fullUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://compresskro.vercel.app/assets/og-image.png" />

        {/* Twitter Card Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content="https://compresskro.vercel.app/assets/og-image.png" />
      </Helmet>

      {/* JSON-LD Schemas */}
      <script type="application/ld+json">{JSON.stringify(softwareSchema)}</script>
      {faqSchema && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
      <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>

      {/* Breadcrumbs Navigation */}
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ck-text-muted)]">
        <Link to="/" className="hover:text-violet-600 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-[var(--ck-text-primary)]">{breadcrumbName}</span>
      </div>

      {/* Header H1 Area */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-black text-[var(--ck-text-primary)] tracking-tight">
          {title}
        </h1>
        <p className="text-xs sm:text-sm md:text-base text-[var(--ck-text-secondary)] font-semibold">
          {subtitle}
        </p>
      </div>

      {/* Main Tool Workspace UI Box */}
      <div className={`${maxWidthClass || 'max-w-4xl'} mx-auto`}>
        {children}
      </div>

      {/* Numbered Steps - How to Section */}
      <div className="max-w-3xl mx-auto p-6 md:p-8 rounded-[var(--ck-radius-xl)] ck-card space-y-6">
        <h2 className="text-md sm:text-lg font-black text-[var(--ck-text-primary)]">
          How to {title.toLowerCase()} Online for Free:
        </h2>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <li key={step.step} className="space-y-2 text-left">
              <div className="w-7 h-7 rounded-full bg-violet-600 text-white font-bold text-xs flex items-center justify-center shadow-md shadow-violet-500/10">
                {step.step}
              </div>
              <p className="text-xs text-[var(--ck-text-secondary)] leading-relaxed font-semibold">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </div>

      {/* Benefits Grid */}
      <div className="max-w-3xl mx-auto space-y-6">
        <h2 className="text-md sm:text-lg font-black text-[var(--ck-text-primary)] text-center">
          Why Choose CompressKro for {breadcrumbName}?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {benefits.map((b, idx) => (
            <div key={idx} className="p-5 rounded-[var(--ck-radius-lg)] ck-card space-y-2 text-left">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <h3 className="text-xs font-black">{b.title}</h3>
              </div>
              <p className="text-[11px] text-[var(--ck-text-secondary)] leading-relaxed font-semibold">
                {b.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Accordion Section */}
      <div className="max-w-3xl mx-auto p-6 md:p-8 rounded-[var(--ck-radius-xl)] ck-card space-y-6">
        <h2 className="text-md sm:text-lg font-black text-[var(--ck-text-primary)] text-center">
          Frequently Asked Questions (FAQ)
        </h2>
        <div className="space-y-4 text-left" style={{ borderTop: '1px solid var(--ck-border)' }}>
          {faqs.map((faq, idx) => (
            <div key={idx} className={`${idx > 0 ? 'pt-4' : 'pt-4'} space-y-1.5`} style={idx > 0 ? { borderTop: '1px solid var(--ck-border)' } : {}}>
              <h3 className="text-xs font-black text-[var(--ck-text-primary)]">
                {faq.question}
              </h3>
              <p className="text-[11px] text-[var(--ck-text-secondary)] leading-relaxed font-semibold">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Related Tools List */}
      <div className="max-w-3xl mx-auto space-y-6">
        <h2 className="text-md sm:text-lg font-black text-[var(--ck-text-primary)] text-center">
          Related Tools
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {relatedTools.map((tool, idx) => {
            const Icon = tool.icon;
            return (
              <Link
                key={idx}
                to={tool.path}
                className="p-4 rounded-[var(--ck-radius-md)] ck-card hover:border-violet-500 transition-all text-left flex gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-[var(--ck-text-primary)] truncate">{tool.name}</h3>
                  <p className="text-[10px] text-[var(--ck-text-muted)] mt-0.5 leading-relaxed truncate">{tool.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
