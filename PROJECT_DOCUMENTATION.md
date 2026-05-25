# QPaper Gen — Complete Project Documentation

> **Living document** — This file describes the complete purpose, architecture, working, and feature set of the Question Paper Generator project. It is kept up-to-date with every code change so the codebase never needs to be re-analysed from scratch.

> **Last updated:** 2026-05-24

---

## Table of Contents

1.  [Purpose & Overview](#1-purpose--overview)
2.  [Tech Stack](#2-tech-stack)
3.  [Project File Structure](#3-project-file-structure)
4.  [Architecture & Data Flow](#4-architecture--data-flow)
5.  [Application Bootstrap](#5-application-bootstrap)
6.  [Routing & Navigation](#6-routing--navigation)
7.  [Pages — Detailed Breakdown](#7-pages--detailed-breakdown)
    - 7.1 [Home Page (/)](#71-home-page-)
    - 7.2 [Dashboard (/papers)](#72-dashboard-papers)
    - 7.3 [Generate Wizard (/new)](#73-generate-wizard-new)
    - 7.4 [View Paper (/paper/:id)](#74-view-paper-paperid)
    - 7.5 [Source Material (/sources)](#75-source-material-sources)
    - 7.6 [Settings (/settings)](#76-settings-settings)
8.  [Services — Detailed Breakdown](#8-services--detailed-breakdown)
    - 8.1 [pdfService.ts — Core Engine](#81-pdfservicets--core-engine)
    - 8.2 [lmStudioService.ts — AI Integration](#82-lmstudioservicets--ai-integration)
    - 8.3 [stemTextCleaner.ts — Unicode/Mojibake Cleaning](#83-stemtextcleanerts--unicodemojibake-cleaning)
    - 8.4 [sourceService.ts — Source Material Library](#84-sourceservicets--source-material-library)
    - 8.5 [templateService.ts — Paper Templates](#85-templateservicets--paper-templates)
    - 8.6 [exportPdf.ts — PDF Export](#86-exportpdfts--pdf-export)
    - 8.7 [db.ts — IndexedDB Layer](#87-dbts--indexeddb-layer)
9.  [Web Worker — PDF Extraction](#9-web-worker--pdf-extraction)
10. [PDF Processing Pipeline](#10-pdf-processing-pipeline)
11. [Content Analysis Pipeline](#11-content-analysis-pipeline)
12. [Question Generation](#12-question-generation)
13. [AI / LM Studio Integration](#13-ai--lm-studio-integration)
14. [STEM Subject Support](#14-stem-subject-support)
15. [Data Storage & Persistence](#15-data-storage--persistence)
16. [UI Component Library & Theming](#16-ui-component-library--theming)
17. [Key Interfaces & Types](#17-key-interfaces--types)
18. [Constants & Limits](#18-constants--limits)
19. [Feature Inventory](#19-feature-inventory)
20. [Known Limitations](#20-known-limitations)
21. [Supabase Edge Function (Unused)](#21-supabase-edge-function-unused)
22. [Auxiliary Files & Documentation](#22-auxiliary-files--documentation)
23. [Change Log](#23-change-log)

---

## 1. Purpose & Overview

**QPaper Gen** is a fully local, AI-powered question paper generator built with React + TypeScript. It allows educators to:

1. **Upload** a textbook PDF
2. **Define** the exam paper structure (sections, question types, marks, difficulty)
3. **Generate** a professionally formatted, print-ready question paper

The application runs **entirely in the browser** — no server, no cloud accounts, no data ever leaves the user's machine. AI-powered question generation is handled by an optional local LM Studio connection (OpenAI-compatible API on `localhost`).

### Core Workflow

```
Upload PDF  →  Extract Text (Worker / Main Thread)
     ↓
Scanned PDF?  →  Tesseract.js OCR (up to 50 pages)
     ↓
STEM Subject?  →  cleanStemText() (fix mojibake)
     ↓
Content Analysis (keywords, topics, definitions, facts, stemProblems)
     ↓
Define Structure (sections, types, marks, difficulty, tags)
     ↓
Generate Questions:
  ├─ LM Studio enabled?  →  AI generation (per-section prompts)
  └─ Disabled / fails?   →  Template-based fallback
     ↓
Review Paper  →  Inline Edit  →  Shuffle  →  Regenerate Section
     ↓
Export PDF / Print  →  Optional Answer Key
```

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **UI Framework** | React + TypeScript | 18.3.1 |
| **Routing** | React Router | 7.13.0 |
| **Styling** | Tailwind CSS | 4.1.12 |
| **Component Library** | Radix UI (shadcn/ui pattern) | Various |
| **Icons** | Lucide React | 0.487.0 |
| **Animations** | Motion (Framer Motion) | 12.23.24 |
| **PDF Extraction** | pdfjs-dist | 5.6.205 |
| **OCR (scanned PDFs)** | Tesseract.js | 7.0.0 |
| **PDF Export** | jsPDF | 4.2.1 |
| **Local AI** | LM Studio (OpenAI-compatible REST) | External |
| **Primary Storage** | IndexedDB (`qpg` database) | Browser API |
| **Settings Storage** | localStorage | Browser API |
| **Build Tool** | Vite | 6.4.2 |
| **Package Manager** | pnpm | — |
| **Class Utilities** | clsx + tailwind-merge | 2.1.1 / 3.2.0 |
| **Toasts** | Sonner | 2.0.3 |
| **Drag & Drop** | react-dnd + HTML5 Backend | 16.0.1 |

---

## 3. Project File Structure

```
Question Paper Generator/
│
├── src/
│   ├── main.tsx                          ← Bootstrap: initDB() → seed stores → render App
│   ├── styles/
│   │   ├── index.css                     ← CSS entry point
│   │   ├── theme.css                     ← "Forest Mist" dark theme (Tailwind v4 syntax)
│   │   └── fonts.css                     ← Google Fonts: DM Sans, Playfair Display
│   ├── imports/                          ← Static assets
│   └── app/
│       ├── App.tsx                       ← Root: <RouterProvider router={router} />
│       ├── Layout.tsx                    ← Sidebar + top bar shell (Forest Mist theme)
│       ├── routes.tsx                    ← All 6 route definitions
│       │
│       ├── pages/
│       │   ├── Home.tsx                  ← Landing page (/)
│       │   ├── Dashboard.tsx             ← Papers list (/papers)
│       │   ├── Generate.tsx              ← 3-step paper generation wizard (/new)
│       │   ├── ViewPaper.tsx             ← View / edit paper (/paper/:id)
│       │   ├── SourceMaterial.tsx        ← PDF library (/sources)
│       │   └── Settings.tsx              ← Profile, prefs, LM Studio config (/settings)
│       │
│       ├── components/
│       │   ├── LMStudioSettings.tsx      ← Legacy standalone LM Studio config panel
│       │   ├── figma/                    ← Figma-imported components
│       │   └── ui/                       ← 49 shadcn/ui-style Radix UI wrappers
│       │
│       ├── services/
│       │   ├── pdfService.ts             ← Core engine: PDF extraction, analysis, generation (51KB)
│       │   ├── lmStudioService.ts        ← AI integration, prompts, parsing (19KB)
│       │   ├── stemTextCleaner.ts        ← Unicode/mojibake cleaning for STEM PDFs
│       │   ├── sourceService.ts          ← Source material CRUD, dedup, stats
│       │   ├── templateService.ts        ← Template CRUD, built-in templates
│       │   ├── exportPdf.ts              ← jsPDF A4 paper rendering + answer key
│       │   ├── db.ts                     ← IndexedDB layer + localStorage migration
│       │   └── _llm_patch.txt            ← LLM patch notes (internal)
│       │
│       └── workers/
│           └── pdfExtract.worker.ts      ← Web Worker for off-thread PDF extraction
│
├── utils/
│   ├── cn.ts                             ← clsx + tailwind-merge utility
│   └── supabase/info.tsx                 ← Supabase config
├── supabase/
│   ├── config.toml                       ← Supabase local config
│   └── functions/server/                 ← Edge function for OpenAI generation (unused)
├── guidelines/                           ← Development conventions
│
├── index.html                            ← Vite entry HTML
├── vite.config.ts                        ← Vite config (aliases, worker format, optimized deps)
├── package.json                          ← Dependencies
├── PROJECT_DOCUMENTATION.md              ← THIS FILE
└── README.md, CHANGELOG.md, etc.
```

---

## 4. Architecture & Data Flow

### Layered Architecture

```
┌─────────────────────────────────────────────────────┐
│                    PAGES (UI)                        │
│  Home │ Dashboard │ Generate │ ViewPaper │ Sources │ Settings │
├─────────────────────────────────────────────────────┤
│                 COMPONENTS                           │
│   49 Radix/shadcn UI wrappers + Forest Mist Layout  │
├─────────────────────────────────────────────────────┤
│                  SERVICES                            │
│  pdfService │ lmStudioService │ sourceService │     │
│  templateService │ exportPdf │ stemTextCleaner       │
├─────────────────────────────────────────────────────┤
│              PERSISTENCE LAYER                       │
│         db.ts (IndexedDB + in-memory cache)          │
│         localStorage (settings, templates, profile)  │
├─────────────────────────────────────────────────────┤
│               WEB WORKER                             │
│         pdfExtract.worker.ts (off-thread PDF.js)     │
└─────────────────────────────────────────────────────┘
```

### Data Flow on Startup

1. `main.tsx` calls `initDB()` → opens IndexedDB (`qpg`, v1).
2. Runs migration from legacy `localStorage` keys to IndexedDB.
3. Loads all data into memory and calls `initPaperStore(papers)` and `initSourceStore(sources)` to seed the services.
4. Renders `<App />`.

---

## 5. Application Bootstrap

**File:** `src/main.tsx`

```tsx
// Simplified boot sequence
await initDB().then(({ papers, sources }) => {
  initPaperStore(papers);
  initSourceStore(sources);
});

createRoot(document.getElementById('root')!).render(
  <App />
);
```

---

## 6. Routing & Navigation

**File:** `src/app/routes.tsx`

| Path | Component | Description |
|---|---|---|
| `/` | `Home` | Landing page / dashboard summary |
| `/papers` | `Dashboard` | List of generated papers |
| `/new` | `Generate` | 3-step paper generation wizard |
| `/paper/:id` | `ViewPaper` | View, edit, shuffle, export a paper |
| `/sources` | `SourceMaterial` | PDF library |
| `/settings` | `Settings` | App configuration |

### Sidebar Navigation (Layout.tsx)

The app uses a "Forest Mist" dark theme layout. The sidebar has a glassmorphic design (`backdrop-filter: blur(16px)`).

| Icon | Label | Route |
|---|---|---|
| 🏠 House | Home | `/` |
| 📄 FileText | Question Papers | `/papers` |
| 📚 BookOpen | Source Material | `/sources` |
| ⚙️ Settings | Settings | `/settings` |

**Features:**
- User card at the bottom displaying user initials/avatar, reading from `qpg_profile` in localStorage (defaults to "Jane Doe" / "Teacher Account").

---

## 7. Pages — Detailed Breakdown

### 7.1 Home Page (`/`)
**File:** `src/app/pages/Home.tsx`
- **Greeting**: Time-based + user's first name.
- **Stats strip**: 4-card grid (Question Papers, Source PDFs, Questions Made, Total Marks).
- **Quick actions**: CTAs to generate a new paper or browse the source library.
- **Recent Papers**: Displays the 3 most recently created papers.

### 7.2 Dashboard (`/papers`)
**File:** `src/app/pages/Dashboard.tsx`
- **Paper cards**: Title, subject, creation date, metrics, tags.
- **Search bar**: Live filter across multiple fields.
- **Tag filter**: Click tags to filter additively with search.
- **Sort & Delete**: Sort by date/title/marks, delete with confirmation.

### 7.3 Generate Wizard (`/new`)
**File:** `src/app/pages/Generate.tsx`
- **Step 1 (Upload)**: Drag & drop PDF, 50MB max. Integrates with `/sources`.
- **Step 2 (Structure)**: Define sections, template picker, LM Studio status, tag input.
- **Step 3 (Generate)**: 4-stage animated progress bar, auto-redirect on completion.

### 7.4 View Paper (`/paper/:id`)
**File:** `src/app/pages/ViewPaper.tsx`
- **Viewing & Editing**: Inline editing via hover actions (pencil/trash).
- **Section Controls**: Shuffle section questions, or Regenerate section via LM Studio.
- **Global Actions**: Shuffle all, toggle Answer Key visibility, Print, Export to PDF (with or without answers).

### 7.5 Source Material (`/sources`)
**File:** `src/app/pages/SourceMaterial.tsx`
- **Library**: Upload once, dedup via size/name checking.
- **Management**: Source cards, inline renaming, "Papers generated" linked chips.
- **Generation**: Quick "Generate" button that bypasses re-extraction.

### 7.6 Settings (`/settings`)
**File:** `src/app/pages/Settings.tsx`
- **User Profile**: Display name and role (saves to `qpg_profile`).
- **Default Preferences**: Duration, marks/Q, difficulty (saves to `qpg_prefs`).
- **LM Studio**: Connection config (saves to `lmStudioConfig`).
- **Danger Zone**: 4 destructive actions with two-step confirmation.

---

## 8. Services — Detailed Breakdown

### 8.1 `pdfService.ts` — Core Engine
**File:** `src/app/services/pdfService.ts` (51KB)
- **Extraction**: `extractTextFromPDF` orchestrates the Worker, main-thread fallback, and OCR fallback.
- **Analysis**: Extracts keywords, topics, definitions, facts, concepts, sentences, and stemProblems. Samples up to 100,000 characters.
- **Generation**: `generateQuestions` routes to `generateQuestionsWithLLM` or fallback template generators (`makeTFQuestion`, `makeFITBFromSentence`, etc.).
- **CRUD**: Caches and updates papers.

### 8.2 `lmStudioService.ts` — AI Integration
**File:** `src/app/services/lmStudioService.ts`
- **Prompts**: `buildPrompt` constructs a context-aware prompt injecting STEM rules, Bloom's Taxonomy guidance, and textbook extracts.
- **Sampling**: `samplePdfText` uses density scoring (numbers ×2, symbols ×4, units ×3) for STEM subjects to pick the most relevant paragraphs.
- **Parsing**: `parseQuestions` attempts JSON parsing, falling back to line-by-line parsing if < 50% of expected questions are extracted.

### 8.3 `stemTextCleaner.ts` — Unicode/Mojibake Cleaning
**File:** `src/app/services/stemTextCleaner.ts`
- Cleans Windows-1252 mojibake (e.g. `â€"` → `–`).
- Fixes math operators and Greek letters mangled by PDF.js.
- Strips control characters.

### 8.4 `sourceService.ts` — Source Material Library
**File:** `src/app/services/sourceService.ts`
- Caches and persists source metadata and extracted text.
- Provides storage statistics and deduplication logic.

### 8.5 `templateService.ts` — Paper Templates
**File:** `src/app/services/templateService.ts`
- Manages 4 built-in presets (Standard MCQ, Mixed Format, Quick Quiz, Comprehensive Final).
- Saves user templates to localStorage.

### 8.6 `exportPdf.ts` — PDF Export
**File:** `src/app/services/exportPdf.ts`
- Generates A4-formatted exam papers using jsPDF.
- Supports 2-column MCQ grids, short answer lines, page numbers, and optional Answer Key pages.

### 8.7 `db.ts` — IndexedDB Layer
**File:** `src/app/services/db.ts`
- `qpg` database, version 1.
- `papers` and `sources` object stores.
- Handles one-time migration from legacy localStorage keys.

---

## 9. Web Worker — PDF Extraction

**File:** `src/app/workers/pdfExtract.worker.ts`
- Extracts PDF text off the main thread.
- Processes pages in batches of 10 (`PAGE_BATCH = 10`).
- Cap: `MAX_CHARS_PER_PAGE = 5,000`.
- Posts progress (`{ type: 'progress' }`) and results back to `pdfService`.

---

## 10. PDF Processing Pipeline

```
File selected (max 50MB, .pdf only)
     ↓
ArrayBuffer transferred to Web Worker (zero-copy)
     ↓
pdfjs extracts text page by page in batches
     ↓
Pages with < 60 chars or copyright/TOC/index text → SKIPPED
     ↓
If Worker unavailable → main-thread fallback
     ↓
If extracted text < 200 chars → scanned PDF detected
     ↓
Tesseract.js OCR (page-by-page, up to 50 pages)
     ↓
cleanStemText() applied for STEM subjects (fix mojibake)
     ↓
Content analysis on up to 100,000 chars
```

---

## 11. Content Analysis Pipeline

**Function:** `analyzeContent(text, subject?)` in `pdfService.ts`

| Category | Description | Strategy |
|---|---|---|
| **Keywords** | Important terms | Frequency analysis, filter stopwords, keep 3+ occurrences. |
| **STEM Terms** | DNA, RNA, ATP, pH | Injected via regex matching for STEM subjects. |
| **Topics** | Capitalized concepts | Extracts multi-word capitalized phrases. |
| **Definitions** | Definitional sentences | Matches "is defined as", "refers to", "means". |
| **Facts** | Data-bearing statements | Matches percentages, "research shows". |
| **Numerical Facts** | STEM data | Sentences with units (kg, N, Pa) or scientific notation. |
| **Stem Problems** | Exercise sentences | Matches "Find", "Calculate", "Prove", "Derive". |

---

## 12. Question Generation

### Mode 1: AI-Powered (LM Studio)
Higher quality, context-aware generation using the local LM Studio instance. Strict prompts prevent hallucination and inject Bloom's Taxonomy.

### Mode 2: Template-Based (Fallback)
If LM Studio is disabled or fails:
- **MCQ**: Definition-based stems with co-occurring keywords as distractors.
- **T/F**: Extracted sentences, occasionally negated or number-flipped for False.
- **Short Answer**: Bloom's verbs + facts/definitions.
- **Fill Blanks**: Extracted sentences with keywords replaced by `_____`.

---

## 13. AI / LM Studio Integration

### Config
- LocalStorage key `lmStudioConfig`. Defaults to `http://localhost:1234/v1`, 2048 tokens, 6000 context chars.

### Error Handling
- 120s timeout.
- HTTP 500/503 mapped to "Out of memory" user messages.
- Empty responses handled gracefully.
- **No silent fallback**: Users are explicitly notified if generation fails.

---

## 14. STEM Subject Support

- **Detection**: `classifySubject` matches keywords ("calculus", "physics") or scans the first 5000 chars with regex.
- **Cleaning**: `cleanStemText` fixes greek letters and math operators.
- **Sampling**: Paragraphs with high density of digits, math symbols, and units are prioritized for the LLM prompt.
- **Prompt Rules**: Inject subject-specific instructions (e.g. "Focus on SI units for Physics").

---

## 15. Data Storage & Persistence

- **IndexedDB**: The `qpg` database stores `papers` and `sources` (including large extracted text up to 300K chars per paper for regeneration).
- **LocalStorage**: Stores user settings (`qpg_profile`, `qpg_prefs`, `lmStudioConfig`, `qpg_templates`).

---

## 16. UI Component Library & Theming

- **Components**: 49 Radix UI wrapper components in `src/app/components/ui/` (shadcn pattern). Largest is `sidebar.tsx` (21KB).
- **Theme**: "Forest Mist" dark theme defined in `src/styles/theme.css` via Tailwind v4 `@theme` blocks.
  - Colors: `--fm-mist` (light text), `--fm-sage` (primary green), `--fm-fern` (medium green), `--fm-night` (background).
- **Fonts**: DM Sans (UI) and Playfair Display (Logo/Headings).

---

## 17. Key Interfaces & Types

```typescript
// Core Paper Structure
interface Paper {
  id: string;
  title: string;
  subject: string;
  duration: string;
  sections: PaperSection[];
  totalMarks: number;
  createdAt: string;
  sourceFileName?: string;
  sourcePdfText?: string;
  tags?: string[];
}

// Section
interface PaperSection {
  name: string;
  instructions: string;
  type: 'mcq' | 'true-false' | 'short-answer' | 'essay' | 'fill-blanks';
  questions: Question[];
}

// Question
interface Question {
  id: string;
  text: string;
  type: string;
  options?: string[];
  answer?: string;
  marks: number;
  difficulty: string;
}
```

---

## 18. Constants & Limits

| Constant | Value | Purpose |
|---|---|---|
| Max PDF file size | 50 MB | File upload limit |
| `MAX_CHARS_PER_PAGE` | 3,000 | Main thread page extraction limit |
| Worker Page Limit | 5,000 | Worker thread page extraction limit |
| `MAX_TOTAL_CHARS` | 5,000,000 | 5 MB total text cap |
| `ANALYSIS_SAMPLE_CHARS`| 100,000 | Analysis sample size |
| `MAX_OCR_PAGES` | 50 | Tesseract limit |
| Stored text cap | 300,000 | Retained text for section regeneration |

---

## 19. Feature Inventory

| Status | Feature |
|---|---|
| ✅ Done | PDF Upload & Web Worker Extraction |
| ✅ Done | OCR Fallback (Tesseract.js) |
| ✅ Done | STEM Analysis & Mojibake Cleaning |
| ✅ Done | Local AI Generation (LM Studio) |
| ✅ Done | Template-Based Generation Fallback |
| ✅ Done | Inline Editing & Section Regeneration |
| ✅ Done | jsPDF A4 Export & Answer Keys |
| ✅ Done | Dashboard (Search, Sort, Tags) |
| ✅ Done | Source Material Library (Deduplication) |
| ✅ Done | Forest Mist Dark Theme & UI Components |
| ✅ Done | IndexedDB Persistence |

---

## 20. Known Limitations

- **Scanned PDFs**: OCR works but is slow (~1-3 minutes).
- **Math Rendering**: MathML/LaTeX is not supported; equations appear as plain unicode text.
- **Local AI Speed**: Generating large papers sequentially via a local LLM takes time.
- **Storage Limits**: While IndexedDB is robust, huge libraries of textbook text can consume gigabytes over time.

---

## 21. Supabase Edge Function (Unused)

The project contains a `supabase/functions/server/` directory generated by Figma Make. It includes an Edge Function (`/make-server-66acca32/generate-questions`) designed to process PDFs and generate questions using the OpenAI `gpt-4o` API.
**Status**: It is completely unused by the current client-side app, which relies entirely on local processing and LM Studio.

---

## 22. Auxiliary Files & Documentation

- `README.md`: Public instructions.
- `CONTRIBUTING.md`: PR guidelines and coding standards.
- `FAQ.md`, `QUICKSTART.md`, `LM_STUDIO_SETUP.md`: Help materials.
- `guidelines/`: Contains internal UI/UX HTML-commented guidelines.

---

## 23. Change Log

### 2026-05-24 — Documentation Created
- Created `PROJECT_DOCUMENTATION.md` replacing the old `APP_OVERVIEW.md`.
- Analyzed entire codebase including the Forest Mist theme, Supabase Edge Function, Worker logic, and the new Home dashboard.
