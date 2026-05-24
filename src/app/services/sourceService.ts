// ── Source Material service ──
// Stores PDF metadata + extracted text so PDFs never need re-uploading.
// The raw file bytes are NOT stored — only extracted text and metadata.
// Backed by IndexedDB via db.ts; in-memory cache keeps reads synchronous.

import { dbPut, dbDelete } from './db';

export interface SourceMaterial {
  id:        string;
  name:      string;       // original filename
  title:     string;       // user-editable friendly name
  subject:   string;       // user-editable subject tag
  pageCount: number;
  sizeBytes: number;
  text:      string;       // full extracted PDF text (no arbitrary cap)
  chapters?: { title: string; text: string }[];
  addedAt:   string;       // ISO date
  paperIds:  string[];     // IDs of papers generated from this source
}

// ── In-memory cache (seeded by initDB in main.tsx) ────────────────────────
let _sources: SourceMaterial[] = [];
export function initSourceStore(sources: SourceMaterial[]): void { _sources = sources; }

export function getSources(): SourceMaterial[] { return _sources; }

export function getSource(id: string): SourceMaterial | null {
  return _sources.find(s => s.id === id) ?? null;
}

export function saveSource(source: SourceMaterial): void {
  _sources = [..._sources.filter(s => s.id !== source.id), source];
  dbPut('sources', source).catch(e => console.error('[DB] saveSource failed:', e));
}

export function deleteSource(id: string): void {
  _sources = _sources.filter(s => s.id !== id);
  dbDelete('sources', id).catch(e => console.error('[DB] deleteSource failed:', e));
}

export function clearAllSources(): void {
  _sources = [];
  import('./db').then(m => m.dbClear('sources')).catch(e => console.error('[DB] clearAllSources failed:', e));
}

export function updateSource(
  id: string,
  patch: Partial<Pick<SourceMaterial, 'title' | 'subject'>>,
): void {
  _sources = _sources.map(s => s.id === id ? { ...s, ...patch } : s);
  const updated = _sources.find(s => s.id === id);
  if (updated) dbPut('sources', updated).catch(e => console.error('[DB] updateSource failed:', e));
}

export function linkPaperToSource(sourceId: string, paperId: string): void {
  const src = _sources.find(s => s.id === sourceId);
  if (!src || src.paperIds.includes(paperId)) return;
  const updated = { ...src, paperIds: [...src.paperIds, paperId] };
  _sources = _sources.map(s => s.id === sourceId ? updated : s);
  dbPut('sources', updated).catch(e => console.error('[DB] linkPaperToSource failed:', e));
}

export function createSource(
  file: File,
  text: string,
  pageCount: number,
  chapters?: { title: string; text: string }[]
): SourceMaterial {
  const title = file.name
    .replace(/\.pdf$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();

  return {
    id:        `src-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    name:      file.name,
    title,
    subject:   '',
    pageCount,
    sizeBytes: file.size,
    text,                          // full text — no cap, IndexedDB handles it
    chapters,
    addedAt:   new Date().toISOString(),
    paperIds:  [],
  };
}

// ── Storage stats — IndexedDB has no easy size API, so we estimate ─────────
export function getStorageStats(): { sources: number; estimatedMB: number } {
  const totalBytes = _sources.reduce((acc, s) => acc + new Blob([s.text]).size, 0);
  return {
    sources:     _sources.length,
    estimatedMB: parseFloat((totalBytes / 1_048_576).toFixed(1)),
  };
}
