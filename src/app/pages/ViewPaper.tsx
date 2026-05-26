import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Printer, Download, ArrowLeft, Loader2, Pencil,
  Check, X, Trash2, Plus, KeyRound, Eye, EyeOff,
  ChevronDown, RefreshCw, Shuffle, FileText, Settings,
  Type, AlignJustify, LayoutGrid, GripVertical,
} from "lucide-react";
import * as pdfService from "../services/pdfService";
import { regenerateSection } from "../services/pdfService";
import { exportPaperToPDF } from "../services/exportPdf";
import { exportPaperToDocx } from "../services/exportDocx";
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
        ? <span style={{ fontFamily: multiline ? "'Georgia', serif" : undefined }} className="math-markdown inline-block w-[calc(100%-24px)] align-top overflow-x-auto max-w-full pb-0.5 scrollbar-none">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: 'span' }}>
              {value}
            </ReactMarkdown>
          </span>
        : <span className="text-gray-400 italic text-xs">{placeholder}</span>}
      <button onClick={open} title="Edit"
        className="ml-1.5 inline-flex items-center lg:opacity-0 group-hover/e:lg:opacity-100 group-hover/e:opacity-100
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
  onExport: (format: "pdf" | "docx", withKey: boolean) => void;
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
          onClick={() => onExport("pdf", false)}
          disabled={isExporting}
          className={`fm-btn-primary flex items-center gap-2 pl-5 pr-3 py-2 rounded-l-xl text-sm font-semibold
            ${isExporting ? "opacity-70 cursor-not-allowed" : ""}`}
        >
          {isExporting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Exporting…</>
            : <><Download className="w-4 h-4" /> Export Paper</>}
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
          className="absolute right-0 mt-1.5 w-64 rounded-xl shadow-xl z-20 overflow-hidden"
          style={{ background: "rgba(25,36,41,0.98)", border: "1px solid rgba(148,180,156,0.25)" }}
        >
          {/* PDF Section */}
          <div className="px-3 py-1.5 bg-[rgba(82,125,111,0.1)] border-b border-[rgba(148,180,156,0.1)]">
            <span className="text-[10px] font-bold tracking-wider text-[#94B49C] uppercase">PDF Document</span>
          </div>
          
          <button
            onClick={() => { onExport("pdf", false); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#D5E2D6]
              hover:bg-[rgba(82,125,111,0.15)] transition-colors text-left"
          >
            <Download className="w-4 h-4 text-[#94B49C] shrink-0" />
            <div>
              <p className="font-medium text-xs">Question Paper</p>
              <p className="text-[10px] text-[#527D6F]">No answers included</p>
            </div>
          </button>
          
          <button
            onClick={() => { onExport("pdf", true); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#D5E2D6]
              hover:bg-[rgba(82,125,111,0.15)] transition-colors text-left"
          >
            <KeyRound className="w-4 h-4 text-[#94B49C] shrink-0" />
            <div>
              <p className="font-medium text-xs">With Answer Key</p>
              <p className="text-[10px] text-[#527D6F]">Appends answers as last page</p>
            </div>
          </button>

          {/* Word Section */}
          <div className="px-3 py-1.5 bg-[rgba(82,125,111,0.1)] border-t border-b border-[rgba(148,180,156,0.1)]">
            <span className="text-[10px] font-bold tracking-wider text-[#94B49C] uppercase">Word Document (.docx)</span>
          </div>

          <button
            onClick={() => { onExport("docx", false); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#D5E2D6]
              hover:bg-[rgba(82,125,111,0.15)] transition-colors text-left"
          >
            <FileText className="w-4 h-4 text-[#94B49C] shrink-0" />
            <div>
              <p className="font-medium text-xs">Question Paper</p>
              <p className="text-[10px] text-[#527D6F]">Word format, editable</p>
            </div>
          </button>

          <button
            onClick={() => { onExport("docx", true); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#D5E2D6]
              hover:bg-[rgba(82,125,111,0.15)] transition-colors text-left"
          >
            <FileText className="w-4 h-4 text-[#94B49C] shrink-0" />
            <div>
              <p className="font-medium text-xs">With Answer Key</p>
              <p className="text-[10px] text-[#527D6F]">Word format with answers</p>
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

  // ── Styling Customizer States ──
  const [spacing, setSpacing]         = useState<"tight" | "normal" | "loose">("normal");
  const [fontSize, setFontSize]       = useState<"sm" | "base" | "lg">("base");
  const [mcqCols, setMcqCols]         = useState<number>(2);
  const [showMarks, setShowMarks]     = useState(true);
  const [showLines, setShowLines]     = useState(true);
  const [hideInstructions, setHideInstructions] = useState(false);
  const [showMobileStyles, setShowMobileStyles] = useState(false);

  // ── Drag and Drop States ──
  const [draggedItem, setDraggedItem] = useState<{ sIdx: number; qIdx: number } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ sIdx: number; qIdx: number } | null>(null);
  const [draggedSectionIdx, setDraggedSectionIdx] = useState<number | null>(null);
  const [dragOverSectionIdx, setDragOverSectionIdx] = useState<number | null>(null);

  // ── Drag and Drop Handlers for Questions ──
  const handleDragStart = (sIdx: number, qIdx: number) => {
    setDraggedItem({ sIdx, qIdx });
  };

  const handleDragOver = (e: React.DragEvent, sIdx: number, qIdx: number) => {
    e.preventDefault();
    setDragOverItem({ sIdx, qIdx });
  };

  const handleDrop = (e: React.DragEvent, targetSIdx: number, targetQIdx: number) => {
    e.preventDefault();
    if (!draggedItem) return;

    const sourceSIdx = draggedItem.sIdx;
    const sourceQIdx = draggedItem.qIdx;

    if (sourceSIdx === targetSIdx && sourceQIdx === targetQIdx) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    mutatePaper(p => {
      const sourceSec = p.sections[sourceSIdx];
      const targetSec = p.sections[targetSIdx];

      // Remove from source
      const [question] = sourceSec.questions.splice(sourceQIdx, 1);

      // Insert into target
      targetSec.questions.splice(targetQIdx, 0, question);

      // Re-index all IDs sequentially
      p.sections.forEach((sec, s) => {
        sec.questions.forEach((questionItem, qIdx) => {
          questionItem.id = s * 100 + qIdx + 1;
        });
      });
    });

    setDraggedItem(null);
    setDragOverItem(null);
    toast.success("Question rearranged");
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  // ── Drag and Drop Handlers for Entire Sections ──
  const handleSectionDragStart = (sIdx: number) => {
    setDraggedSectionIdx(sIdx);
  };

  const handleSectionDragOver = (e: React.DragEvent, sIdx: number) => {
    e.preventDefault();
    setDragOverSectionIdx(sIdx);
  };

  const handleSectionDrop = (e: React.DragEvent, targetSIdx: number) => {
    e.preventDefault();
    if (draggedSectionIdx === null) return;
    if (draggedSectionIdx === targetSIdx) {
      setDraggedSectionIdx(null);
      setDragOverSectionIdx(null);
      return;
    }

    mutatePaper(p => {
      const [section] = p.sections.splice(draggedSectionIdx, 1);
      p.sections.splice(targetSIdx, 0, section);

      // Re-index all IDs sequentially
      p.sections.forEach((sec, s) => {
        sec.questions.forEach((questionItem, qIdx) => {
          questionItem.id = s * 100 + qIdx + 1;
        });
      });
    });

    setDraggedSectionIdx(null);
    setDragOverSectionIdx(null);
    toast.success("Section rearranged");
  };

  const handleSectionDragEnd = () => {
    setDraggedSectionIdx(null);
    setDragOverSectionIdx(null);
  };

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
      const msg = paper.isPromptMode || paper.sourceFile === 'Custom Prompt'
        ? "No prompt text stored for this paper."
        : "No source text stored. Re-generate this paper from the original PDF to enable section regeneration.";
      toast.error(msg);
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

  const handleExport = async (format: "pdf" | "docx", withKey: boolean) => {
    if (!paper) return;

    if (format === "pdf") {
      // For STEM, we MUST use native browser print to render KaTeX math correctly in PDF
      if (paper.subjectType === "math_physics" || paper.subjectType === "chemistry") {
        if (withKey && !showAnswers) {
          setShowAnswers(true);
          toast.info("Answer key shown. Please save as PDF in the print dialog to preserve math formatting.", { duration: 5000 });
          setTimeout(() => window.print(), 500);
        } else if (!withKey && showAnswers) {
          setShowAnswers(false);
          toast.info("Answer key hidden. Please save as PDF in the print dialog to preserve math formatting.", { duration: 5000 });
          setTimeout(() => window.print(), 500);
        } else {
          toast.info("Please select 'Save as PDF' in the print dialog. This perfectly preserves all math formulas!", { duration: 5000 });
          window.print();
        }
        return;
      }

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
    } else {
      // Word (.docx) export - supports unicode math directly!
      setIsExporting(true);
      try {
        await exportPaperToDocx(paper, withKey);
        toast.success(withKey ? "Word document with answer key downloaded!" : "Word document downloaded!");
      } catch (err) {
        console.error(err);
        toast.error("Word export failed. Please try again.");
      } finally {
        setIsExporting(false);
      }
    }
  };

  const totalQuestions = paper
    ? paper.sections.reduce((a, s) => a + s.questions.length, 0)
    : 0;
  const answeredCount = paper
    ? paper.sections.reduce((a, s) => a + s.questions.filter(q => q.answer?.trim()).length, 0)
    : 0;

  const paperFontSizeClass = fontSize === "sm" ? "text-sm" : fontSize === "lg" ? "text-lg" : "text-base";
  const h1Class = fontSize === "sm" ? "text-xl sm:text-2xl" : fontSize === "lg" ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl";
  const h2Class = fontSize === "sm" ? "text-sm sm:text-base" : fontSize === "lg" ? "text-lg sm:text-xl" : "text-base sm:text-lg";
  const h3Class = fontSize === "sm" ? "text-xs sm:text-sm" : fontSize === "lg" ? "text-base sm:text-lg" : "text-sm sm:text-base";
  const sectionSpacingClass = spacing === "tight" ? "space-y-6" : spacing === "loose" ? "space-y-16" : "space-y-12";
  const questionSpacingClass = spacing === "tight" ? "space-y-3" : spacing === "loose" ? "space-y-9" : "space-y-6";
  
  const mcqColsClass = mcqCols === 1 
    ? "grid-cols-1" 
    : mcqCols === 4 
      ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-4 print:grid-cols-4" 
      : "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 print:grid-cols-2";

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="w-10 h-10 fm-spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-full py-6 sm:py-8 px-4 sm:px-6 lg:px-8 print:p-0 fm-fadein">
      <div className="max-w-7xl mx-auto flex flex-col xl:flex-row gap-6 items-stretch print:space-y-0 print:gap-0">
        
        {/* Left side: Action bar, Hint banner, Paper sheet */}
        <div className="flex-1 space-y-5 print:space-y-0">
          
          {/* Action bar */}
          <div className="fm-glass rounded-2xl px-4 sm:px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
            <button onClick={() => navigate("/")}
              className="flex items-center gap-2 text-sm font-medium text-[#94B49C] hover:text-[#D5E2D6] transition-colors self-start">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </button>

            <div className="flex gap-2 items-center flex-wrap justify-start md:justify-end w-full md:w-auto">
              {isDirty && (
                <button onClick={saveChanges}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
                    text-white bg-[#527D6F] hover:bg-[#3e6358] transition-colors animate-pulse">
                  <Check className="w-4 h-4" /> Save Changes
                </button>
              )}

              {/* Mobile styles toggle */}
              <button
                onClick={() => setShowMobileStyles(s => !s)}
                className={`xl:hidden flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all
                  ${showMobileStyles
                    ? "text-white bg-[#527D6F]"
                    : "text-[#94B49C] hover:bg-[rgba(82,125,111,0.12)]"}`}
                style={showMobileStyles ? {} : { border: "1px solid rgba(148,180,156,0.2)" }}
              >
                <Settings className="w-4 h-4" /> Styles
              </button>

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
                <span>{showAnswers ? "Hide Answers" : "Answer Key"}</span>
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

          {/* Mobile styles card */}
          {showMobileStyles && (
            <div className="xl:hidden fm-glass rounded-2xl p-5 space-y-5 print:hidden">
              <div className="flex items-center justify-between border-b border-[rgba(148,180,156,0.1)] pb-2">
                <span className="text-xs font-bold tracking-widest text-[#94B49C] uppercase">Paper Styles</span>
                <button onClick={() => setShowMobileStyles(false)} className="text-[#527D6F] hover:text-[#94B49C]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <CustomizerControls
                spacing={spacing} setSpacing={setSpacing}
                fontSize={fontSize} setFontSize={setFontSize}
                mcqCols={mcqCols} setMcqCols={setMcqCols}
                showMarks={showMarks} setShowMarks={setShowMarks}
                showLines={showLines} setShowLines={setShowLines}
                hideInstructions={hideInstructions} setHideInstructions={setHideInstructions}
              />
            </div>
          )}

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
            className={`rounded-2xl p-6 sm:p-16 md:p-20 border border-gray-200/80 print:shadow-none print:rounded-none print:p-0 shadow-[0_20px_50px_rgba(0,0,0,0.15)] transition-all duration-300 ${paperFontSizeClass}`}
            style={{ background: "#fff", color: "#1a1a1a", fontFamily: "'Georgia', serif", lineHeight: spacing === "tight" ? "1.4" : spacing === "loose" ? "1.8" : "1.6" }}
          >
            {/* Header */}
            <div className="text-center border-b-2 border-gray-800 pb-6 mb-8">
              <h1 className={`font-bold uppercase tracking-widest ${h1Class}`}>{paper!.subject}</h1>
              <h2 className={`mt-2 font-medium text-gray-600 ${h2Class}`}>{paper!.title}</h2>
              <div className="flex justify-between mt-6 text-xs sm:text-sm font-semibold text-gray-600">
                <span>Time Allowed: {paper!.duration}</span>
                <span>Total Marks: {paper!.totalMarks}</span>
              </div>
            </div>

            {/* Sections */}
            <div className={sectionSpacingClass}>
              {paper!.sections.map((section, sIdx) => {
                const isSectionDragged = draggedSectionIdx === sIdx;
                const isSectionDragOver = dragOverSectionIdx === sIdx;

                return (
                  <div
                    key={sIdx}
                    onDragOver={(e) => {
                      if (draggedSectionIdx !== null) handleSectionDragOver(e, sIdx);
                    }}
                    onDrop={(e) => {
                      if (draggedSectionIdx !== null) handleSectionDrop(e, sIdx);
                    }}
                    className={`transition-all duration-200 rounded-xl p-3 -m-3 mb-6
                      ${isSectionDragged ? "opacity-30 border-2 border-dashed border-gray-300" : ""}
                      ${isSectionDragOver && !isSectionDragged ? "bg-[rgba(82,125,111,0.05)] border-2 border-dashed border-[#527D6F]" : ""}
                    `}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <div
                          draggable="true"
                          onDragStart={() => handleSectionDragStart(sIdx)}
                          onDragEnd={handleSectionDragEnd}
                          className="print:hidden cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-600 p-0.5"
                          title="Drag to rearrange section"
                        >
                          <GripVertical className="w-4 h-4 shrink-0" />
                        </div>
                        <h3 className={`font-bold underline decoration-gray-400 underline-offset-4 ${h3Class}`}>
                          {section.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 print:hidden w-full sm:w-auto justify-end">
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
                    {!hideInstructions && section.instructions && (
                      <p className="italic text-gray-500 mt-1 mb-4 text-sm">{section.instructions}</p>
                    )}

                    <ol className={`list-decimal list-inside ${questionSpacingClass}`}>
                      {section.questions.map((q, qIdx) => {
                        const isDragged = draggedItem?.sIdx === sIdx && draggedItem?.qIdx === qIdx;
                        const isDragOver = dragOverItem?.sIdx === sIdx && dragOverItem?.qIdx === qIdx;

                        return (
                          <li
                            key={q.id}
                            onDragOver={(e) => {
                              if (draggedItem !== null) handleDragOver(e, sIdx, qIdx);
                            }}
                            onDrop={(e) => {
                              if (draggedItem !== null) handleDrop(e, sIdx, qIdx);
                            }}
                            className={`pl-2 group/item relative rounded-lg transition-all duration-200
                              ${isDragged ? "opacity-30 border-2 border-dashed border-gray-300" : ""}
                              ${isDragOver && !isDragged ? "bg-[rgba(148,180,156,0.12)] border-2 border-dashed border-[#94B49C]" : ""}
                            `}
                          >
                            <div className="inline-block align-top w-[calc(100%-1.5rem)] ml-1">

                              {/* Question row */}
                              <div className="flex items-start gap-2 justify-between">
                                <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                  <div
                                    draggable="true"
                                    onDragStart={() => handleDragStart(sIdx, qIdx)}
                                    onDragEnd={handleDragEnd}
                                    className="print:hidden cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-600 mt-1"
                                    title="Drag to rearrange question"
                                  >
                                    <GripVertical className="w-3.5 h-3.5 shrink-0" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <EditableText
                                      value={q.text}
                                      onSave={v => updateQuestionText(sIdx, qIdx, v)}
                                      multiline
                                    />
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 shrink-0 print:gap-0">
                                  {showMarks && (
                                    <span className="text-xs sm:text-sm font-semibold text-gray-500 select-none whitespace-nowrap">
                                      [{q.marks ?? 1}]
                                    </span>
                                  )}
                                  
                                  <button
                                    onClick={() => deleteQuestion(sIdx, qIdx)}
                                    title="Delete question"
                                    className="print:hidden shrink-0 p-1 rounded lg:opacity-0
                                      group-hover/item:lg:opacity-100 group-hover/item:opacity-100 transition-opacity
                                      text-gray-300 hover:text-red-400 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Options */}
                              {q.options && (
                                <div className={`mt-3 ml-4 grid ${mcqColsClass} gap-2`}>
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

                              {section.type.toLowerCase().includes("short answer") && !showAnswers && showLines && (
                                <div className="mt-6 mb-8 border-b border-dotted border-gray-300 w-full h-8" />
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>

                    <button
                      onClick={() => addQuestion(sIdx)}
                      className="print:hidden mt-4 flex items-center gap-1.5 text-xs font-medium
                        text-[#94B49C] hover:text-[#527D6F] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add question to {section.name}
                    </button>
                  </div>
                );
              })}
          </div>

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-gray-200 text-center text-sm text-gray-400">
            *** End of Paper ***
          </div>
        </div>
      </div>

      {/* Right side: Desktop Sticky Styles panel */}
        <div className="hidden xl:block w-80 shrink-0 print:hidden">
          <div className="sticky top-6 fm-glass p-5 space-y-6">
            <div className="border-b border-[rgba(148,180,156,0.15)] pb-3">
              <h3 className="text-sm font-bold tracking-widest text-[#94B49C] uppercase flex items-center gap-2">
                <Settings className="w-4 h-4" /> Paper Layout Styles
              </h3>
            </div>
            
            <CustomizerControls
              spacing={spacing}
              setSpacing={setSpacing}
              fontSize={fontSize}
              setFontSize={setFontSize}
              mcqCols={mcqCols}
              setMcqCols={setMcqCols}
              showMarks={showMarks}
              setShowMarks={setShowMarks}
              showLines={showLines}
              setShowLines={setShowLines}
              hideInstructions={hideInstructions}
              setHideInstructions={setHideInstructions}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Switch subcomponent ──
function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex flex-col pr-2">
        <span className="text-xs font-semibold text-[#D5E2D6]">{label}</span>
        {description && <span className="text-[10px] text-gray-400 leading-tight mt-0.5">{description}</span>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? "bg-[#527D6F]" : "bg-[rgba(255,255,255,0.08)]"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// ── CustomizerControls subcomponent ──
function CustomizerControls({
  spacing,
  setSpacing,
  fontSize,
  setFontSize,
  mcqCols,
  setMcqCols,
  showMarks,
  setShowMarks,
  showLines,
  setShowLines,
  hideInstructions,
  setHideInstructions,
}: {
  spacing: "tight" | "normal" | "loose";
  setSpacing: (v: "tight" | "normal" | "loose") => void;
  fontSize: "sm" | "base" | "lg";
  setFontSize: (v: "sm" | "base" | "lg") => void;
  mcqCols: number;
  setMcqCols: (v: number) => void;
  showMarks: boolean;
  setShowMarks: (v: boolean) => void;
  showLines: boolean;
  setShowLines: (v: boolean) => void;
  hideInstructions: boolean;
  setHideInstructions: (v: boolean) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Font Size Preset */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#94B49C] uppercase tracking-wider">
          <Type className="w-3.5 h-3.5" />
          <span>Font Size</span>
        </div>
        <div className="grid grid-cols-3 gap-1 p-1 bg-[rgba(255,255,255,0.04)] border border-[rgba(148,180,156,0.15)] rounded-lg">
          {(["sm", "base", "lg"] as const).map(sz => (
            <button
              key={sz}
              onClick={() => setFontSize(sz)}
              className={`py-1 text-xs font-medium rounded transition-all capitalize cursor-pointer ${
                fontSize === sz
                  ? "bg-[#527D6F] text-white shadow-sm"
                  : "text-[#94B49C] hover:text-[#D5E2D6] hover:bg-[rgba(82,125,111,0.08)]"
              }`}
            >
              {sz === "base" ? "Normal" : sz === "sm" ? "Small" : "Large"}
            </button>
          ))}
        </div>
      </div>

      {/* Line Spacing Preset */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#94B49C] uppercase tracking-wider">
          <AlignJustify className="w-3.5 h-3.5" />
          <span>Line Spacing</span>
        </div>
        <div className="grid grid-cols-3 gap-1 p-1 bg-[rgba(255,255,255,0.04)] border border-[rgba(148,180,156,0.15)] rounded-lg">
          {(["tight", "normal", "loose"] as const).map(sp => (
            <button
              key={sp}
              onClick={() => setSpacing(sp)}
              className={`py-1 text-xs font-medium rounded transition-all capitalize cursor-pointer ${
                spacing === sp
                  ? "bg-[#527D6F] text-white shadow-sm"
                  : "text-[#94B49C] hover:text-[#D5E2D6] hover:bg-[rgba(82,125,111,0.08)]"
              }`}
            >
              {sp}
            </button>
          ))}
        </div>
      </div>

      {/* MCQ Columns */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#94B49C] uppercase tracking-wider">
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>MCQ Layout Columns</span>
        </div>
        <div className="grid grid-cols-3 gap-1 p-1 bg-[rgba(255,255,255,0.04)] border border-[rgba(148,180,156,0.15)] rounded-lg">
          {([1, 2, 4] as const).map(cols => (
            <button
              key={cols}
              onClick={() => setMcqCols(cols)}
              className={`py-1 text-xs font-medium rounded transition-all cursor-pointer ${
                mcqCols === cols
                  ? "bg-[#527D6F] text-white shadow-sm"
                  : "text-[#94B49C] hover:text-[#D5E2D6] hover:bg-[rgba(82,125,111,0.08)]"
              }`}
            >
              {cols} {cols === 1 ? "Col" : "Cols"}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Toggles Divider */}
      <div className="border-t border-[rgba(148,180,156,0.15)] pt-4 space-y-3">
        <div className="text-xs font-semibold text-[#94B49C] uppercase tracking-wider mb-1">
          Document Elements
        </div>
        <div className="space-y-2">
          <Switch
            checked={showMarks}
            onChange={setShowMarks}
            label="Question Marks Badges"
            description="Display marks per question (e.g. [2])"
          />
          <Switch
            checked={showLines}
            onChange={setShowLines}
            label="Short Answer Lines"
            description="Draw dotted lines for written answers"
          />
          <Switch
            checked={!hideInstructions}
            onChange={(checked) => setHideInstructions(!checked)}
            label="Section Instructions"
            description="Show instructions under section names"
          />
        </div>
      </div>
    </div>
  );
}
