import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Printer, Download, ArrowLeft, Loader2, Pencil,
  Check, X, Trash2, Plus, KeyRound, Eye, EyeOff,
  ChevronDown, RefreshCw, Shuffle,
} from "lucide-react";
import * as pdfService from "../services/pdfService";
import { regenerateSection } from "../services/pdfService";
import { exportPaperToPDF } from "../services/exportPdf";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// ── Editable single-line or multi-line field ──
function EditableText({
  value,
  onSave,
  multiline = false,
  placeholder = "Click pencil to add…",
  className = "",
}: {
  value: string;
  onSave: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  const open   = () => { setDraft(value); setEditing(true); };
  const cancel = () => setEditing(false);
  const save   = () => {
    const t = draft.trim();
    if (t !== value) onSave(t);
    setEditing(false);
  };

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      if (multiline) {
        (ref.current as HTMLTextAreaElement).style.height = "auto";
        (ref.current as HTMLTextAreaElement).style.height =
          (ref.current as HTMLTextAreaElement).scrollHeight + "px";
      }
    }
  }, [editing, multiline]);

  const sharedCls = `rounded-lg border border-[rgba(148,180,156,0.4)] bg-[rgba(82,125,111,0.08)]
    px-3 py-2 text-sm text-gray-900 leading-relaxed focus:outline-none
    focus:border-[#94B49C] focus:ring-1 focus:ring-[#94B49C] w-full`;

  if (editing) {
    return (
      <div className={`w-full ${className}`}>
        {multiline ? (
          <textarea
            ref={ref as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={e => {
              setDraft(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
              if (e.key === "Escape") cancel();
            }}
            className={`${sharedCls} resize-none`}
            style={{ fontFamily: "'Georgia', serif", minHeight: 56 }}
          />
        ) : (
          <input
            ref={ref as React.RefObject<HTMLInputElement>}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancel();
            }}
            className={sharedCls}
          />
        )}
        <div className="flex gap-2 mt-1.5 items-center">
          <button onClick={save}
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold text-white
              bg-[#527D6F] hover:bg-[#3e6358] transition-colors">
            <Check className="w-3 h-3" /> Save
          </button>
          <button onClick={cancel}
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-[#527D6F]
              hover:bg-[rgba(82,125,111,0.1)] transition-colors">
            <X className="w-3 h-3" /> Cancel
          </button>
          {multiline && (
            <span className="ml-auto text-xs text-gray-400">⌘↵ to save · Esc to cancel</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <span className={`group/e inline-block w-full ${className}`}>
      {value
        ? <span style={{ fontFamily: multiline ? "'Georgia', serif" : undefined }} className="math-markdown inline-block w-[calc(100%-24px)] align-top">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: 'span' }}>
              {value}
            </ReactMarkdown>
          </span>
        : <span className="text-gray-400 italic text-xs">{placeholder}</span>}
      <button onClick={open} title="Edit"
        className="ml-1.5 inline-flex items-center opacity-0 group-hover/e:opacity-100
          transition-opacity text-[#94B49C] hover:text-[#527D6F]">
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

// ── Editable MCQ option ──
function EditableOption({ label, value, onSave, isCorrect = false }: {
  label: string; value: string; onSave: (v: string) => void; isCorrect?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  const open   = () => { setDraft(value); setEditing(true); };
  const cancel = () => setEditing(false);
  const save   = () => { if (draft.trim() !== value) onSave(draft.trim()); setEditing(false); };

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  if (editing) {
    return (
      <div className="flex items-center gap-1 col-span-1">
        <span className="font-semibold text-gray-700 shrink-0">{label}</span>
        <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          className="flex-1 rounded border border-[rgba(148,180,156,0.4)] bg-[rgba(82,125,111,0.06)]
            px-2 py-0.5 text-sm text-gray-900 focus:outline-none focus:border-[#94B49C]" />
        <button onClick={save}   className="text-[#527D6F] hover:text-[#3e6358]"><Check className="w-3.5 h-3.5" /></button>
        <button onClick={cancel} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 group/opt rounded px-1 -mx-1 transition-colors
      ${isCorrect ? 'text-[#2d6b4f] font-semibold' : 'text-gray-700'}`}>
      <span className={`font-semibold shrink-0 ${isCorrect ? 'text-[#2d6b4f]' : ''}`}>{label}</span>
      <span className="flex-1 math-markdown">
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: 'span' }}>
          {value}
        </ReactMarkdown>
      </span>
      {isCorrect && (
        <Check className="w-3.5 h-3.5 text-[#2d6b4f] shrink-0" aria-label="Correct answer" />
      )}
      <button onClick={open} title="Edit option"
        className="opacity-0 group-hover/opt:opacity-100 transition-opacity text-[#94B49C] hover:text-[#527D6F] ml-1">
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Export dropdown ──
function ExportDropdown({
  onExport,
  isExporting,
}: {
  onExport: (withKey: boolean) => void;
  isExporting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div className="flex">
        {/* Main button */}
        <button
          onClick={() => onExport(false)}
          disabled={isExporting}
          className={`fm-btn-primary flex items-center gap-2 pl-5 pr-3 py-2 rounded-l-xl text-sm font-semibold
            ${isExporting ? "opacity-70 cursor-not-allowed" : ""}`}
        >
          {isExporting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Exporting…</>
            : <><Download className="w-4 h-4" /> Export PDF</>}
        </button>
        {/* Chevron */}
        <button
          onClick={() => setOpen(o => !o)}
          disabled={isExporting}
          className="fm-btn-primary pl-2 pr-2.5 py-2 rounded-r-xl border-l border-[rgba(255,255,255,0.15)]
            text-sm font-semibold disabled:opacity-70"
          title="More export options"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div
          className="absolute right-0 mt-1.5 w-56 rounded-xl shadow-xl z-20 overflow-hidden"
          style={{ background: "rgba(25,36,41,0.97)", border: "1px solid rgba(148,180,156,0.2)" }}
        >
          <button
            onClick={() => { onExport(false); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#D5E2D6]
              hover:bg-[rgba(82,125,111,0.15)] transition-colors text-left"
          >
            <Download className="w-4 h-4 text-[#94B49C] shrink-0" />
            <div>
              <p className="font-medium">Question Paper</p>
              <p className="text-xs text-[#527D6F]">No answers included</p>
            </div>
          </button>
          <div style={{ borderTop: "1px solid rgba(148,180,156,0.1)" }} />
          <button
            onClick={() => { onExport(true); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#D5E2D6]
              hover:bg-[rgba(82,125,111,0.15)] transition-colors text-left"
          >
            <KeyRound className="w-4 h-4 text-[#94B49C] shrink-0" />
            <div>
              <p className="font-medium">With Answer Key</p>
              <p className="text-xs text-[#527D6F]">Appends answers as last page</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// ── Main page ──
// ══════════════════════════════════════════
export function ViewPaper() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [paper, setPaper]             = useState<pdfService.Paper | null>(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isDirty, setIsDirty]         = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);

  useEffect(() => {
    if (id) {
      const found = pdfService.getPaper(id);
      if (found) setPaper(JSON.parse(JSON.stringify(found)));
      else { toast.error("Paper not found"); navigate("/"); }
      setIsLoading(false);
    }
  }, [id, navigate]);

  // ── Mutation helpers ──
  const mutatePaper = (fn: (draft: pdfService.Paper) => void) => {
    setPaper(prev => {
      if (!prev) return prev;
      const next: pdfService.Paper = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });
    setIsDirty(true);
  };

  const updateQuestionText = (sIdx: number, qIdx: number, text: string) =>
    mutatePaper(p => { p.sections[sIdx].questions[qIdx].text = text; });

  const updateAnswer = (sIdx: number, qIdx: number, answer: string) =>
    mutatePaper(p => { p.sections[sIdx].questions[qIdx].answer = answer; });

  const updateOption = (sIdx: number, qIdx: number, oIdx: number, val: string) =>
    mutatePaper(p => { p.sections[sIdx].questions[qIdx].options![oIdx] = val; });

  const deleteQuestion = (sIdx: number, qIdx: number) => {
    mutatePaper(p => {
      p.sections[sIdx].questions.splice(qIdx, 1);
      p.sections[sIdx].questions.forEach((q, i) => { q.id = sIdx * 100 + i + 1; });
    });
    toast.success("Question removed");
  };

  const addQuestion = (sIdx: number) => {
    mutatePaper(p => {
      const sec   = p.sections[sIdx];
      const newId = sIdx * 100 + sec.questions.length + 1;
      const isMCQ = sec.type.toLowerCase().includes("multiple choice") || sec.type.toLowerCase().includes("mcq");
      const isTF  = sec.type.toLowerCase().includes("true");
      sec.questions.push({
        id:   newId,
        text: "New question — click the pencil to edit.",
        marks: sec.questions[0]?.marks ?? 1,
        ...(isMCQ ? { options: ["Option A", "Option B", "Option C", "Option D"] }
          : isTF  ? { options: ["True", "False"] }
          : {}),
      });
    });
  };

  // ── Fisher-Yates shuffle for an array ──
  const shuffleArray = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const shuffleSection = (sIdx: number) => {
    mutatePaper(p => {
      p.sections[sIdx].questions = shuffleArray(p.sections[sIdx].questions);
      // Re-number ids to keep them sequential
      p.sections[sIdx].questions.forEach((q, i) => { q.id = sIdx * 100 + i + 1; });
    });
    toast.success(`${paper!.sections[sIdx].name} shuffled!`);
  };

  const shuffleAll = () => {
    mutatePaper(p => {
      p.sections.forEach((sec, sIdx) => {
        sec.questions = shuffleArray(sec.questions);
        sec.questions.forEach((q, i) => { q.id = sIdx * 100 + i + 1; });
      });
    });
    toast.success("All sections shuffled!");
  };

  const saveChanges = () => {
    if (!paper) return;
    const updated: pdfService.Paper = {
      ...paper,
      totalMarks: paper.sections.reduce(
        (sum, sec) => sum + sec.questions.reduce((s, q) => s + (q.marks ?? 0), 0), 0
      ),
    };
    pdfService.deletePaper(paper.id);
    localStorage.setItem(
      "questionPapers",
      JSON.stringify([...pdfService.getPapers(), updated])
    );
    setPaper(updated);
    setIsDirty(false);
    toast.success("Changes saved!");
  };

  const handleRegenerate = async (sIdx: number) => {
    if (!paper) return;
    if (!paper.sourceText) {
      toast.error("No source text stored. Re-generate this paper from the original PDF to enable section regeneration.");
      return;
    }
    setRegeneratingIdx(sIdx);
    try {
      const newSection = await regenerateSection(paper, sIdx);
      mutatePaper(p => { p.sections[sIdx] = newSection; });
      toast.success(`${paper.sections[sIdx].name} regenerated!`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Regeneration failed. Is LM Studio running?");
    } finally {
      setRegeneratingIdx(null);
    }
  };

  const handleExport = async (withKey: boolean) => {
    if (!paper) return;
    setIsExporting(true);
    try {
      await exportPaperToPDF(paper, withKey);
      toast.success(withKey ? "PDF with answer key downloaded!" : "PDF downloaded!");
    } catch (err) {
      console.error(err);
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const totalQuestions = paper
    ? paper.sections.reduce((a, s) => a + s.questions.length, 0)
    : 0;
  const answeredCount = paper
    ? paper.sections.reduce((a, s) => a + s.questions.filter(q => q.answer?.trim()).length, 0)
    : 0;

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="w-10 h-10 fm-spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-full py-8 px-4 sm:px-6 lg:px-8 print:p-0 fm-fadein">
      <div className="max-w-4xl mx-auto space-y-5 print:space-y-0">

        {/* ── Action bar ── */}
        <div className="fm-glass rounded-2xl px-5 py-3 flex items-center justify-between print:hidden">
          <button onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm font-medium text-[#94B49C] hover:text-[#D5E2D6] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>

          <div className="flex gap-2 items-center flex-wrap justify-end">
            {isDirty && (
              <button onClick={saveChanges}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
                  text-white bg-[#527D6F] hover:bg-[#3e6358] transition-colors animate-pulse">
                <Check className="w-4 h-4" /> Save Changes
              </button>
            )}

            {/* Shuffle all sections */}
            <button
              onClick={shuffleAll}
              title="Shuffle questions in all sections"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium
                text-[#94B49C] hover:bg-[rgba(82,125,111,0.12)] transition-all"
              style={{ border: "1px solid rgba(148,180,156,0.2)" }}
            >
              <Shuffle className="w-4 h-4" /> Shuffle All
            </button>

            {/* Answer key toggle */}
            <button
              onClick={() => setShowAnswers(a => !a)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all
                ${showAnswers
                  ? "text-white bg-[#527D6F] hover:bg-[#3e6358]"
                  : "text-[#94B49C] hover:bg-[rgba(82,125,111,0.12)]"}`}
              style={showAnswers ? {} : { border: "1px solid rgba(148,180,156,0.2)" }}
            >
              <KeyRound className="w-4 h-4" />
              {showAnswers ? "Hide Answers" : "Answer Key"}
              {answeredCount > 0 && !showAnswers && (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: "rgba(82,125,111,0.2)", color: "#94B49C" }}>
                  {answeredCount}/{totalQuestions}
                </span>
              )}
            </button>

            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-[#94B49C]
                transition-all hover:bg-[rgba(82,125,111,0.12)]"
              style={{ border: "1px solid rgba(148,180,156,0.2)" }}>
              <Printer className="w-4 h-4" /> Print
            </button>

            <ExportDropdown onExport={handleExport} isExporting={isExporting} />
          </div>
        </div>

        {/* ── Hint banner ── */}
        <div
          className="print:hidden flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs text-[#94B49C]"
          style={{ background: "rgba(82,125,111,0.08)", border: "1px solid rgba(148,180,156,0.15)" }}
        >
          {showAnswers ? (
            <>
              <KeyRound className="w-3.5 h-3.5 shrink-0 text-[#94B49C]" />
              {answeredCount > 0
                ? <><strong className="mr-0.5">{answeredCount}/{totalQuestions}</strong> answers auto-generated. Click any <strong className="mx-0.5">pencil</strong> to edit. For MCQ, the correct option is highlighted in green.</>
                : <>Answer key mode — click the pencil next to each <strong className="mx-0.5">Answer</strong> field to fill in the correct answer.</>
              }
              {" "}Use <strong className="mx-0.5">Export PDF → With Answer Key</strong> to download.
              <span className="ml-2 px-2 py-0.5 rounded text-[11px] font-medium bg-[#94B49C]/20 text-[#3e6358]">
                💡 For complex math, use <strong>Print → Save as PDF</strong> instead of Export.
              </span>
            </>
          ) : (
            <>
              <Pencil className="w-3.5 h-3.5 shrink-0" />
              Hover over any question or option and click the <strong className="mx-0.5">pencil icon</strong> to edit.
              Use <strong className="mx-0.5">+</strong> to add and <strong className="mx-0.5">✕</strong> to delete questions.
              <span className="ml-2 px-2 py-0.5 rounded text-[11px] font-medium bg-[#94B49C]/20 text-[#3e6358]">
                💡 For complex math, use <strong>Print → Save as PDF</strong> instead of Export.
              </span>
              {answeredCount > 0 && (
                <span className="ml-auto shrink-0 font-medium" style={{ color: "#94B49C" }}>
                  {answeredCount}/{totalQuestions} answers ready
                </span>
              )}
            </>
          )}
        </div>

        {/* ── The paper ── */}
        <div
          className="rounded-2xl p-10 sm:p-16 print:shadow-none print:rounded-none print:p-0"
          style={{ background: "#fff", color: "#1a1a1a", fontFamily: "'Georgia', serif" }}
        >
          {/* Header */}
          <div className="text-center border-b-2 border-gray-800 pb-6 mb-8">
            <h1 className="text-3xl font-bold uppercase tracking-widest">{paper!.subject}</h1>
            <h2 className="text-xl mt-2 font-medium text-gray-600">{paper!.title}</h2>
            <div className="flex justify-between mt-6 text-sm font-semibold text-gray-600">
              <span>Time Allowed: {paper!.duration}</span>
              <span>Total Marks: {paper!.totalMarks}</span>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-12">
            {paper!.sections.map((section, sIdx) => (
              <div key={sIdx}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-bold underline decoration-gray-400 underline-offset-4">
                    {section.name}
                  </h3>
                  <div className="flex items-center gap-2 print:hidden">
                    {/* Per-section shuffle */}
                    <button
                      onClick={() => shuffleSection(sIdx)}
                      disabled={regeneratingIdx !== null}
                      title={`Shuffle questions in ${section.name}`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                        transition-all
                        ${regeneratingIdx !== null
                          ? "text-[#3a5560] cursor-not-allowed opacity-50"
                          : "text-[#527D6F] hover:text-[#94B49C] hover:bg-[rgba(82,125,111,0.1)]"
                        }`}
                      style={{ border: "1px solid rgba(148,180,156,0.18)" }}
                    >
                      <Shuffle className="w-3.5 h-3.5" /> Shuffle
                    </button>

                    {/* Regenerate */}
                    <button
                      onClick={() => handleRegenerate(sIdx)}
                      disabled={regeneratingIdx !== null}
                      title={`Regenerate ${section.name} questions`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                        transition-all
                        ${regeneratingIdx === sIdx
                          ? "text-[#94B49C] bg-[rgba(82,125,111,0.15)] cursor-wait"
                          : regeneratingIdx !== null
                          ? "text-[#3a5560] cursor-not-allowed opacity-50"
                          : "text-[#527D6F] hover:text-[#94B49C] hover:bg-[rgba(82,125,111,0.1)]"
                        }`}
                      style={{ border: "1px solid rgba(148,180,156,0.18)" }}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${regeneratingIdx === sIdx ? "animate-spin" : ""}`} />
                      {regeneratingIdx === sIdx ? "Regenerating…" : "Regenerate"}
                    </button>
                  </div>
                </div>
                <p className="italic text-gray-500 mt-1 mb-4 text-sm">{section.instructions}</p>

                <ol className="list-decimal list-inside space-y-6">
                  {section.questions.map((q, qIdx) => (
                    <li key={q.id} className="pl-2 group/item">
                      <div className="inline-block align-top w-[calc(100%-1.5rem)] ml-1">

                        {/* Question row */}
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <EditableText
                              value={q.text}
                              onSave={v => updateQuestionText(sIdx, qIdx, v)}
                              multiline
                            />
                          </div>
                          <button
                            onClick={() => deleteQuestion(sIdx, qIdx)}
                            title="Delete question"
                            className="print:hidden shrink-0 mt-0.5 p-1 rounded opacity-0
                              group-hover/item:opacity-100 transition-opacity
                              text-gray-300 hover:text-red-400 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Options */}
                        {q.options && (
                          <div className="mt-3 ml-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.options.map((opt, oIdx) => {
                              // Detect correct option from q.answer (e.g. "B) Some text")
                              const correctLetter = showAnswers && q.answer
                                ? q.answer.match(/^([A-D])\)/i)?.[1]?.toUpperCase()
                                : undefined;
                              const isCorrect = !!correctLetter &&
                                correctLetter === String.fromCharCode(65 + oIdx);
                              return (
                                <EditableOption
                                  key={oIdx}
                                  label={`${String.fromCharCode(97 + oIdx)})`}
                                  value={opt}
                                  onSave={v => updateOption(sIdx, qIdx, oIdx, v)}
                                  isCorrect={isCorrect}
                                />
                              );
                            })}
                          </div>
                        )}

                        {/* Answer key field — only shown in answer key mode */}
                        {showAnswers && (
                          <div
                            className="mt-3 ml-4 flex items-start gap-2 px-3 py-2 rounded-lg print:hidden"
                            style={{ background: "rgba(60,110,90,0.07)", border: "1px solid rgba(60,110,90,0.2)" }}
                          >
                            <KeyRound className="w-3.5 h-3.5 text-[#3c6e5a] shrink-0 mt-0.5" />
                            <div className="flex-1 text-sm">
                              <span className="text-xs font-semibold text-[#3c6e5a] uppercase tracking-wide mr-2">
                                Answer:
                              </span>
                              <EditableText
                                value={q.answer ?? ""}
                                onSave={v => updateAnswer(sIdx, qIdx, v)}
                                multiline={!q.options}
                                placeholder="Click pencil to add answer…"
                                className="text-[#3c6e5a]"
                              />
                            </div>
                          </div>
                        )}

                        {section.type === "Short Answer" && !showAnswers && (
                          <div className="mt-6 mb-8 border-b border-dotted border-gray-300 w-full h-8" />
                        )}
                      </div>
                    </li>
                  ))}
                </ol>

                <button
                  onClick={() => addQuestion(sIdx)}
                  className="print:hidden mt-4 flex items-center gap-1.5 text-xs font-medium
                    text-[#94B49C] hover:text-[#527D6F] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add question to {section.name}
                </button>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-gray-200 text-center text-sm text-gray-400">
            *** End of Paper ***
          </div>
        </div>

      </div>
    </div>
  );
}
