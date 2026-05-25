# Changelog

All notable changes to the Question Paper Generator will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-05-24

### Fixed
- **Chapter title extraction** — chapter names in the Source Material library were showing as bare
  `"Chapter 1"` / `"Unit 2"` instead of the actual title (e.g. `"Chapter 1: Atoms and Molecules"`).
  Root cause: the PDF text was a flat space-joined blob with no line breaks, so the title-extraction
  logic had nothing to read. Two-part fix:
  1. `pdfService.ts` and `pdfExtract.worker.ts` now use pdfjs's `hasEOL` flag on each text item to
     emit real `\n` characters, preserving the visual line structure of the PDF.
  2. `extractChapterTitle()` reads the next non-empty line after each chapter marker and applies
     proper Title Case formatting (ALL-CAPS headings are converted to readable case).
- **LM Studio generation timeout** — large prompts (10+ questions, STEM subjects, 6000 context chars)
  would silently hang for 2–5 minutes and then fail with a timeout error.
  Root cause: `stream: false` made the app wait in silence for the entire response before receiving
  any data, allowing the browser's connection idle timer to fire.
  Fix: switched `callLLM()` to `stream: true` (Server-Sent Events). Tokens arrive continuously so
  the connection stays alive regardless of model speed. Hard abort raised from 120 s → 10 minutes.

### Changed
- `callLLM()` now reads the SSE stream incrementally and accepts an optional `onChunk` callback for
  future live streaming UI.
- Elapsed-time counter added to the Step 3 generating screen — shows `5s`, `1m 23s`, etc. next to
  the "LM Studio Active" badge so users can see the model is working.
- `extractChapterTitle()` now handles three PDF layouts: inline colon separator, same-line dash
  separator, and title on its own next line.

## [1.0.0] - 2026-04-22

### Added
- Initial release of Question Paper Generator
- PDF upload and text extraction using PDF.js
- Intelligent content analysis:
  - Automatic filtering of non-educational pages (copyright, TOC, index, etc.)
  - Keyword extraction (words appearing 3+ times)
  - Topic and concept identification
  - Definition extraction from sentences
  - Fact extraction with data and percentages
- Multiple question types:
  - Multiple Choice Questions (MCQ) with 4 options
  - True/False statements
  - Short Answer questions
  - Essay/Long Answer questions
  - Fill in the Blanks questions
- Custom paper structure:
  - Define sections with custom names
  - Set question count per section
  - Configure marks per question
  - Set difficulty level (Easy, Medium, Hard)
- LM Studio integration:
  - OpenAI-compatible API endpoint support
  - Local AI-powered question generation
  - Automatic fallback to template-based generation
  - Connection testing and configuration UI
- Dashboard features:
  - View all generated papers
  - Search papers by title or subject
  - Delete unwanted papers
  - Quick access to paper details
- Print-ready paper view:
  - Professional formatting
  - Section headers with instructions
  - Proper question numbering
  - Total marks display
- Data persistence:
  - LocalStorage for paper storage
  - LM Studio configuration persistence
  - No backend required
- Modern UI:
  - Clean, intuitive interface
  - Radix UI components
  - Tailwind CSS styling
  - Responsive design
  - Progress indicators
  - Toast notifications

### Technical Details
- React 18.3.1
- TypeScript
- Tailwind CSS 4.1
- PDF.js 5.6.205
- React Router 7
- Vite 6.3.5
- OpenAI-compatible API format for LM Studio

### Documentation
- Comprehensive README.md with setup and usage instructions
- LM_STUDIO_SETUP.md with detailed LM Studio integration guide
- CONTRIBUTING.md with contribution guidelines
- MIT License
- Complete project documentation

### Known Limitations
- PDFs must contain actual text (scanned PDFs without OCR not supported in v1.0; OCR added in v1.1)
- Maximum PDF size: 50 MB
- LM Studio requires CORS to be enabled
- Works only in modern browsers with localStorage / IndexedDB support
- No cloud sync (local-only storage)

## [Unreleased]

### Planned Features
- Export to Word/PDF format
- Answer key generation
- Question bank/library system
- Multi-language support
- Image support in questions
- Batch processing for multiple PDFs
- Cloud sync option
- Collaborative editing
- More question types (matching, ordering, diagrams)
- OCR support for scanned PDFs
- Mobile app version
- Question difficulty estimation
- Bloom's taxonomy classification

---

## Version History

### Version Numbering
- **Major** (X.0.0): Breaking changes or major new features
- **Minor** (0.X.0): New features, backwards compatible
- **Patch** (0.0.X): Bug fixes, minor improvements

### Support
- Current version: 1.3.0
- Minimum browser requirements: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Node.js: 18+ required for development
