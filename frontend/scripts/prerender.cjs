// ============================================================
// CompressKro — Build-Time Static SEO Pre-renderer
// Reads dist/index.html and outputs SEO-friendly route pages
// containing full JSON-LD structured schemas, titles, and FAQs.
// ============================================================

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '../dist');
const TEMPLATE_PATH = path.join(DIST_DIR, 'index.html');

if (!fs.existsSync(TEMPLATE_PATH)) {
  console.error('Error: dist/index.html not found. Run "vite build" first.');
  process.exit(1);
}

const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

const routes = [
  {
    path: 'merge-pdf',
    title: 'Merge PDF Online Free - Combine PDF Files | CompressKro',
    desc: 'Merge multiple PDF files online for free. Rearrange, reorder, and combine PDF pages into a single document. 100% private in-browser tool.',
    heading: 'Merge PDF Online',
    sub: 'Combine multiple PDF files into one single document online for free.',
    faqs: [
      { q: 'How do I merge multiple PDFs into one document?', a: 'Click the select button to upload files, drag cards to rearrange their order, and click Compile.' },
      { q: 'Is there a limit on file count?', a: 'No, you can combine as many files as needed. Large documents depend on your device browser memory.' }
    ]
  },
  {
    path: 'split-pdf',
    title: 'Split PDF Online Free - Extract PDF Pages | CompressKro',
    desc: 'Split PDF files online for free. Extract specific pages or split document ranges into individual PDFs. 100% private in-browser tool.',
    heading: 'Split PDF Online',
    sub: 'Extract pages or split ranges from your PDF files.',
    faqs: [
      { q: 'Can I extract non-contiguous pages?', a: 'Yes. You can enter comma-separated numbers (e.g. 1, 3) or ranges (e.g. 2-5) to split.' },
      { q: 'Is this process local?', a: 'Yes, document splitting compiles entirely on your local machine using client-side libraries.' }
    ]
  },
  {
    path: 'rotate-pdf',
    title: 'Rotate PDF Pages Online Free - Organize PDF | CompressKro',
    desc: 'Rotate and reorder PDF pages online for free. Drag and drop pages to rearrange, sort, delete, and organize PDF documents. 100% private.',
    heading: 'Rotate & Organize PDF',
    sub: 'Rearrange, rotate, and delete pages of your PDF documents visually.',
    faqs: [
      { q: 'How do I reorder pages?', a: 'Simply upload the PDF and drag the page thumbnails to sort them in any order you choose.' },
      { q: 'Can I delete pages from a PDF?', a: 'Yes, click the trash bin icon on any page thumbnail to delete it before generating the output.' }
    ]
  },
  {
    path: 'images-to-pdf',
    title: 'Convert Images to PDF Online Free - JPG, PNG | CompressKro',
    desc: 'Convert PNG, JPG, and WebP images to PDF online for free. Stack, reorder, and compile multiple images into a single PDF document. Local client-side.',
    heading: 'Convert Images to PDF',
    sub: 'Convert PNG, JPG, and WebP images into clean, standard PDF pages.',
    faqs: [
      { q: 'Can I combine multiple pictures into one PDF?', a: 'Yes. Drop multiple files, arrange them in order, and compile them into a multi-page document.' },
      { q: 'Will image resolution change?', a: 'No, we preserve the original resolution and fit images to PDF page dimensions.' }
    ]
  },
  {
    path: 'lock-pdf',
    title: 'Lock PDF Online Free - Password Protect PDF | CompressKro',
    desc: 'Add passwords to lock PDF files online for free. Encrypt sensitive documents with strong owner passwords. 100% private in-browser tool.',
    heading: 'Lock PDF Online',
    sub: 'Encrypt and password protect your PDF files for secure sharing.',
    faqs: [
      { q: 'What encryption standard is used?', a: 'We use high-security standard password locks. Your passwords are processed locally in your browser.' },
      { q: 'What happens if I forget the password?', a: 'We do not store passwords. If you lose it, the PDF cannot be opened.' }
    ]
  },
  {
    path: 'unlock-pdf',
    title: 'Unlock PDF Online Free - Remove PDF Password | CompressKro',
    desc: 'Unlock password protected PDFs online for free. Remove owner password restrictions and print or edit locks. 100% private, local browser decrypt.',
    heading: 'Unlock PDF Online',
    sub: 'Remove passwords and permissions locks from PDF documents.',
    faqs: [
      { q: 'Can I unlock a file if I do not know the password?', a: 'No. You must enter the correct password once to verify authority before locks can be removed.' },
      { q: 'Does this work on all PDF documents?', a: 'Yes, it works on standard user/owner encrypted files.' }
    ]
  },
  {
    path: 'add-watermark',
    title: 'Add Watermark to PDF Online - Text & Image | CompressKro',
    desc: 'Add text or image watermarks to PDF pages online for free. Customize font, opacity, size, rotation, and overlay style. Local browser security.',
    heading: 'Add Watermark to PDF',
    sub: 'Stamp custom logo images or brand texts onto PDF pages.',
    faqs: [
      { q: 'Can I adjust watermark transparency?', a: 'Yes, use the opacity slider to blend the text or logo overlay smoothly into the background.' },
      { q: 'Can I choose specific target pages?', a: 'Yes, you can configure watermark placement for all pages or specific page indices.' }
    ]
  },
  {
    path: 'remove-watermark',
    title: 'Remove Watermark from PDF Online Free | CompressKro',
    desc: 'Remove watermarks and background annotations from PDF files online for free. Clear text headers or visual overlays with local browser clean.',
    heading: 'Remove Watermark from PDF',
    sub: 'Clean annotations, stamps, and watermark objects from PDF streams.',
    faqs: [
      { q: 'How does watermarks clean work?', a: 'The tool uses secure backend Ghostscript routines to strip redundant visual layers.' },
      { q: 'Is my document content preserved?', a: 'Yes, original texts, lines, and content shapes are fully maintained.' }
    ]
  },
  {
    path: 'page-numbers',
    title: 'Add Page Numbers to PDF Online Free | CompressKro',
    desc: 'Add customizable page numbers to PDF files online for free. Position page numbering headers/footers with local client privacy.',
    heading: 'Add PDF Page Numbers',
    sub: 'Format and stamp clean page numbers onto your PDF documents automatically.',
    faqs: [
      { q: 'Where are page numbers positioned?', a: 'You can choose between top/bottom headers or footers, and left, center, or right alignments.' },
      { q: 'Can I change the start page index?', a: 'Yes, you can configure the numbering to start from page 1 or skip the title page.' }
    ]
  },
  {
    path: 'pdf-to-jpg',
    title: 'Convert PDF to JPG Online Free - Extract Images | CompressKro',
    desc: 'Convert PDF to JPG online for free. Save all PDF pages as separate high-resolution JPEG images. 100% private in-browser tool.',
    heading: 'Convert PDF to JPG',
    sub: 'Convert PDF document pages into high-fidelity JPG/PNG images.',
    faqs: [
      { q: 'Can I choose output image formats?', a: 'Yes, you can convert pages to standard JPG or high-resolution PNG image grids.' },
      { q: 'Are pages watermarked during conversion?', a: 'No, exports are clean and contain only original page visual layouts.' }
    ]
  },

  {
    path: 'ocr-pdf',
    title: 'OCR PDF Online Free - Searchable PDF Creator | CompressKro',
    desc: 'Add searchable text layers to scanned PDF pages online for free using OCR. Powered by secure tesseract/ocrmypdf services.',
    heading: 'OCR PDF Document',
    sub: 'Overlay searchable text layers on top of scanned images.',
    faqs: [
      { q: 'How does OCR process files?', a: 'The backend compiles image contents using Tesseract engine layers to output searchable PDF formats.' },
      { q: 'Is OCR secure?', a: 'Yes. Connection routes are encrypted, and files are purged immediately from memory after compilation.' }
    ]
  },
  {
    path: 'repair-pdf',
    title: 'Repair PDF Online Free - Fix Corrupted & Broken PDFs | CompressKro',
    desc: 'Repair corrupted PDF files online for free. Rebuild XREF tables, fix damaged stream objects, and recover unreadable PDF pages. Private, fast, and secure.',
    heading: 'Repair Corrupted PDF Document',
    sub: 'Rebuild cross-reference tables and recover damaged PDF stream structures.',
    faqs: [
      { q: 'What corruption issues can be repaired?', a: 'The tool fixes invalid XREF tables, broken stream headers, corrupted page dictionaries, and improper offset tables.' },
      { q: 'Is file processing secure?', a: 'Yes, repair runs inside isolated sandboxes and temp files are permanently deleted immediately.' }
    ]
  },
  {
    path: 'compress-pdf',
    title: 'Compress PDF Online Free - Reduce PDF File Size | CompressKro',
    desc: 'Compress PDF files online for free. Reduce PDF file sizes significantly without losing quality. Easy drag-and-drop tool, privacy-first.',
    heading: 'Compress PDF Online',
    sub: 'Reduce PDF file sizes keeping maximum visual document quality.',
    faqs: [
      { q: 'Does compression affect text?', a: 'No, characters and text layout remain sharp. Compression targets page image streams.' },
      { q: 'What preset should I use?', a: 'We recommend "Balanced" for optimal size reduction with clean page graphics.' }
    ]
  },
  {
    path: 'sign-pdf',
    title: 'Sign PDF Online Free - Add Signature & Stamp | CompressKro',
    desc: 'Add digital signatures and custom stamps to PDF online for free. Draw signatures, upload brand stamps, and position them with arrow nudges. Local client privacy.',
    heading: 'Sign PDF Online',
    sub: 'Draw signatures, upload custom company stamps, and position dates on PDFs.',
    faqs: [
      { q: 'Can I drag signature placement?', a: 'Yes, drag overlays visually on stacked page canvases and nudge with keyboard Arrow keys.' },
      { q: 'Can I sign multiple pages?', a: 'Yes, choose specific page range options or apply stamp layouts to all pages.' }
    ]
  },
  {
    path: 'edit-pdf',
    title: 'Edit PDF Online Free - Edit Text & Replace Images | CompressKro',
    desc: 'Edit PDF text and images online for free. Modify existing text runs, erase details, insert shapes, replace images, and sign client-side. 100% private.',
    heading: 'Edit PDF Online',
    sub: 'Modify text, replace images, whiteout details, and customize your PDF pages online.',
    faqs: [
      { q: 'Can I edit the text of any PDF?', a: "You can edit text layers on native or OCR'd PDFs. PDFs made from scanned images do not have a text layer." },
      { q: 'How do I erase or redact details?', a: 'Select the Whiteout tool and drag a rectangle over any area to overlay a white rectangle.' }
    ]
  },
  {
    path: 'compress-image',
    title: 'Compress Image Online Free - Reduce Image Size | CompressKro',
    desc: 'Compress JPG, PNG, WebP, and HEIC images online for free. Target specific KB sizes (20KB, 50KB, 100KB) for portals. 100% private in-browser compression.',
    heading: 'Compress Image Size',
    sub: 'Reduce photo bytes to target KB limits without losing quality.',
    faqs: [
      { q: 'Can I target exact KB limits?', a: 'Yes, specify sizes like 20KB or 50KB for government exam forms.' },
      { q: 'Is bulk compression supported?', a: 'Yes, you can drop multiple images to compress them in parallel.' }
    ]
  },
  {
    path: 'resize-image',
    title: 'Resize Image Online Free - Scale & Crop Dimensions | CompressKro',
    desc: 'Resize image dimensions online for free. Scale width and height in pixels, crop proportions, and lock aspect ratios. 100% private in-browser canvas tool.',
    heading: 'Resize Image online',
    sub: 'Crop bounding boxes and scale image dimensions easily.',
    faqs: [
      { q: 'Can I lock aspect ratios?', a: 'Yes, lock width/height proportions to prevent image stretching.' },
      { q: 'Is there passport photo crop standard?', a: 'Yes, select standard aspect presets for fast portrait setups.' }
    ]
  },
  {
    path: 'convert-image',
    title: 'Convert Image Online Free - PNG, JPG, WebP, HEIC | CompressKro',
    desc: 'Convert image formats online for free. Convert PNG to JPG, HEIC to JPG, WebP to PNG, and more. Privacy-first, local browser converter.',
    heading: 'Convert Image Formats',
    sub: 'Convert PNG, JPG, WebP, and HEIC images online easily.',
    faqs: [
      { q: 'Can I convert HEIC photos on Windows?', a: 'Yes, heic2any runs locally to convert Apple iOS images offline.' },
      { q: 'Does conversion reduce details?', a: 'No, format conversion preserves original dimensions and details.' }
    ]
  },
  {
    path: 'passport-maker',
    title: 'Passport Photo Maker Online Free - Visa Photo Generator | CompressKro',
    desc: 'Generate print-ready visa and passport photos online for free. Standard country presets, eye alignment guidelines, and tiled print sheet grids. Privacy guaranteed.',
    heading: 'Passport Photo Maker',
    sub: 'Prepare print-ready country-standard passport photos easily.',
    faqs: [
      { q: 'What country presets are available?', a: 'Presets include India (3.5x4.5cm), US (2x2in), UK/Europe (3.5x4.5cm), and more.' },
      { q: 'Can I print multiple copies?', a: 'Yes, the tool auto-tiles copies on standard A4 or 4x6 print sheets.' }
    ]
  },
  {
    path: 'govt-assistant',
    title: 'Govt Portal Photo Assistant Free - SSC, UPSC Image Presets | CompressKro',
    desc: 'Prepare photos and signatures for SSC, UPSC, IBPS, and JEE portals automatically. Auto-apply official portal dimension and KB size guidelines. Free and private.',
    heading: 'Govt Portal Photo Assistant',
    sub: 'Auto-configure image resizing for government job applications.',
    faqs: [
      { q: 'What exam portals are included?', a: 'Presets support SSC, UPSC, IBPS, SBI, JEE, NEET, and PAN/Aadhaar cards.' },
      { q: 'Are instructions updated?', a: 'Guidelines are synced with official exam notification catalogs.' }
    ]
  },

  {
    path: 'html-to-pdf',
    title: 'Compile HTML to PDF Online Free - Webpage to PDF | CompressKro',
    desc: 'Convert raw HTML code and web tags to PDF online for free. Clean layouts, printable margins, safe and private. 100% private.',
    heading: 'Compile HTML to PDF',
    sub: 'Compile raw HTML code or web page markup into standard printable PDF files.',
    faqs: [
      { q: 'What tags are supported?', a: 'We support headings, paragraphs, bullet points, line breaks, and standard text structures.' },
      { q: 'Is CSS styling applied?', a: 'Yes, simple CSS layouts are translated into printable margins and page boundaries.' }
    ]
  },

  {
    path: 'extract-images',
    title: 'Extract Images from PDF Online Free - Image Extractor | CompressKro',
    desc: 'Extract embedded photos, screenshots, and graphic assets from PDF online for free into a ZIP file. 100% private.',
    heading: 'Extract Images from PDF',
    sub: 'Scan and extract embedded photos and graphics from a PDF document.',
    faqs: [
      { q: 'Does extraction reduce image quality?', a: 'No, image files are extracted as raw streams directly from the PDF without re-compression.' },
      { q: 'Are vector graphic layers extracted?', a: 'No, only actual inline photo elements (JPEG/PNG) are extracted by the scanner.' }
    ]
  },

  {
    path: 'crop-pdf',
    title: 'Crop PDF Online Free - Trim PDF Margins | CompressKro',
    desc: 'Crop PDF pages online for free. Adjust margins visually with preview controls. 100% client-side in-browser canvas tool.',
    heading: 'Crop PDF Pages',
    sub: 'Trim page margins and define custom boundaries visually.',
    faqs: [
      { q: 'Does cropping reduce file bytes?', a: 'No, it defines new viewport dimensions. The elements still exist in raw structures but standard readers hide them.' },
      { q: 'Is this process private?', a: 'Yes, editing coordinates runs entirely inside your client browser.' }
    ]
  },
  {
    path: 'html-to-image',
    title: 'HTML or URL to Image Online Free - Screenshot Capture | CompressKro',
    desc: 'Convert raw HTML code or complete web URLs into high-quality JPEG or PNG images online for free. Custom viewport sizes, full page capture. Secure.',
    heading: 'HTML or URL to Image Converter',
    sub: 'Convert HTML code markup or capture entire webpage links into clean, high-fidelity images.',
    faqs: [
      { q: 'What does Full Page capture do?', a: 'It captures the entire scrollable height of the webpage, outputting it as a single tall screenshot image.' },
      { q: 'What format should I select?', a: 'Use PNG for text-heavy code captures to preserve sharp pixels, and JPEG for image-heavy screenshots to get smaller file sizes.' }
    ]
  },
  {
    path: 'edit-image',
    title: 'Pro Image Editor Online Free - Edit Photo Canvas | CompressKro',
    desc: 'Edit your photos online for free. Adjust brightness, contrast, saturations, apply preset style filters, rotate, flip, draw annotations, add text overlays, or crop bounds visually. 100% private in-browser canvas editor.',
    heading: 'Pro Image Editor',
    sub: 'Visual adjustment sliders, preset filters, drawings, text overlays, and crop bounding boxes.',
    faqs: [
      { q: 'What filters can I apply?', a: 'You can choose between Monochrome, Sepia, Invert, Vintage, Cool, Dramatic, and Polaroid presets.' },
      { q: 'Is drawing editable?', a: 'You can draw custom lines and brush annotations, and use the Undo/Redo controls to step back/forward through individual drawing operations.' }
    ]
  },
  {
    path: 'remove-bg',
    title: 'Remove Image Background Free Online - Transparency Keyer | CompressKro',
    desc: 'Erase solid backgrounds from images online for free. Convert white, black, or custom backdrops to transparent pixels locally. Easy, fast, and secure.',
    heading: 'Remove Solid Background',
    sub: 'Erase solid color backdrops from signatures, logos, or portrait photos.',
    faqs: [
      { q: 'Can I pick any background color?', a: 'Yes. The tool auto-detects background colors, or you can click anywhere on the image to sample a custom shade.' },
      { q: 'Does this upload images to a server?', a: 'No. Background color segmentation runs entirely in your browser client canvas memory.' }
    ]
  },
  {
    path: 'remove-background',
    title: 'AI Background Remover Free Online - Transparent PNG Cutout | CompressKro',
    desc: 'Erase backgrounds from images automatically online for free. AI-assisted portrait, animal, and product segmentation models. 100% secure.',
    heading: 'AI Background Remover',
    sub: 'Erase backgrounds from images automatically using neural network models.',
    faqs: [
      { q: 'What models are supported?', a: 'We support ISNet-general-use, U2Net standard portrait, and lightweight U2Netp models.' },
      { q: 'Is my data secure?', a: 'Yes. Files process inside an isolated sandboxed backend and are automatically deleted immediately after download.' }
    ]
  }
];

routes.forEach((route) => {
  const routeDir = path.join(DIST_DIR, route.path);
  if (!fs.existsSync(routeDir)) {
    fs.mkdirSync(routeDir, { recursive: true });
  }

  // Construct structured data FAQPage
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': route.faqs.map(f => ({
      '@type': 'Question',
      'name': f.q,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': f.a
      }
    }))
  };

  // Compile prerender content shell inside #root for SEO indexation
  const seoContentHtml = `
    <noscript>
      <style>
        .prerender-shell { display: block !important; }
      </style>
    </noscript>
    <div class="prerender-shell p-6 max-w-4xl mx-auto space-y-8" style="display: none; font-family: sans-serif; color: #334155; line-height: 1.6;">
      <header class="space-y-2">
        <h1 style="font-size: 2.25rem; font-weight: 800; color: #0f172a; margin-bottom: 0.5rem;">${route.heading}</h1>
        <p style="font-size: 1.125rem; color: #475569;">${route.sub}</p>
      </header>

      <section class="steps-section" style="margin-top: 2rem;">
        <h2 style="font-size: 1.5rem; font-weight: 700; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem;">How to Use this Tool</h2>
        <ol style="margin-top: 1rem; padding-left: 1.5rem;">
          <li style="margin-bottom: 0.5rem; font-weight: 600;">Upload your target file into the tool drops area.</li>
          <li style="margin-bottom: 0.5rem; font-weight: 600;">Configure operations settings, page targets, or formatting parameters.</li>
          <li style="margin-bottom: 0.5rem; font-weight: 600;">Click the process button and download the compiled file.</li>
        </ol>
      </section>

      <section class="faqs-section" style="margin-top: 3rem;">
        <h2 style="font-size: 1.5rem; font-weight: 700; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem;">Frequently Asked Questions (FAQ)</h2>
        <div style="margin-top: 1.5rem; space-y-4;">
          ${route.faqs.map(f => `
            <div style="margin-bottom: 1.5rem;">
              <h3 style="font-size: 1.125rem; font-weight: 600; color: #0f172a; margin-bottom: 0.25rem;">${f.q}</h3>
              <p style="color: #475569;">${f.a}</p>
            </div>
          `).join('')}
        </div>
      </section>

      <footer style="margin-top: 4rem; padding-top: 2rem; border-t: 1px solid #e2e8f0; text-align: center; font-size: 0.875rem; color: #94a3b8;">
        &copy; ${new Date().getFullYear()} CompressKro. Free client-side document compiler tools.
      </footer>
    </div>
  `;

  // Inject meta tags, canonical path, and pre-render content shell
  let outputHtml = template
    .replace(
      /<title>.*?<\/title>/,
      `<title>${route.title}</title>`
    )
    .replace(
      /<meta name="description" content=".*?" \/>/,
      `<meta name="description" content="${route.desc}" />`
    )
    .replace(
      `<head>\n    <link rel="canonical" href="https://compresskro.vercel.app/${route.path}" />\n    <script type="application/ld+json">\n      ${JSON.stringify(faqSchema, null, 2)}\n    </script>`
    )
    .replace(
      '<div id="root"></div>',
      `<div id="root">${seoContentHtml}</div>`
    );

  const outputPath = path.join(routeDir, 'index.html');
  fs.writeFileSync(outputPath, outputHtml, 'utf8');
  console.log(`✓ Pre-rendered static path: /${route.path}`);
});

console.log('\n🌟 Static SEO pre-rendering complete!');
