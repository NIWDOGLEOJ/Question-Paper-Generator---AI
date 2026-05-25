// ── PDF extraction Web Worker ──
// Runs pdfjs extraction off the main thread to avoid blocking the UI.

import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const MAX_CHARS_PER_PAGE = 5_000;

async function extractPageText(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
): Promise<string> {
  try {
    const page    = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    // pdfjs items carry `hasEOL` which marks the end of a visual line.
    // Emitting \n there gives us real line structure for chapter detection.
    const parts: string[] = [];
    for (const item of content.items as any[]) {
      if (!('str' in item)) continue;
      parts.push(item.str);
      if (item.hasEOL) parts.push('\n');
      else if (item.str && !item.str.endsWith(' ')) parts.push(' ');
    }
    const raw = parts.join('')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return raw.slice(0, MAX_CHARS_PER_PAGE);
  } catch {
    return '';
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { arrayBuffer, startPage, endPage } = e.data as {
    arrayBuffer: ArrayBuffer;
    startPage:   number;
    endPage:     number | undefined;
  };

  try {
    const pdf = await pdfjsLib.getDocument({
      data:             arrayBuffer,
      disableRange:     true,
      disableStream:    true,
      isEvalSupported:  false,
    }).promise;

    const rangeStart = Math.max(1, startPage ?? 1);
    const rangeEnd   = Math.min(pdf.numPages, endPage ?? pdf.numPages);

    self.postMessage({ type: 'progress', msg: `Extracting ${pdf.numPages} pages…` });

    const PAGE_BATCH = 10;
    const pageNums   = Array.from({ length: rangeEnd - rangeStart + 1 }, (_, i) => rangeStart + i);
    const chunks: string[] = [];

    for (let i = 0; i < pageNums.length; i += PAGE_BATCH) {
      const batch   = pageNums.slice(i, i + PAGE_BATCH);
      const results = await Promise.all(batch.map(n => extractPageText(pdf, n)));
      chunks.push(...results.filter(Boolean));
      self.postMessage({
        type: 'progress',
        msg:  `Extracted ${Math.min(i + PAGE_BATCH, pageNums.length)} / ${pageNums.length} pages`,
      });
    }

    self.postMessage({ type: 'result', text: chunks.join('\n\n') });
  } catch (err) {
    self.postMessage({
      type: 'error',
      msg:  err instanceof Error ? err.message : 'Worker extraction failed',
    });
  }
};
