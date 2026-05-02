import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { Label } from "../components/ui/label";
import {
  Plus, Trash2, Wand2, CheckCircle2, File, UploadCloud,
  ArrowRight, ArrowLeft, Cpu, Sparkles, FileText, Zap,
} from "lucide-react";
import { toast } from "sonner";
import * as pdfService from "../services/pdfService";
import { getLMStudioConfig } from "../services/lmStudioService";

interface Section {
  id: string;
  name: string;
  type: string;
  count: number;
  marks: number;
  difficulty: string;
}

const STEPS = [
  { id: 1, label: "Upload Source" },
  { id: 2, label: "Define Structure" },
  { id: 3, label: "Generate" },
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

export function Generate() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [paperTitle, setPaperTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState("120");
  const [sections, setSections] = useState<Section[]>([
    { id: "1", name: "Section A", type: "Multiple Choice", count: 10, marks: 1, difficulty: "Easy" },
  ]);
  const [stage, setStage] = useState<Stage>("extracting");
  const [isGenerating, setIsGenerating] = useState(false);

  // ── File helpers ──
  const acceptFile = useCallback((f: File) => {
    if (f.type === "application/pdf") { setFile(f); toast.success(`"${f.name}" ready`); }
    else toast.error("Please upload a PDF file");
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

  // ── Generate ──
  const handleGenerate = async () => {
    if (!file) { toast.error("Please upload a PDF first"); return; }
    setIsGenerating(true);
    setStep(3);

    try {
      setStage("extracting");
      const pdfText = await pdfService.extractTextFromPDF(file);

      setStage("analysing");
      // Yield to browser so the UI updates before the sync analysis runs
      await new Promise(r => setTimeout(r, 30));

      setStage("generating");
      const paper = await pdfService.generateQuestions(
        pdfText,
        sections,
        paperTitle || "Generated Question Paper",
        subject || "Subject",
        `${duration} Minutes`,
        file.name,
      );

      setStage("done");
      pdfService.savePaper(paper);
      toast.success("Question paper generated!");
      setTimeout(() => navigate(`/paper/${paper.id}`), 600);

    } catch (err) {
      setIsGenerating(false);
      setStep(2);
      toast.error(err instanceof Error ? err.message : "Generation failed. Please try again.");
    }
  };

  const totalQ = sections.reduce((a, s) => a + s.count, 0);
  const totalM = sections.reduce((a, s) => a + s.count * s.marks, 0);
  const lmEnabled = getLMStudioConfig().enabled;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 fm-fadein">

      {/* ── Step progress ── */}
      <div className="flex items-center gap-2 mb-10">
        {STEPS.map((s, i) => {
          const done   = step > s.id;
          const active = step === s.id;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300
                  ${done   ? "bg-[#94B49C] text-[#2F3E46]"
                  : active ? "border-2 border-[#94B49C] text-[#94B49C] step-active"
                           : "border-2 border-[rgba(148,180,156,0.25)] text-[#527D6F]"}`}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : s.id}
                </div>
                <span className={`text-sm font-medium hidden sm:block transition-colors
                  ${active ? "text-[#D5E2D6]" : done ? "text-[#94B49C]" : "text-[#527D6F]"}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="h-px w-10 sm:w-16 transition-colors"
                  style={{ background: step > s.id ? "#527D6F" : "rgba(148,180,156,0.18)" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Card ── */}
      <div className="fm-glass rounded-2xl p-8">

        {/* ════ STEP 1 ════ */}
        {step === 1 && (
          <div className="fm-fadein space-y-7">
            <div>
              <h2 className="text-xl font-bold text-[#D5E2D6]" style={{ fontFamily: "'Playfair Display',serif" }}>
                Upload Source Material
              </h2>
              <p className="text-sm text-[#94B49C] mt-1">Upload a textbook PDF — the AI will read it and craft tailored questions.</p>
            </div>

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
                  <button onClick={e => { e.stopPropagation(); setFile(null); }}
                    className="text-xs text-[#c0504a] hover:underline mt-1">
                    Remove file
                  </button>
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

            <div className="flex justify-end">
              <button disabled={!file} onClick={() => setStep(2)}
                className={`fm-btn-primary flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold
                  ${!file ? "opacity-40 cursor-not-allowed" : ""}`}>
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ════ STEP 2 ════ */}
        {step === 2 && (
          <div className="fm-fadein space-y-7">
            <div>
              <h2 className="text-xl font-bold text-[#D5E2D6]" style={{ fontFamily: "'Playfair Display',serif" }}>
                Paper Structure
              </h2>
              <p className="text-sm text-[#94B49C] mt-1">Name the paper, set duration, and add question sections.</p>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-6"
              style={{ borderBottom: "1px solid rgba(148,180,156,0.12)" }}>
              {[
                { label: "Paper Title", value: paperTitle, set: setPaperTitle, placeholder: "Mid-Term Exam" },
                { label: "Subject",     value: subject,    set: setSubject,    placeholder: "Biology 101" },
                { label: "Duration (min)", value: duration, set: setDuration,  placeholder: "120", type: "number" },
              ].map(f => (
                <div key={f.label}>
                  <Label className="text-xs font-semibold text-[#94B49C] mb-1.5 block tracking-wide uppercase">{f.label}</Label>
                  <input type={f.type || "text"} value={f.value}
                    onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                    className="fm-input w-full h-9 rounded-lg px-3 text-sm" />
                </div>
              ))}
            </div>

            {/* Sections */}
            <div className="space-y-4">
              {sections.map((s, i) => (
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
          <div className="fm-fadein py-14 flex flex-col items-center text-center gap-8">
            {stage !== "done" ? (
              <>
                {/* Animated icon */}
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 rounded-full"
                    style={{ background: "rgba(82,125,111,0.1)", border: "2px solid rgba(82,125,111,0.2)" }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {stage === "extracting" ? <File className="w-9 h-9 text-[#94B49C] fm-float" />
                     : stage === "analysing"  ? <Zap  className="w-9 h-9 text-[#94B49C] fm-float" />
                                              : <Sparkles className="w-9 h-9 text-[#94B49C] fm-float" />}
                  </div>
                  <div className="absolute -inset-2 rounded-full border-2 border-transparent"
                    style={{ borderTopColor: "#94B49C", animation: "spin-ring 1s linear infinite" }} />
                </div>

                {/* Stage label */}
                <div>
                  <h3 className="text-xl font-bold text-[#D5E2D6]" style={{ fontFamily: "'Playfair Display',serif" }}>
                    {STAGE_LABELS[stage]}
                  </h3>
                  <p className="text-sm text-[#94B49C] mt-1 max-w-xs">
                    {stage === "extracting" && "Reading and parsing your PDF pages in parallel…"}
                    {stage === "analysing"  && "Identifying keywords, topics and key concepts…"}
                    {stage === "generating" && (lmEnabled
                      ? "LM Studio is crafting intelligent questions from the content…"
                      : "Building questions from extracted content…")}
                  </p>
                </div>

                {lmEnabled && (
                  <div className="flex items-center gap-2 text-xs text-[#94B49C] px-4 py-2 rounded-full"
                    style={{ background: "rgba(82,125,111,0.15)", border: "1px solid rgba(82,125,111,0.3)" }}>
                    <Cpu className="w-3.5 h-3.5" /> LM Studio Active
                  </div>
                )}

                {/* Stepped progress bar */}
                <div className="w-72 space-y-2">
                  <div className="flex justify-between text-xs text-[#527D6F] font-medium">
                    <span>{STAGE_LABELS[stage]}</span>
                    <span>{STAGE_PROGRESS[stage]}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "rgba(148,180,156,0.15)" }}>
                    <div className="h-full rounded-full transition-all duration-700 ease-out fm-shimmer"
                      style={{ width: `${STAGE_PROGRESS[stage]}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-[#3a5560]">
                    {["Extract", "Analyse", "Generate", "Done"].map((l, i) => (
                      <span key={l} className={
                        (stage === "extracting" && i === 0) ||
                        (stage === "analysing"  && i <= 1) ||
                        (stage === "generating" && i <= 2)
                          ? "text-[#94B49C]" : ""
                      }>{l}</span>
                    ))}
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
