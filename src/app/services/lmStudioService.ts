import { Section, Question } from './pdfService';

export interface LMStudioConfig {
  enabled: boolean;
  apiUrl: string;
  model: string;
  apiToken: string;
  maxTokens: number;
  contextChars: number;
}

export function getLMStudioConfig(): LMStudioConfig {
  const stored = localStorage.getItem('lmStudioConfig');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        maxTokens:    parsed.maxTokens    ?? 2048,
        contextChars: parsed.contextChars ?? 6000,
        ...parsed,
      };
    } catch { /* fall through */ }
  }
  return {
    enabled:      false,
    apiUrl:       'http://localhost:1234/v1',
    model:        '',
    apiToken:     '',
    maxTokens:    2048,
    contextChars: 6000,
  };
}

export function saveLMStudioConfig(config: LMStudioConfig): void {
  localStorage.setItem('lmStudioConfig', JSON.stringify(config));
}

// ── Fetch the list of loaded models from LM Studio ──
export async function fetchAvailableModels(apiUrl: string, apiToken: string): Promise<string[]> {
  try {
    const res = await fetch(`${apiUrl}/models`, {
      headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data as { id: string }[]).map(m => m.id);
  } catch {
    return [];
  }
}

export async function testLMStudioConnection(apiUrl: string, apiToken: string): Promise<boolean> {
  try {
    const models = await fetchAvailableModels(apiUrl, apiToken);
    return models.length > 0;
  } catch {
    return false;
  }
}

// ── Smart sampler: spread across beginning, middle, end ──
function samplePdfText(pdfText: string, maxChars: number): string {
  if (pdfText.length <= maxChars) return pdfText;
  const t   = Math.floor(maxChars / 3);
  const mid = Math.floor(pdfText.length / 2);
  return (
    pdfText.slice(0, t) +
    '\n...\n' +
    pdfText.slice(mid - Math.floor(t / 2), mid + Math.floor(t / 2)) +
    '\n...\n' +
    pdfText.slice(pdfText.length - t)
  );
}

// ── Build a tight, well-structured prompt per question type ──
function buildPrompt(pdfSample: string, section: Section, subject: string): string {
  const { count, type, difficulty, marks } = section;
  const typeLC = type.toLowerCase();

  let format = '';
  let example = '';

  if (typeLC.includes('multiple choice') || typeLC.includes('mcq')) {
    format  = 'Numbered list. Each question followed by exactly 4 options on separate lines prefixed A) B) C) D).';
    example = `1. What is the main function of X?\nA) Option one\nB) Option two\nC) Option three\nD) Option four`;
  } else if (typeLC.includes('true') || typeLC.includes('false')) {
    format  = 'Numbered list of statements only. No answers, no explanations.';
    example = `1. X is defined as Y.\n2. The process of Z involves W.`;
  } else if (typeLC.includes('short')) {
    format  = 'Numbered list of questions only. Each question should require a 2–4 sentence answer.';
    example = `1. Define X and explain its significance.\n2. Describe the role of Y in Z.`;
  } else if (typeLC.includes('essay') || typeLC.includes('long')) {
    format  = 'Numbered list of essay prompts only.';
    example = `1. Critically analyse the concept of X and its impact on Y.\n2. Discuss the relationship between A and B with examples.`;
  } else if (typeLC.includes('fill')) {
    format  = 'Numbered list. Use __________ for the blank. One blank per sentence.';
    example = `1. The process of X is primarily used for __________.\n2. __________ is defined as the study of Y.`;
  } else {
    format  = 'Numbered list of questions.';
    example = `1. Explain X.\n2. Describe Y.`;
  }

  return `You are an expert exam paper writer for ${subject}.
Using ONLY the textbook content provided, write exactly ${count} ${difficulty} ${type} questions.
Each question is worth ${marks} mark(s).

TEXTBOOK CONTENT:
${pdfSample}

OUTPUT FORMAT — follow this exactly:
${format}

EXAMPLE:
${example}

RULES:
- Write exactly ${count} questions. No more, no less.
- Base every question directly on the provided content.
- Do NOT include answers, answer keys, or explanations.
- Do NOT add section headers, preamble, or closing remarks.
- Start immediately with "1."`;
}

// ── Core LLM call with timeout ──
async function callLLM(prompt: string, config: LMStudioConfig): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiToken) headers['Authorization'] = `Bearer ${config.apiToken}`;

  const controller = new AbortController();
  // Generous timeout — local LLMs can be slow
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    const res = await fetch(`${config.apiUrl}/chat/completions`, {
      method:  'POST',
      headers,
      signal:  controller.signal,
      body: JSON.stringify({
        model:       config.model,
        messages:    [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens:  config.maxTokens,
        stream:      false,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // 500 / 503 usually means the model crashed (OOM) or is still loading
      if (res.status === 500 || res.status === 503) {
        throw new Error(
          `LM Studio crashed (status ${res.status}). ` +
          'This is usually an Out-of-Memory error — your model is too large. ' +
          'Try: (1) load a smaller model (3–8B), or (2) reduce Context Chars and Max Tokens in LM Studio Settings.'
        );
      }
      throw new Error(`LM Studio error ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) {
      throw new Error(
        'LM Studio returned an empty response. ' +
        'The model may have run out of memory mid-generation. ' +
        'Try reducing Max Tokens or switching to a smaller model.'
      );
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// ── Robust parser — handles many LLM output variations ──
function parseQuestions(raw: string, section: Section, sectionIdx: number): Question[] {
  const { type, count, marks } = section;
  const typeLC = type.toLowerCase();
  const isMCQ  = typeLC.includes('multiple choice') || typeLC.includes('mcq');
  const isTF   = typeLC.includes('true') || typeLC.includes('false');

  // Split on numbered items: "1." / "1)" / "Q1." / "Question 1."
  const blocks = raw
    .split(/(?:^|\n)(?:Q(?:uestion)?\s*)?\d+[\.\)]\s+/i)
    .map(b => b.trim())
    .filter(b => b.length > 5);

  const questions: Question[] = [];

  for (let i = 0; i < blocks.length && questions.length < count; i++) {
    const id    = sectionIdx * 100 + questions.length + 1;
    const block = blocks[i];
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

    if (!lines.length) continue;

    if (isMCQ) {
      // First line(s) before A) are the question text
      const optionStart = lines.findIndex(l => /^[A-Da-d][\)\.]\s+/.test(l));
      if (optionStart === -1) {
        // No options found — still save the question text
        questions.push({ id, text: lines[0], marks });
        continue;
      }
      const questionText = lines.slice(0, optionStart).join(' ').trim();
      const options = lines
        .slice(optionStart)
        .filter(l => /^[A-Da-d][\)\.]\s+/.test(l))
        .map(l => l.replace(/^[A-Da-d][\)\.]\s+/, '').trim())
        .slice(0, 4);
      if (options.length >= 2) {
        questions.push({ id, text: questionText || lines[0], options, marks });
      }
    } else if (isTF) {
      questions.push({ id, text: lines.join(' '), options: ['True', 'False'], marks });
    } else {
      questions.push({ id, text: lines.join(' '), marks });
    }
  }

  // If we got fewer questions than expected, try a line-by-line fallback
  if (questions.length < Math.ceil(count * 0.5)) {
    console.warn(`Parser only found ${questions.length}/${count} questions — trying fallback`);
    const fallbackLines = raw
      .split('\n')
      .map(l => l.replace(/^(?:Q(?:uestion)?\s*)?\d+[\.\)]\s*/i, '').trim())
      .filter(l => l.length > 15 && !/^[A-Da-d][\)\.]\s+/.test(l));

    for (let i = questions.length; i < count && i < fallbackLines.length; i++) {
      const id = sectionIdx * 100 + i + 1;
      const text = fallbackLines[i];
      if (isTF)  questions.push({ id, text, options: ['True', 'False'], marks });
      else       questions.push({ id, text, marks });
    }
  }

  return questions;
}

// ── Main export: generate questions for one section ──
export async function generateQuestionsWithLLM(
  pdfText: string,
  section: Section,
  sectionIdx: number,
  subject: string
): Promise<Question[]> {
  const config = getLMStudioConfig();
  if (!config.enabled) throw new Error('LM Studio is not enabled');
  if (!config.model)   throw new Error('No model selected. Please pick a model in LM Studio Settings.');

  const sample = samplePdfText(pdfText, config.contextChars);
  const prompt = buildPrompt(sample, section, subject);

  console.log(`[LLM] Section "${section.name}" — ${section.count}× ${section.type}`);
  const t0  = performance.now();
  const raw = await callLLM(prompt, config);
  console.log(`[LLM] Response in ${((performance.now() - t0) / 1000).toFixed(1)}s — ${raw.length} chars`);

  const questions = parseQuestions(raw, section, sectionIdx);
  console.log(`[LLM] Parsed ${questions.length}/${section.count} questions`);
  return questions;
}
