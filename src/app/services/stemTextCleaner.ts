/**
 * cleanStemText — fix garbled unicode/symbols from pdfjs extraction.
 * pdfjs frequently mangles math symbols when extracting STEM PDFs.
 * This maps common mojibake sequences back to correct characters,
 * and strips unrecognised control characters.
 */
export function cleanStemText(raw: string): string {
  let t = raw;

  // ── Common Windows-1252 / Latin-1 mojibake sequences ──────────────────
  t = t.replace(/\u00e2\u20ac\u201c/g, '\u2013'); // en-dash
  t = t.replace(/\u00e2\u20ac\u201d/g, '\u2014'); // em-dash
  t = t.replace(/\u00e2\u20ac\u02dc/g, '\u2018'); // left single quote
  t = t.replace(/\u00e2\u20ac\u2122/g, '\u2019'); // right single quote
  t = t.replace(/\u00c2\u00b0/g,  '\u00b0');      // degree °
  t = t.replace(/\u00c2\u00b1/g,  '\u00b1');      // plus-minus ±
  t = t.replace(/\u00c3\u00b7/g,  '\u00f7');      // division ÷
  t = t.replace(/\u00c3\u0097/g,  '\u00d7');      // multiplication ×
  t = t.replace(/\u00c2\u00b2/g,  '^2');          // superscript 2
  t = t.replace(/\u00c2\u00b3/g,  '^3');          // superscript 3
  t = t.replace(/\u00c2\u00b9/g,  '^1');          // superscript 1

  // ── Math operator mojibake ─────────────────────────────────────────────
  t = t.replace(/\u00e2\u221a/g,  '\u221a');      // √ sqrt
  t = t.replace(/\u00e2\u222b/g,  '\u222b');      // ∫ integral
  t = t.replace(/\u00e2\u2211/g,  '\u2211');      // ∑ sum
  t = t.replace(/\u00e2\u220f/g,  '\u220f');      // ∏ product
  t = t.replace(/\u00e2\u221e/g,  '\u221e');      // ∞ infinity
  t = t.replace(/\u00e2\u2264/g,  '\u2264');      // ≤
  t = t.replace(/\u00e2\u2265/g,  '\u2265');      // ≥
  t = t.replace(/\u00e2\u2260/g,  '\u2260');      // ≠

  // ── Greek letter mojibake ──────────────────────────────────────────────
  t = t.replace(/\u00ce\u00b1/g,  '\u03b1');      // α alpha
  t = t.replace(/\u00ce\u00b2/g,  '\u03b2');      // β beta
  t = t.replace(/\u00ce\u00b3/g,  '\u03b3');      // γ gamma
  t = t.replace(/\u00ce\u00b4/g,  '\u03b4');      // δ delta
  t = t.replace(/\u00ce\u00b8/g,  '\u03b8');      // θ theta
  t = t.replace(/\u00ce\u00bb/g,  '\u03bb');      // λ lambda
  t = t.replace(/\u00ce\u00bc/g,  '\u03bc');      // μ mu
  t = t.replace(/\u00cf\u20ac/g,  '\u03c0');      // π pi
  t = t.replace(/\u00ce\u2030/g,  '\u03a9');      // Ω omega
  t = t.replace(/\u00cf\u0192/g,  '\u03c3');      // σ sigma

  // ── Remove non-printable control chars (keep \n \r \t) ────────────────
  // eslint-disable-next-line no-control-regex
  t = t.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // ── Collapse runs of 3+ spaces down to 2 ─────────────────────────────
  t = t.replace(/ {3,}/g, '  ');

  return t.trim();
}
