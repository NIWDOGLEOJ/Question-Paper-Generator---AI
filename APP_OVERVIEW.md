# QPaper Gen — Application Overview

> A fully local, AI-powered question paper generator built with React + TypeScript.  
> Upload a textbook PDF, define the structure, and get a professionally formatted exam paper — no cloud, no accounts, no data leaving your machine.

---

## Table of Contents

1. [What It Does](#1-what-it-does)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Pages & Navigation](#4-pages--navigation)
5. [Core Features](#5-core-features)
6. [AI / LM Studio Integration](#6-ai--lm-studio-integration)
7. [STEM Subject Support](#7-stem-subject-support)
8. [PDF Processing Pipeline](#8-pdf-processing-pipeline)
9. [Data Storage](#9-data-storage)
10. [Services Reference](#10-services-reference)
11. [Project Structure](#11-project-structure)
12. [Getting Started](#12-getting-started)
13. [Feature History](#13-feature-history)
14. [Known Limitations](#14-known-limitations)

---

## 1. What It Does

QPaper Gen takes a textbook PDF and produces a fully structured, print-ready exam paper in minutes.

**Core workflow:**

```
Upload PDF  →  Extract Text  →  Clean & Analyse Content
     ↓
Define Structure (sections, types, marks, difficulty)
     ↓
Generate Questions  →  LM Studio (AI)  or  Template Engine (fallback)
     ↓
Review Paper  →  Edit Inline  →  Export PDF / Print
```

Everything runs in the browser. No server, no API key, no internet required.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18.3.1 + TypeScript |
| Routing | React Router 7 |
| Styling | Tailwind CSS 4.1 |
| Component Library | Radix UI (full suite) |
| Icons | Lucide React |
| PDF Extraction | pdfjs-dist 5.6.205 (Worker + main-thread fallback) |
| OCR (scanned PDFs) | Tesseract.js 7 |
| PDF Export | jsPDF 4 |
| Local AI | LM Studio (OpenAI-compatible REST API) |
| Persistence | IndexedDB (primary) + localStorage (settings/templates) |
| Build Tool | Vite 6 |
| Package Manager | pnpm |

---

## 3. Architecture

```
src/
├── main.tsx                  ← Bootstrap: initialises IndexedDB, seeds in-memory stores
├── app/
│   ├── App.tsx               ← RouterProvider root
│   ├── Layout.tsx            ← Sidebar + top bar shell
│   ├── routes.tsx            ← All route definitions
│   ├── pages/                ← One file per page/route
│   ├── components/           ← Reusable UI components
│   ├── services/             ← All business logic (no UI)
│   └── workers/              ← Web Worker for off-thread PDF extraction
```

### Data flow

- On startup, `initDB()` loads all papers and sources from IndexedDB into in-memory arrays (`_papers`, `_sources`).
- All reads are synchronous (from memory). All writes go to IndexedDB asynchronously in the background.
- Settings (LM Studio config, user profile, prefs, templates) stay in `localStorage` — they're small and need instant sync.

---

## 4. Pages & Navigation

The sidebar has four nav items, all wired to real routes:

| Nav Item | Route | Description |
|---|---|---|
| Dashboard | `/` | Lists all generated papers with search and tag filtering |
| Question Papers | `/` | Currently same as Dashboard (planned: dedicated grid view) |
| Source Material | `/sources` | PDF library — upload once, reuse forever |
| Settings | `/settings` | Profile, LM Studio config, preferences, danger zone |

Additional routes:

| Route | Description |
|---|---|
| `/new` | 3-step paper generation wizard |
| `/paper/:id` | View, edit, and export a specific paper |

The sidebar user card (name + initials avatar) links to `/settings` and updates live when profile is saved.

---

## 5. Core Features

### Dashboard
- Lists all saved papers sorted by creation date
- **Search bar** — filters across title, subject, source filename, and all tags simultaneously
- **Tag filter** — click any tag chip to filter by it; search + tag filter combine
- Live result count with "no results" empty state
- Delete papers with a confirmation step

### Source Material Library (`/sources`)
- Upload a PDF once — text is extracted and stored in IndexedDB
- **Deduplication** — re-uploading the same file (same name + size) is detected and rejected
- **Inline editing** — rename the title or subject of any source in place
- Shows which papers were generated from each source (clickable chips)
- **Generate** button — navigates to `/new` with the source pre-loaded, skipping re-extraction entirely
- Storage usage indicator (KB / MB used)
- Search by title, filename, or subject

### Generate Wizard (`/new`)
Three steps:

**Step 1 — Upload Source**
- Drag-and-drop or click-to-browse PDF upload
- If arriving from Source Material, shows a green "loaded from library" banner instead (source text reused, no re-extraction)
- File name, size, and remove option displayed

**Step 2 — Paper Structure**
- Paper title, subject, duration inputs
- **Templates** — load a saved or built-in template to pre-fill all sections
- **Save as Template** — save the current section config for reuse
- LM Studio status banner: red warning if disabled, green confirmation if active
- Add / remove sections; per-section: name, question type, count, marks/Q, difficulty
- Live total questions + total marks display

**Step 3 — Generation**
- Animated progress with 4 stages: Extract → Analyse → Generate → Done
- Per-stage labels and progress bar
- Redirects to `/paper/:id` on completion

### View Paper (`/paper/:id`)

**Editing (inline, no modal):**
- Hover any question → pencil icon appears → click to edit text in an auto-grow textarea
- Hover any MCQ option → pencil icon → edit inline
- Delete individual questions (trash icon, hover to reveal)
- Add questions to any section (+ button at section bottom)
- All edits are in-memory; a "Save Changes" button pulses when unsaved

**Section controls (per section header):**
- **Shuffle** — Fisher-Yates randomise question order within that section
- **Regenerate** — re-send that section to LM Studio for fresh questions without touching the rest

**Global action bar:**
- **Shuffle All** — shuffles every section at once
- **Answer Key** toggle — reveals a green answer field per question for filling in correct answers
- **Print** — browser print dialog
- **Export PDF** — split button:
  - *Question Paper* — clean paper, no answers
  - *With Answer Key* — paper + a formatted answer key appended as final pages

### Paper Templates
- 4 built-in templates: Standard MCQ, Mixed Format (School), Quick Quiz, Comprehensive Final
- Save any custom section config as a named template
- Templates stored in `localStorage`; user templates show a delete button on hover

### PDF Export (jsPDF)
- Proper A4 layout with margins, sections, and page breaks
- MCQ options in a 2-column grid; True/False inline
- Answer lines for Short Answer sections
- Marks badge per question (right-aligned)
- Page numbers in footer (`Page N of M`)
- Answer key page: green header banner, questions grouped by section, `Q1.` labels

### Settings (`/settings`)

| Section | Contents |
|---|---|
| User Profile | Display name, role — shown in sidebar user card |
| Default Preferences | Default duration, marks/Q, difficulty for new papers |
| LM Studio / Local AI | Full connection config (see §6) |
| Storage & Data | Live counts of papers/sources/templates, storage usage, danger zone |

Danger zone actions (all require two-step confirmation):
- Clear all papers
- Clear source library
- Clear all templates
- Clear everything

---

## 6. AI / LM Studio Integration

LM Studio runs a local OpenAI-compatible server at `http://localhost:1234/v1`. The app calls `/chat/completions` with a structured prompt for each section.

### Configuration (Settings page)
| Field | Default | Notes |
|---|---|---|
| Enable toggle | Off | Must be turned on — no silent fallback |
| API URL | `http://localhost:1234/v1` | Change if port differs |
| API Token | (empty) | Most local setups don't need one |
| Model | (auto-detect) | Click ↻ to fetch loaded models |
| Max Tokens | 2048 | Increase for long essay sections |
| Context Chars | 6000 | PDF text sent per section |

### Quick Setup
1. Open LM Studio → load a model (3–8B recommended for speed)
2. Developer tab → Start Server → **enable CORS**
3. In app Settings → click ↻ (auto-detect models) → Test Connection → Save

### Prompt Engineering
Each section gets its own prompt built by `buildPrompt()`:
- Bloom's Taxonomy level injected (Easy = Remember/Understand, Medium = Apply/Analyse, Hard = Evaluate/Create)
- Subject-specific rules for physics, chemistry, maths, biology (see §7)
- Symbol/formula handling guidance for corrupted PDF text
- Extracted "stem problems" from the PDF injected as inspiration examples
- Strict output format instructions with a worked example
- Hard rule: if a formula is garbled, ask a conceptual question — never invent values

### Error handling
- **No silent fallback** — if LM Studio is enabled but fails, the error is surfaced with a clear message
- **Streaming mode** (`stream: true`) — tokens arrive token-by-token over SSE so the HTTP connection
  stays alive indefinitely; no browser idle-connection timeout fires regardless of model speed
- 10-minute hard abort per request (safety net only; streaming prevents normal timeouts)
- Status 500/503 mapped to a user-friendly OOM explanation
- Empty response mapped to a helpful "model ran out of memory" message
- **Elapsed-time counter** shown in the Step 3 UI (`5s`, `1m 23s`, …) so users can see the model is
  actively working

---

## 7. STEM Subject Support

### Subject Classification
`classifySubject()` detects the subject in two steps:
1. Keyword match on the subject string the user typed ("physics", "calculus", etc.)
2. If ambiguous, content-scan the first 5000 chars of the PDF using regex signals per discipline

### STEM Text Cleaning (`stemTextCleaner.ts`)
pdfjs frequently mangles math symbols when extracting PDFs. Before analysis and before sending to the LLM, the text passes through `cleanStemText()` which fixes:
- Common Windows-1252 / Latin-1 mojibake (`â€"` → `–`, `Â°` → `°`)
- Math operator mojibake (`âˆ«` → `∫`, `âˆš` → `√`, `â‰¤` → `≤`)
- Greek letter mojibake (`Î±` → `α`, `Î²` → `β`, `Ï€` → `π`)
- Superscript digits (`Â²` → `^2`, `Â³` → `^3`)
- Non-printable control characters

### STEM-Aware Content Sampling
For STEM subjects, instead of a naive begin/mid/end spread, every paragraph is scored by density of:
- Numeric digits (×2 weight)
- Mathematical symbols (×4 weight)
- Scientific unit strings like `kg`, `mol`, `V`, `Hz` (×3 weight)

The highest-density paragraphs are sent to the LLM, ensuring it sees the actual equations and worked examples rather than the preface.

### Stem Problems Extraction
`analyzeContent()` extracts sentences matching patterns like:
> "Find the velocity of...", "Prove that...", "Calculate the...", "Derive the expression for..."

These are injected into the prompt as *"Example Problems from the Textbook"* so the LLM generates questions in the same style as the book's exercises.

### Discipline-Specific Prompts
Each STEM subject gets a dedicated rules block in the prompt:

| Subject | Examples |
|---|---|
| **Physics** | "State and prove", "Derive the expression for", "What is the SI unit of", MCQ distractors use wrong units/quantities |
| **Chemistry** | "Write the balanced equation for", "Explain the mechanism of", distractors use wrong oxidation states |
| **Mathematics** | "Solve", "Prove that", "Find the value of", distractors use common calculation errors (sign errors, wrong formula variants) |
| **Biology** | "Describe the role of", "Distinguish between", "Describe with diagrams", distractors are anatomically plausible |

---

## 8. PDF Processing Pipeline

```
File selected
     ↓
ArrayBuffer transferred to Web Worker (zero-copy)
     ↓
pdfjs extracts text page by page in batches of 10
Each item's `hasEOL` flag is checked — if true, a real \n is emitted
preserving the visual line structure of the PDF
     ↓
Pages with < 60 chars or copyright text are skipped
     ↓
If Worker unavailable → main-thread fallback (same logic)
     ↓
If extracted text < 200 chars → scanned PDF detected
     ↓
Tesseract.js OCR (page-by-page, up to 50 pages)
     ↓
cleanStemText() applied for STEM subjects
     ↓
Content analysis: keywords, topics, definitions,
facts, concepts, sentences, stemProblems
     ↓
splitTextIntoChapters() — detects CHAPTER/UNIT/MODULE markers,
extracts the real chapter title from the next line (hasEOL-aware),
converts ALL-CAPS headings to Title Case
     ↓
Text stored on Paper object (capped at 300k chars)
for future section regeneration
```

### Limits
| Parameter | Value |
|---|---|
| Max chars per page | 3,000 |
| Max total chars | 5,000,000 (5 MB) |
| Analysis sample | 100,000 chars |
| Max OCR pages | 50 |
| Stored source text cap | 300,000 chars |

---

## 9. Data Storage

### IndexedDB (`qpg` database, version 1)
| Store | Key | Contents |
|---|---|---|
| `papers` | `paper.id` | Full Paper objects including sections, questions, answers, source text |
| `sources` | `source.id` | Source metadata + extracted text |

On first run, any data in `localStorage` under `questionPapers` or `qpg_sources` is automatically migrated to IndexedDB and the localStorage keys are removed.

### localStorage
| Key | Contents |
|---|---|
| `lmStudioConfig` | LM Studio connection settings |
| `qpg_profile` | User display name and role |
| `qpg_prefs` | Default paper preferences |
| `qpg_templates` | Saved paper structure templates |

---

## 10. Services Reference

| File | Responsibility |
|---|---|
| `pdfService.ts` | PDF extraction, content analysis, question generation, paper CRUD |
| `lmStudioService.ts` | LM Studio API calls, prompt building, response parsing |
| `stemTextCleaner.ts` | Unicode/mojibake cleaning for STEM PDF text |
| `sourceService.ts` | Source material CRUD, deduplication, storage stats |
| `templateService.ts` | Template CRUD, 4 built-in templates |
| `exportPdf.ts` | jsPDF-based A4 paper rendering + answer key page |
| `db.ts` | IndexedDB open/read/write/delete + localStorage migration |

---

## 11. Project Structure

```
Question Paper Generator/
├── src/
│   ├── main.tsx                        ← Bootstrap (DB init → render)
│   └── app/
│       ├── App.tsx
│       ├── Layout.tsx                  ← Sidebar, nav, user card, top bar
│       ├── routes.tsx                  ← All 5 routes
│       ├── pages/
│       │   ├── Dashboard.tsx           ← Papers list, search, tag filter
│       │   ├── Generate.tsx            ← 3-step wizard
│       │   ├── ViewPaper.tsx           ← View / edit / export
│       │   ├── SourceMaterial.tsx      ← PDF library
│       │   └── Settings.tsx            ← Config, profile, danger zone
│       ├── components/
│       │   ├── ui/                     ← Radix UI wrappers (shadcn style)
│       │   └── LMStudioSettings.tsx    ← (legacy, config now in Settings page)
│       ├── services/
│       │   ├── pdfService.ts
│       │   ├── lmStudioService.ts
│       │   ├── stemTextCleaner.ts
│       │   ├── sourceService.ts
│       │   ├── templateService.ts
│       │   ├── exportPdf.ts
│       │   └── db.ts
│       └── workers/
│           └── pdfExtract.worker.ts    ← Off-thread pdfjs extraction
├── public/
├── index.html
├── vite.config.ts
├── package.json
└── pnpm-lock.yaml
```

---

## 12. Getting Started

### Prerequisites
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- A modern browser (Chrome 90+, Firefox 88+, Safari 14+)
- LM Studio (optional, for AI generation)

### Install & Run

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build
```

### LM Studio Setup
1. Download [LM Studio](https://lmstudio.ai/) and load a model (3–8B recommended)
2. Developer tab → Start Server → enable **CORS**
3. In the app: Settings → LM Studio section → click ↻ to detect model → Test Connection → Save
4. The green banner on Step 2 of the wizard confirms it's active

### Recommended Models
| Model | Speed | Quality | Notes |
|---|---|---|---|
| Llama 3.2 3B | Very fast | Good | Best for quick iteration |
| Llama 3.1 8B | Fast | Very good | Best balance |
| Mistral 7B Instruct | Fast | Very good | Good for STEM |
| Llama 3 70B | Slow | Excellent | Needs 48GB+ RAM |

---

## 13. Feature History

All features built during development (in order):

| # | Feature | Description |
|---|---|---|
| 1 | Real PDF Export | jsPDF A4 layout with page breaks, MCQ grid, answer lines, page numbers |
| 2 | Inline Editing | Edit question text, MCQ options; add/delete questions; auto-grow textarea |
| 3 | Paper Templates | Save/load section configs; 4 built-in templates; template picker modal |
| 4 | Answer Key | Toggle per-question answer fields; export PDF with answer key appended |
| 5 | Regenerate Section | Re-send one section to LM Studio without touching the rest of the paper |
| 6 | Dashboard Search | Live search across title, subject, filename, tags; combines with tag filter |
| 7 | Question Shuffle | Per-section and global Fisher-Yates shuffle; re-numbers after shuffle |
| 8 | Source Material | PDF library with one-time extraction, deduplication, and Generate shortcut |
| 9 | Settings Page | Profile, default prefs, LM Studio config, storage stats, danger zone |
| 10 | IndexedDB | Migrated from localStorage to IndexedDB for large paper/source storage |
| 11 | STEM Support | Subject detection, symbol cleaning, STEM-aware sampling, discipline prompts |
| 12 | stemProblems | Extracts "Find/Calculate/Prove" sentences from PDF and injects into LLM prompt |
| 13 | hasEOL Extraction | pdfjs `hasEOL` flag used to emit real `\n` characters, preserving PDF line structure |
| 14 | Chapter Title Fix | `extractChapterTitle()` reads the next line after each chapter marker for the real title |
| 15 | LLM Streaming | `callLLM()` uses `stream: true` SSE — no more timeouts; elapsed-time counter in UI |

---

## 14. Known Limitations

| Limitation | Notes |
|---|---|
| Scanned PDFs | OCR via Tesseract.js works but is slow (~1–3 min for 50 pages) |
| Math rendering | LaTeX is rendered via KaTeX in the paper view; complex environments may not display perfectly |
| LM Studio speed | Local LLMs are slow for large papers; streaming mode keeps the connection alive but generation still takes time |
| Browser storage | IndexedDB has no hard cap but browsers may impose limits; large source libraries (many 300k-char texts) will grow |
| No cloud sync | All data is local to the browser; clearing site data removes everything |
| Question Papers nav | Currently duplicates Dashboard — dedicated view not yet built |
| Mobile | Layout is desktop-first; functional on tablet but not optimised for phone |

---

*Last updated: May 2026 — v1.3.0*
