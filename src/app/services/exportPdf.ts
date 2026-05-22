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

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FS.question);
      const qLines = wrapText(doc, q.text, qWidth - (marksLabel ? 18 : 0), FS.question);

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
          const colW = (CONTENT_W - 7) / 2;
          for (let oi = 0; oi < q.options.length; oi++) {
            const col      = oi % 2;
            const xPos     = indent + 2 + col * colW;
            const optLines = wrapText(doc, `${labels[oi]}) ${q.options[oi]}`, colW - 4, FS.option);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(FS.option);
            doc.setTextColor(...C.darkGrey);
            doc.text(optLines, xPos, y);
            if (col === 1 || oi === q.options.length - 1) y += optLines.length * 5;
          }
          y += 1;
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
      const ans = (q.answer ?? '').trim();
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
