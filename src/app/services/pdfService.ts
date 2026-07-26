// PDF text extraction using pdfjs-dist + Tesseract.js OCR fallback
import * as pdfjsLib from 'pdfjs-dist';
import { getLMStudioConfig, generateQuestionsWithLLM, generateFullPaperWithLLM } from './lmStudioService';
import { cleanStemText } from './stemTextCleaner';
import { dbPut, dbDelete } from './db';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// ── Limits — no artificial page cap; Worker handles full books ──
const MAX_CHARS_PER_PAGE    = 3_000;   // per page (kept modest for memory)
const MAX_TOTAL_CHARS       = 5_000_000; // 5 MB — covers any real-world book
const ANALYSIS_SAMPLE_CHARS = 100_000;  // 100 k chars for keyword/topic analysis
const PAGE_BATCH_SIZE       = 15;
const MAX_OCR_PAGES         = 50;       // OCR is slow; cap for scanned PDFs

// ── In-memory cache (seeded by initDB in main.tsx) ──────────────────────
let _papers: Paper[] = [];
export function initPaperStore(papers: Paper[]): void { _papers = papers; }

export interface Section {
  name: string; type: string; count: number; marks: number; difficulty: string;
}
export interface Question {
  id: number; text: string; options?: string[]; marks?: number;
  /** Correct answer — shown only in answer-key view/export */
  answer?: string;
}
export interface PaperSection {
  name: string; instructions: string; type: string; questions: Question[];
}
export interface Paper {
  id: string; title: string; subject: string; duration: string;
  totalMarks: number; sections: PaperSection[];
  createdAt: string; sourceFile: string;
  tags?: string[];
  /** Target audience academic level (e.g., High School, College) */
  academicLevel?: string;
  /** Subject classification for math/science rendering logic */
  subjectType?: SubjectType;
  /** Extracted PDF text — stored so sections can be regenerated without re-uploading */
  sourceText?: string;
  /** Whether the paper was generated from a custom prompt/topic rather than a PDF */
  isPromptMode?: boolean;
  /** Selected institutional board style (e.g. CBSE, Samacheer TN Matriculation) */
  institutionStyle?: 'cbse' | 'tn_matric' | 'standard';
  /** School-specific learned questioning pattern guidelines */
  customInstructions?: string;
  /** Custom school / institution name */
  schoolName?: string;
}

function isSkippablePage(text: string): boolean {
  if (text.trim().length < 60) return true;
  const lower = text.toLowerCase();
  return ['all rights reserved', 'isbn ', 'cataloging-in-publication']
    .filter(p => lower.includes(p)).length >= 2;
}

// ── Extract digital text from one page (preserving line breaks via hasEOL) ──
async function extractPageText(pdf: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<string> {
  try {
    const page    = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    // pdfjs items have a `hasEOL` flag set when the item ends a visual line.
    // Using it gives us real line structure instead of a flat space-joined blob.
    const parts: string[] = [];
    for (const item of content.items as any[]) {
      if (!('str' in item)) continue;
      parts.push(item.str);
      if (item.hasEOL) parts.push('\n');
      else if (item.str && !item.str.endsWith(' ')) parts.push(' ');
    }
    const text = parts.join('')
      .replace(/[ \t]+/g, ' ')       // collapse horizontal whitespace only
      .replace(/\n{3,}/g, '\n\n')    // max 2 consecutive blank lines
      .trim()
      .slice(0, MAX_CHARS_PER_PAGE);
    page.cleanup();
    return isSkippablePage(text) ? '' : text;
  } catch {
    return '';
  }
}

// ── Render a PDF page to a canvas and return ImageData for OCR ──
async function renderPageToCanvas(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale = 2.0   // 2× scale = better OCR accuracy
): Promise<HTMLCanvasElement | null> {
  try {
    const page     = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas   = document.createElement('canvas');
    canvas.width   = viewport.width;
    canvas.height  = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    page.cleanup();
    return canvas;
  } catch {
    return null;
  }
}

// ── OCR one canvas using Tesseract.js (loaded dynamically) ──
async function ocrCanvas(canvas: HTMLCanvasElement, worker: any): Promise<string> {
  try {
    const { data } = await worker.recognize(canvas);
    return (data.text as string)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_CHARS_PER_PAGE);
  } catch {
    return '';
  }
}

// ── Load Tesseract worker ──
async function createTesseractWorker(
  onProgress?: (msg: string) => void
): Promise<any | null> {
  try {
    // @ts-ignore — optional dependency
    const { createWorker } = await import(/* @vite-ignore */ 'tesseract.js');
    const worker = await createWorker('eng', 1, {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          const pct = (m.progress * 100).toFixed(0);
          console.log(`OCR: ${pct}%`);
          onProgress?.(`OCR in progress: ${pct}%`);
        }
      },
    });
    return worker;
  } catch (e) {
    console.warn('Tesseract load failed:', e);
    return null;
  }
}

// ── Worker-based digital extraction (non-blocking) ───────────────────────
function extractWithWorker(
  arrayBuffer: ArrayBuffer,
  startPage: number,
  endPage: number | undefined,
  report: (msg: string) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/pdfExtract.worker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.onmessage = (e) => {
      const { type, msg, text } = e.data;
      if (type === 'progress') report(msg);
      else if (type === 'result') { worker.terminate(); resolve(text); }
      else if (type === 'error')  { worker.terminate(); reject(new Error(msg)); }
    };
    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message ?? 'Worker error')); };
    // Transfer ownership of the ArrayBuffer — zero-copy, no memory doubling
    worker.postMessage({ arrayBuffer, startPage, endPage }, [arrayBuffer]);
  });
}

// ── Main-thread digital fallback (used when Worker is unavailable) ────────
async function extractMainThread(
  file: File,
  report: (msg: string) => void,
  startPage: number,
  endPage: number | undefined,
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer, disableRange: true, disableStream: true, isEvalSupported: false,
  }).promise;

  const rangeStart = Math.max(1, startPage);
  const rangeEnd   = Math.min(pdf.numPages, endPage ?? pdf.numPages);
  report(`Main-thread fallback — extracting pages ${rangeStart}–${rangeEnd}`);

  const pageNums = Array.from({ length: rangeEnd - rangeStart + 1 }, (_, i) => rangeStart + i);
  const chunks: string[] = [];

  for (let i = 0; i < pageNums.length; i += PAGE_BATCH_SIZE) {
    const batch   = pageNums.slice(i, i + PAGE_BATCH_SIZE);
    const results = await Promise.all(batch.map(n => extractPageText(pdf, n)));
    chunks.push(...results.filter(Boolean));
    report(`Extracting… ${Math.min(i + PAGE_BATCH_SIZE, pageNums.length)}/${pageNums.length} pages`);
  }
  await pdf.destroy();
  return chunks.join('\n\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// ── Quick page-count probe (no full extraction) ──
export async function getPDFPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer, disableRange: true, disableStream: true, isEvalSupported: false,
  }).promise;
  const count = pdf.numPages;
  try { await pdf.destroy(); } catch { /* ignore */ }
  return count;
}

// ── Main extraction entry point ───────────────────────────────────────────
export async function extractTextFromPDF(
  file: File,
  onProgress?: (msg: string) => void,
  startPage = 1,
  endPage?: number,
): Promise<string> {
  const t0     = performance.now();
  const report = (msg: string) => { console.log(msg); onProgress?.(msg); };

  // Step 1 — digital extraction via Worker (non-blocking)
  let digitalText = '';
  try {
    const ab = await file.arrayBuffer();
    digitalText = await extractWithWorker(ab, startPage, endPage, report);
  } catch (workerErr) {
    report('Worker unavailable — extracting on main thread…');
    try {
      digitalText = await extractMainThread(file, report, startPage, endPage);
    } catch (mainErr) {
      throw new Error(`Extraction failed: ${mainErr instanceof Error ? mainErr.message : mainErr}`);
    }
  }

  // Step 2 — if too little text, this is a scanned PDF → OCR on main thread
  if (digitalText.length < 200) {
    report('Detected scanned PDF — starting OCR (this takes 1–3 min for large files)…');
    const worker = await createTesseractWorker(report);
    if (!worker) throw new Error(
      'OCR failed to initialise. Install tesseract.js: pnpm add tesseract.js'
    );

    let pdf: pdfjsLib.PDFDocumentProxy | null = null;
    try {
      const ab2    = await file.arrayBuffer();
      pdf          = await pdfjsLib.getDocument({ data: ab2, disableRange: true, disableStream: true, isEvalSupported: false }).promise;
      const rStart = Math.max(1, startPage);
      const rEnd   = Math.min(pdf.numPages, endPage ?? pdf.numPages, rStart + MAX_OCR_PAGES - 1);
      const ocrChunks: string[] = [];

      for (let p = rStart; p <= rEnd; p++) {
        report(`OCR: page ${p - rStart + 1}/${rEnd - rStart + 1}…`);
        const canvas = await renderPageToCanvas(pdf, p);
        if (!canvas) continue;
        const text = await ocrCanvas(canvas, worker);
        if (text.length > 30) ocrChunks.push(text);
      }
      await worker.terminate();
      digitalText = ocrChunks.join('\n\n').trim();
      report(`OCR complete — ${digitalText.length.toLocaleString()} chars`);
    } finally {
      if (pdf) try { await pdf.destroy(); } catch { /* ignore */ }
    }
  }

  const cleaned = digitalText
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleaned.length < 50) throw new Error(
    'Could not extract readable text. If this is a scanned PDF, install tesseract.js: pnpm add tesseract.js'
  );

  report(`Done in ${((performance.now() - t0) / 1000).toFixed(1)}s — ${cleaned.length.toLocaleString()} chars`);
  return cleaned;
}

// ── Subject classification ────────────────────────────────────────────────
export type SubjectType = 'math' | 'physics' | 'chemistry' | 'biology' | 'general';

const SUBJECT_SIGNALS: Record<Exclude<SubjectType,'general'>, string[]> = {
  math:      ['math', 'calculus', 'algebra', 'geometry', 'statistics', 'trigonometry', 'arithmetic', 'probability', 'combinatorics'],
  physics:   ['physics', 'mechanics', 'thermodynamics', 'electromagnetism', 'optics', 'quantum', 'relativity', 'dynamics', 'kinematics', 'astrophysics'],
  chemistry: ['chemistry', 'organic', 'inorganic', 'biochemistry', 'chemical', 'stoichiometry', 'thermochemistry', 'electrochemistry'],
  biology:   ['biology', 'microbiology', 'genetics', 'ecology', 'physiology', 'anatomy', 'botany', 'zoology', 'cell biology'],
};

const STEM_CONTENT_SIGNALS: Record<Exclude<SubjectType,'general'>, RegExp> = {
  // Use word-stem prefixes so plurals / conjugations also match:
  // "matrices" matches "matri", "equations" matches "equat", etc.
  physics:   /\b(?:force|veloc|accelerat|momentum|energi|gravit|current|voltage|resistanc|magnetic|circuit|friction|pressur|thermodynam|photon|nuclei|waveform|kinetic|potential|electr)\w*/gi,
  chemistry: /\b(?:reaction|molecul|atom|element|compound|bond|acid|base|oxidat|reduct|catalyst|equilibri|entrop|enthalp|mol(?:e|ar)|concentrat|electroly|periodic|covalent|ionic)\w*/gi,
  math:      /\b(?:equat|theorem|proof|integr|deriv|matri|vector|polynom|function|limit|series|probabilit|trigonometr|logarithm|algebr|geometr|calculus|quadrat|identit|factor|root|complex)\w*/gi,
  biology:   /\b(?:cell|DNA|RNA|protein|gene|organism|evolut|photosynthes|respirat|mitosis|meiosis|chromosom|enzyme|membran|ribosom|metabol|heredit|ecosystem)\w*/gi,
};

export function classifySubject(subject: string, sampleText = ''): SubjectType {
  const s = subject.toLowerCase();
  for (const [type, sigs] of Object.entries(SUBJECT_SIGNALS) as [Exclude<SubjectType,'general'>, string[]][]) {
    if (sigs.some(sig => s.includes(sig))) return type;
  }
  if (!sampleText) return 'general';
  const scan   = sampleText.slice(0, 5_000);
  const counts = {} as Record<Exclude<SubjectType,'general'>, number>;
  for (const [type, rx] of Object.entries(STEM_CONTENT_SIGNALS) as [Exclude<SubjectType,'general'>, RegExp][]) {
    counts[type] = (scan.match(rx) ?? []).length;
    rx.lastIndex = 0;
  }
  const max = Math.max(...Object.values(counts));
  if (max < 4) return 'general';
  return (Object.entries(counts) as [Exclude<SubjectType,'general'>, number][]).find(([, c]) => c === max)![0];
}

// STEM short terms that would otherwise be filtered out by the length > 4 rule
const STEM_SHORT_RE = /\b(pH|DNA|RNA|ATP|ADP|PCR|NMR|EMF|emf|rms|RMS|AC|DC|UV|IR|STP|NTP|mol|ion|ray|arc|eV)\b/g;

// Named law / theorem / principle pattern
const NAMED_LAW_RE = /\b([A-Z][a-z]+(?:'s)?)\s+(?:law|theorem|principle|equation|formula|rule|effect|postulate|constant)\b/g;

// STEM numerical fact: value + unit
const STEM_UNIT_RE = /\b\d+\.?\d*\s*(?:m\/s|km\/h|kg|g\/mol|mol|N|Pa|kPa|J|kJ|W|kW|V|mV|A|mA|Ω|°C|K|Hz|MHz|GHz|nm|μm|cm|mm|km|eV|kJ\/mol|cal|kcal|atm|bar)\b/i;
const SCI_NOTATION_RE = /\b\d+\.?\d*\s*[×x]\s*10/;

// ── Content analysis — runs on a capped sample only ──
interface ContentAnalysis {
  keywords: string[]; topics: string[]; definitions: string[];
  facts: string[]; concepts: string[]; sentences: string[];
  stemProblems: string[];   // STEM: "Find…", "Calculate…", "Prove that…" sentences
}

function buildSample(text: string): string {
  if (text.length <= ANALYSIS_SAMPLE_CHARS) return text;
  const t = Math.floor(ANALYSIS_SAMPLE_CHARS / 3);
  const mid = Math.floor(text.length / 2);
  return text.slice(0, t) +
    text.slice(mid - Math.floor(t / 2), mid + Math.floor(t / 2)) +
    text.slice(text.length - t);
}

function analyzeContent(pdfText: string, subjectType: SubjectType = 'general'): ContentAnalysis {
  const sample    = buildSample(pdfText);
  const sentences = sample.split(/[.!?]+/).map(s => s.trim())
    .filter(s => s.length > 30 && s.length < 250 && !/^(page|chapter|\d+|figure|table)/i.test(s));

  // ── Standard keyword extraction ──────────────────────────────────────
  const wordFreq = new Map<string, number>();
  for (const w of sample.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/)) {
    if (w.length < 4)          continue; // too short
    if (w.includes('_'))       continue; // filename / chapter artifacts (e.g. "12th_maths_tm_vol1_ch")
    if (/^\d/.test(w))         continue; // starts with digit ("12th", "3rd", "vol1")
    if (isCommonWord(w))       continue;
    if (/^\d+$/.test(w))       continue;
    wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
  }
  const keywords = [...wordFreq.entries()].filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1]).slice(0, 100).map(([w]) => w);

  // ── STEM: inject short terms that are too short for the length filter ─
  if (subjectType !== 'general') {
    const shortMatches = [...new Set((sample.match(STEM_SHORT_RE) ?? []).map(t => t.toLowerCase()))];
    STEM_SHORT_RE.lastIndex = 0;
    keywords.push(...shortMatches.filter(t => !keywords.includes(t)));
  }

  // ── Topic extraction ──────────────────────────────────────────────────
  const topicRaw = sample.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}/g) ?? [];
  const topics   = [...new Set(topicRaw)]
    .filter(t =>
      t.length > 3 &&
      !t.includes('_') &&
      !/^(The|This|That|Chapter|Section|Figure|Table|Page)/.test(t)
    ).slice(0, 50);

  // ── STEM: named laws / theorems / principles ──────────────────────────
  if (subjectType !== 'general') {
    NAMED_LAW_RE.lastIndex = 0;
    let lm: RegExpExecArray | null;
    const laws: string[] = [];
    while ((lm = NAMED_LAW_RE.exec(sample)) !== null) laws.push(lm[0]);
    const uniqueLaws = [...new Set(laws)].slice(0, 20);
    topics.push(...uniqueLaws.filter(l => !topics.includes(l)));
    // Also add law names as keywords (e.g. "newton", "ohm", "boyle")
    for (const law of uniqueLaws) {
      const base = law.split(/\s+/)[0].toLowerCase().replace(/'s$/, '');
      if (!keywords.includes(base)) keywords.push(base);
    }
  }

  // ── Definition extraction ─────────────────────────────────────────────
  const definitions = sentences
    .filter(s => /\bis\b|\bare\b|defined as|refers to|means that|known as/i.test(s) && s.length < 150)
    .slice(0, 30);

  // ── Fact extraction ───────────────────────────────────────────────────
  const facts = sentences
    .filter(s => /\d+%|\d+ percent|approximately|about \d+|studies show|research indicates|according to/i.test(s))
    .slice(0, 20);

  // ── STEM: numerical facts with scientific units ───────────────────────
  if (subjectType !== 'general') {
    const stemFacts = sentences.filter(s =>
      (STEM_UNIT_RE.test(s) || SCI_NOTATION_RE.test(s)) && !facts.includes(s)
    ).slice(0, 15);
    facts.push(...stemFacts);
  }

  // ── Concept (multi-word phrase) extraction ────────────────────────────
  const phraseFreq = new Map<string, number>();
  const phraseRe   = /\b([A-Z][a-z]+(?:\s+[a-z]+){1,3})\b/g;
  let pm: RegExpExecArray | null;
  const phraseScan = sample.slice(0, 15_000);
  while ((pm = phraseRe.exec(phraseScan)) !== null)
    phraseFreq.set(pm[1], (phraseFreq.get(pm[1]) || 0) + 1);
  const concepts = [...phraseFreq.entries()].filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1]).slice(0, 40).map(([p]) => p);

  // ── STEM: extract problem-solving sentences ("Find…", "Calculate…", "Prove…") ─
  // These make far better short-answer questions than keyword templates.
  const stemProblems: string[] = [];
  if (subjectType !== 'general') {
    const probRe = /\b(?:find|calculate|determine|evaluate|solve|simplify|prove|show that|derive|compute)\b[^.!?]{15,150}[.!?]/gi;
    let probM: RegExpExecArray | null;
    while ((probM = probRe.exec(sample)) !== null) {
      const s = probM[0].trim();
      if (s.length > 20 && s.length < 200 && !stemProblems.includes(s)) {
        stemProblems.push(s);
        if (stemProblems.length >= 40) break;
      }
    }
  }

  return { keywords, topics, definitions, facts, concepts, sentences, stemProblems };
}

// ── Generate questions ──
export async function generateQuestions(
  pdfText: string, sections: Section[], paperTitle: string,
  subject: string, duration: string, fileName: string,
  academicLevel: string = "High School",
  isPromptMode: boolean = false,
  institutionStyle: 'cbse' | 'tn_matric' | 'standard' = 'standard',
  customInstructions: string = "",
  schoolName: string = ""
): Promise<Paper> {
  const t0          = performance.now();
  const useLLM      = getLMStudioConfig().enabled;
  const subjectType = classifySubject(subject, isPromptMode ? "" : pdfText.slice(0, 5_000));
  
  // For STEM subjects, clean garbled symbols before analysis and LLM (skip in prompt mode)
  const cleanedText = (subjectType !== 'general' && !isPromptMode) ? cleanStemText(pdfText) : pdfText;
  
  // Skip full analysis in prompt mode
  const analysis    = !isPromptMode ? analyzeContent(cleanedText, subjectType) : null;
  const keywords    = analysis?.keywords ?? [];
  const topics      = analysis?.topics ?? [];
  const definitions = analysis?.definitions ?? [];
  const facts       = analysis?.facts ?? [];
  const concepts    = analysis?.concepts ?? [];
  const sentences   = analysis?.sentences ?? [];
  const stemProblems = analysis?.stemProblems ?? [];
 
  let finalSections: PaperSection[] = [];

  if (isPromptMode) {
    if (!useLLM) {
      throw new Error(
        "Local AI (LM Studio) must be enabled in Settings to generate a paper from custom prompts."
      );
    }
    try {
      finalSections = await generateFullPaperWithLLM(
        cleanedText,
        sections,
        subject,
        subjectType,
        academicLevel,
        institutionStyle,
        customInstructions
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `LM Studio failed during custom prompt paper generation: ${msg}. ` +
        `Check that LM Studio is running, CORS is enabled, and a model is loaded.`
      );
    }
  } else {
    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const section = sections[sIdx];
      let questions: Question[];

      if (useLLM) {
        try {
          questions = await generateQuestionsWithLLM(
            cleanedText, section, sIdx, subject, subjectType,
            stemProblems, academicLevel, isPromptMode, institutionStyle,
            customInstructions
          );
        } catch (err) {
          // DO NOT silently fall back — surface the real error so the user knows LM Studio failed
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(
            `LM Studio failed for "${section.name}": ${msg}. ` +
            `Check that LM Studio is running, CORS is enabled, and a model is loaded. ` +
            `You can disable LM Studio in Settings to use the built-in template generator instead.`
          );
        }
      } else {
        questions = templateQuestions(section, sIdx, keywords, topics, concepts, sentences, definitions, facts, subject, subjectType, academicLevel);
      }
      finalSections.push({ name: section.name, instructions: getInstructions(section), type: section.type, questions });
    }
  }
 
  console.log(`generateQuestions [${subjectType}]: ${((performance.now() - t0) / 1000).toFixed(2)}s`);
  return {
    id: `p-${Date.now()}`,
    title: paperTitle,
    subject,
    duration,
    totalMarks: sections.reduce((a, s) => a + s.count * s.marks, 0),
    sections: finalSections,
    createdAt: new Date().toISOString(),
    sourceFile: fileName,
    academicLevel,
    subjectType,
    sourceText: cleanedText,
    isPromptMode,
    institutionStyle,
    customInstructions,
    schoolName,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ── Map each keyword to the fragment after "is / are / defined as / refers to" ──
function buildDefinitionMap(definitions: string[], keywords: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const def of definitions) {
    const m = def.match(/^(.{3,60}?)\s+(?:is|are|defined as|refers to|means)\b\s*(.{10,120})/i);
    if (!m) continue;
    const subj     = m[1].trim().toLowerCase().replace(/^(the|a|an)\s+/i, '');
    const fragment = m[2].trim().replace(/[.,;]$/, '').slice(0, 100);
    if (fragment.length < 10) continue;
    if (!map.has(subj)) map.set(subj, fragment);
    // Also check if any known keyword appears in the subject phrase
    for (const kw of keywords.slice(0, 80)) {
      if (!map.has(kw) && subj.includes(kw)) { map.set(kw, fragment); break; }
    }
  }
  return map;
}

// ── Map each keyword to other keywords that appear in the same sentences ──
function buildCoOccurrence(sentences: string[], keywords: string[]): Map<string, string[]> {
  const map   = new Map<string, string[]>();
  const topKw = keywords.slice(0, 60);
  for (const sentence of sentences.slice(0, 200)) {
    const lower   = sentence.toLowerCase();
    const present = topKw.filter(kw => lower.includes(kw));
    if (present.length < 2) continue;
    for (const kw of present) {
      const others = present.filter(k => k !== kw);
      map.set(kw, [...new Set([...(map.get(kw) ?? []), ...others])].slice(0, 12));
    }
  }
  return map;
}

// ── Build a T/F question from a real PDF sentence ──
//    True:  use a fact/sentence as-is
//    False: try keyword-swap → number-flip → verb-negation, then fallback
function makeTFQuestion(
  sentences: string[], facts: string[], keywords: string[], i: number,
  trueRatio = 0.5,
): { text: string; answer: 'True' | 'False' } {
  const pool = [...facts, ...sentences].filter(s => s.length > 40 && s.length < 180);
  // Distribute false questions evenly across every 8-question window based on trueRatio.
  // Easy=0.75 → 2 false per 8 (indices 6,7); Medium=0.5 → 4 false; Hard=0.375 → 5 false.
  const falseSlots = Math.round(8 * (1 - trueRatio));
  const wantFalse  = (i % 8) >= (8 - falseSlots);

  if (wantFalse && pool.length > 0) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const src = pool[(i * 7 + attempt) % pool.length];
      if (!src) continue;
      const lower = src.toLowerCase();

      // Strategy 1 — swap a keyword for a different one that isn't already in the sentence
      const found = keywords.filter(kw => kw.length >= 5 && lower.includes(kw));
      if (found.length >= 1) {
        const target = found[0];
        const alt    = keywords.find(k => k.length >= 4 && k !== target && !lower.includes(k));
        if (alt) {
          const modified = src.replace(new RegExp(`\\b${escapeRegex(target)}\\b`, 'i'), alt);
          if (modified !== src) return { text: modified.trim(), answer: 'False' };
        }
      }

      // Strategy 2 — change a numeric value in a fact sentence
      const numM = src.match(/\b(\d{1,4}(?:\.\d+)?)\s*(%|percent|kg|km|mm|years?|hours?|minutes?)\b/i);
      if (numM) {
        const orig     = parseFloat(numM[1]);
        const fake     = orig > 10 ? Math.round(orig * 2.3) : parseFloat((orig * 0.15).toFixed(1));
        const modified = src.replace(numM[0], `${fake} ${numM[2]}`);
        if (modified !== src) return { text: modified.trim(), answer: 'False' };
      }

      // Strategy 3 — negate the main verb
      const negated = src.replace(/\b(is|are|was|were|can|will|does)\b(?!\s+not\b)/, '$1 not');
      if (negated !== src) return { text: negated.trim(), answer: 'False' };
    }
  }

  // Return a true statement from the pool
  if (pool.length > 0) {
    const trueSrc = pool[(i * 11) % pool.length];
    if (trueSrc) return { text: trueSrc.trim(), answer: 'True' };
  }

  // Last-resort templates
  const kw  = keywords[(i * 7)  % Math.max(keywords.length, 1)] ?? 'concept';
  const kw2 = keywords[(i * 13) % Math.max(keywords.length, 1)] ?? 'theory';
  return wantFalse
    ? { text: `${kw} and ${kw2} are interchangeable terms that mean the same thing.`, answer: 'False' }
    : { text: `${kw} is a fundamental concept closely related to ${kw2}.`, answer: 'True' };
}

// ── Blank out a keyword from a real sentence ──
function makeFITBFromSentence(
  sentences: string[], keywords: string[], i: number,
): { q: string; a: string } | null {
  for (let attempt = 0; attempt < 15; attempt++) {
    const src = sentences[(i * 11 + attempt) % Math.max(sentences.length, 1)];
    if (!src || src.length < 40 || src.length > 200) continue;
    const lower = src.toLowerCase();
    // Prefer longer keywords (more significant / less common)
    const found = keywords
      .filter(kw => kw.length >= 5 && lower.includes(kw))
      .sort((a, b) => b.length - a.length);
    if (!found.length) continue;
    const target  = found[0];
    const blanked = src.replace(new RegExp(`\\b${escapeRegex(target)}\\b`, 'i'), '__________');
    if (blanked !== src) return { q: blanked.trim(), a: target };
  }
  return null;
}

// ── Convert a definition sentence into a short-answer Q&A ──
function questionFromDefinition(def: string): { q: string; a: string } | null {
  const m = def.match(/^([^,\(\d]{3,55}?)\s+(?:is|are|refers to|defined as|means)\b(.{10,})/i);
  if (!m) return null;
  const subject = m[1].trim();
  if (subject.split(/\s+/).length > 6) return null; // subject too verbose
  return {
    q: `What ${/\bare\b/i.test(def) ? 'are' : 'is'} ${subject}?`,
    a: def.trim(),
  };
}

// ── Bloom's Taxonomy difficulty map ──
const BLOOMS = {
  Easy: {
    level:       "Remember / Understand",
    description: "Recall facts, define terms, describe concepts from memory",
    verbs:       ["Define", "List", "Identify", "Name", "State", "Describe", "Recall", "Summarise"],
    mcqStems:    ["What is", "Which term describes", "Define", "Identify the correct description of", "Name the primary feature of", "Which statement correctly describes", "State the meaning of", "Which best defines"],
    shortStems:  ["Define", "List the main features of", "State the meaning of", "Describe", "Identify", "Name and explain", "What is meant by", "Summarise"],
    essayStems:  ["Describe", "Summarise the key features of", "Outline the main aspects of", "List and explain the components of", "Describe the role of", "Summarise the significance of", "Outline the characteristics of", "Describe the process of"],
    tfTrueRatio: 0.75,  // mostly true — students confirm what they know
  },
  Medium: {
    level:       "Apply / Analyse",
    description: "Apply concepts to contexts, explain relationships, break down ideas",
    verbs:       ["Explain", "Classify", "Compare", "Differentiate", "Apply", "Examine", "Illustrate", "Solve"],
    mcqStems:    ["How does", "Why is", "What is the relationship between", "How would you apply", "Which best explains the role of", "Classify the following statement about", "How is", "What effect does"],
    shortStems:  ["Explain how", "Compare", "Analyse the role of", "How does", "Differentiate between", "Illustrate the relationship between", "Apply the concept of", "Examine the function of"],
    essayStems:  ["Compare and contrast", "Analyse the relationship between", "Examine the role of", "Explain the significance of", "Differentiate between", "Illustrate how", "Classify and explain", "Analyse the impact of"],
    tfTrueRatio: 0.5,   // balanced — requires understanding, not just recall
  },
  Hard: {
    level:       "Evaluate / Create",
    description: "Judge claims, assess evidence, justify positions, synthesise ideas",
    verbs:       ["Evaluate", "Justify", "Critique", "Assess", "Construct", "Synthesise", "Design", "Formulate"],
    mcqStems:    ["Evaluate the claim that", "Which evidence best supports", "Justify why", "Assess the impact of", "Which argument best critiques", "What is the most significant limitation of", "Evaluate which approach best addresses", "Which conclusion is best supported by evidence about"],
    shortStems:  ["Evaluate", "Justify", "Assess the significance of", "Critique the claim that", "What evidence supports", "Construct an argument for", "How would you evaluate", "Assess the strengths and limitations of"],
    essayStems:  ["Critically evaluate", "Justify the importance of", "Assess the strengths and limitations of", "Construct an argument for", "Synthesise the key ideas about", "Formulate a position on", "Critically analyse", "Evaluate the evidence for"],
    tfTrueRatio: 0.375, // more false — students must evaluate, not just confirm
  },
} as const;

type Difficulty = keyof typeof BLOOMS;

// ── STEM-specific question patterns ──────────────────────────────────────
const STEM_MCQ: Record<Exclude<SubjectType,'general'>, string[]> = {
  physics: [
    "Which of the following correctly states",
    "What is the SI unit of",
    "Which equation correctly relates",
    "Which of the following is a vector quantity related to",
    "According to the principle of",
    "Which statement correctly describes the relationship between",
    "What physical quantity is measured by",
    "Which law governs the behaviour of",
  ],
  chemistry: [
    "Which of the following correctly represents",
    "What is the oxidation state of",
    "Which type of bond is present in",
    "Which equation correctly represents the reaction involving",
    "What is the role of",
    "Which property is characteristic of",
    "Which of the following correctly applies",
    "What is the correct IUPAC name for",
  ],
  math: [
    "Which expression correctly represents",
    "What is the value of",
    "Which theorem applies to",
    "Which of the following is equivalent to",
    "What is the solution to",
    "Which statement about",
    "What is the derivative of",
    "Which formula correctly calculates",
  ],
  biology: [
    "Which of the following correctly describes",
    "Which structure is responsible for",
    "Which process is represented by",
    "What is the role of",
    "Which statement correctly explains",
    "Which organelle is responsible for",
    "Which type of",
    "Which of the following correctly identifies",
  ],
};

const STEM_SHORT: Record<Exclude<SubjectType,'general'>, string[]> = {
  physics: [
    "State and explain",
    "Define and give the SI unit of",
    "Write the mathematical expression for",
    "Derive the formula for",
    "State the conditions necessary for",
    "Explain with the help of a diagram",
    "What is the significance of",
    "Distinguish between",
  ],
  chemistry: [
    "Write the balanced chemical equation for",
    "Define and give an example of",
    "Explain the mechanism of",
    "State and apply",
    "What are the products of",
    "Distinguish between",
    "Calculate and explain",
    "Write the structural formula of",
  ],
  math: [
    "Solve",
    "Prove that",
    "Find the value of",
    "Differentiate",
    "Evaluate",
    "Show that",
    "Calculate",
    "Simplify",
  ],
  biology: [
    "Describe the role of",
    "Explain the process of",
    "Distinguish between",
    "What are the functions of",
    "Explain with a diagram",
    "State and explain",
    "Describe the structure of",
    "Explain how",
  ],
};

const STEM_ESSAY: Record<Exclude<SubjectType,'general'>, string[]> = {
  physics: [
    "Derive the expression for",
    "Describe an experiment to determine",
    "Explain with diagrams the principle and working of",
    "State and prove",
    "Discuss the applications of",
    "Compare and contrast",
    "Analyse the factors affecting",
    "Explain the phenomenon of",
  ],
  chemistry: [
    "Describe the mechanism and conditions for",
    "Explain with equations the industrial preparation of",
    "Discuss the structure, properties and uses of",
    "Derive and apply",
    "Compare the properties of",
    "Explain the bonding and reactivity of",
    "Describe the laboratory preparation and properties of",
    "Discuss the factors affecting",
  ],
  math: [
    "Prove the following theorem about",
    "Derive the general formula for",
    "Solve the following problem involving",
    "Apply the method of",
    "Find and justify the solution to",
    "Construct and verify",
    "Evaluate and interpret",
    "Demonstrate using",
  ],
  biology: [
    "Describe with diagrams the process of",
    "Explain the significance of",
    "Compare and contrast",
    "Discuss the role of",
    "Explain how",
    "Describe the structure and function of",
    "Analyse the factors affecting",
    "Discuss the evolutionary significance of",
  ],
};

// ── Template generation ──
function templateQuestions(
  section: Section, sectionIdx: number, keywords: string[], topics: string[],
  concepts: string[], sentences: string[], definitions: string[], facts: string[],
  subject: string, subjectType: SubjectType = 'general', academicLevel: string = "High School"
): Question[] {
  const bloom = BLOOMS[(section.difficulty as Difficulty)] ?? BLOOMS.Medium;
  const kl = Math.max(keywords.length, 1);
  const tl = Math.max(topics.length,   1);
  const cl = Math.max(concepts.length, 1);
  const dl = Math.max(definitions.length, 1);

  // Build once, reuse for every question in this section
  const defMap = buildDefinitionMap(definitions, keywords);
  const coMap  = buildCoOccurrence(sentences, keywords);

  return Array.from({ length: section.count }, (_, i) => {
    const id      = sectionIdx * 100 + i + 1;
    const kw      = keywords[(i * 7)  % kl] ?? 'concept';
    const kw2     = keywords[(i * 13) % kl] ?? 'theory';
    const topic   = topics[(i * 3)   % tl] ?? subject;
    const concept = concepts[(i * 5) % cl] ?? kw;
    const type    = section.type.toLowerCase().replace(/[\s/]+/g, '');

    // ── Multiple Choice ──────────────────────────────────────────────────
    if (type.includes('multiplechoice') || type.includes('mcq')) {
      const isStem = subjectType !== 'general';
      const hasDef = defMap.has(kw.toLowerCase());
      // STEM subjects get discipline-specific stems; others get Bloom's stems
      const stemList = isStem ? STEM_MCQ[subjectType as Exclude<SubjectType,'general'>] : null;
      const stem     = stemList ? stemList[i % 8] : bloom.mcqStems[i % bloom.mcqStems.length];
      const qTexts = hasDef && !isStem
        ? [
            `What is ${kw}?`,
            `Which of the following best describes ${kw}?`,
            `How does ${kw} relate to ${kw2}?`,
            `Which statement correctly explains the role of ${kw}?`,
            `Evaluate which description of ${kw} best explains its significance.`,
            `Which evidence best supports the understanding of ${kw}?`,
            `${kw} is best understood as:`,
            `Select the most accurate description of ${kw}:`,
          ]
        : [
            `${stem} ${kw}?`,
            `${stem} ${concept}?`,
            `${stem} ${kw} in the context of ${topic}?`,
            `${stem} ${kw2} in relation to ${kw}?`,
            `${stem} ${kw}?`,
            `${stem} ${concept} in ${subject}?`,
            `${stem} ${kw}?`,
            `${stem} ${kw} and ${kw2}?`,
          ];
      const { options, answer } = mcqOptions(kw, keywords, concepts, defMap, coMap, subjectType);
      return { id, text: qTexts[i % 8], options, marks: section.marks, answer };
    }

    // ── True / False — use real PDF sentences, biased by Bloom level ───
    if (type.includes('true') || type.includes('false')) {
      const { text, answer } = makeTFQuestion(sentences, facts, keywords, i, bloom.tfTrueRatio);
      return { id, text, options: ['True', 'False'], marks: section.marks, answer };
    }

    // ── Short Answer ─────────────────────────────────────────────────────
    if (type.includes('short')) {
      const def     = definitions[(i * 3) % dl];
      const fromDef = def ? questionFromDefinition(def) : null;
      if (fromDef && subjectType === 'general') return { id, text: fromDef.q, marks: section.marks, answer: fromDef.a };

      const isStem   = subjectType !== 'general';
      const kwDef    = defMap.get(kw.toLowerCase());
      const bVerb    = isStem
        ? STEM_SHORT[subjectType as Exclude<SubjectType,'general'>][i % 8]
        : bloom.shortStems[i % bloom.shortStems.length];

      const qTemplates = [
        `${bVerb} ${kw}.`,
        `${bVerb} ${concept}.`,
        `${bVerb} ${kw} and ${kw2}.`,
        `${bVerb} the main features of ${topic}.`,
        `${bVerb} ${kw} in the context of ${subject}.`,
        `${bVerb} the relationship between ${kw} and ${kw2}.`,
        `${bVerb} ${concept} with reference to ${topic}.`,
        `${bVerb} ${kw} and its role in ${subject}.`,
      ];
      const modelAnswers = [
        kwDef ? `${kw} ${kwDef}. It is significant because it underpins ${topic}.` : `${kw} is a key concept in ${subject} related to ${kw2}.`,
        `The key characteristics of ${concept} include its relationship to ${kw} and its role in ${topic}.`,
        `${kw} and ${kw2} are related in ${subject}. ${kw} provides the basis for ${kw2}, together explaining ${topic}.`,
        `${topic} is characterised by its focus on ${kw} and ${concept}.`,
        kwDef ? `${kw} ${kwDef}.` : `${kw} refers to a fundamental idea in ${subject} involving ${kw2}.`,
        `${kw} and ${kw2} are interrelated: ${kw} describes the property while ${kw2} governs the behaviour in ${topic}.`,
        `${concept} in the context of ${topic} involves ${kw} and ${kw2}.`,
        `${kw} plays a central role in ${subject} by underpinning ${topic} alongside ${kw2}.`,
      ];
      return { id, text: qTemplates[i % 8], marks: section.marks, answer: modelAnswers[i % 8] };
    }

    // ── Essay ─────────────────────────────────────────────────────────────
    if (type.includes('essay') || type.includes('long')) {
      const isStem = subjectType !== 'general';
      const eStem  = isStem
        ? STEM_ESSAY[subjectType as Exclude<SubjectType,'general'>][i % 8]
        : bloom.essayStems[i % bloom.essayStems.length];
      const qTexts = [
        `${eStem} ${kw} in ${subject}.`,
        `${eStem} ${kw} and ${kw2}, with examples.`,
        `${eStem} ${topic}.`,
        `${eStem} ${concept} and its significance in ${subject}.`,
        `${eStem} ${kw} and ${kw2}.`,
        `${eStem} the role of ${kw} in ${subject}, including advantages and limitations.`,
        `${eStem} ${topic}, referring to relevant principles.`,
        `${eStem} ${kw} and its relationship to ${kw2} and ${concept}.`,
      ];
      const keyPoints = [
        `Key points: (1) Define ${kw} and its scope. (2) Historical development. (3) Applications in ${subject}. (4) Relationship to ${kw2} and ${concept}. (5) Advantages, limitations, and future directions.`,
        `Key points: (1) Define ${kw} and ${kw2}. (2) Compare core mechanisms. (3) Explain their interaction in ${topic}. (4) Provide two concrete examples. (5) Analyse broader implications for ${subject}.`,
        `Key points: (1) Overview of ${topic} and its significance. (2) Underlying theories involving ${kw}. (3) Real-world applications. (4) Critical evaluation. (5) Future directions.`,
        `Key points: (1) Define ${concept} within ${subject}. (2) Explain its importance. (3) Relationship to ${kw} and ${kw2}. (4) Illustrative examples. (5) Key insights.`,
        `Key points: (1) Define both ${kw} and ${kw2}. (2) Identify similarities. (3) Identify differences. (4) Discuss contexts where each applies. (5) Conclusions on relative importance.`,
        `Key points: (1) Define ${kw} and its role in ${subject}. (2) Trace its impact across ${topic}. (3) Advantages. (4) Limitations and criticisms. (5) Overall evaluation with evidence.`,
        `Key points: (1) Historical background of ${topic}. (2) Theoretical frameworks involving ${kw}. (3) Key research findings. (4) Ongoing debates. (5) Synthesis and outlook.`,
        `Key points: (1) Define ${kw}. (2) Identify related concepts (${kw2}, ${concept}). (3) Explain interactions. (4) Significance in ${subject}. (5) Conclusion.`,
      ];
      return { id, text: qTexts[i % 8], marks: section.marks, answer: keyPoints[i % 8] };
    }

    // ── Fill in the Blank — blank a keyword from a real sentence ────────
    if (type.includes('fill') || type.includes('blank')) {
      const fitb = makeFITBFromSentence(sentences, keywords, i);
      if (fitb) return { id, text: fitb.q, marks: section.marks, answer: fitb.a };
      // Fallback templates
      const templates = [
        { q: `The process of ${kw} is primarily used for __________.`,            a: kw2 },
        { q: `In ${subject}, ${kw} is defined as __________.`,                    a: kw2 },
        { q: `${topic} consists of __________ and ${kw}.`,                        a: kw2 },
        { q: `The main function of ${kw} is to __________.`,                      a: kw2 },
        { q: `${concept} can be achieved through __________ and ${kw2}.`,         a: kw  },
        { q: `The relationship between ${kw} and ${kw2} demonstrates __________.`, a: concept },
        { q: `According to the text, ${kw} leads to __________.`,                 a: kw2 },
        { q: `One key characteristic of ${topic} is __________.`,                 a: kw  },
      ];
      const { q, a } = templates[i % 8];
      return { id, text: q, marks: section.marks, answer: a };
    }

    // ── Generic fallback ─────────────────────────────────────────────────
    const kwDef = defMap.get(kw.toLowerCase());
    return {
      id, text: `Explain ${kw} and its significance in ${subject}.`, marks: section.marks,
      answer: kwDef ? `${cap(kw)} ${kwDef}.` : `${kw} is a fundamental concept in ${subject} closely related to ${kw2} and ${concept}.`,
    };
  });
}

function isCommonWord(w: string): boolean {
  return new Set(['that','this','with','from','have','they','will','would','there','their',
    'what','about','which','when','make','like','time','just','know','take','people','into',
    'year','your','good','some','could','them','than','then','now','look','only','come','over',
    'think','also','back','after','use','how','our','work','first','well','way','even','new',
    'want','because','any','these','give','day','most','through','been','very','such','where',
    'much','should','being','example','used','using','various','different','many']).has(w);
}

function mcqOptions(
  kw: string, keywords: string[], concepts: string[],
  defMap: Map<string, string>, coMap: Map<string, string[]>,
  subjectType: SubjectType = 'general',
): { options: string[]; answer: string } {
  const kwL = kw.toLowerCase();

  // ── Correct option ────────────────────────────────────────────────────
  const correctDef    = defMap.get(kwL);
  const correctOption = correctDef
    ? cap(correctDef)
    : `A fundamental concept in this subject related to ${kw} and its properties`;

  // ── Distractors: prefer co-occurring keywords with their own definitions ─
  const related  = coMap.get(kwL) ?? [];
  const distPool = [
    ...related,
    ...keywords.filter(k => k !== kw && !related.includes(k) && !k.includes('_')),
  ].filter(k => k !== kw);

  const distractors: string[] = [];
  for (const relKw of distPool) {
    if (distractors.length >= 3) break;
    const relDef = defMap.get(relKw.toLowerCase());
    if (relDef) distractors.push(cap(relDef));
  }

  // ── Fallback distractors — subject-aware ──────────────────────────────
  const fallbackKws = distPool.filter(k => !distractors.some(d => d.toLowerCase().includes(k)));
  const fallbackCon = concepts.filter(c => c.toLowerCase() !== kwL && !c.includes('_'));

  const fillers = subjectType === 'math' ? [
    fallbackKws[0] ? `A property that applies to ${fallbackKws[0]} but not to ${kw}` : `A property that holds only for real numbers, not complex ones`,
    fallbackCon[0] ? `The inverse operation of ${fallbackCon[0]}`                    : `The inverse or reciprocal form of this operation`,
    fallbackKws[1] ? `A special case of ${fallbackKws[1]} unrelated to ${kw}`        : `A special case valid only under restricted conditions`,
  ] : subjectType === 'physics' ? [
    fallbackKws[0] ? `A quantity measured in different units from ${kw}`   : `A scalar quantity, unlike the vector form described`,
    fallbackCon[0] ? `A property of ${fallbackCon[0]}, not of ${kw}`      : `An effect observed only at relativistic speeds`,
    fallbackKws[1] ? `The rate of change of ${fallbackKws[1]}, not ${kw}` : `A conserved quantity in elastic collisions only`,
  ] : subjectType === 'chemistry' ? [
    fallbackKws[0] ? `A property of ${fallbackKws[0]}, not of ${kw}`        : `A property exhibited only by ionic compounds`,
    fallbackCon[0] ? `A reaction involving ${fallbackCon[0]} instead of ${kw}` : `An endothermic process with the opposite enthalpy change`,
    fallbackKws[1] ? `The oxidised form of ${fallbackKws[1]}`               : `A catalyst that lowers activation energy for a different reaction`,
  ] : subjectType === 'biology' ? [
    fallbackKws[0] ? `A structure found in ${fallbackKws[0]} but not in ${kw}` : `A structure present only in prokaryotic cells`,
    fallbackCon[0] ? `A process that occurs in ${fallbackCon[0]}, not in ${kw}` : `A process that occurs only during meiosis, not mitosis`,
    fallbackKws[1] ? `The enzyme that breaks down ${fallbackKws[1]}`        : `An organelle responsible for a different cellular function`,
  ] : [
    fallbackKws[0] ? `A method primarily concerned with ${fallbackKws[0]} rather than ${kw}` : 'An unrelated theoretical framework',
    fallbackCon[0] ? `${fallbackCon[0]} and its associated principles`                        : 'A separate methodological approach',
    fallbackKws[1] ? `The study of ${fallbackKws[1]} in this context`                         : 'A concept operating independently of the described process',
  ];

  while (distractors.length < 3) distractors.push(fillers[distractors.length]);

  // ── Shuffle ───────────────────────────────────────────────────────────
  const pool  = [correctOption, ...distractors.slice(0, 3)];
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const options    = order.map(idx => pool[idx]);
  const correctIdx = order.indexOf(0);
  return { options, answer: `${String.fromCharCode(65 + correctIdx)}) ${correctOption}` };
}

function getInstructions(section: Section): string {
  const { marks, count, type } = section;
  if (/multiple choice|true/i.test(type)) return `Answer all questions. Each question carries ${marks} mark${marks > 1 ? 's' : ''}.`;
  if (/short/i.test(type))                return `Answer any ${Math.ceil(count * 0.7)} questions. Each carries ${marks} marks.`;
  if (/essay|long/i.test(type))           return `Answer any ${Math.ceil(count / 2)} questions. Each carries ${marks} marks.`;
  return `Answer all questions. Each question carries ${marks} mark${marks > 1 ? 's' : ''}.`;
}

export function savePaper(paper: Paper): void {
  _papers = [..._papers.filter(p => p.id !== paper.id), paper];
  dbPut('papers', paper).catch(e => console.error('[DB] savePaper failed:', e));
}
// ── Chapter Splitting ──

/**
 * Extracts the full chapter title from the text after `matchEnd`.
 *
 * With hasEOL-preserved extraction the text now has real newlines, so we can
 * reliably read the next non-empty line as the chapter heading.
 *
 * Layout A (same line with separator):  "CHAPTER 1: Atoms and Molecules"
 * Layout B (title on its own line):     "CHAPTER 1\nAtoms and Molecules\n"
 * Layout C (number on one line, title next): "CHAPTER\n1\nAtoms and Molecules"
 */
function extractChapterTitle(
  keyword: string,
  num: string,
  matchEnd: number,
  text: string
): string {
  const prefix = `${keyword.charAt(0).toUpperCase()}${keyword.slice(1).toLowerCase()} ${num}`;

  // Scan the 300 chars immediately after the match
  const after = text.slice(matchEnd, matchEnd + 300);

  // Layout A: colon/dash separator on same line — "Chapter 1: Title" or "Chapter 1 - Title"
  const inlineMatch = after.match(/^[ \t]*[:–\-—]+[ \t]*([^\n]{3,80})/);
  if (inlineMatch) {
    const candidate = inlineMatch[1].trim().replace(/\s+/g, ' ');
    // Reject if it reads like running body text (lowercase start, too long, ends mid-sentence)
    if (/^[A-Z]/.test(candidate) && candidate.length <= 80 && !/[.!?]$/.test(candidate)) {
      return `${prefix}: ${candidate}`;
    }
  }

  // Layout B/C: look at each line after the match until we find a heading-like line
  const lines = after.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/\s+/g, ' ');
    if (!line) continue;

    const wordCount = line.split(' ').length;
    const isAllCaps = line === line.toUpperCase() && /[A-Z]{2,}/.test(line);
    const isTitleCase = /^[A-Z]/.test(line) && wordCount <= 10;

    if ((isAllCaps || isTitleCase) && line.length >= 3 && line.length <= 90 && wordCount <= 12) {
      // Nicely capitalise ALL-CAPS titles (e.g. "ATOMS AND MOLECULES" → "Atoms and Molecules")
      const STOP_WORDS = new Set(['and','or','of','the','in','a','an','to','for','with','by','on','at','from']);
      const formatted = isAllCaps
        ? line.replace(/\b\w+/g, (w, i) =>
            i === 0 || !STOP_WORDS.has(w.toLowerCase())
              ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
              : w.toLowerCase()
          )
        : line;
      return `${prefix}: ${formatted}`;
    }
    // First non-empty line looked like body text — give up looking
    break;
  }

  return prefix; // fallback: just "Chapter 1"
}

export function splitTextIntoChapters(text: string, baseTitle: string): { title: string, text: string }[] {
  // Regex finds the chapter keyword + number only; title extraction happens separately below.
  const chapterRegex = /\b(CHAPTER|UNIT|MODULE|LESSON|TOPIC|PART)\s+([0-9IVX]+)\b/gi;
  
  const matches = [...text.matchAll(chapterRegex)];
  if (matches.length < 2) return [{ title: baseTitle, text }];
  
  const chaptersMap = new Map<string, { title: string, text: string }>();
  
  // 1. Filter out inline references (e.g. "see Chapter 3", "covered in Unit 2")
  const validMatches = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const before = text.slice(Math.max(0, match.index! - 20), match.index!).toLowerCase();
    const isInline = /\b(in|see|from|read|to|refer|discuss(ed)?|covered)\s+$/i.test(before);
    if (!isInline) validMatches.push({ match, nextMatch: matches[i + 1] });
  }

  // 2. Find dominant prefix to prevent 12 chapters when there are 6 chapters and 6 units
  const prefixCounts: Record<string, number> = { CHAPTER: 0, UNIT: 0, MODULE: 0, LESSON: 0, TOPIC: 0, PART: 0 };
  for (const { match } of validMatches) {
    const prefix = match[1].toUpperCase();
    if (prefix in prefixCounts) prefixCounts[prefix]++;
  }

  const priorities = ['CHAPTER', 'UNIT', 'MODULE', 'LESSON', 'TOPIC', 'PART'];
  let dominantPrefix: string | null = null;
  for (const p of priorities) {
    if (prefixCounts[p] >= 2) {
      dominantPrefix = p;
      break;
    }
  }

  const filteredMatches = dominantPrefix 
    ? validMatches.filter(m => m.match[1].toUpperCase() === dominantPrefix)
    : validMatches;

  // 3. Group by ID to merge TOC entries and actual chapter bodies
  for (let i = 0; i < filteredMatches.length; i++) {
    const { match } = filteredMatches[i];
    const nextMatch = filteredMatches[i + 1] ? filteredMatches[i + 1].match : null;
    
    const startIndex = match.index!;
    const endIndex = nextMatch ? nextMatch.index! : text.length;
    const chapterText = text.slice(startIndex, endIndex).trim();

    const type = match[1].toUpperCase();
    const num = match[2].toUpperCase();
    const chapterId = `${type} ${num}`; // e.g. "CHAPTER 1"

    // Extract the full human-readable title by looking at text after the match
    const matchEnd = match.index! + match[0].length;
    const header = extractChapterTitle(match[1], num, matchEnd, text);
    
    // Ignore extremely short chunks (TOC artifacts)
    if (chapterText.length > 500) {
      const existing = chaptersMap.get(chapterId);
      if (existing) {
        // Keep the most descriptive title (longest, or one that has ": Name" vs bare "Chapter N")
        const existingHasName = existing.title.includes(':');
        const headerHasName = header.includes(':');
        const bestTitle = (headerHasName && !existingHasName)
          ? header
          : (!headerHasName && existingHasName)
            ? existing.title
            : header.length > existing.title.length ? header : existing.title;
        chaptersMap.set(chapterId, { title: bestTitle, text: existing.text + '\n\n' + chapterText });
      } else {
        chaptersMap.set(chapterId, { title: header, text: chapterText });
      }
    }
  }
  
  const chapters = Array.from(chaptersMap.values());
  if (chapters.length < 2) return [{ title: baseTitle, text }];
  return chapters;
}

export function getPapers(): Paper[] { return _papers; }
export function getPaper(id: string): Paper | null {
  return _papers.find(p => p.id === id) ?? null;
}
export function deletePaper(id: string): void {
  _papers = _papers.filter(p => p.id !== id);
  dbDelete('papers', id).catch(e => console.error('[DB] deletePaper failed:', e));
}
export function clearAllPapers(): void {
  _papers = [];
  import('./db').then(m => m.dbClear('papers')).catch(e => console.error('[DB] clearAllPapers failed:', e));
}
export function updatePaperTags(id: string, tags: string[]): void {
  _papers = _papers.map(p => p.id === id ? { ...p, tags } : p);
  const updated = _papers.find(p => p.id === id);
  if (updated) dbPut('papers', updated).catch(e => console.error('[DB] updatePaperTags failed:', e));
}
export function updatePaperSection(id: string, sectionIdx: number, section: PaperSection): void {
  _papers = _papers.map(p => {
    if (p.id !== id) return p;
    const sections = [...p.sections];
    sections[sectionIdx] = section;
    return { ...p, sections };
  });
  const updated = _papers.find(p => p.id === id);
  if (updated) dbPut('papers', updated).catch(e => console.error('[DB] updatePaperSection failed:', e));
}

// ── Regenerate a single section's questions ──
export async function regenerateSection(
  paper: Paper,
  sectionIdx: number,
): Promise<PaperSection> {
  const sec     = paper.sections[sectionIdx];
  const useLLM  = getLMStudioConfig().enabled;
  const text    = paper.sourceText ?? '';
  const isPromptMode = paper.isPromptMode || paper.sourceFile === 'Custom Prompt';

  // Build a Section descriptor from the stored PaperSection
  const sectionDef: Section = {
    name:       sec.name,
    type:       sec.type,
    count:      sec.questions.length,
    marks:      sec.questions[0]?.marks ?? 1,
    difficulty: 'Mixed',
  };

  let questions: Question[];

  if (useLLM && text) {
    questions = await generateQuestionsWithLLM(
      text, sectionDef, sectionIdx, paper.subject,
      paper.subjectType ?? 'general', [], paper.academicLevel ?? 'High School',
      isPromptMode,
      paper.institutionStyle ?? 'standard',
      paper.customInstructions
    );
  } else if (text) {
    if (isPromptMode) {
      throw new Error(
        "Local AI (LM Studio) must be enabled in Settings to regenerate questions for a prompt-based paper."
      );
    }
    // Template fallback when LLM is off but text is available
    const analysis = analyzeContent(text);
    const { keywords, topics, definitions, facts, concepts, sentences } = analysis;
    questions = templateQuestions(
      sectionDef, sectionIdx,
      keywords, topics, concepts, sentences, definitions, facts,
      paper.subject,
    );
  } else {
    throw new Error(
      'No source text stored for this paper. ' +
      'Re-generate the paper from the original PDF to enable section regeneration.',
    );
  }

  return { name: sec.name, instructions: sec.instructions, type: sec.type, questions };
}
