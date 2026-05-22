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
    const raw     = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
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
