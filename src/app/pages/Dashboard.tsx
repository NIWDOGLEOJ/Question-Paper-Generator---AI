import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  FileText, Plus, Calendar, Clock, BookOpen,
  Trash2, Sparkles, AlertTriangle, Tag, X, Search,
} from "lucide-react";
import * as pdfService from "../services/pdfService";
import { toast } from "sonner";

// ── Normalise a raw tag string ──
const normaliseTag = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');

// ── Inline tag-editor panel ──
function TagEditor({
  paper,
  allTags,
  onClose,
  onUpdate,
}: {
  paper: pdfService.Paper;
  allTags: string[];
  onClose: () => void;
  onUpdate: (id: string, tags: string[]) => void;
}) {
  const [tags, setTags]     = useState<string[]>(paper.tags ?? []);
  const [input, setInput]   = useState("");
  const inputRef            = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const suggestions = allTags.filter(
    t => !tags.includes(t) && t.includes(normaliseTag(input)),
  ).slice(0, 6);

  const addTag = (raw: string) => {
    const t = normaliseTag(raw);
    if (!t || tags.includes(t)) { setInput(""); return; }
    const next = [...tags, t];
    setTags(next);
    onUpdate(paper.id, next);
    setInput("");
  };

  const removeTag = (t: string) => {
    const next = tags.filter(x => x !== t);
    setTags(next);
    onUpdate(paper.id, next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(input); }
    if (e.key === "Escape") onClose();
    if (e.key === "Backspace" && input === "" && tags.length > 0) {
      const next = tags.slice(0, -1);
      setTags(next);
      onUpdate(paper.id, next);
    }
  };

  return (
    <div className="px-6 pb-5">
      <div
        className="rounded-xl p-3 space-y-3"
        style={{ background: "rgba(82,125,111,0.07)", border: "1px solid rgba(148,180,156,0.18)" }}
      >
        {/* Current tags + input */}
        <div
          className="flex flex-wrap gap-1.5 items-center min-h-[32px] px-2 py-1.5 rounded-lg cursor-text"
          style={{ background: "rgba(82,125,111,0.06)", border: "1px solid rgba(148,180,156,0.2)" }}
          onClick={() => inputRef.current?.focus()}
        >
          {tags.map(t => (
            <span
              key={t}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: "rgba(82,125,111,0.22)", color: "#94B49C" }}
            >
              {t}
              <button
                onClick={e => { e.stopPropagation(); removeTag(t); }}
                className="hover:text-[#D5E2D6] transition-colors"
                aria-label={`Remove tag ${t}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? "Type a tag and press Enter…" : ""}
            className="flex-1 min-w-[120px] bg-transparent text-xs text-[#D5E2D6]
              placeholder:text-[#527D6F] outline-none"
          />
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-[#527D6F] self-center">Suggestions:</span>
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => addTag(s)}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium text-[#527D6F]
                  hover:text-[#94B49C] transition-colors"
                style={{ border: "1px dashed rgba(148,180,156,0.3)" }}
              >
                + {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-[#3a5560]">
            Enter or comma to add · Backspace to remove last
          </p>
          <button
            onClick={onClose}
            className="text-xs font-medium text-[#527D6F] hover:text-[#94B49C] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
export function Dashboard() {
  const [papers, setPapers]                   = useState<pdfService.Paper[]>([]);
  const [isLoading, setIsLoading]             = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingTagsId, setEditingTagsId]     = useState<string | null>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery]           = useState('');

  useEffect(() => { loadPapers(); }, []);

  const loadPapers = () => {
    try      { setPapers(pdfService.getPapers()); }
    catch    { toast.error("Failed to load papers"); }
    finally  { setIsLoading(false); }
  };

  const handleDeleteClick = (id: string) => {
    setEditingTagsId(null);
    setConfirmDeleteId(prev => (prev === id ? null : id));
  };

  const handleConfirmDelete = (id: string) => {
    pdfService.deletePaper(id);
    setConfirmDeleteId(null);
    if (activeTagFilter) {
      // If the deleted paper was the last one with this tag, clear the filter
      const remaining = pdfService.getPapers().filter(p => p.tags?.includes(activeTagFilter));
      if (remaining.length === 0) setActiveTagFilter(null);
    }
    loadPapers();
    toast.success("Paper deleted");
  };

  const handleTagsUpdate = (id: string, tags: string[]) => {
    pdfService.updatePaperTags(id, tags);
    loadPapers();
    // If active filter tag was removed from this paper and now has no matches → clear filter
    if (activeTagFilter && !tags.includes(activeTagFilter)) {
      const stillExists = pdfService.getPapers().some(
        p => p.id !== id && p.tags?.includes(activeTagFilter),
      );
      if (!stillExists) setActiveTagFilter(null);
    }
  };

  const toggleTagEdit = (id: string) => {
    setConfirmDeleteId(null);
    setEditingTagsId(prev => (prev === id ? null : id));
  };

  // All unique tags across all papers, sorted alphabetically
  const allTags = [...new Set(papers.flatMap(p => p.tags ?? []))].sort();

  const filteredPapers = papers.filter(p => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || [
      p.title, p.subject, p.sourceFile, ...(p.tags ?? []),
    ].some(field => field?.toLowerCase().includes(q));
    const matchesTag = !activeTagFilter || p.tags?.includes(activeTagFilter);
    return matchesSearch && matchesTag;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <div className="w-10 h-10 fm-spinner" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 fm-fadein">

      {/* ── Header row ── */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs font-semibold tracking-widest text-[#527D6F] uppercase mb-1">
            Your workspace
          </p>
          <h1 className="text-3xl font-bold text-[#D5E2D6]"
            style={{ fontFamily: "'Playfair Display', serif" }}>
            Question Papers
          </h1>
          <p className="mt-1 text-sm text-[#94B49C]">
            Manage and preview your AI-generated papers.
          </p>
        </div>
        <Link
          to="/new"
          className="fm-btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg"
        >
          <Plus className="w-4 h-4" /> New Paper
        </Link>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Papers",   value: papers.length },
          { label: "Total Sections", value: papers.reduce((a, p) => a + p.sections.length, 0) },
          { label: "Total Marks",    value: papers.reduce((a, p) => a + p.totalMarks, 0) },
        ].map((stat, i) => (
          <div key={i} className="fm-glass p-5 rounded-xl" style={{ animationDelay: `${i * 80}ms` }}>
            <p className="text-2xl font-bold text-[#94B49C]">{stat.value}</p>
            <p className="text-xs text-[#527D6F] mt-1 font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Search bar ── */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#527D6F] pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by title, subject, tag or filename…"
          className="w-full h-10 pl-10 pr-10 rounded-xl text-sm text-[#D5E2D6]
            placeholder:text-[#3a5560] focus:outline-none focus:ring-1 focus:ring-[#527D6F] transition-all"
          style={{
            background: "rgba(82,125,111,0.07)",
            border: "1px solid rgba(148,180,156,0.15)",
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#527D6F]
              hover:text-[#94B49C] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Search result count ── */}
      {searchQuery.trim() && papers.length > 0 && (
        <p className="text-xs text-[#527D6F] mb-2 fm-fadein">
          {filteredPapers.length === 0
            ? 'No results'
            : `${filteredPapers.length} result${filteredPapers.length !== 1 ? 's' : ''}`}
          {activeTagFilter ? ` in tag "${activeTagFilter}"` : ''}
        </p>
      )}

      {/* ── Active tag filter banner ── */}
      {activeTagFilter && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4 fm-fadein"
          style={{ background: "rgba(82,125,111,0.1)", border: "1px solid rgba(148,180,156,0.2)" }}
        >
          <Tag className="w-3.5 h-3.5 text-[#94B49C]" />
          <span className="text-xs text-[#94B49C]">
            Showing papers tagged
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: "rgba(82,125,111,0.25)", color: "#D5E2D6" }}
          >
            {activeTagFilter}
          </span>
          <span className="text-xs text-[#527D6F]">
            ({filteredPapers.length} of {papers.length} paper{papers.length !== 1 ? 's' : ''})
          </span>
          <button
            onClick={() => setActiveTagFilter(null)}
            className="ml-auto flex items-center gap-1 text-xs text-[#527D6F]
              hover:text-[#94B49C] transition-colors"
          >
            <X className="w-3 h-3" /> Clear filter
          </button>
        </div>
      )}

      {/* ── Papers list ── */}
      {papers.length === 0 ? (
        <div className="fm-glass rounded-2xl p-16 flex flex-col items-center text-center">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 fm-float"
            style={{ background: "rgba(82,125,111,0.15)", border: "1px solid rgba(82,125,111,0.25)" }}
          >
            <Sparkles className="w-9 h-9 text-[#94B49C]" />
          </div>
          <h3 className="text-lg font-bold text-[#D5E2D6] mb-2">No papers yet</h3>
          <p className="text-sm text-[#94B49C] mb-6 max-w-xs">
            Upload a textbook PDF and let the AI craft a complete question paper in seconds.
          </p>
          <Link
            to="/new"
            className="fm-btn-primary flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> Generate your first paper
          </Link>
        </div>
      ) : filteredPapers.length === 0 ? (
        <div className="fm-glass rounded-2xl p-10 flex flex-col items-center text-center gap-3">
          <Search className="w-8 h-8 text-[#527D6F]" />
          <p className="text-sm text-[#94B49C] font-medium">
            {searchQuery
              ? `No papers match "${searchQuery}"${activeTagFilter ? ` in tag "${activeTagFilter}"` : ''}`
              : `No papers tagged "${activeTagFilter}"`}
          </p>
          <div className="flex gap-3">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-[#527D6F] hover:text-[#94B49C] underline transition-colors"
              >
                Clear search
              </button>
            )}
            {activeTagFilter && (
              <button
                onClick={() => setActiveTagFilter(null)}
                className="text-xs text-[#527D6F] hover:text-[#94B49C] underline transition-colors"
              >
                Clear tag filter
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="fm-glass rounded-2xl overflow-hidden">
          <ul role="list" className="divide-y divide-[rgba(148,180,156,0.1)]">
            {filteredPapers.map((paper, i) => {
              const isPending    = confirmDeleteId === paper.id;
              const isEditingTag = editingTagsId  === paper.id;
              const hasTags      = (paper.tags?.length ?? 0) > 0;

              return (
                <li
                  key={paper.id}
                  className={`group transition-colors ${
                    isPending ? '' : isEditingTag ? '' : 'hover:bg-[rgba(82,125,111,0.08)]'
                  }`}
                  style={{
                    animationDelay: `${i * 50}ms`,
                    ...(isPending    ? { background: 'rgba(192,80,74,0.04)' }      : {}),
                    ...(isEditingTag ? { background: 'rgba(82,125,111,0.05)' }     : {}),
                  }}
                >
                  {/* ── Main row ── */}
                  <div className="px-6 py-4 flex items-start gap-4">

                    {/* Icon */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors mt-0.5"
                      style={{ background: isPending ? 'rgba(192,80,74,0.12)' : 'rgba(82,125,111,0.18)' }}
                    >
                      <FileText className={`w-5 h-5 ${isPending ? 'text-[#c0504a]' : 'text-[#94B49C]'}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {isPending ? (
                        <p className="text-sm font-semibold text-[#c0504a] truncate">{paper.title}</p>
                      ) : (
                        <Link to={`/paper/${paper.id}`}
                          className="text-sm font-semibold text-[#D5E2D6] truncate block
                            group-hover:text-[#94B49C] transition-colors">
                          {paper.title}
                        </Link>
                      )}

                      {/* Metadata row */}
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#527D6F]">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" /> {paper.subject}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(paper.createdAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {paper.duration}
                        </span>
                        <span className="text-[#94B49C] font-medium">{paper.totalMarks} marks</span>
                      </div>

                      {/* Tag chips */}
                      {hasTags && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {paper.tags!.map(t => (
                            <button
                              key={t}
                              onClick={() => setActiveTagFilter(
                                activeTagFilter === t ? null : t
                              )}
                              title={activeTagFilter === t ? "Clear filter" : `Filter by "${t}"`}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full
                                text-[10px] font-medium transition-all ${
                                  activeTagFilter === t
                                    ? "text-[#D5E2D6]"
                                    : "text-[#527D6F] hover:text-[#94B49C]"
                                }`}
                              style={{
                                background: activeTagFilter === t
                                  ? "rgba(82,125,111,0.35)"
                                  : "rgba(82,125,111,0.12)",
                                border: "1px solid rgba(148,180,156,0.15)",
                              }}
                            >
                              <Tag className="w-2.5 h-2.5" />
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right-side buttons */}
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      {/* Sections badge */}
                      <span className="fm-badge">
                        {paper.sections.length}{" "}
                        {paper.sections.length === 1 ? "section" : "sections"}
                      </span>

                      {/* Tag button */}
                      <button
                        onClick={() => toggleTagEdit(paper.id)}
                        title="Edit tags"
                        className={`ml-1 p-2 rounded-lg transition-all ${
                          isEditingTag
                            ? "text-[#94B49C] bg-[rgba(82,125,111,0.18)] opacity-100"
                            : "text-[#527D6F] hover:text-[#94B49C] hover:bg-[rgba(82,125,111,0.1)] opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        <Tag className="h-4 w-4" />
                      </button>

                      {/* Trash button */}
                      <button
                        onClick={() => handleDeleteClick(paper.id)}
                        title={isPending ? "Cancel delete" : "Delete paper"}
                        className={`p-2 rounded-lg transition-all ${
                          isPending
                            ? 'text-[#c0504a] bg-[rgba(192,80,74,0.12)] opacity-100'
                            : 'text-[#527D6F] hover:text-[#c0504a] hover:bg-[rgba(192,80,74,0.1)] opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* ── Tag editor panel ── */}
                  {isEditingTag && (
                    <TagEditor
                      paper={paper}
                      allTags={allTags}
                      onClose={() => setEditingTagsId(null)}
                      onUpdate={handleTagsUpdate}
                    />
                  )}

                  {/* ── Delete confirmation panel ── */}
                  {isPending && (
                    <div className="px-6 pb-4">
                      <div
                        className="flex items-center gap-3 px-4 py-3 rounded-xl"
                        style={{ background: 'rgba(192,80,74,0.08)', border: '1px solid rgba(192,80,74,0.22)' }}
                      >
                        <AlertTriangle className="w-4 h-4 text-[#c0504a] shrink-0" />
                        <p className="flex-1 text-sm text-[#c0504a]">
                          Permanently delete{' '}
                          <span className="font-semibold">"{paper.title}"</span>?
                          This cannot be undone.
                        </p>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#94B49C]
                            transition-all hover:bg-[rgba(82,125,111,0.15)]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleConfirmDelete(paper.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white
                            transition-all hover:opacity-90"
                          style={{ background: 'rgba(192,80,74,0.82)' }}
                        >
                          Delete
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

      {/* ── All-tags quick-filter strip (shown only when there are tags) ── */}
      {allTags.length > 0 && !activeTagFilter && (
        <div className="mt-4 flex flex-wrap gap-2 items-center fm-fadein">
          <span className="text-[10px] font-semibold tracking-widest text-[#3a5560] uppercase">
            Filter by tag:
          </span>
          {allTags.map(t => (
            <button
              key={t}
              onClick={() => setActiveTagFilter(t)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px]
                font-medium text-[#527D6F] hover:text-[#94B49C] transition-all"
              style={{ border: "1px solid rgba(148,180,156,0.2)" }}
            >
              <Tag className="w-2.5 h-2.5" /> {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
