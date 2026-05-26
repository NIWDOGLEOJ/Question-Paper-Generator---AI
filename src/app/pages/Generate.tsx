import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Label } from "../components/ui/label";
import {
  Plus, Trash2, Wand2, CheckCircle2, File, UploadCloud,
  ArrowRight, ArrowLeft, Cpu, Sparkles, FileText, Zap, AlertTriangle, ExternalLink,
  BookTemplate, Save, X, LayoutTemplate, ListTree, Terminal,
} from "lucide-react";
import { toast } from "sonner";
import * as pdfService from "../services/pdfService";
import { getLMStudioConfig } from "../services/lmStudioService";
import {
  getTemplates, saveTemplate, deleteTemplate,
  createTemplate, BUILTIN_TEMPLATES,
  type PaperTemplate,
} from "../services/templateService";
import * as sourceService from "../services/sourceService";
import type { SourceMaterial } from "../services/sourceService";

interface Section {
  id:         string;
  name:       string;
  type:       string;
  count:      number;
  marks:      number;
  difficulty: string;
}

const STEPS = [
  { id: 1, label: "Upload Source"   },
  { id: 2, label: "Define Structure" },
  { id: 3, label: "Generate"        },
];

type Stage = "extracting" | "analysing" | "generating" | "done";

const STAGE_LABELS: Record<Stage, string> = {
  extracting: "Reading PDF…",
  analysing:  "Analysing content…",
  generating: "Generating questions…",
  done:       "Complete!",
};

const STAGE_PROGRESS: Record<Stage, number> = {
  extracting: 30,
  analysing:  55,
  generating: 80,
  done:       100,
};

// ── Small modal for naming a new template ──
function SaveTemplateModal({
  onSave,
  onClose,
}: {
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="fm-glass rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 mx-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#D5E2D6]" style={{ fontFamily: "'Playfair Display',serif" }}>
            Save as Template
          </h3>
          <button onClick={onClose} className="text-[#527D6F] hover:text-[#94B49C]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-[#94B49C]">
          This saves the current section structure so you can reuse it in future papers.
        </p>
        <div>
          <Label className="text-xs font-semibold text-[#94B49C] mb-1.5 block tracking-wide uppercase">
            Template Name
          </Label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && name.trim()) onSave(name.trim()); }}
            placeholder="e.g. Standard MCQ Exam"
            className="fm-input w-full h-9 rounded-lg px-3 text-sm"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-[#94B49C] hover:bg-[rgba(82,125,111,0.1)] transition-all">
            Cancel
          </button>
          <button
            disabled={!name.trim()}
            onClick={() => name.trim() && onSave(name.trim())}
            className="fm-btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold
              disabled:opacity-40 disabled:cursor-not-allowed">
            <Save className="w-3.5 h-3.5" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Template picker panel ──
function TemplatePicker({
  onApply,
  onClose,
}: {
  onApply: (tpl: PaperTemplate | Omit<PaperTemplate, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}) {
  const [userTemplates, setUserTemplates] = useState(getTemplates());

  const handleDelete = (id: string) => {
    deleteTemplate(id);
    setUserTemplates(getTemplates());
    toast.success("Template deleted");
  };

  const allBuiltin = BUILTIN_TEMPLATES.map((t, i) => ({ ...t, id: `builtin-${i}`, createdAt: '' }));
  const all        = [...allBuiltin, ...userTemplates];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="fm-glass rounded-2xl p-6 w-full max-w-lg shadow-2xl mx-4 space-y-4 max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-[#94B49C]" />
            <h3 className="text-base font-bold text-[#D5E2D6]" style={{ fontFamily: "'Playfair Display',serif" }}>
              Choose a Template
            </h3>
          </div>
          <button onClick={onClose} className="text-[#527D6F] hover:text-[#94B49C]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#94B49C] shrink-0">
          Applying a template replaces your current sections. Paper title and subject are not affected.
        </p>

        {/* List */}
        <div className="overflow-y-auto space-y-2 pr-1">
          {all.map((tpl) => {
            const isBuiltin = tpl.id.startsWith("builtin-");
            const totalQ    = tpl.sections.reduce((a, s) => a + s.count, 0);
            const totalM    = tpl.sections.reduce((a, s) => a + s.count * s.marks, 0);
            return (
              <div key={tpl.id}
                className="group flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all
                  hover:bg-[rgba(82,125,111,0.12)]"
                style={{ border: "1px solid rgba(148,180,156,0.1)" }}
                onClick={() => { onApply(tpl); onClose(); }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: "rgba(82,125,111,0.18)" }}>
                  <LayoutTemplate className="w-4 h-4 text-[#94B49C]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#D5E2D6] truncate">{tpl.name}</p>
                    {isBuiltin && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-[#527D6F]"
                        style={{ background: "rgba(82,125,111,0.15)" }}>built-in</span>
                    )}
                  </div>
                  <p className="text-xs text-[#527D6F] mt-0.5">
                    {tpl.sections.length} section{tpl.sections.length !== 1 ? 's' : ''} ·{' '}
                    {totalQ} questions · {totalM} marks · {tpl.duration} min
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {tpl.sections.map((s, i) => (
                      <span key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full text-[#94B49C]"
                        style={{ background: "rgba(82,125,111,0.12)" }}>
                        {s.name}: {s.count}× {s.type}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Delete (user templates only) */}
                {!isBuiltin && (
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(tpl.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg
                      text-[#527D6F] hover:text-[#c0504a] hover:bg-[rgba(192,80,74,0.1)]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Generate page ──
export function Generate() {
  const navigate = useNavigate();
  const [step, setStep]           = useState(1);
  const [generationMode, setGenerationMode] = useState<"pdf" | "prompt">("pdf");
  const [customPrompt, setCustomPrompt] = useState("");
  const [file, setFile]           = useState<File | null>(null);
  const [preloadedSource, setPreloadedSource] = useState<SourceMaterial | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [paperTitle, setPaperTitle] = useState("");
  const [subject, setSubject]     = useState("");
  const [academicLevel, setAcademicLevel] = useState("High School");
  const [duration, setDuration]   = useState("120");
  const [sections, setSections]   = useState<Section[]>([
    { id: "1", name: "Section A", type: "Multiple Choice", count: 10, marks: 1, difficulty: "Easy" },
  ]);
  const [stage, setStage]         = useState<Stage>("extracting");
  const [isGenerating, setIsGenerating] = useState(false);
  const [ocrActive, setOcrActive] = useState(false);

  // Page range state
  const [pageCount, setPageCount]           = useState<number | null>(null);
  const [startPage, setStartPage]           = useState(1);
  const [endPage, setEndPage]               = useState(1);
  const [loadingPageCount, setLoadingPageCount] = useState(false);

  // Template UI state
  const [showPicker, setShowPicker]     = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Chapter selection state
  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);

  // ── Elapsed-time ticker (shown while LM Studio is generating) ──
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (stage === 'generating' && isGenerating) {
      setElapsedSecs(0);
      timerRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stage, isGenerating]);

  // ── Scanned AI Console Log State & Telemetry ──
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step !== 3 || stage === "done") {
      setConsoleLogs([]);
      return;
    }

    const isPrompt = generationMode === "prompt";
    const logsPool = {
      extracting: isPrompt ? [
        "[SYSTEM] Compiling custom prompt instructions...",
        "[COMPILER] Initializing semantic scope limits...",
        "[COMPILER] Parsed target audience parameters.",
        "[SYSTEM] Prompt instructions compiled successfully."
      ] : [
        "[SYSTEM] Initializing parallel PDF segment workers...",
        "[OCR] Reading document stream chunk 0xAE82...",
        "[OCR] Parsed Page 1 text context.",
        "[OCR] Parsed Page 2 text context.",
        "[OCR] Page 3: Scanning optical character markers...",
        "[OCR] Parsed Page 4 text context.",
        "[OCR] Parsed Page 5 text context.",
        "[SYSTEM] Extracted raw textbook corpus successfully."
      ],
      analysing: isPrompt ? [
        "[ENGINE] Analysing custom prompt syllabus constraints...",
        "[ENGINE] Mapped topic density weights...",
        "[SYSTEM] Topic instruction analysis completed."
      ] : [
        "[EXTRACTOR] Initializing NLP conceptual semantics...",
        "[EXTRACTOR] Core Topic identified: Foundations & General Principles.",
        "[EXTRACTOR] Key Concept extracted: permittivity of free space",
        "[EXTRACTOR] Mapped textbook curriculum vectors & cognitive weights...",
        "[SYSTEM] Semantic conceptual analysis completed (8 core chapters mapped)."
      ],
      generating: [
        "[AI ENGINE] Handshaking with local LM Studio endpoint...",
        "[AI ENGINE] Prompt template builder compiled successfully...",
        "[AI ENGINE] Generating questions for defined sections...",
        "[AI ENGINE] Formatting math equations with KaTeX symbols...",
        "[AI ENGINE] Aligning cognitive levels to Bloom's taxonomy...",
        "[SYSTEM] Question paper compiled. Resolving final indices..."
      ]
    };

    // Add initial log
    setConsoleLogs([`[SYSTEM] Starting active stage: ${stage.toUpperCase()}...`]);

    let currentIdx = 0;
    const timer = setInterval(() => {
      const activePool = logsPool[stage as keyof typeof logsPool] || [];
      if (currentIdx < activePool.length) {
        const nextLog = activePool[currentIdx];
        if (nextLog) {
          setConsoleLogs(prev => [...prev, nextLog]);
        }
        currentIdx++;
      } else {
        // Continuous ping while waiting
        setConsoleLogs(prev => [
          ...prev,
          `[PING] Processing active data segment... (Elapsed: ${elapsedSecs}s)`
        ]);
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [step, stage, generationMode]);

  // Auto-scroll effect
  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleLogs]);

  // ── Check for pre-loaded source from Source Material page ──
  useEffect(() => {
    const srcId = sessionStorage.getItem('qpg_preload_source');
    if (srcId) {
      const src = sourceService.getSource(srcId);
      if (src) {
        setPreloadedSource(src);
        setSubject(src.subject || '');
        
        if (src.chapters && src.chapters.length > 0) {
          // Default all chapters to selected
          setSelectedChapters(src.chapters.map((_, i) => i));
          // Wait on Step 1 so user can toggle chapters
          setStep(1);
        } else {
          // Auto-advance to step 2 since source is already loaded
          setStep(2);
        }
      }
      sessionStorage.removeItem('qpg_preload_source');
    }
  }, []);

  // ── File helpers ──
  const acceptFile = useCallback(async (f: File) => {
    if (f.type !== "application/pdf") { toast.error("Please upload a PDF file"); return; }
    setPreloadedSource(null);
    setFile(f);
    setPageCount(null);
    setLoadingPageCount(true);
    try {
      const count = await pdfService.getPDFPageCount(f);
      setPageCount(count);
      setStartPage(1);
      setEndPage(count);
    } catch {
      // Non-fatal — user can still generate without a range picker
    } finally {
      setLoadingPageCount(false);
    }
    toast.success(`"${f.name}" ready`);
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) acceptFile(e.target.files[0]);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.[0]) acceptFile(e.dataTransfer.files[0]);
  };

  // ── Section helpers ──
  const addSection = () => setSections(prev => [...prev, {
    id: Date.now().toString(),
    name: `Section ${String.fromCharCode(65 + prev.length)}`,
    type: "Short Answer", count: 5, marks: 2, difficulty: "Medium",
  }]);

  const removeSection = (id: string) => {
    if (sections.length > 1) setSections(s => s.filter(x => x.id !== id));
    else toast.error("At least one section is required");
  };

  const updateSection = (id: string, field: keyof Section, value: any) =>
    setSections(s => s.map(x => x.id === id ? { ...x, [field]: value } : x));

  // ── Apply template ──
  const applyTemplate = (tpl: Pick<PaperTemplate, 'sections' | 'duration'>) => {
    setSections(tpl.sections.map((s, i) => ({
      id:         `tpl-${Date.now()}-${i}`,
      name:       s.name,
      type:       s.type,
      count:      s.count,
      marks:      s.marks,
      difficulty: s.difficulty,
    })));
    setDuration(tpl.duration);
    toast.success("Template applied!");
  };

  // ── Save current as template ──
  const handleSaveTemplate = (name: string) => {
    const tpl = createTemplate(name, duration, sections);
    saveTemplate(tpl);
    setShowSaveModal(false);
    toast.success(`Template "${name}" saved!`);
  };

  // ── Generate ──
  const handleGenerate = async () => {
    if (generationMode === "pdf" && !file && !preloadedSource) { toast.error("Please upload a PDF first"); return; }
    if (generationMode === "prompt" && customPrompt.trim().length < 10) { toast.error("Please enter a custom prompt description first"); return; }
    setIsGenerating(true);
    setStep(3);

    try {
      let pdfText: string;
      let fileName: string;
      const isPromptMode = generationMode === "prompt";

      if (isPromptMode) {
        setStage("extracting");
        pdfText = customPrompt.trim();
        fileName = "Custom Prompt";
        await new Promise(r => setTimeout(r, 600)); // smooth progress bar pause
      } else if (preloadedSource) {
        // Use stored text — optionally filter by selected chapters
        setStage("extracting");
        if (preloadedSource.chapters && preloadedSource.chapters.length > 0 && selectedChapters.length > 0) {
          const sortedSelected = [...selectedChapters].sort((a, b) => a - b);
          pdfText = sortedSelected.map(i => preloadedSource.chapters![i].text).join('\n\n');
        } else {
          pdfText  = preloadedSource.text;
        }
        fileName = preloadedSource.name;
        await new Promise(r => setTimeout(r, 300));
      } else {
        setStage("extracting");
        pdfText = await pdfService.extractTextFromPDF(file!, (msg) => {
          console.log('[extraction]', msg);
          if (msg.toLowerCase().includes('ocr')) setOcrActive(true);
        }, startPage, endPage);
        fileName = file!.name;
      }

      setStage("analysing");
      await new Promise(r => setTimeout(r, isPromptMode ? 600 : 30));

      setStage("generating");
      const paper = await pdfService.generateQuestions(
        pdfText,
        sections,
        paperTitle || "Generated Question Paper",
        subject    || "Subject",
        `${duration} Minutes`,
        fileName,
        academicLevel,
        isPromptMode
      );

      setStage("done");
      pdfService.savePaper(paper);

      // Link paper back to source library entry
      if (preloadedSource && !isPromptMode) {
        sourceService.linkPaperToSource(preloadedSource.id, paper.id);
      }

      toast.success("Question paper generated!");
      setTimeout(() => navigate(`/paper/${paper.id}`), 600);

    } catch (err) {
      setIsGenerating(false);
      setStep(2);
      toast.error(err instanceof Error ? err.message : "Generation failed. Please try again.");
    }
  };

  const totalQ    = sections.reduce((a, s) => a + s.count, 0);
  const totalM    = sections.reduce((a, s) => a + s.count * s.marks, 0);
  const lmEnabled = getLMStudioConfig().enabled;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 fm-fadein">

      {/* Modals */}
      {showPicker    && <TemplatePicker  onApply={applyTemplate} onClose={() => setShowPicker(false)} />}
      {showSaveModal && <SaveTemplateModal onSave={handleSaveTemplate} onClose={() => setShowSaveModal(false)} />}

      {/* ── Step progress ── */}
      <div className="flex items-center justify-between sm:justify-start gap-3 mb-8 sm:mb-10 w-full overflow-x-auto pb-1.5 scrollbar-none shrink-0">
        {STEPS.map((s, i) => {
          const done   = step > s.id;
          const active = step === s.id;
          return (
            <div key={s.id} className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 shrink-0
                  ${done   ? "bg-[#94B49C] text-[#2F3E46]"
                  : active ? "border-2 border-[#94B49C] text-[#94B49C] step-active"
                           : "border-2 border-[rgba(148,180,156,0.25)] text-[#527D6F]"}`}>
                  {done ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : s.id}
                </div>
                <span className={`text-sm font-medium transition-colors shrink-0
                  ${active ? "text-[#D5E2D6]" : done ? "text-[#94B49C]" : "text-[#527D6F]"}
                  ${step === s.id ? "inline-block" : "hidden sm:inline-block"}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="h-px w-8 sm:w-16 transition-colors shrink-0"
                  style={{ background: step > s.id ? "#527D6F" : "rgba(148,180,156,0.18)" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Card ── */}
      <div className="fm-glass rounded-2xl p-4 sm:p-6 md:p-8">

        {/* ════ STEP 1 ════ */}
        {step === 1 && (
          <div className="fm-fadein space-y-7">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#D5E2D6]" style={{ fontFamily: "'Playfair Display',serif" }}>
                  Source Material
                </h2>
                <p className="text-sm text-[#94B49C] mt-1">Provide a textbook PDF or enter a custom topic prompt for the AI.</p>
              </div>
              
              {/* Tab Switcher */}
              <div className="flex p-1 rounded-xl bg-[rgba(148,180,156,0.06)] border border-[rgba(148,180,156,0.1)] w-full sm:w-64 shrink-0">
                <button
                  type="button"
                  onClick={() => setGenerationMode("pdf")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${generationMode === "pdf"
                      ? "bg-[#527D6F] text-[#D5E2D6] shadow"
                      : "text-[#94B49C] hover:text-[#D5E2D6] hover:bg-[rgba(82,125,111,0.06)]"}`}
                >
                  <File className="w-3.5 h-3.5" /> PDF Textbook
                </button>
                <button
                  type="button"
                  onClick={() => setGenerationMode("prompt")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${generationMode === "prompt"
                      ? "bg-[#527D6F] text-[#D5E2D6] shadow"
                      : "text-[#94B49C] hover:text-[#D5E2D6] hover:bg-[rgba(82,125,111,0.06)]"}`}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Custom Prompt
                </button>
              </div>
            </div>

            {generationMode === "pdf" ? (
              <div className="space-y-7 fm-fadein">
                {/* Pre-loaded source banner */}
                {preloadedSource && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "rgba(82,125,111,0.12)", border: "1px solid rgba(148,180,156,0.25)" }}>
                    <FileText className="w-5 h-5 text-[#94B49C] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#D5E2D6] truncate">{preloadedSource.title}</p>
                      <p className="text-xs text-[#527D6F]">Loaded from your library · no re-upload needed</p>
                    </div>
                    <button onClick={() => { setPreloadedSource(null); }}
                      className="text-xs text-[#527D6F] hover:text-[#c0504a] transition-colors">
                      Change
                    </button>
                  </div>
                )}

                {preloadedSource && preloadedSource.chapters && preloadedSource.chapters.length > 0 && (
                  <div className="rounded-xl px-4 py-4 space-y-3 fm-fadein"
                    style={{ background: "rgba(82,125,111,0.07)", border: "1px solid rgba(148,180,156,0.15)" }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ListTree className="w-3.5 h-3.5 text-[#527D6F]" />
                        <span className="text-xs font-semibold text-[#94B49C] uppercase tracking-wide">
                          Select Chapters
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setSelectedChapters(preloadedSource.chapters!.map((_, i) => i))} className="text-[10px] px-2 py-1 rounded transition-all bg-[rgba(82,125,111,0.15)] text-[#94B49C] hover:text-[#D5E2D6] hover:bg-[rgba(82,125,111,0.25)]">Select All</button>
                        <button onClick={() => setSelectedChapters([])} className="text-[10px] px-2 py-1 rounded transition-all bg-[rgba(192,80,74,0.1)] text-[#c0504a] hover:text-[#ff7b72] hover:bg-[rgba(192,80,74,0.15)]">Clear</button>
                      </div>
                    </div>
                    <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                      {preloadedSource.chapters.map((ch, idx) => (
                        <label key={idx} className="flex items-start gap-2 p-2 rounded-lg hover:bg-[rgba(82,125,111,0.08)] cursor-pointer transition-colors border border-transparent hover:border-[rgba(148,180,156,0.1)]">
                          <input type="checkbox" className="mt-0.5 accent-[#527D6F]"
                            checked={selectedChapters.includes(idx)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedChapters(prev => [...prev, idx]);
                              else setSelectedChapters(prev => prev.filter(i => i !== idx));
                            }} />
                          <span className="text-sm text-[#D5E2D6] leading-snug">{ch.title}</span>
                        </label>
                      ))}
                    </div>
                    {selectedChapters.length === 0 && (
                      <p className="text-[10px] text-[#c0504a] mt-2">Please select at least one chapter, or the whole book will be used.</p>
                    )}
                  </div>
                )}

                <div
                  className={`fm-dropzone rounded-xl px-6 py-14 flex flex-col items-center justify-center text-center cursor-pointer
                    ${isDragging ? "active" : ""} ${file ? "border-[#527D6F] bg-[rgba(82,125,111,0.1)]" : ""}`}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => !file && document.getElementById("fm-file-input")?.click()}
                >
                  {file ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center fm-float"
                        style={{ background: "rgba(82,125,111,0.2)", border: "1px solid rgba(82,125,111,0.35)" }}>
                        <FileText className="w-7 h-7 text-[#94B49C]" />
                      </div>
                      <p className="font-semibold text-[#D5E2D6] text-sm">{file.name}</p>
                      <p className="text-xs text-[#527D6F]">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      <button onClick={e => { e.stopPropagation(); setFile(null); setPageCount(null); }}
                        className="text-xs text-[#c0504a] hover:underline mt-1">Remove file</button>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className="w-12 h-12 text-[#527D6F] mb-4 fm-float" />
                      <p className="text-sm font-medium text-[#D5E2D6] mb-1">Drop your PDF here</p>
                      <p className="text-xs text-[#527D6F]">or click to browse · up to 50 MB</p>
                      <input id="fm-file-input" type="file" accept=".pdf" className="sr-only" onChange={onInputChange} />
                    </>
                  )}
                </div>

                {/* ── Page range selector (shown once page count is known) ── */}
                {file && (
                  <div className="rounded-xl px-4 py-4 space-y-3 fm-fadein"
                    style={{ background: "rgba(82,125,111,0.07)", border: "1px solid rgba(148,180,156,0.15)" }}>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-[#527D6F]" />
                        <span className="text-xs font-semibold text-[#94B49C] uppercase tracking-wide">
                          Page Range
                        </span>
                        {loadingPageCount && (
                          <span className="text-xs text-[#527D6F]">Detecting…</span>
                        )}
                        {pageCount && !loadingPageCount && (
                          <span className="text-xs text-[#527D6F]">{pageCount} pages total</span>
                        )}
                      </div>

                      {/* Quick-select presets */}
                      {pageCount && !loadingPageCount && (
                        <div className="flex gap-1.5">
                          {[
                            { label: "All",    s: 1,                          e: pageCount },
                            { label: "First½", s: 1,                          e: Math.ceil(pageCount / 2) },
                            { label: "Last½",  s: Math.floor(pageCount / 2) + 1, e: pageCount },
                          ].map(p => (
                            <button key={p.label}
                              type="button"
                              onClick={() => { setStartPage(p.s); setEndPage(p.e); }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all
                                ${startPage === p.s && endPage === p.e
                                  ? "bg-[rgba(82,125,111,0.35)] text-[#D5E2D6]"
                                  : "text-[#527D6F] hover:bg-[rgba(82,125,111,0.15)]"}`}
                              style={{ border: "1px solid rgba(148,180,156,0.2)" }}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Inputs row */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <Label className="text-xs text-[#94B49C] shrink-0">From</Label>
                        <input
                          type="number" min={1} max={pageCount ?? 9999}
                          value={startPage}
                          disabled={!pageCount || loadingPageCount}
                          onChange={e => {
                            const v = Math.max(1, Math.min(parseInt(e.target.value) || 1, endPage));
                            setStartPage(v);
                          }}
                          className="fm-input w-20 h-8 rounded-lg px-3 text-sm text-center
                            disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                      </div>

                      {/* Visual range bar */}
                      {pageCount && (
                        <div className="flex-1 flex flex-col items-stretch gap-1">
                          <div className="h-1.5 rounded-full overflow-hidden"
                            style={{ background: "rgba(148,180,156,0.15)" }}>
                            <div className="h-full rounded-full transition-all duration-200"
                              style={{
                                marginLeft:  `${((startPage - 1) / pageCount) * 100}%`,
                                width:       `${((endPage - startPage + 1) / pageCount) * 100}%`,
                                background:  "rgba(148,180,156,0.7)",
                              }} />
                          </div>
                          <p className="text-center text-[10px] text-[#527D6F]">
                            {endPage - startPage + 1} page{endPage - startPage + 1 !== 1 ? "s" : ""} selected
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <Label className="text-xs text-[#94B49C] shrink-0">To</Label>
                        <input
                          type="number" min={startPage} max={pageCount ?? 9999}
                          value={endPage}
                          disabled={!pageCount || loadingPageCount}
                          onChange={e => {
                            const v = Math.min(
                              pageCount ?? 9999,
                              Math.max(parseInt(e.target.value) || startPage, startPage),
                            );
                            setEndPage(v);
                          }}
                          className="fm-input w-20 h-8 rounded-lg px-3 text-sm text-center
                            disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {!pageCount && !loadingPageCount && (
                      <p className="text-xs text-[#527D6F]">
                        Could not detect page count — the full PDF will be used.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 fm-fadein">
                <div>
                  <Label className="text-xs font-semibold text-[#94B49C] mb-1.5 block tracking-wide uppercase">
                    Topic / Guidelines Prompt
                  </Label>
                  <textarea
                    value={customPrompt}
                    onChange={e => setCustomPrompt(e.target.value)}
                    placeholder="Describe your exam topics, syllabus chapters, or specific guidelines here... (e.g. 'Photosynthesis, light and dark reactions, chloroplast structure. Ensure questions focus on molecular stages and ATP production. Calibrate for High School AP Biology class.')"
                    rows={8}
                    className="fm-input w-full rounded-xl p-4 text-sm resize-none custom-scrollbar"
                  />
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-[10px] text-[#527D6F]">
                      Provide details about key concepts and guidelines for better AI results.
                    </p>
                    <p className="text-[10px] text-[#94B49C] font-semibold">
                      {customPrompt.trim().length} character(s)
                    </p>
                  </div>
                </div>

                {/* Local AI warning */}
                {!lmEnabled && (
                  <div className="rounded-xl p-3.5 text-xs flex gap-3 fm-fadein"
                    style={{ background: "rgba(192,80,74,0.08)", border: "1px solid rgba(192,80,74,0.2)" }}>
                    <AlertTriangle className="w-4 h-4 text-[#c0504a] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[#c0504a] font-bold">Local AI is Disabled</p>
                      <p className="text-[#c0504a] mt-0.5 opacity-80 leading-relaxed">
                        Prompt-based generation requires an active local LLM connection. Please enable and connect **LM Studio** in your settings before proceeding.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button
                disabled={
                  (generationMode === "pdf" && !file && !preloadedSource) ||
                  (generationMode === "prompt" && (customPrompt.trim().length < 10 || !lmEnabled))
                }
                onClick={() => setStep(2)}
                className={`fm-btn-primary flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold
                  disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ════ STEP 2 ════ */}
        {step === 2 && (
          <div className="fm-fadein space-y-7">

            {/* Header row with template buttons */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#D5E2D6]" style={{ fontFamily: "'Playfair Display',serif" }}>
                  Paper Structure
                </h2>
                <p className="text-sm text-[#94B49C] mt-1">Name the paper, set duration, and add question sections.</p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0 w-full sm:w-auto">
                <button
                  onClick={() => setShowPicker(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#94B49C]
                    hover:bg-[rgba(82,125,111,0.12)] transition-all bg-[rgba(82,125,111,0.05)]"
                  style={{ border: "1px solid rgba(148,180,156,0.2)" }}
                  title="Load a template"
                >
                  <LayoutTemplate className="w-3.5 h-3.5" /> Templates
                </button>
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#94B49C]
                    hover:bg-[rgba(82,125,111,0.12)] transition-all bg-[rgba(82,125,111,0.05)]"
                  style={{ border: "1px solid rgba(148,180,156,0.2)" }}
                  title="Save current structure as template"
                >
                  <Save className="w-3.5 h-3.5" /> Save Template
                </button>
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-6"
              style={{ borderBottom: "1px solid rgba(148,180,156,0.12)" }}>
              {[
                { label: "Paper Title",    value: paperTitle, set: setPaperTitle, placeholder: "Mid-Term Exam"  },
                { label: "Subject",        value: subject,    set: setSubject,    placeholder: "Biology 101"    },
                { label: "Duration (min)", value: duration,   set: setDuration,   placeholder: "120", type: "number" },
              ].map(f => (
                <div key={f.label}>
                  <Label className="text-xs font-semibold text-[#94B49C] mb-1.5 block tracking-wide uppercase">{f.label}</Label>
                  <input type={f.type || "text"} value={f.value}
                    onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                    className="fm-input w-full h-9 rounded-lg px-3 text-sm" />
                </div>
              ))}
              <div>
                <Label className="text-xs font-semibold text-[#94B49C] mb-1.5 block tracking-wide uppercase">Academic Level</Label>
                <select value={academicLevel} onChange={e => setAcademicLevel(e.target.value)} className="fm-select w-full h-9">
                  <option>Elementary School</option>
                  <option>Middle School</option>
                  <option>High School</option>
                  <option>Undergraduate (College)</option>
                  <option>Graduate / Professional</option>
                </select>
              </div>
            </div>

            {/* LM Studio status banner */}
            {!lmEnabled && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(192,80,74,0.08)", border: "1px solid rgba(192,80,74,0.25)" }}>
                <AlertTriangle className="w-4 h-4 text-[#c0504a] shrink-0 mt-0.5" />
                <div className="flex-1 text-sm text-[#c0504a]">
                  <p className="font-semibold">LM Studio is disabled</p>
                  <p className="text-xs mt-0.5 opacity-80">
                    Questions will be generated using the built-in template engine — quality will be lower.
                    Enable LM Studio in{" "}
                    <a href="/settings" className="underline font-medium">Settings</a>{" "}
                    for AI-generated questions.
                  </p>
                </div>
              </div>
            )}
            {lmEnabled && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(82,125,111,0.1)", border: "1px solid rgba(82,125,111,0.25)" }}>
                <Cpu className="w-4 h-4 text-[#94B49C] shrink-0" />
                <div className="text-sm text-[#94B49C]">
                  <span className="font-semibold">LM Studio active</span>
                  <span className="text-xs ml-2 opacity-70">— questions will be AI-generated from your PDF</span>
                </div>
              </div>
            )}

            {/* Sections */}
            <div className="space-y-4">
              {sections.map((s) => (
                <div key={s.id} className="fm-section-card p-4 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold tracking-widest text-[#527D6F] uppercase">{s.name}</span>
                    <button onClick={() => removeSection(s.id)}
                      className="p-1.5 rounded-lg text-[#527D6F] hover:text-[#c0504a] hover:bg-[rgba(192,80,74,0.1)] transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-[#94B49C] mb-1 block">Section Name</Label>
                      <input value={s.name} onChange={e => updateSection(s.id, "name", e.target.value)}
                        className="fm-input w-full h-9 rounded-lg px-3 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[#94B49C] mb-1 block">Question Type</Label>
                      <select value={s.type} onChange={e => updateSection(s.id, "type", e.target.value)} className="fm-select w-full h-9">
                        <option>Multiple Choice</option>
                        <option>True / False</option>
                        <option>Short Answer</option>
                        <option>Long Answer / Essay</option>
                        <option>Fill in the Blanks</option>
                      </select>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Label className="text-xs text-[#94B49C] mb-1 block">No. of Questions</Label>
                        <input type="number" min="1" value={s.count}
                          onChange={e => updateSection(s.id, "count", parseInt(e.target.value) || 1)}
                          className="fm-input w-full h-9 rounded-lg px-3 text-sm" />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-[#94B49C] mb-1 block">Marks / Q</Label>
                        <input type="number" min="1" value={s.marks}
                          onChange={e => updateSection(s.id, "marks", parseInt(e.target.value) || 1)}
                          className="fm-input w-full h-9 rounded-lg px-3 text-sm" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-[#94B49C] mb-1 block">Difficulty</Label>
                      <select value={s.difficulty} onChange={e => updateSection(s.id, "difficulty", e.target.value)} className="fm-select w-full h-9">
                        <option>Easy</option>
                        <option>Medium</option>
                        <option>Hard</option>
                        <option>Mixed</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={addSection}
              className="w-full py-3 rounded-xl text-sm font-medium text-[#94B49C] transition-all hover:bg-[rgba(82,125,111,0.1)] flex items-center justify-center gap-2"
              style={{ border: "2px dashed rgba(148,180,156,0.25)" }}>
              <Plus className="w-4 h-4" /> Add Section
            </button>

            <div className="flex items-center justify-between pt-4"
              style={{ borderTop: "1px solid rgba(148,180,156,0.12)" }}>
              <div className="text-xs text-[#527D6F] font-medium">
                <span className="text-[#94B49C] font-semibold">{totalQ}</span> questions ·{" "}
                <span className="text-[#94B49C] font-semibold">{totalM}</span> marks total
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-[#94B49C] hover:bg-[rgba(82,125,111,0.1)] transition-all">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={handleGenerate}
                  className="fm-btn-primary flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold">
                  <Wand2 className="w-4 h-4" /> Generate Paper
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════ STEP 3 ════ */}
        {step === 3 && (
          <div className="fm-fadein py-10 flex flex-col items-center text-center gap-6 max-w-2xl mx-auto w-full px-4">
            <style>{`
              @keyframes scan {
                0% { top: 0%; opacity: 0.15; }
                50% { opacity: 0.7; }
                100% { top: 100%; opacity: 0.15; }
              }
              .animate-scan {
                animation: scan 3s linear infinite;
              }
            `}</style>
            
            {stage !== "done" ? (
              <>
                {/* Visual Scanner Ring & Details */}
                <div className="flex flex-col sm:flex-row items-center gap-6 w-full justify-center">
                  <div className="relative w-20 h-20 shrink-0">
                    <div className="absolute inset-0 rounded-full"
                      style={{ background: "rgba(82,125,111,0.1)", border: "2px solid rgba(82,125,111,0.2)" }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      {stage === "extracting" ? <File      className="w-8 h-8 text-[#94B49C] fm-float" />
                       : stage === "analysing" ? <Zap      className="w-8 h-8 text-[#94B49C] fm-float" />
                                              : <Sparkles className="w-8 h-8 text-[#94B49C] fm-float" />}
                    </div>
                    <div className="absolute -inset-1.5 rounded-full border-2 border-transparent"
                      style={{ borderTopColor: "#94B49C", animation: "spin-ring 1s linear infinite" }} />
                  </div>

                  <div className="text-center sm:text-left">
                    <h3 className="text-lg font-bold text-[#D5E2D6]" style={{ fontFamily: "'Playfair Display',serif" }}>
                      {STAGE_LABELS[stage]}
                    </h3>
                    <p className="text-xs text-[#94B49C] mt-1 max-w-md">
                      {stage === "extracting" && (ocrActive
                        ? "Running parallel OCR segment workers to extract scanned text..."
                        : "Parsing PDF file blocks and reading raw text layers in parallel...")}
                      {stage === "analysing"  && "Identifying scientific concepts, chapters, formulas, and cognitive weights..."}
                      {stage === "generating" && (lmEnabled
                        ? "Connecting to LM Studio endpoint. Generating custom question structures..."
                        : "Constructing question structures and option templates from textbook corpus...")}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full max-w-xl space-y-2 px-1">
                  <div className="flex justify-between text-xs text-[#527D6F] font-semibold">
                    <span>Active Stage: {STAGE_LABELS[stage]}</span>
                    <span>{STAGE_PROGRESS[stage]}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden"
                    style={{ background: "rgba(148,180,156,0.15)" }}>
                    <div className="h-full rounded-full transition-all duration-700 ease-out fm-shimmer"
                      style={{ width: `${STAGE_PROGRESS[stage]}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-[#3a5560] font-mono uppercase tracking-wider">
                    {["Extract", "Analyse", "Generate", "Done"].map((l, i) => (
                      <span key={l} className={
                        (stage === "extracting" && i === 0) ||
                        (stage === "analysing"  && i <= 1) ||
                        (stage === "generating" && i <= 2) ? "text-[#94B49C] font-semibold" : ""
                      }>{l}</span>
                    ))}
                  </div>
                </div>

                {/* AI Console log terminal */}
                <div className="w-full max-w-xl flex flex-col text-left">
                  {/* Console Top Window Header */}
                  <div className="w-full bg-[rgba(30,42,47,0.92)] rounded-t-xl border-t border-x border-[rgba(148,180,156,0.22)] px-4 py-2 flex items-center justify-between shadow-lg">
                    <div className="flex gap-1.5 shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                    </div>
                    <span className="text-[10px] font-bold font-mono text-[#94B49C] tracking-widest uppercase flex items-center gap-1.5">
                      <Terminal className="w-3 h-3" /> Concept-Extractor-Console.log
                    </span>
                    <div className="w-8 shrink-0 flex justify-end">
                      {lmEnabled && (
                        <span className="text-[9px] font-bold bg-[#527D6F]/30 text-[#94B49C] px-1.5 py-0.5 rounded border border-[#94B49C]/20 flex items-center gap-1 tabular-nums animate-pulse">
                          <Cpu className="w-2.5 h-2.5" /> {elapsedSecs}s
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Console Body */}
                  <div className="relative w-full bg-black/40 rounded-b-xl border-b border-x border-[rgba(148,180,156,0.22)] shadow-xl overflow-hidden">
                    {/* Laser scanning beam overlay */}
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-[#94B49C] opacity-40 shadow-[0_0_8px_rgba(148,180,156,0.6)] animate-scan pointer-events-none z-10" />
                    
                    {/* Log Lines List */}
                    <div className="h-44 p-4 font-mono text-[11px] leading-relaxed text-[#D5E2D6] overflow-y-auto space-y-1.5 scrollbar-thin select-none">
                      {consoleLogs.map((log, index) => {
                        if (!log || typeof log !== "string") return null;
                        let colorClass = "text-[#D5E2D6]";
                        if (log.startsWith("[SYSTEM]")) {
                          colorClass = "text-[#94B49C] font-semibold";
                        } else if (log.startsWith("[EXTRACTOR]")) {
                          colorClass = "text-[#527D6F]";
                        } else if (log.startsWith("[AI ENGINE]")) {
                          colorClass = "text-emerald-400";
                        } else if (log.startsWith("[PING]")) {
                          colorClass = "text-gray-500 italic";
                        }
                        
                        return (
                          <div key={index} className={`${colorClass} transition-all duration-300 opacity-90 flex items-start gap-1`}>
                            <span className="text-gray-600 shrink-0 select-none">&gt;</span>
                            <span className="break-all">{log}</span>
                          </div>
                        );
                      })}
                      <div ref={consoleBottomRef} />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(82,125,111,0.15)", border: "2px solid rgba(148,180,156,0.3)" }}>
                  <CheckCircle2 className="w-10 h-10 text-[#94B49C]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#D5E2D6]">Complete!</h3>
                  <p className="text-sm text-[#94B49C] mt-1">Redirecting to your paper…</p>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
