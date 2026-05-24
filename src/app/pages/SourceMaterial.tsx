import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  UploadCloud, FileText, Trash2, Wand2, AlertTriangle,
  Pencil, Check, X, BookOpen, Calendar, Hash,
  HardDrive, Search, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import * as pdfService from "../services/pdfService";
import * as sourceService from "../services/sourceService";
import type { SourceMaterial } from "../services/sourceService";

// ── Format bytes nicely ──
function fmtSize(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

// ── Inline editable field ──
function InlineEdit({
  value, placeholder, onSave,
}: { value: string; placeholder: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const save = () => {
    if (draft.trim() !== value) onSave(draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          ref={ref}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className="rounded border border-[rgba(148,180,156,0.4)] bg-[rgba(82,125,111,0.1)]
            px-2 py-0.5 text-sm text-[#D5E2D6] focus:outline-none focus:border-[#94B49C] w-44"
        />
        <button onClick={save}            className="text-[#94B49C] hover:text-[#D5E2D6]"><Check className="w-3.5 h-3.5" /></button>
        <button onClick={() => setEditing(false)} className="text-[#527D6F] hover:text-[#94B49C]"><X className="w-3.5 h-3.5" /></button>
      </span>
    );
  }

  return (
    <span className="group/ie inline-flex items-center gap-1">
      <span className={value ? "text-[#D5E2D6]" : "text-[#3a5560] italic"}>{value || placeholder}</span>
      <button onClick={() => { setDraft(value); setEditing(true); }}
        className="opacity-0 group-hover/ie:opacity-100 transition-opacity text-[#527D6F] hover:text-[#94B49C]">
        <Pencil className="w-3 h-3" />
      </button>
    </span>
  );
}

// ── Drop zone component ──
function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);

  const accept = (f: File) => {
    if (f.type === "application/pdf") onFile(f);
    else toast.error("Please upload a PDF file");
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) accept(e.dataTransfer.files[0]); }}
      onClick={() => document.getElementById("src-file-input")?.click()}
      className={`fm-dropzone rounded-2xl px-8 py-12 flex flex-col items-center justify-center
        text-center cursor-pointer transition-all ${dragging ? "active" : ""}`}
    >
      <UploadCloud className="w-12 h-12 text-[#527D6F] mb-4 fm-float" />
      <p className="text-sm font-semibold text-[#D5E2D6] mb-1">Drop a PDF here to add to your library</p>
      <p className="text-xs text-[#527D6F]">or click to browse · up to 50 MB</p>
      <input id="src-file-input" type="file" accept=".pdf" className="sr-only"
        onChange={e => { if (e.target.files?.[0]) accept(e.target.files[0]); e.target.value = ""; }} />
    </div>
  );
}

// ── Processing overlay ──
function ProcessingBanner({ fileName }: { fileName: string }) {
  return (
    <div className="fm-glass rounded-2xl px-6 py-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "rgba(82,125,111,0.2)" }}>
        <FileText className="w-5 h-5 text-[#94B49C] fm-float" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#D5E2D6] truncate">{fileName}</p>
        <p className="text-xs text-[#94B49C] mt-0.5">Extracting text… this may take a moment</p>
        <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "rgba(148,180,156,0.15)" }}>
          <div className="h-full rounded-full fm-shimmer w-2/3" />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
export function SourceMaterialPage() {
  const navigate = useNavigate();
  const [sources, setSources]         = useState<SourceMaterial[]>([]);
  const [processing, setProcessing]   = useState<string | null>(null);   // filename being processed
  const [confirmId, setConfirmId]     = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [papers, setPapers]           = useState<ReturnType<typeof pdfService.getPapers>>([]);

  const load = () => {
    setSources(sourceService.getSources().sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    ));
    setPapers(pdfService.getPapers());
  };

  useEffect(() => { load(); }, []);

  // ── Process a new PDF ──
  const handleFile = useCallback(async (file: File) => {
    // Deduplicate by filename + size
    const exists = sourceService.getSources().find(
      s => s.name === file.name && s.sizeBytes === file.size
    );
    if (exists) {
      toast.info(`"${file.name}" is already in your library`);
      return;
    }

    setProcessing(file.name);
    try {
      let pageCount = 0;
      const text = await pdfService.extractTextFromPDF(file, (msg) => {
        // Try to extract page count from extraction messages
        const m = msg.match(/(\d+)\s+page/i);
        if (m) pageCount = parseInt(m[1]);
      });
      
      const baseTitle = file.name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
      const chapters = pdfService.splitTextIntoChapters(text, baseTitle);

      if (chapters.length > 1) {
        let savedCount = 0;
        for (const ch of chapters) {
          const src = sourceService.createSource(file, ch.text, pageCount);
          src.title = ch.title; // Override title
          sourceService.saveSource(src);
          savedCount++;
        }
        toast.success(`"${baseTitle}" was split into ${savedCount} chapters!`);
      } else {
        const src = sourceService.createSource(file, text, pageCount);
        sourceService.saveSource(src);
        toast.success(`"${src.title}" added to your library!`);
      }
      
      load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to process PDF. Please try again.");
    } finally {
      setProcessing(null);
    }
  }, []);

  // ── Delete ──
  const handleDelete = (id: string) => {
    sourceService.deleteSource(id);
    setConfirmId(null);
    load();
    toast.success("Source removed");
  };

  // ── Navigate to Generate with this source pre-loaded ──
  const handleGenerate = (src: SourceMaterial) => {
    // Store the source id in sessionStorage so Generate page can pick it up
    sessionStorage.setItem('qpg_preload_source', src.id);
    navigate('/new');
  };

  const stats = sourceService.getStorageStats();

  const filtered = sources.filter(s => {
    const q = searchQuery.trim().toLowerCase();
    return !q || [s.title, s.name, s.subject].some(f => f.toLowerCase().includes(q));
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 fm-fadein">

      {/* ── Header ── */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest text-[#527D6F] uppercase mb-1">Library</p>
          <h1 className="text-3xl font-bold text-[#D5E2D6]"
            style={{ fontFamily: "'Playfair Display', serif" }}>
            Source Material
          </h1>
          <p className="mt-1 text-sm text-[#94B49C]">
            Upload PDFs once, reuse them to generate papers anytime.
          </p>
        </div>
        {/* Storage usage pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-[#527D6F]"
          style={{ border: "1px solid rgba(148,180,156,0.15)", background: "rgba(82,125,111,0.06)" }}>
          <HardDrive className="w-3.5 h-3.5" />
          {stats.estimatedKB > 1024
            ? `${(stats.estimatedKB / 1024).toFixed(1)} MB used`
            : `${stats.estimatedKB} KB used`}
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Sources",        value: sources.length },
          { label: "Pages stored",   value: sources.reduce((a, s) => a + s.pageCount, 0) || "—" },
          { label: "Papers generated", value: sources.reduce((a, s) => a + s.paperIds.length, 0) },
        ].map((stat, i) => (
          <div key={i} className="fm-glass p-5 rounded-xl">
            <p className="text-2xl font-bold text-[#94B49C]">{stat.value}</p>
            <p className="text-xs text-[#527D6F] mt-1 font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Processing banner ── */}
      {processing && <div className="mb-4"><ProcessingBanner fileName={processing} /></div>}

      {/* ── Drop zone ── */}
      <div className="mb-8">
        <DropZone onFile={handleFile} />
      </div>

      {/* ── Search ── */}
      {sources.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#527D6F] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search sources by title or subject…"
            className="w-full h-10 pl-10 pr-10 rounded-xl text-sm text-[#D5E2D6]
              placeholder:text-[#3a5560] focus:outline-none focus:ring-1 focus:ring-[#527D6F]"
            style={{ background: "rgba(82,125,111,0.07)", border: "1px solid rgba(148,180,156,0.15)" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#527D6F] hover:text-[#94B49C]">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* ── Source list ── */}
      {sources.length === 0 && !processing ? (
        <div className="fm-glass rounded-2xl p-16 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 fm-float"
            style={{ background: "rgba(82,125,111,0.15)", border: "1px solid rgba(82,125,111,0.25)" }}>
            <BookOpen className="w-9 h-9 text-[#94B49C]" />
          </div>
          <h3 className="text-lg font-bold text-[#D5E2D6] mb-2">No sources yet</h3>
          <p className="text-sm text-[#94B49C] max-w-xs">
            Upload a textbook PDF above. It'll be stored here so you can generate
            multiple papers from it without re-uploading.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="fm-glass rounded-2xl p-10 flex flex-col items-center text-center gap-2">
          <Search className="w-8 h-8 text-[#527D6F]" />
          <p className="text-sm text-[#94B49C]">No sources match "{searchQuery}"</p>
          <button onClick={() => setSearchQuery('')}
            className="text-xs text-[#527D6F] hover:text-[#94B49C] underline">Clear search</button>
        </div>
      ) : (
        <div className="fm-glass rounded-2xl overflow-hidden">
          <ul className="divide-y divide-[rgba(148,180,156,0.1)]">
            {filtered.map((src) => {
              const isPending   = confirmId === src.id;
              const srcPapers   = papers.filter(p => src.paperIds.includes(p.id));

              return (
                <li key={src.id}
                  className={`group transition-colors ${isPending ? "" : "hover:bg-[rgba(82,125,111,0.07)]"}`}
                  style={isPending ? { background: "rgba(192,80,74,0.04)" } : {}}
                >
                  <div className="px-6 py-4 flex items-start gap-4">

                    {/* Icon */}
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: isPending ? "rgba(192,80,74,0.12)" : "rgba(82,125,111,0.18)" }}>
                      <FileText className={`w-5 h-5 ${isPending ? "text-[#c0504a]" : "text-[#94B49C]"}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">

                      {/* Title (editable) */}
                      <div className="text-sm font-semibold">
                        <InlineEdit
                          value={src.title}
                          placeholder="Untitled"
                          onSave={v => { sourceService.updateSource(src.id, { title: v }); load(); }}
                        />
                      </div>

                      {/* Subject (editable) */}
                      <div className="text-xs">
                        <span className="text-[#3a5560] mr-1">Subject:</span>
                        <InlineEdit
                          value={src.subject}
                          placeholder="Add subject…"
                          onSave={v => { sourceService.updateSource(src.id, { subject: v }); load(); }}
                        />
                      </div>

                      {/* Meta row */}
                      <div className="flex flex-wrap gap-3 text-xs text-[#527D6F] pt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(src.addedAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {src.pageCount > 0 ? `${src.pageCount} pages` : "pages unknown"}
                        </span>
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {fmtSize(src.sizeBytes)}
                        </span>
                        {srcPapers.length > 0 && (
                          <span className="flex items-center gap-1 text-[#94B49C] font-medium">
                            <Wand2 className="w-3 h-3" />
                            {srcPapers.length} paper{srcPapers.length !== 1 ? "s" : ""} generated
                          </span>
                        )}
                      </div>

                      {/* Papers generated from this source */}
                      {srcPapers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {srcPapers.map(p => (
                            <button key={p.id}
                              onClick={() => navigate(`/paper/${p.id}`)}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]
                                font-medium text-[#527D6F] hover:text-[#94B49C] transition-all"
                              style={{ border: "1px solid rgba(148,180,156,0.18)", background: "rgba(82,125,111,0.08)" }}>
                              <FileText className="w-2.5 h-2.5" />
                              {p.title}
                              <ChevronRight className="w-2.5 h-2.5" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                      {/* Generate paper button */}
                      <button
                        onClick={() => handleGenerate(src)}
                        title="Generate a paper from this source"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                          text-[#94B49C] hover:text-[#D5E2D6] hover:bg-[rgba(82,125,111,0.15)]
                          transition-all opacity-0 group-hover:opacity-100"
                        style={{ border: "1px solid rgba(148,180,156,0.2)" }}
                      >
                        <Wand2 className="w-3.5 h-3.5" /> Generate
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setConfirmId(prev => prev === src.id ? null : src.id)}
                        title="Remove source"
                        className={`p-2 rounded-lg transition-all
                          ${isPending
                            ? "text-[#c0504a] bg-[rgba(192,80,74,0.12)] opacity-100"
                            : "text-[#527D6F] hover:text-[#c0504a] hover:bg-[rgba(192,80,74,0.1)] opacity-0 group-hover:opacity-100"}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Delete confirm panel */}
                  {isPending && (
                    <div className="px-6 pb-4">
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                        style={{ background: "rgba(192,80,74,0.08)", border: "1px solid rgba(192,80,74,0.22)" }}>
                        <AlertTriangle className="w-4 h-4 text-[#c0504a] shrink-0" />
                        <p className="flex-1 text-sm text-[#c0504a]">
                          Remove <span className="font-semibold">"{src.title}"</span> from the library?
                          Papers generated from it won't be affected.
                        </p>
                        <button onClick={() => setConfirmId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#94B49C]
                            hover:bg-[rgba(82,125,111,0.15)] transition-all">
                          Cancel
                        </button>
                        <button onClick={() => handleDelete(src.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white
                            hover:opacity-90 transition-all"
                          style={{ background: "rgba(192,80,74,0.82)" }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
