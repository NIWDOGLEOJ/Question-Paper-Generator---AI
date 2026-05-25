import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  PageNumber,
  Footer,
} from 'docx';
import type { Paper } from './pdfService';
import { stripLatex } from './exportPdf';

// ── Colors ──
const C = {
  brandGreen: "527D6F", // Premium pine green
  darkText:   "2B3A34", // Soft dark charcoal/green
  borderLight:"D5E2D6", // Subtle borders
  grayText:   "666666", // Muted elements
  white:      "FFFFFF",
};

/**
 * Creates an elegant, universally compatible horizontal rule underline in Word/Pages
 */
function createDivider(color = C.borderLight, size = 6): Paragraph {
  return new Paragraph({
    spacing: { before: 80, after: 120 },
    border: {
      bottom: {
        color: color,
        space: 2,
        style: BorderStyle.SINGLE,
        size: size,
      },
    },
    children: [],
  });
}

/**
 * Exports paper to a Word Document (.docx) optimized for 100% bulletproof compatibility
 * with Apple Pages, MS Word, and Google Docs, while maintaining a stunning typography.
 */
export async function exportPaperToDocx(
  paper: Paper,
  includeAnswerKey = false,
): Promise<void> {
  const children: any[] = [];

  // ── 1. Bulletproof High-Typography Header Block (Universal Pages/Word) ──
  
  // Top spacer
  children.push(new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }));

  // Subject Header
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: stripLatex(paper.subject).toUpperCase(),
          bold: true,
          font: "Calibri",
          size: 38, // 19pt
          color: C.brandGreen,
        }),
      ],
    })
  );

  // Paper Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 140 },
      children: [
        new TextRun({
          text: stripLatex(paper.title),
          bold: true,
          italics: true,
          font: "Calibri",
          size: 26, // 13pt
          color: C.darkText,
        }),
      ],
    })
  );

  // Top border of metadata
  children.push(createDivider(C.brandGreen, 6));

  // Metadata Line (Centered and clean - 100% Pages compatible)
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 80 },
      children: [
        new TextRun({
          text: `⏱  TIME ALLOWED: `,
          bold: true,
          font: "Calibri",
          size: 20, // 10pt
          color: C.grayText,
        }),
        new TextRun({
          text: `${paper.duration}    |    `,
          bold: true,
          font: "Calibri",
          size: 20,
          color: C.darkText,
        }),
        new TextRun({
          text: `🎯  TOTAL MARKS: `,
          bold: true,
          font: "Calibri",
          size: 20,
          color: C.grayText,
        }),
        new TextRun({
          text: `${paper.totalMarks} MARKS`,
          bold: true,
          font: "Calibri",
          size: 20,
          color: C.darkText,
        }),
      ],
    })
  );

  // Bottom border of metadata
  children.push(createDivider(C.brandGreen, 6));

  // Spacing after header
  children.push(new Paragraph({ spacing: { before: 180, after: 0 }, children: [] }));


  // ── 2. Render Paper Body (Sections & Questions) ──
  paper.sections.forEach((section) => {
    // Section Divider Spacer
    children.push(new Paragraph({ spacing: { before: 120, after: 0 }, children: [] }));

    // Universally compatible Section Heading with elegant Bottom Border rule
    children.push(
      new Paragraph({
        spacing: { before: 180, after: 100 },
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 12, // 1.5pt elegant underline
            color: C.brandGreen,
            space: 6,
          },
        },
        children: [
          new TextRun({
            text: section.name.toUpperCase(),
            bold: true,
            font: "Calibri",
            size: 24, // 12pt
            color: C.brandGreen,
          }),
        ],
      })
    );

    // Section Instructions
    if (section.instructions) {
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 180 },
          indent: { left: 120 },
          children: [
            new TextRun({
              text: `Instructions: ${stripLatex(section.instructions)}`,
              italics: true,
              font: "Calibri",
              size: 20, // 10pt
              color: C.grayText,
            }),
          ],
        })
      );
    }

    // Questions in Section
    section.questions.forEach((q, qi) => {
      const qNumText = `Q${qi + 1}.  `;
      const qTextClean = stripLatex(q.text);
      const marksLabel = q.marks !== undefined
        ? `    [${q.marks} Mark${q.marks !== 1 ? 's' : ''}]`
        : '';

      const questionRuns = [
        new TextRun({
          text: qNumText,
          bold: true,
          font: "Calibri",
          size: 22, // 11pt
          color: C.brandGreen,
        }),
        new TextRun({
          text: qTextClean,
          font: "Calibri",
          size: 22, // 11pt
          color: C.darkText,
        }),
      ];

      if (marksLabel) {
        questionRuns.push(
          new TextRun({
            text: marksLabel,
            bold: true,
            font: "Calibri",
            size: 20, // 10pt
            color: C.brandGreen,
          })
        );
      }

      children.push(
        new Paragraph({
          spacing: { before: 180, after: 80, line: 280 }, // Spaced and breathable
          children: questionRuns,
        })
      );

      // Render MCQ options vertically (Highly consistent & clean across all apps)
      if (q.options && q.options.length > 0) {
        q.options.forEach((opt, oIdx) => {
          const label = String.fromCharCode(97 + oIdx) + ")   "; // a) , b) , c) , d)
          children.push(
            new Paragraph({
              indent: { left: 480 }, // Indent options cleanly by 0.33 inches
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({
                  text: label,
                  bold: true,
                  font: "Calibri",
                  size: 21, // 10.5pt
                  color: C.brandGreen,
                }),
                new TextRun({
                  text: stripLatex(opt),
                  font: "Calibri",
                  size: 21, // 10.5pt
                  color: C.darkText,
                }),
              ],
            })
          );
        });
      }
    });
  });

  // ── 3. Render Answer Key (If requested) ──
  if (includeAnswerKey) {
    children.push(
      new Paragraph({
        children: [],
        pageBreakBefore: true,
      })
    );

    // Universally compatible Answer Key Header
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 120 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 12, color: C.brandGreen, space: 6 },
          top: { style: BorderStyle.SINGLE, size: 12, color: C.brandGreen, space: 6 },
        },
        children: [
          new TextRun({
            text: "ANSWER KEY",
            bold: true,
            font: "Calibri",
            size: 26, // 13pt
            color: C.brandGreen,
          }),
        ],
      })
    );

    paper.sections.forEach((section) => {
      // Section header inside Answer Key
      children.push(
        new Paragraph({
          spacing: { before: 200, after: 100 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 4, color: C.borderLight, space: 4 },
          },
          children: [
            new TextRun({
              text: `${section.name} - Answers`,
              bold: true,
              font: "Calibri",
              size: 22, // 11pt
              color: C.darkText,
            }),
          ],
        })
      );

      section.questions.forEach((q, qi) => {
        const ans = q.answer?.trim() || "No answer provided.";

        children.push(
          new Paragraph({
            spacing: { before: 80, after: 80, line: 240 },
            indent: { left: 240 },
            children: [
              new TextRun({
                text: `Q${qi + 1}.  `,
                bold: true,
                font: "Calibri",
                size: 20, // 10pt
                color: C.brandGreen,
              }),
              new TextRun({
                text: stripLatex(ans),
                font: "Calibri",
                size: 20, // 10pt
                color: C.darkText,
              }),
            ],
          })
        );
      });
    });

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 100 },
        children: [
          new TextRun({
            text: "*** End of Answer Key ***",
            italics: true,
            font: "Calibri",
            size: 18, // 9pt
            color: C.grayText,
          }),
        ],
      })
    );
  }

  // ── 4. Create and configure the docx document ──
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch standard margins
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${stripLatex(paper.title)}  |  Page `,
                    font: "Calibri",
                    size: 18, // 9pt
                    color: C.grayText,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: "Calibri",
                    size: 18,
                    color: C.grayText,
                  }),
                  new TextRun({
                    text: " of ",
                    font: "Calibri",
                    size: 18,
                    color: C.grayText,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: "Calibri",
                    size: 18,
                    color: C.grayText,
                  }),
                ],
              }),
            ],
          }),
        },
        children: children,
      },
    ],
  });

  // ── 5. Generate the blob and trigger client-side download ──
  const blob = await Packer.toBlob(doc);
  const safeName = paper.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const suffix = includeAnswerKey ? '_with_answers' : '_question_paper';
  const fileName = `${safeName}${suffix}.docx`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
