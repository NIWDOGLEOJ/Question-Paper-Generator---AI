import { Section, Question, SubjectType } from './pdfService';

// ── Subject-specific prompt additions for STEM ───────────────────────────
const STEM_PROMPT: Record<Exclude<SubjectType,'general'>, string> = {
  physics: `SUBJECT-SPECIFIC RULES (Physics):
- Prefer questions about laws, principles, and their mathematical expressions.
- Include questions asking for SI units where relevant (e.g. "What is the SI unit of force?").
- For Short Answer and Essay: include "State and prove", "Derive the expression for", or "Describe an experiment to determine" style questions.
- MCQ distractors should use plausible but incorrect physical quantities or units.
- Do NOT invent numerical values not present in the text; ask conceptual questions about numbers that appear.`,

  chemistry: `SUBJECT-SPECIFIC RULES (Chemistry):
- Include questions on chemical reactions, bonding, and molecular properties present in the text.
- For Short Answer: include "Write the balanced equation for", "Define and give an example of", "Explain the mechanism of".
- For Essay: use "Describe the preparation and properties of", "Discuss with equations".
- MCQ options should use chemically plausible alternatives (e.g. wrong oxidation states, wrong products).
- Do NOT invent chemical formulas or reactions not present in the text.`,

  math: `SUBJECT-SPECIFIC RULES (Mathematics):
- Prefer questions that require applying a theorem, rule, or formula mentioned in the text.
- For Short Answer: include "Solve", "Prove that", "Find the value of", "Show that", "Simplify".
- For Essay: use "Derive the general formula for", "Prove the following theorem", "Apply the method of".
- MCQ options should use common calculation errors as distractors (e.g. sign errors, wrong formula variants).
- Focus on procedural AND conceptual understanding.`,

  biology: `SUBJECT-SPECIFIC RULES (Biology):
- Include questions about processes, structures, and functions described in the text.
- For Short Answer: include "Describe the role of", "Explain the process of", "Distinguish between".
- For Essay: use "Describe with diagrams", "Explain the significance of", "Compare and contrast".
- MCQ distractors should be anatomically or functionally plausible alternatives.
- Include diagram-based questions where relevant (describe what a diagram would show).`,
};

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

// ── STEM-aware sampler ──────────────────────────────────────────────────
// For STEM subjects we score each paragraph by how many numbers/symbols
// it contains and prefer the richest ones, up to maxChars total.
// For general subjects we fall back to the begin/mid/end spread.
function samplePdfText(
  pdfText: string,
  maxChars: number,
  subjectType: SubjectType = 'general',
): string {
  if (pdfText.length <= maxChars) return pdfText;

  if (subjectType === 'general') {
    // Original spread: beginning ⅓ + middle ⅓ + end ⅓
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

  // STEM: score paragraphs by density of numeric/symbolic content
  const paras = pdfText.split(/\n{2,}/).filter(p => p.trim().length > 40);
  const scored = paras.map(p => {
    const nums    = (p.match(/\d/g) ?? []).length;
    const symbols = (p.match(/[=+\-×÷∫∑∏√∞αβγδθλμπΩ≤≥≠±°]/g) ?? []).length;
    const units   = (p.match(/\b(?:kg|mol|m\/s|km\/h|\bN\b|\bJ\b|\bV\b|\bA\b|\bW\b|\bHz\b|°C|\bK\b|\bPa\b)/g) ?? []).length;
    // Density = score per char (so short but equation-dense paragraphs score high)
    const density = (nums * 2 + symbols * 4 + units * 3) / Math.max(p.length, 1);
    return { p, density, len: p.length };
  });

  // Sort by density descending, take until we reach maxChars
  scored.sort((a, b) => b.density - a.density);
  const chosen: string[] = [];
  let used = 0;
  for (const { p, len } of scored) {
    if (used + len > maxChars) continue;
    chosen.push(p);
    used += len;
    if (used >= maxChars * 0.9) break;
  }

  // Always prepend the first 500 chars (subject introduction / chapter opening)
  const intro = pdfText.slice(0, 500);
  return intro + '\n...\n' + chosen.join('\n\n');
}

// ── Bloom's level guidance injected into each prompt ──
const BLOOMS_PROMPT: Record<string, { level: string; description: string; exampleVerbs: string }> = {
  Easy:   { level: "Remember / Understand", description: "recall facts, define terms, describe from memory",       exampleVerbs: "Define, List, Identify, Name, State, Describe, Recall, Summarise" },
  Medium: { level: "Apply / Analyse",        description: "apply to a context, explain relationships, break down", exampleVerbs: "Explain, Compare, Classify, Differentiate, Apply, Examine, Illustrate, Solve" },
  Hard:   { level: "Evaluate / Create",      description: "judge evidence, assess claims, justify positions",      exampleVerbs: "Evaluate, Justify, Critique, Assess, Construct, Synthesise, Design, Formulate" },
};

// ── Build a tight, well-structured prompt per question type ──
function buildPrompt(
  pdfSample:    string,
  section:      Section,
  subject:      string,
  subjectType:  SubjectType = 'general',
  stemProblems: string[]    = [],
): string {
  const { count, type, difficulty, marks } = section;
  const bloom     = BLOOMS_PROMPT[difficulty] ?? BLOOMS_PROMPT.Medium;
  const typeLC    = type.toLowerCase();
  const stemBlock = subjectType !== 'general' ? '\n\n' + STEM_PROMPT[subjectType as Exclude<SubjectType,'general'>] : '';

  // ── Symbol handling guidance for STEM ────────────────────────────────
  // pdfjs often corrupts or drops math symbols. Instruct the LLM to handle gracefully.
  const symbolGuidance = subjectType !== 'general' ? `
SYMBOL / FORMULA HANDLING:
- The source text was extracted from a PDF and may contain garbled or missing mathematical symbols.
- If a formula or equation appears corrupted (e.g. "âˆ«" instead of "∫", "x ² " with extra spaces), infer the intended expression from context and write it correctly in your question.
- ALWAYS use standard LaTeX notation for mathematical equations, scientific units, and chemical formulas. Enclose inline math in single dollar signs (e.g. $E=mc^2$) and block equations in double dollar signs (e.g. $$ \int x^2 dx $$).
- If you cannot confidently reconstruct a formula, ask a CONCEPTUAL question about the topic instead — do NOT invent numbers or equations that are not supported by the text.` : '';

  let format = '';
  let example = '';

  if (typeLC.includes('multiple choice') || typeLC.includes('mcq')) {
    format  = 'Numbered list. Each question: question text, then exactly 4 options (A) B) C) D)), then "Answer: X" (the correct letter only).';
    example = `1. What is the main function of X?\nA) Option one\nB) Option two\nC) Option three\nD) Option four\nAnswer: A\n\n2. Which best describes Y?\nA) Desc one\nB) Desc two\nC) Desc three\nD) Desc four\nAnswer: C`;
  } else if (typeLC.includes('true') || typeLC.includes('false')) {
    format  = 'Numbered list. Each item: a factual statement, then "Answer: True" or "Answer: False" on the next line.';
    example = `1. X is defined as Y.\nAnswer: True\n\n2. The process of Z involves only W.\nAnswer: False`;
  } else if (typeLC.includes('short')) {
    format  = 'Numbered list. Each item: question text, then "Answer:" followed by a concise 2–3 sentence model answer.';
    example = `1. Define X and explain its significance.\nAnswer: X is the process of... It is significant because it enables...\n\n2. Describe the role of Y in Z.\nAnswer: Y functions as... In Z, it is responsible for...`;
  } else if (typeLC.includes('essay') || typeLC.includes('long')) {
    format  = 'Numbered list. Each item: essay prompt, then "Answer:" listing 4–5 key points a strong answer must cover.';
    example = `1. Critically analyse the concept of X and its impact on Y.\nAnswer: Key points: (1) Define X and its scope. (2) Historical context. (3) Relationship to Y. (4) Advantages and limitations. (5) Real-world examples.\n\n2. Discuss A and B with examples.\nAnswer: Key points: (1) Define A and B. (2) Compare their mechanisms. (3) Provide two concrete examples. (4) Analyse implications.`;
  } else if (typeLC.includes('fill')) {
    format  = 'Numbered list. Use __________ for the blank (one blank per sentence). Then "Answer: [the missing word or phrase]".';
    example = `1. The process of X is primarily used for __________.\nAnswer: energy production\n\n2. __________ is defined as the study of Y.\nAnswer: Biology`;
  } else {
    format  = 'Numbered list. Each item: question, then "Answer:" with a concise model answer.';
    example = `1. Explain X.\nAnswer: X refers to...\n\n2. Describe Y.\nAnswer: Y is characterised by...`;
  }

  // ── Inject sample problems extracted from the PDF (STEM boost) ──────
  const problemsBlock = stemProblems.length > 0
    ? `\nEXAMPLE PROBLEMS FROM THE TEXTBOOK (use these as inspiration — do NOT copy verbatim):\n` +
      stemProblems.slice(0, 10).map((p, i) => `${i + 1}. ${p}`).join('\n')
    : '';

  return `You are an expert exam paper writer for ${subject}.
Using ONLY the textbook content provided, write exactly ${count} ${type} questions.
Each question is worth ${marks} mark(s).

COGNITIVE LEVEL (Bloom's Taxonomy): ${difficulty} — ${bloom.level}
Target: ${bloom.description}.
Preferred question verbs: ${bloom.exampleVerbs}.${stemBlock}${symbolGuidance}${problemsBlock}

TEXTBOOK CONTENT:
${pdfSample}

OUTPUT FORMAT — follow this exactly:
${format}

EXAMPLE:
${example}

RULES:
- Write exactly ${count} questions. No more, no less.
- Base every question directly on the provided content.
- Match the cognitive level: ${bloom.level}. Use the preferred verbs listed above.
- Include an "Answer:" line for EVERY question exactly as shown in the format above.
- For MCQ: the Answer line must be just the letter (e.g., "Answer: B"). Do not repeat the option text.
- If a formula or symbol in the source text is garbled, ask a conceptual question instead — do NOT invent values.
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

// ── Extract the answer text from a raw question block ──
function extractAnswer(block: string): string | undefined {
  const idx = block.search(/\bAnswer:/i);
  if (idx === -1) return undefined;
  const after = block.slice(idx + 7).trim(); // 7 = "Answer:".length
  // Join multi-line answers, strip any trailing numbered item that leaked in
  const answer = after
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  return answer || undefined;
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
    // Strip answer section from lines so it doesn't pollute question text / options
    const blockNoAnswer = block.replace(/\bAnswer:[\s\S]*/i, '').trim();
    const lines = blockNoAnswer.split('\n').map(l => l.trim()).filter(Boolean);

    if (!lines.length) continue;

    if (isMCQ) {
      // First line(s) before A) are the question text
      const optionStart = lines.findIndex(l => /^[A-Da-d][\)\.]\s+/.test(l));
      if (optionStart === -1) {
        const answerText = extractAnswer(block);
        questions.push({ id, text: lines[0], marks, ...(answerText && { answer: answerText }) });
        continue;
      }
      const questionText = lines.slice(0, optionStart).join(' ').trim();
      const options = lines
        .slice(optionStart)
        .filter(l => /^[A-Da-d][\)\.]\s+/.test(l))
        .map(l => l.replace(/^[A-Da-d][\)\.]\s+/, '').trim())
        .slice(0, 4);

      // Map "Answer: B" → "B) Option text"
      const answerRaw = extractAnswer(block);
      let answer: string | undefined;
      if (answerRaw) {
        const letterMatch = answerRaw.match(/^([A-Da-d])[\).]?\s*/);
        if (letterMatch && options.length > 0) {
          const letterIdx = letterMatch[1].toUpperCase().charCodeAt(0) - 65; // A=0, B=1 …
          answer = options[letterIdx]
            ? `${String.fromCharCode(65 + letterIdx)}) ${options[letterIdx]}`
            : answerRaw;
        } else {
          answer = answerRaw;
        }
      }

      if (options.length >= 2) {
        questions.push({ id, text: questionText || lines[0], options, marks, ...(answer && { answer }) });
      }
    } else if (isTF) {
      const answerText = extractAnswer(block);
      questions.push({
        id, text: blockNoAnswer.replace(/^[A-Da-d][\)\.]\s+/gm, '').replace(/\s+/g, ' ').trim(),
        options: ['True', 'False'], marks,
        ...(answerText && { answer: answerText }),
      });
    } else {
      const answerText = extractAnswer(block);
      questions.push({
        id, text: lines.join(' '), marks,
        ...(answerText && { answer: answerText }),
      });
    }
  }

  // If we got fewer questions than expected, try a line-by-line fallback
  if (questions.length < Math.ceil(count * 0.5)) {
    console.warn(`Parser only found ${questions.length}/${count} questions — trying fallback`);
    const fallbackLines = raw
      .split('\n')
      .map(l => l.replace(/^(?:Q(?:uestion)?\s*)?\d+[\.\)]\s*/i, '').trim())
      .filter(l => l.length > 15 && !/^[A-Da-d][\)\.]\s+/.test(l) && !/\bAnswer:/i.test(l));

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
  pdfText:      string,
  section:      Section,
  sectionIdx:   number,
  subject:      string,
  subjectType:  SubjectType = 'general',
  stemProblems: string[]    = [],
): Promise<Question[]> {
  const config = getLMStudioConfig();
  if (!config.enabled) throw new Error('LM Studio is not enabled');
  if (!config.model)   throw new Error('No model selected. Please pick a model in LM Studio Settings.');

  // Use STEM-aware sampler so equation-dense paragraphs are preferred
  const sample = samplePdfText(pdfText, config.contextChars, subjectType);
  const prompt = buildPrompt(sample, section, subject, subjectType, stemProblems);

  console.log(`[LLM] Section "${section.name}" — ${section.count}× ${section.type} [${subjectType}] stemProblems=${stemProblems.length}`);
  const t0  = performance.now();
  const raw = await callLLM(prompt, config);
  console.log(`[LLM] Response in ${((performance.now() - t0) / 1000).toFixed(1)}s — ${raw.length} chars`);

  const questions = parseQuestions(raw, section, sectionIdx);
  console.log(`[LLM] Parsed ${questions.length}/${section.count} questions`);
  return questions;
}
