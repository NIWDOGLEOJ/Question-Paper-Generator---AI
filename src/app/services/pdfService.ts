// PDF text extraction using pdfjs-dist + Tesseract.js OCR fallback
import * as pdfjsLib from 'pdfjs-dist';
import { getLMStudioConfig, generateQuestionsWithLLM } from './lmStudioService';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// ── Limits ──
const MAX_PAGES_TO_EXTRACT  = 150;
const MAX_CHARS_PER_PAGE    = 5_000;
const MAX_TOTAL_CHARS       = 300_000;
const ANALYSIS_SAMPLE_CHARS = 30_000;
const PAGE_BATCH_SIZE       = 10;
// For scanned PDFs: OCR is slow so cap lower
const MAX_OCR_PAGES         = 30;

export interface Section {
  name: string; type: string; count: number; marks: number; difficulty: string;
}
export interface Question {
  id: number; text: string; options?: string[]; marks?: number;
}
export interface PaperSection {
  name: string; instructions: string; type: string; questions: Question[];
}
export interface Paper {
  id: string; title: string; subject: string; duration: string;
  totalMarks: number; sections: PaperSection[];
  createdAt: string; sourceFile: string;
}

function isSkippablePage(text: string): boolean {
  if (text.trim().length < 60) return true;
  const lower = text.toLowerCase();
  return ['all rights reserved', 'isbn ', 'cataloging-in-publication']
    .filter(p => lower.includes(p)).length >= 2;
}

// ── Extract digital text from one page ──
async function extractPageText(pdf: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<string> {
  try {
    const page    = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const text    = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
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

// ── Main extraction ──
export async function extractTextFromPDF(
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  let pdf: pdfjsLib.PDFDocumentProxy | null = null;
  const report = (msg: string) => { console.log(msg); onProgress?.(msg); };

  try {
    const t0          = performance.now();
    const arrayBuffer = await file.arrayBuffer();

    pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      disableRange: true,
      disableStream: true,
      isEvalSupported: false,
    }).promise;

    const total = Math.min(pdf.numPages, MAX_PAGES_TO_EXTRACT);
    report(`PDF loaded — ${pdf.numPages} pages, processing up to ${total}`);

    // ── Phase 1: Try digital text extraction in parallel batches ──
    const pageNums = Array.from({ length: total }, (_, i) => i + 1);
    const chunks: string[] = [];

    for (let i = 0; i < pageNums.length; i += PAGE_BATCH_SIZE) {
      const batch   = pageNums.slice(i, i + PAGE_BATCH_SIZE);
      const results = await Promise.all(batch.map(n => extractPageText(pdf!, n)));
      chunks.push(...results);
      if (chunks.join('').length >= MAX_TOTAL_CHARS) break;
    }

    let fullText = chunks.filter(Boolean).join('\n\n').trim();
    const digitalCharCount = fullText.length;
    report(`Digital text: ${digitalCharCount.toLocaleString()} chars`);

    // ── Phase 2: If too little text found → scanned PDF → run OCR ──
    if (digitalCharCount < 200) {
      report('Detected scanned PDF — starting OCR (this takes 1–3 min for large files)…');

      const worker = await createTesseractWorker(report);

      if (!worker) {
        throw new Error(
          'OCR failed to initialise. Try clearing the Vite cache and restarting: ' +
          'stop the dev server, run \'rm -rf node_modules/.vite\', then \'pnpm dev\''
        );
      }

      const ocrPages = Math.min(pdf.numPages, MAX_OCR_PAGES);
      const ocrChunks: string[] = [];

      for (let pageNum = 1; pageNum <= ocrPages; pageNum++) {
        report(`OCR: page ${pageNum} / ${ocrPages}…`);
        const canvas = await renderPageToCanvas(pdf, pageNum);
        if (!canvas) continue;
        const text = await ocrCanvas(canvas, worker);
        if (text.length > 30) ocrChunks.push(text);
        if (ocrChunks.join('').length >= MAX_TOTAL_CHARS) break;
      }

      await worker.terminate();
      fullText = ocrChunks.join('\n\n').trim();
      report(`OCR complete — ${fullText.length.toLocaleString()} chars extracted`);
    }

    // ── Final clean-up ──
    fullText = fullText
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, MAX_TOTAL_CHARS);

    report(`Extraction done in ${((performance.now() - t0) / 1000).toFixed(1)}s`);

    if (fullText.length < 50) {
      throw new Error(
        'Could not extract any readable text from this PDF. ' +
        'If it is a scanned document, make sure tesseract.js is installed (pnpm add tesseract.js).'
      );
    }

    return fullText;

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('tesseract') || error.message.includes('scanned') || error.message.includes('OCR')) throw error;
      if (error.message.includes('Invalid PDF'))  throw new Error('Not a valid PDF file.');
      if (error.message.includes('password'))     throw new Error('PDF is password-protected. Please unlock it first.');
    }
    throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (pdf) try { await pdf.destroy(); } catch { /* ignore */ }
  }
}

// ── Content analysis — runs on a capped sample only ──
interface ContentAnalysis {
  keywords: string[]; topics: string[]; definitions: string[];
  facts: string[]; concepts: string[]; sentences: string[];
}

function buildSample(text: string): string {
  if (text.length <= ANALYSIS_SAMPLE_CHARS) return text;
  const t = Math.floor(ANALYSIS_SAMPLE_CHARS / 3);
  const mid = Math.floor(text.length / 2);
  return text.slice(0, t) +
    text.slice(mid - Math.floor(t / 2), mid + Math.floor(t / 2)) +
    text.slice(text.length - t);
}

function analyzeContent(pdfText: string): ContentAnalysis {
  const sample   = buildSample(pdfText);
  const sentences = sample.split(/[.!?]+/).map(s => s.trim())
    .filter(s => s.length > 30 && s.length < 250 && !/^(page|chapter|\d+|figure|table)/i.test(s));

  const wordFreq = new Map<string, number>();
  for (const w of sample.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/)) {
    if (w.length > 4 && !isCommonWord(w) && !/^\d+$/.test(w))
      wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
  }
  const keywords = [...wordFreq.entries()].filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1]).slice(0, 100).map(([w]) => w);

  const topicRaw = sample.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}/g) || [];
  const topics   = [...new Set(topicRaw)]
    .filter(t => t.length > 3 && !/^(The|This|That|Chapter|Section|Figure|Table)/.test(t)).slice(0, 50);

  const definitions = sentences
    .filter(s => /\bis\b|\bare\b|defined as|refers to|means that|known as/i.test(s) && s.length < 150).slice(0, 30);
  const facts = sentences
    .filter(s => /\d+%|\d+ percent|approximately|about \d+|studies show|research indicates|according to/i.test(s)).slice(0, 20);

  const phraseFreq = new Map<string, number>();
  const phraseRe   = /\b([A-Z][a-z]+(?:\s+[a-z]+){1,3})\b/g;
  let pm: RegExpExecArray | null;
  const phraseScan = sample.slice(0, 15_000);
  while ((pm = phraseRe.exec(phraseScan)) !== null)
    phraseFreq.set(pm[1], (phraseFreq.get(pm[1]) || 0) + 1);
  const concepts = [...phraseFreq.entries()].filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1]).slice(0, 40).map(([p]) => p);

  return { keywords, topics, definitions, facts, concepts, sentences };
}

// ── Generate questions ──
export async function generateQuestions(
  pdfText: string, sections: Section[], paperTitle: string,
  subject: string, duration: string, fileName: string
): Promise<Paper> {
  const t0     = performance.now();
  const useLLM = getLMStudioConfig().enabled;
  const analysis = analyzeContent(pdfText);
  const { keywords, topics, definitions, facts, concepts, sentences } = analysis;

  let generatedSections: PaperSection[];

  if (useLLM) {
    generatedSections = [];
    for (let idx = 0; idx < sections.length; idx++) {
      const section = sections[idx];
      let questions: Question[];
      try {
        questions = await generateQuestionsWithLLM(pdfText, section, idx, subject);
      } catch (err) {
        console.warn(`LLM failed for "${section.name}", using template:`, err);
        questions = templateQuestions(section, idx, keywords, topics, concepts, sentences, definitions, facts, subject);
      }
      generatedSections.push({ name: section.name, instructions: getInstructions(section), type: section.type, questions });
    }
  } else {
    generatedSections = sections.map((section, idx) => ({
      name: section.name, instructions: getInstructions(section), type: section.type,
      questions: templateQuestions(section, idx, keywords, topics, concepts, sentences, definitions, facts, subject),
    }));
  }

  console.log(`generateQuestions: ${((performance.now() - t0) / 1000).toFixed(2)}s`);
  return {
    id: `paper-${Date.now()}`, title: paperTitle, subject, duration,
    totalMarks: sections.reduce((a, s) => a + s.count * s.marks, 0),
    sections: generatedSections, createdAt: new Date().toISOString(), sourceFile: fileName,
  };
}

// ── Template generation ──
function templateQuestions(
  section: Section, sectionIdx: number, keywords: string[], topics: string[],
  concepts: string[], sentences: string[], definitions: string[], facts: string[], subject: string
): Question[] {
  const kl = Math.max(keywords.length, 1), tl = Math.max(topics.length, 1);
  const cl = Math.max(concepts.length, 1), sl = Math.max(sentences.length, 1);
  const dl = Math.max(definitions.length, 1), fl = Math.max(facts.length, 1);

  return Array.from({ length: section.count }, (_, i) => {
    const id = sectionIdx * 100 + i + 1;
    const kw = keywords[(i * 7) % kl] || 'concept', kw2 = keywords[(i * 13) % kl] || 'theory';
    const topic = topics[(i * 3) % tl] || subject, concept = concepts[(i * 5) % cl] || kw;
    const sentence = sentences[(i * 11) % sl], definition = definitions[i % dl], fact = facts[i % fl];
    const type = section.type.toLowerCase().replace(/[\s/]+/g, '');

    if (type.includes('multiplechoice') || type.includes('mcq')) {
      const q = [`What is the primary function of ${kw}?`, `Which statement best describes ${concept}?`,
        `In the context of ${topic}, what is the significance of ${kw}?`,
        `Which of the following correctly explains ${kw}?`, `What role does ${kw2} play in relation to ${kw}?`,
        definition ? `"${definition.split(/\bis\b|\bare\b/)[0].trim()}" is:` : `How is ${concept} characterised?`,
        `Which statement about ${topic} is accurate?`, `${kw} is best understood as:`][i % 8];
      return { id, text: q, options: mcqOptions(kw, keywords, concepts), marks: section.marks };
    }
    if (type.includes('true') || type.includes('false')) {
      const q = [`${topic} is fundamentally related to ${kw}.`,
        sentence?.length > 40 && sentence.length < 120 ? sentence : `${kw} plays a central role in ${subject}.`,
        `The primary purpose of ${kw} is to enhance ${kw2}.`, `${concept} is an essential component of ${topic}.`,
        definition?.slice(0, 150) || `${kw} can be classified as a type of ${kw2}.`,
        fact || `${kw} significantly impacts ${subject}.`,
        `${topic} and ${kw} are interdependent concepts.`, `${kw} is more important than ${kw2}.`][i % 8];
      return { id, text: q, options: ['True', 'False'], marks: section.marks };
    }
    if (type.includes('short')) {
      const q = [`Define ${kw} and explain its significance.`, `What are the key characteristics of ${concept}?`,
        `Briefly explain the relationship between ${kw} and ${kw2}.`, `Describe the main features of ${topic}.`,
        `What is meant by ${kw}?`, `Explain how ${kw} contributes to ${subject}.`,
        `List the main aspects of ${concept}.`, `Compare ${kw} with ${kw2}.`][i % 8];
      return { id, text: q, marks: section.marks };
    }
    if (type.includes('essay') || type.includes('long')) {
      const q = [`Write a comprehensive essay on ${kw} and its applications in ${subject}.`,
        `Discuss the relationship between ${kw} and ${kw2} with examples.`,
        `Critically analyse ${topic}. Include theories and real-world applications.`,
        `Explain the importance of ${concept} in ${subject} with examples.`,
        `Compare and contrast ${kw} with ${kw2}.`,
        `Evaluate the impact of ${kw} on ${subject}, including advantages and limitations.`,
        `Describe the current understanding of ${topic}.`,
        `Analyse how ${kw} relates to other key concepts in ${subject}.`][i % 8];
      return { id, text: q, marks: section.marks };
    }
    if (type.includes('fill') || type.includes('blank')) {
      const q = [`The process of ${kw} is primarily used for __________.`,
        `In ${subject}, ${kw} is defined as __________.`, `${topic} consists of __________ and ${kw}.`,
        `The main function of ${kw} is to __________.`, `${concept} can be achieved through __________ and ${kw2}.`,
        `The relationship between ${kw} and ${kw2} demonstrates __________.`,
        `According to the text, ${kw} leads to __________.`,
        `One key characteristic of ${topic} is __________.`][i % 8];
      return { id, text: q, marks: section.marks };
    }
    return { id, text: `Explain ${kw} and its significance in ${subject}. (${section.marks} marks)`, marks: section.marks };
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

function mcqOptions(correct: string, keywords: string[], concepts: string[]): string[] {
  const ok = keywords.filter(k => k !== correct), oc = concepts.filter(c => c.toLowerCase() !== correct.toLowerCase());
  return [`A process that involves ${correct} and its related mechanisms`,
    ok[0] ? `A framework based on ${ok[0]} rather than ${correct}` : 'An unrelated concept',
    ok[1] ? `The implementation of ${ok[1]} in practical contexts` : 'A different theoretical approach',
    oc[0] ? `${oc[0]} and its applications` : 'An alternative methodology',
  ].sort(() => Math.random() - 0.5);
}

function getInstructions(section: Section): string {
  const { marks, count, type } = section;
  if (/multiple choice|true/i.test(type)) return `Answer all questions. Each question carries ${marks} mark${marks > 1 ? 's' : ''}.`;
  if (/short/i.test(type))                return `Answer any ${Math.ceil(count * 0.7)} questions. Each carries ${marks} marks.`;
  if (/essay|long/i.test(type))           return `Answer any ${Math.ceil(count / 2)} questions. Each carries ${marks} marks.`;
  return `Answer all questions. Each question carries ${marks} mark${marks > 1 ? 's' : ''}.`;
}

export function savePaper(paper: Paper): void {
  localStorage.setItem('questionPapers', JSON.stringify([...getPapers(), paper]));
}
export function getPapers(): Paper[] {
  try { return JSON.parse(localStorage.getItem('questionPapers') || '[]'); } catch { return []; }
}
export function getPaper(id: string): Paper | null {
  return getPapers().find(p => p.id === id) || null;
}
export function deletePaper(id: string): void {
  localStorage.setItem('questionPapers', JSON.stringify(getPapers().filter(p => p.id !== id)));
}
