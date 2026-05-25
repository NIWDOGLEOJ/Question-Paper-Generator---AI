import jsPDF from 'jspdf';
import type { Paper } from './pdfService';

// ── Page constants (A4 in mm) ──
const PAGE_W    = 210;
const PAGE_H    = 297;
const MARGIN    = 20;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── Font sizes ──
const FS = {
  title:       18,
  subtitle:    13,
  meta:        10,
  sectionHead: 12,
  instruction: 10,
  question:    11,
  option:      10.5,
  footer:      9,
  answerHead:  14,
  answerItem:  10,
};

// ── Colours ──
const C = {
  black:     [26,  26,  26]  as [number, number, number],
  darkGrey:  [60,  60,  60]  as [number, number, number],
  midGrey:   [100, 100, 100] as [number, number, number],
  lightGrey: [180, 180, 180] as [number, number, number],
  ruleDark:  [40,  40,  40]  as [number, number, number],
  ruleLight: [210, 210, 210] as [number, number, number],
  green:     [60,  110, 90]  as [number, number, number],
  greenBg:   [235, 245, 239] as [number, number, number],
};

function wrapText(doc: jsPDF, text: string, maxWidth: number, fontSize: number): string[] {
  doc.setFontSize(fontSize);
  return doc.splitTextToSize(text, maxWidth) as string[];
}

// ── LaTeX → readable plain-text for jsPDF (which cannot render LaTeX) ──
// Converts the most common constructs the LLM produces into unicode/ASCII equivalents.
export function stripLatex(raw: string): string {
  let s = raw;

  // 1. Remove display math delimiters $$ ... $$ and block \[ ... \]
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_, inner) => convertLatexMath(inner.trim()));
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => convertLatexMath(inner.trim()));
  // 2. Remove inline math delimiters $ ... $ and \( ... \)
  s = s.replace(/\$([\s\S]*?)\$/g,      (_, inner) => convertLatexMath(inner.trim()));
  s = s.replace(/\\\(([\s\S]*?)\\\)/g,  (_, inner) => convertLatexMath(inner.trim()));

  return s.trim();
}

function convertLatexMath(s: string): string {
  // \frac{a}{b}  →  (a)/(b)
  // Handles nested braces one level deep by iterating
  for (let i = 0; i < 5; i++) {
    s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
  }

  // \sqrt{x}  →  √x
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
  s = s.replace(/\\sqrt\s+(\S)/g, '√$1');

  // Superscripts: x^{n}  →  x^n  then convert single-digit/letter supers to unicode
  s = s.replace(/\^\{([^{}]+)\}/g, (_, e) => toSuperscript(e));
  s = s.replace(/\^([0-9a-z])/g,   (_, c) => toSuperscript(c));

  // Subscripts: x_{n}  →  unicode subscript where possible
  s = s.replace(/_\{([^{}]+)\}/g, (_, e) => toSubscript(e));
  s = s.replace(/_([0-9a-z])/g,   (_, c) => toSubscript(c));

  // Greek letters
  const greek: Record<string, string> = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ',
    eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ',
    nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ',
    upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
    Alpha: 'Α', Beta: 'Β', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ',
    Mu: 'Μ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  };
  for (const [cmd, ch] of Object.entries(greek)) {
    s = s.replace(new RegExp(`\\\\${cmd}\\b`, 'g'), ch);
  }

  // Common operators and symbols
  const ops: [RegExp, string][] = [
    [/\\cdot/g, '·'],      [/\\times/g, '×'],   [/\\div/g, '÷'],
    [/\\pm/g, '±'],        [/\\mp/g, '∓'],       [/\\leq/g, '≤'],
    [/\\geq/g, '≥'],       [/\\neq/g, '≠'],      [/\\approx/g, '≈'],
    [/\\infty/g, '∞'],     [/\\sum/g, 'Σ'],      [/\\prod/g, 'Π'],
    [/\\int/g, '∫'],       [/\\partial/g, '∂'],  [/\\nabla/g, '∇'],
    [/\\in/g, '∈'],        [/\\notin/g, '∉'],    [/\\subset/g, '⊂'],
    [/\\supset/g, '⊃'],   [/\\cup/g, '∪'],       [/\\cap/g, '∩'],
    [/\\rightarrow/g, '→'],[/\\leftarrow/g, '←'],[/\\Rightarrow/g, '⇒'],
    [/\\Leftrightarrow/g, '⟺'],[/\\to/g, '→'],  [/\\ldots/g, '…'],
    [/\\cdots/g, '⋯'],    [/\\forall/g, '∀'],   [/\\exists/g, '∃'],
    [/\\lim/g, 'lim'],     [/\\log/g, 'log'],    [/\\ln/g, 'ln'],
    [/\\sin/g, 'sin'],     [/\\cos/g, 'cos'],    [/\\tan/g, 'tan'],
    [/\\le\b/g, '≤'],      [/\\ge\b/g, '≥'],     [/\\ne\b/g, '≠'],
  ];
  for (const [pat, rep] of ops) s = s.replace(pat, rep);

  // \text{...}  →  just the text
  s = s.replace(/\\text\{([^{}]*)\}/g, '$1');
  s = s.replace(/\\mathrm\{([^{}]*)\}/g, '$1');
  s = s.replace(/\\mathbf\{([^{}]*)\}/g, '$1');
  s = s.replace(/\\mathit\{([^{}]*)\}/g, '$1');

  // \left( \right)  →  plain parens
  s = s.replace(/\\left\s*([([{|])/g, '$1');
  s = s.replace(/\\right\s*([)\]}|])/g, '$1');

  // Strip remaining unknown backslash commands (\cmd or \cmd{...})
  s = s.replace(/\\[a-zA-Z]+\{([^{}]*)\}/g, '$1');
  s = s.replace(/\\[a-zA-Z]+/g, '');

  // Cleanup stray braces and extra whitespace
  s = s.replace(/[{}]/g, '');
  s = s.replace(/\s{2,}/g, ' ');

  return s.trim();
}

const SUPER_MAP: Record<string, string> = {
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  'a':'ᵃ','b':'ᵇ','c':'ᶜ','d':'ᵈ','e':'ᵉ','f':'ᶠ','g':'ᵍ','h':'ʰ','i':'ⁱ',
  'j':'ʲ','k':'ᵏ','l':'ˡ','m':'ᵐ','n':'ⁿ','o':'ᵒ','p':'ᵖ','r':'ʳ','s':'ˢ',
  't':'ᵗ','u':'ᵘ','v':'ᵛ','w':'ʷ','x':'ˣ','y':'ʸ','z':'ᶻ',
  '+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾',
};
const SUB_MAP: Record<string, string> = {
  '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
  'a':'ₐ','e':'ₑ','i':'ᵢ','j':'ⱼ','k':'ₖ','l':'ₗ','m':'ₘ','n':'ₙ','o':'ₒ',
  'p':'ₚ','r':'ᵣ','s':'ₛ','t':'ₜ','u':'ᵤ','v':'ᵥ','x':'ₓ',
  '+':'₊','-':'₋','=':'₌','(':'₍',')':'₎',
};

function toSuperscript(s: string): string {
  return [...s].map(c => SUPER_MAP[c] ?? `^${c}`).join('');
}
function toSubscript(s: string): string {
  return [...s].map(c => SUB_MAP[c] ?? `_${c}`).join('');
}


function hRule(doc: jsPDF, y: number, color: [number, number, number], thickness = 0.4) {
  doc.setDrawColor(...color);
  doc.setLineWidth(thickness);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
}

function addFooter(
  doc: jsPDF,
  pageNum: number,
  totalPages: number,
  paperTitle: string,
  isAnswerKey = false,
) {
  const y = PAGE_H - 10;
  doc.setFontSize(FS.footer);
  doc.setTextColor(...C.lightGrey);
  doc.setFont('helvetica', 'normal');
  doc.text(isAnswerKey ? `${paperTitle} — ANSWER KEY` : paperTitle, MARGIN, y);
  doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - MARGIN, y, { align: 'right' });
}

// ── Render the question paper body (shared by both modes) ──
function renderBody(doc: jsPDF, paper: Paper): { y: number; pageNum: number } {
  let y       = MARGIN;
  let pageNum = 1;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - 18) {
      doc.addPage();
      pageNum++;
      y = MARGIN;
    }
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FS.title);
  doc.setTextColor(...C.black);
  doc.text(paper.subject.toUpperCase(), PAGE_W / 2, y, { align: 'center' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FS.subtitle);
  doc.setTextColor(...C.darkGrey);
  doc.text(paper.title, PAGE_W / 2, y, { align: 'center' });
  y += 5;

  doc.setFontSize(FS.meta);
  doc.setTextColor(...C.midGrey);
  doc.text(`Time Allowed: ${paper.duration}`, MARGIN, y + 3);
  doc.text(`Total Marks: ${paper.totalMarks}`, PAGE_W - MARGIN, y + 3, { align: 'right' });
  y += 8;

  hRule(doc, y, C.ruleDark, 0.6);
  y += 6;

  for (const section of paper.sections) {
    ensureSpace(20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FS.sectionHead);
    doc.setTextColor(...C.black);
    doc.text(section.name, MARGIN, y);
    y += 5;

    doc.setDrawColor(...C.darkGrey);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, MARGIN + doc.getTextWidth(section.name), y);
    y += 3;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(FS.instruction);
    doc.setTextColor(...C.midGrey);
    doc.text(section.instructions, MARGIN, y);
    y += 6;

    for (let qi = 0; qi < section.questions.length; qi++) {
      const q          = section.questions[qi];
      const indent     = MARGIN + 7;
      const qWidth     = CONTENT_W - 7;
      const marksLabel = q.marks !== undefined
        ? `[${q.marks} mark${q.marks !== 1 ? 's' : ''}]`
        : '';

      const qText = stripLatex(q.text);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FS.question);
      const qLines = wrapText(doc, qText, qWidth - (marksLabel ? 18 : 0), FS.question);

      const optH   = q.options
        ? (q.options.length === 2 ? 6 : Math.ceil(q.options.length / 2) * 5.5 + 2)
        : 0;
      const ansH   = section.type === 'Short Answer' ? 12 : 0;
      const blockH = qLines.length * 5.5 + optH + ansH + 6;

      ensureSpace(blockH);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(FS.question);
      doc.setTextColor(...C.black);
      doc.text(`${qi + 1}.`, MARGIN, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.black);
      doc.text(qLines, indent, y);

      if (marksLabel) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(FS.footer);
        doc.setTextColor(...C.midGrey);
        doc.text(marksLabel, PAGE_W - MARGIN, y, { align: 'right' });
      }

      y += qLines.length * 5.5;

      if (q.options && q.options.length > 0) {
        const labels = ['a', 'b', 'c', 'd', 'e'];
        const isTF   = q.options.length === 2 &&
          q.options[0].toLowerCase() === 'true' &&
          q.options[1].toLowerCase() === 'false';

        if (isTF) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(FS.option);
          doc.setTextColor(...C.darkGrey);
          doc.text('a) True        b) False', indent + 2, y);
          y += 5.5;
        } else {
          // Detect if any option has math content — if so use 1-per-line layout
          // to avoid overflow of long expressions like "(dy/dx)dx"
          const cleanedOpts = q.options.map(o => stripLatex(o));
          const hasMath = cleanedOpts.some(o =>
            /[/√∫∂²³⁰⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉αβγδεθλμπσφωΩΣΔΓΠ]/.test(o)
          );

          if (hasMath) {
            // One option per line — prevents math expressions from overflowing
            for (let oi = 0; oi < cleanedOpts.length; oi++) {
              const optLines = wrapText(doc, `${labels[oi]}) ${cleanedOpts[oi]}`, CONTENT_W - 14, FS.option);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(FS.option);
              doc.setTextColor(...C.darkGrey);
              doc.text(optLines, indent + 2, y);
              y += optLines.length * 5;
            }
            y += 1;
          } else {
            // 2-column grid for short options (no math)
            const colW = (CONTENT_W - 7) / 2;
            for (let oi = 0; oi < cleanedOpts.length; oi++) {
              const col      = oi % 2;
              const xPos     = indent + 2 + col * colW;
              const optLines = wrapText(doc, `${labels[oi]}) ${cleanedOpts[oi]}`, colW - 4, FS.option);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(FS.option);
              doc.setTextColor(...C.darkGrey);
              doc.text(optLines, xPos, y);
              if (col === 1 || oi === cleanedOpts.length - 1) y += optLines.length * 5;
            }
            y += 1;
          }
        }
      }

      if (section.type === 'Short Answer') {
        y += 2;
        hRule(doc, y, C.ruleLight, 0.25);
        y += 4;
        hRule(doc, y, C.ruleLight, 0.25);
        y += 4;
      }

      y += 4;
    }

    y += 6;
    const secIdx = paper.sections.indexOf(section);
    if (secIdx < paper.sections.length - 1) {
      hRule(doc, y, C.ruleLight, 0.3);
      y += 6;
    }
  }

  ensureSpace(12);
  hRule(doc, y, C.ruleLight, 0.3);
  y += 6;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(FS.footer);
  doc.setTextColor(...C.lightGrey);
  doc.text('*** End of Paper ***', PAGE_W / 2, y, { align: 'center' });

  return { y, pageNum };
}

// ── Append answer key pages ──
function renderAnswerKey(doc: jsPDF, paper: Paper): void {
  doc.addPage();
  let y = MARGIN;
  let pageNum = doc.getNumberOfPages();

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - 18) {
      doc.addPage();
      pageNum++;
      y = MARGIN;
    }
  };

  // ── Answer Key Header ──
  doc.setFillColor(...C.green);
  doc.roundedRect(MARGIN, y - 5, CONTENT_W, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FS.answerHead);
  doc.setTextColor(255, 255, 255);
  doc.text('ANSWER KEY', PAGE_W / 2, y + 4, { align: 'center' });
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FS.footer);
  doc.setTextColor(...C.midGrey);
  doc.text(`${paper.title} — ${paper.subject}`, PAGE_W / 2, y + 3, { align: 'center' });
  y += 8;

  hRule(doc, y, C.ruleDark, 0.5);
  y += 7;

  // ── Collect all answers, grouped by section ──
  let globalQ = 0;

  for (const section of paper.sections) {
    const hasAnyAnswer = section.questions.some(q => q.answer && q.answer.trim());
    if (!hasAnyAnswer) continue;

    ensureSpace(14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FS.sectionHead - 1);
    doc.setTextColor(...C.black);
    doc.text(section.name, MARGIN, y);
    y += 5;
    doc.setDrawColor(...C.darkGrey);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, y, MARGIN + doc.getTextWidth(section.name), y);
    y += 5;

    for (let qi = 0; qi < section.questions.length; qi++) {
      const q   = section.questions[qi];
      globalQ++;
      const ans = stripLatex((q.answer ?? '').trim());
      if (!ans) continue;

      ensureSpace(10);

      const ansLines = wrapText(doc, ans, CONTENT_W - 20, FS.answerItem);
      const blockH   = ansLines.length * 5 + 5;
      ensureSpace(blockH);

      // Question number badge
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(FS.answerItem);
      doc.setTextColor(...C.green);
      doc.text(`Q${qi + 1}.`, MARGIN, y);

      // Answer text
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.darkGrey);
      doc.text(ansLines, MARGIN + 10, y);

      y += ansLines.length * 5 + 3;
    }

    y += 3;
    hRule(doc, y, C.ruleLight, 0.2);
    y += 5;
  }

  // ── End of answer key ──
  ensureSpace(10);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(FS.footer);
  doc.setTextColor(...C.lightGrey);
  doc.text('*** End of Answer Key ***', PAGE_W / 2, y, { align: 'center' });
}

// ── Main export ──
export async function exportPaperToPDF(
  paper: Paper,
  includeAnswerKey = false,
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  renderBody(doc, paper);

  if (includeAnswerKey) {
    renderAnswerKey(doc, paper);
  }

  // Add footers to every page
  const totalPages = doc.getNumberOfPages();
  // Answer key starts after paper body — track where body ends
  let bodyPages = totalPages;
  if (includeAnswerKey) {
    // Re-render body to count its pages (cheap, no side effects on final doc)
    const countDoc = new jsPDF({ unit: 'mm', format: 'a4', compress: false });
    renderBody(countDoc, paper);
    bodyPages = countDoc.getNumberOfPages();
  }

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addFooter(doc, p, totalPages, paper.title, p > bodyPages);
  }

  const safeName = paper.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const suffix   = includeAnswerKey ? '_with_answers' : '_question_paper';
  doc.save(`${safeName}${suffix}.pdf`);
}
