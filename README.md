# CompressKro

> **One Platform for All Your File Optimization Needs**
> *Compress. Convert. Resize. Optimize. All in One Place.*

CompressKro is a modern, privacy-first web application for compressing, resizing, converting, and optimizing files. Most image operations run locally inside your browser, while advanced PDF optimization is securely processed in-memory without permanent storage.

---

## 🚀 Features (Phase 1 MVP)

| Feature | Status | Description |
|---|---|---|
| **Image Compressor** | ✅ Done | Exact KB target, quality slider, or scale %. Binary-search algorithm. |
| **Image Resizer** | ✅ Done | Custom px, preset names (Passport, Aadhaar, LinkedIn, etc.). |
| **Format Converter** | ✅ Done | PNG ↔ JPG ↔ WebP, HEIC → JPG, Image → PDF |
| **Passport Photo Maker** | ✅ Done | Align photo against crop guides, white background, exact KB output |
| **PDF Tools** | ✅ Done | Merge, Split, Rotate, Reorder, Delete pages, Images → PDF |
| **Govt Portal Assistant** | ✅ Done | One-click presets for UPSC, SSC, Passport India, PAN, Aadhaar |
| **Dark Mode** | ✅ Done | Toggle light/dark. Defaults to dark. |
| **Batch Processing** | ✅ Done | Multi-file upload for compression & conversion |

---

## 🏗️ Architecture

```
CompressKro/
├── frontend/           # React + TypeScript + Vite + Tailwind CSS v4
│   └── src/
│       ├── App.tsx                    # Main shell (sidebar, routing, dark mode)
│       ├── components/
│       │   ├── Dashboard.tsx          # Stats, quick access, drag-and-drop
│       │   ├── ImageCompressor.tsx    # Binary-search KB compression
│       │   ├── ImageResizer.tsx       # Dimension scaling with presets
│       │   ├── ImageConverter.tsx     # Multi-format conversion (HEIC via heic2any)
│       │   ├── PassportMaker.tsx      # Passport photo with alignment guides
│       │   ├── PdfTools.tsx           # Merge / Split / Rotate / Images→PDF
│       │   └── GovtAssistant.tsx      # Portal-specific requirement presets
│       └── index.css                  # Tailwind v4 + glassmorphism utilities
└── backend/            # Node.js + Express
    └── server.js       # PDF compression, HEIC fallback, server-side compress
```

---

## ⚡ Signature Feature — Exact KB Compression

Instead of manually selecting quality levels, users enter a target file size (e.g. 50 KB). The **Binary Search Algorithm** automatically finds the optimal JPEG quality that stays under the limit while preserving the maximum possible visual quality.

```
High Quality → file too big? ↓ halve quality
Low Quality  → file too small? ↑ double quality
Binary Search converges in ~8 iterations
```

---

## 🔒 Privacy First Architecture

- **Local Processing:** Most image operations and standard PDF utility tools (merge, split, rotate) run 100% locally in your browser via HTML5 Canvas API and `pdf-lib`.
- **Transient Server Processing:** Heavy PDF optimizations and server fallbacks process files in temporary RAM (`multer.memoryStorage()`) and return results immediately.
- **Zero Permanent Storage:** No files are stored to disk or kept in a database.
- **No Accounts & No Telemetry:** No user registration or tracking history.

---

## 🛠️ Tech Stack

| Layer | Tools |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS v4 |
| Icons | Lucide React |
| PDF (client) | pdf-lib |
| HEIC (client) | heic2any |
| Animations | canvas-confetti |
| Fonts | Outfit + Inter (Google Fonts) |
| Backend | Node.js, Express, Sharp, multer |

---

## 🏃 Running Locally

```bash
# Start the frontend dev server
cd frontend
npm run dev
# → http://localhost:5173

# Start the backend (optional, for server-side HEIC & PDF compress fallback)
cd backend
npm run dev
# → http://localhost:3001
```

---

## 🗺️ Roadmap

- **Phase 2**: Batch processing UI, PDF compression via backend Sharp, Background removal
- **Phase 3**: Video compression (FFmpeg), OCR (Tesseract), AI enhancement, Browser extension
