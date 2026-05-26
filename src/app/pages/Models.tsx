import { useState } from "react";
import { useNavigate } from "react-router";
import { 
  Sparkles, Plus, Trash2, Search, Calendar, Clock, BookOpen, 
  FileText, Wand2, Cpu, AlertTriangle, UploadCloud, CheckCircle2, X 
} from "lucide-react";
import { toast } from "sonner";
import * as pdfService from "../services/pdfService";
import { getLMStudioConfig, learnBlueprintFromPaper } from "../services/lmStudioService";
import { 
  getTemplates, saveTemplate, deleteTemplate, 
  createTemplate, type PaperTemplate 
} from "../services/templateService";

export function ModelsPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<PaperTemplate[]>(() => 
    getTemplates().filter(t => t.schoolName || t.customInstructions || t.institutionStyle !== undefined)
  );
  
  // Search & Filter
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<'all' | 'cbse' | 'tn_matric' | 'standard'>('all');

  // Uploader Modal state
  const [showLearnModal, setShowLearnModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"upload" | "extracting" | "analysing" | "review">("upload");
  const [ocrActive, setOcrActive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Learned model states in Modal
  const [modelName, setModelName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [duration, setDuration] = useState("120");
  const [style, setStyle] = useState<'cbse' | 'tn_matric' | 'standard'>('standard');
  const [sections, setSections] = useState<any[]>([]);
  const [customInstructions, setCustomInstructions] = useState("");

  const lmEnabled = getLMStudioConfig().enabled;

  const refreshTemplates = () => {
    setTemplates(getTemplates().filter(t => t.schoolName || t.customInstructions || t.institutionStyle !== undefined));
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the learned model "${name}"?`)) {
      deleteTemplate(id);
      refreshTemplates();
      toast.success("Model deleted successfully");
    }
  };

  const handleCreateExam = (tpl: PaperTemplate) => {
    // We can pre-fill /new with this template!
    // Since our Generate page automatically loads standard templates from templateService,
    // we can pass a state variable to useNavigate so that Generate automatically applies this template!
    navigate("/new", { state: { applyTemplateId: tpl.id } });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
    else if (e.type === "dragleave") setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type === "application/pdf") {
      setFile(dropped);
    } else {
      toast.error("Please drop a valid PDF file");
    }
  };

  const startAnalysis = async () => {
    if (!file) return;
    
    try {
      setStage("extracting");
      setOcrActive(false);
      
      const pdfText = await pdfService.extractTextFromPDF(file, (msg) => {
        console.log('[extraction-model-page]', msg);
        if (msg.toLowerCase().includes('ocr')) setOcrActive(true);
      });

      if (!pdfText.trim()) {
        throw new Error("No readable text found in PDF. Ensure it is a valid PDF.");
      }

      setStage("analysing");
      
      // Analyze with Local AI
      const learned = await learnBlueprintFromPaper(pdfText);
      
      setModelName(`${learned.name || "Learned School"} Model`);
      setSchoolName(learned.schoolName || "");
      setDuration(learned.duration || "120");
      setStyle(learned.institutionStyle || 'standard');
      setSections(learned.sections || []);
      setCustomInstructions(learned.customInstructions || "");
      
      setStage("review");
      toast.success("AI successfully extracted question paper model!");
    } catch (err: any) {
      toast.error(err.message || "Failed to analyze paper pattern.");
      setStage("upload");
    }
  };

  const handleSaveModel = () => {
    if (!modelName.trim()) {
      toast.error("Please provide a template name");
      return;
    }
    
    const tpl = createTemplate(
      modelName.trim(), 
      duration, 
      sections, 
      style, 
      customInstructions.trim() || undefined, 
      schoolName.trim() || undefined
    );
    
    saveTemplate(tpl);
    refreshTemplates();
    setShowLearnModal(false);
    setFile(null);
    setStage("upload");
    toast.success(`Model "${modelName}" trained and saved!`);
  };

  // Filter templates
  const filtered = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || 
                          (t.schoolName && t.schoolName.toLowerCase().includes(search.toLowerCase()));
    
    const matchesTab = activeTab === 'all' || 
                       (activeTab === 'cbse' && t.institutionStyle === 'cbse') ||
                       (activeTab === 'tn_matric' && t.institutionStyle === 'tn_matric') ||
                       (activeTab === 'standard' && (t.institutionStyle === 'standard' || !t.institutionStyle));
                       
    return matchesSearch && matchesTab;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 fm-fadein">
      
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#D5E2D6] tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}>
            AI Question Paper Models
          </h1>
          <p className="text-sm text-[#94B49C] mt-1">
            Train and manage custom school blueprint models to replicate layout structures and questioning style rules.
          </p>
        </div>
        <button
          onClick={() => {
            setFile(null);
            setStage("upload");
            setShowLearnModal(true);
          }}
          className="fm-btn-primary flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold shrink-0"
        >
          <Plus className="w-4 h-4" /> Train New Model
        </button>
      </div>

      {/* ── Filters & Search ── */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-[rgba(82,125,111,0.03)] p-3 rounded-2xl border border-[rgba(148,180,156,0.08)]">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-[#527D6F] absolute left-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search school or model name..."
            className="fm-input pl-9 pr-4 py-2 w-full text-xs rounded-xl h-9"
          />
        </div>

        {/* Board Tabs */}
        <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto scrollbar-none pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Models' },
            { id: 'cbse', label: 'CBSE' },
            { id: 'tn_matric', label: 'TN Matric' },
            { id: 'standard', label: 'Standard' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0
                ${activeTab === tab.id 
                  ? 'bg-[#527D6F] text-[#D5E2D6] shadow-md' 
                  : 'text-[#94B49C] hover:bg-[rgba(82,125,111,0.1)]'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Models Grid ── */}
      {filtered.length === 0 ? (
        <div className="fm-glass rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 max-w-xl mx-auto border border-dashed border-[rgba(148,180,156,0.2)]">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[rgba(82,125,111,0.1)]">
            <Sparkles className="w-6 h-6 text-[#94B49C]" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-[#D5E2D6]">No Learned Models Found</h3>
            <p className="text-xs text-[#94B49C]">
              {search 
                ? "No custom models match your active search terms or tab filter."
                : "You haven't trained any custom school models yet. Upload an example question paper PDF to get started!"
              }
            </p>
          </div>
          {!search && (
            <button
              onClick={() => {
                setFile(null);
                setStage("upload");
                setShowLearnModal(true);
              }}
              className="fm-btn-primary px-4 py-2 rounded-xl text-xs font-semibold"
            >
              Train Your First Model
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(tpl => {
            const styleLabel = tpl.institutionStyle === 'cbse' 
              ? 'CBSE' 
              : tpl.institutionStyle === 'tn_matric' 
                ? 'TN State Board' 
                : 'Standard';
                
            const totalQ = tpl.sections.reduce((a, s) => a + s.count, 0);
            const totalM = tpl.sections.reduce((a, s) => a + s.count * s.marks, 0);
            
            return (
              <div 
                key={tpl.id}
                className="fm-glass rounded-2xl p-5 hover:translate-y-[-2px] transition-all flex flex-col justify-between h-[230px] border border-[rgba(148,180,156,0.1)] hover:border-[rgba(148,180,156,0.22)]"
              >
                <div className="space-y-2.5 min-w-0">
                  {/* Affiliation Badge & Style */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md
                      ${tpl.institutionStyle === 'cbse' 
                        ? 'bg-[rgba(100,149,237,0.15)] text-[#6495ED]' 
                        : tpl.institutionStyle === 'tn_matric'
                          ? 'bg-[rgba(218,165,32,0.15)] text-[#DAA520]'
                          : 'bg-[rgba(82,125,111,0.15)] text-[#94B49C]'
                      }`}
                    >
                      {styleLabel}
                    </span>
                    <span className="text-[10px] text-[#527D6F] font-medium">
                      Trained {new Date(tpl.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Title & School */}
                  <div className="space-y-0.5 min-w-0">
                    <h3 className="text-base font-bold text-[#D5E2D6] truncate leading-tight" title={tpl.name}>
                      {tpl.name}
                    </h3>
                    {tpl.schoolName && (
                      <p className="text-xs text-[#94B49C] truncate italic font-medium" title={tpl.schoolName}>
                        🏫 {tpl.schoolName}
                      </p>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="flex gap-4 text-xs text-[#94B49C] pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#527D6F]" /> {tpl.duration} mins
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-[#527D6F]" /> {totalQ} Qs ({totalM} Marks)
                    </span>
                  </div>

                  {/* Section structure preview chips */}
                  <div className="flex flex-wrap gap-1 pt-1 overflow-hidden h-[24px]">
                    {tpl.sections.map((s, idx) => (
                      <span 
                        key={idx} 
                        className="px-1.5 py-0.5 text-[9px] font-medium bg-[rgba(82,125,111,0.06)] text-[#94B49C] rounded border border-[rgba(148,180,156,0.05)]"
                      >
                        {s.name}: {s.count}×{s.marks}M
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between border-t border-[rgba(148,180,156,0.08)] pt-3 mt-3 shrink-0">
                  <button
                    onClick={() => handleDelete(tpl.id, tpl.name)}
                    className="p-1.5 rounded-lg text-[#527D6F] hover:text-[#c0504a] hover:bg-[rgba(192,80,74,0.1)] transition-all"
                    title="Delete Model"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleCreateExam(tpl)}
                    className="fm-btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> Replicate Exam
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── AI Uploader Learn Modal ── */}
      {showLearnModal && (
        <LearnModelModal 
          onApply={handleSaveModel} 
          onClose={() => setShowLearnModal(false)} 
        />
      )}
    </div>
  );
}

// ── Modal to learn structural pattern and school rules from past year PDF ──
function LearnModelModal({
  onApply,
  onClose,
}: {
  onApply: (model: {
    name: string;
    duration: string;
    institutionStyle: 'cbse' | 'tn_matric' | 'standard';
    sections: Array<{ name: string; type: string; count: number; marks: number; difficulty: string; instructions: string; }>;
    customInstructions?: string;
    schoolName?: string;
  }) => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"upload" | "extracting" | "analysing" | "review">("upload");
  const [ocrActive, setOcrActive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Learned model states
  const [modelName, setModelName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [duration, setDuration] = useState("120");
  const [style, setStyle] = useState<'cbse' | 'tn_matric' | 'standard'>('standard');
  const [sections, setSections] = useState<any[]>([]);
  const [customInstructions, setCustomInstructions] = useState("");

  const lmEnabled = getLMStudioConfig().enabled;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
    else if (e.type === "dragleave") setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type === "application/pdf") {
      setFile(dropped);
    } else {
      toast.error("Please drop a valid PDF file");
    }
  };

  const startAnalysis = async () => {
    if (!file) return;
    
    try {
      setStage("extracting");
      setOcrActive(false);
      
      const pdfText = await pdfService.extractTextFromPDF(file, (msg) => {
        console.log('[extraction-model-page-modal]', msg);
        if (msg.toLowerCase().includes('ocr')) setOcrActive(true);
      });

      if (!pdfText.trim()) {
        throw new Error("No readable text found in PDF. Ensure it is a valid PDF.");
      }

      setStage("analysing");
      
      // Analyze with Local AI
      const learned = await learnBlueprintFromPaper(pdfText);
      
      setModelName(`${learned.name || "Learned School"} Model`);
      setSchoolName(learned.schoolName || "");
      setDuration(learned.duration || "120");
      setStyle(learned.institutionStyle || 'standard');
      setSections(learned.sections || []);
      setCustomInstructions(learned.customInstructions || "");
      
      setStage("review");
      toast.success("AI successfully extracted question paper model!");
    } catch (err: any) {
      toast.error(err.message || "Failed to analyze paper pattern.");
      setStage("upload");
    }
  };

  const handleSaveAndApply = () => {
    if (!modelName.trim()) {
      toast.error("Please provide a template name");
      return;
    }
    
    const parsedModel = {
      name: modelName.trim(),
      duration,
      institutionStyle: style,
      sections,
      customInstructions: customInstructions.trim() || undefined,
      schoolName: schoolName.trim() || undefined
    };

    onApply(parsedModel);
  };

  const inputCls = "fm-input w-full h-9 rounded-lg px-3 text-sm";
  const selectCls = "fm-select w-full h-9 rounded-lg px-3 text-sm";
  const LabelCls = "text-xs font-semibold text-[#94B49C] mb-1.5 block uppercase tracking-wider";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="fm-glass rounded-2xl p-6 w-full max-w-xl shadow-2xl space-y-4 mx-4 max-h-[85vh] flex flex-col overflow-hidden text-[#D5E2D6]">
        
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#94B49C]" />
            <h3 className="text-base font-bold text-[#D5E2D6]" style={{ fontFamily: "'Playfair Display',serif" }}>
              AI Question Paper Model Extractor
            </h3>
          </div>
          <button onClick={onClose} className="text-[#527D6F] hover:text-[#94B49C]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          
          {/* UPLOAD STAGE */}
          {stage === "upload" && (
            <div className="space-y-4">
              <p className="text-xs text-[#94B49C]">
                Upload a past exam paper PDF (from any school or board). The local AI will extract its exact section structures, question counts, marks, difficulty, and school-specific styling guidelines to save as a reusable template.
              </p>

              {!lmEnabled && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(192,80,74,0.08)", border: "1px solid rgba(192,80,74,0.25)" }}>
                  <AlertTriangle className="w-4 h-4 text-[#c0504a] shrink-0 mt-0.5" />
                  <div className="text-xs text-[#c0504a]">
                    <p className="font-semibold">Local AI Required</p>
                    <p className="mt-0.5 opacity-80">
                      You must enable LM Studio in <a href="/settings" className="underline">Settings</a> to analyze and learn structures from past papers.
                    </p>
                  </div>
                </div>
              )}

              {lmEnabled && (
                <>
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-7 flex flex-col items-center justify-center
                      transition-all duration-200 cursor-pointer ${
                        isDragging
                          ? "border-[#527D6F] bg-[rgba(82,125,111,0.08)]"
                          : "border-[rgba(148,180,156,0.2)] hover:border-[rgba(148,180,156,0.35)]"
                      }`}
                  >
                    <input
                      type="file"
                      id="past-paper-file-page"
                      accept="application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <label htmlFor="past-paper-file-page" className="cursor-pointer flex flex-col items-center text-center">
                      <UploadCloud className="w-10 h-10 text-[#94B49C] mb-3 opacity-80" />
                      <span className="text-sm font-semibold text-[#D5E2D6] block mb-1">
                        {file ? file.name : "Drag & drop past paper PDF here"}
                      </span>
                      <span className="text-xs text-[#94B49C]">
                        {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "or click to browse computer"}
                      </span>
                    </label>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button onClick={onClose}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-[#94B49C] hover:bg-[rgba(82,125,111,0.1)] transition-all">
                      Cancel
                    </button>
                    <button
                      disabled={!file}
                      onClick={startAnalysis}
                      className="fm-btn-primary flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold
                        disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Wand2 className="w-4 h-4" /> Extract Layout
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* EXTRACTING STAGE */}
          {stage === "extracting" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
              <div className="fm-spinner w-8 h-8 rounded-full border-2 border-t-transparent border-[#527D6F] animate-spin" />
              <div className="space-y-1">
                <p className="font-semibold text-base text-[#D5E2D6]">Extracting paper text...</p>
                <p className="text-xs text-[#94B49C]">Converting digital pages to text lines.</p>
                {ocrActive && (
                  <p className="text-xs text-[#b0a85d] italic font-medium pt-1">
                    ⚠️ Scanned image detected — activating OCR pipeline...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ANALYSING STAGE */}
          {stage === "analysing" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
              <div className="relative">
                <div className="fm-spinner w-10 h-10 rounded-full border-2 border-t-transparent border-[#94B49C] animate-spin" />
                <Cpu className="w-5 h-5 text-[#94B49C] absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-base text-[#D5E2D6]">AI is learning paper pattern...</p>
                <p className="text-xs text-[#94B49C] max-w-sm">
                  Analyzing document structures, extracting sections, counting questions, and capturing school-specific styling guidelines.
                </p>
              </div>
            </div>
          )}

          {/* REVIEW STAGE */}
          {stage === "review" && (
            <div className="space-y-4 fm-fadein">
              <p className="text-xs text-[#94B49C]">
                Review the blueprint and rules successfully extracted by the AI. You can edit any details before saving it as a persistent model.
              </p>

              {/* Editable Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className={LabelCls}>Model / Template Name</span>
                  <input
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. DAV Chemistry Midterm Model"
                  />
                </div>
                <div>
                  <span className={LabelCls}>School / Institution Name</span>
                  <input
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. DAV Public School, Chennai"
                  />
                </div>
                <div>
                  <span className={LabelCls}>Exam Board / Affiliation Style</span>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value as any)}
                    className={selectCls}
                  >
                    <option value="standard">Standard Style</option>
                    <option value="cbse">CBSE Board Exam</option>
                    <option value="tn_matric">Tamil Nadu Matriculation</option>
                  </select>
                </div>
                <div>
                  <span className={LabelCls}>Duration (minutes)</span>
                  <input
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    type="number"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Sections Table Preview */}
              <div>
                <span className={LabelCls}>Extracted Sections</span>
                <div className="border border border-[rgba(148,180,156,0.15)] rounded-xl overflow-hidden text-xs bg-[rgba(82,125,111,0.03)]">
                  <div className="grid grid-cols-4 gap-2 p-2 border-b border-[rgba(148,180,156,0.15)] bg-[rgba(82,125,111,0.06)] font-semibold text-[#94B49C]">
                    <span>Name</span>
                    <span>Type</span>
                    <span>Q Count</span>
                    <span>Marks/Q</span>
                  </div>
                  <div className="max-h-[120px] overflow-y-auto divide-y divide-[rgba(148,180,156,0.1)]">
                    {sections.map((s, i) => (
                      <div key={i} className="grid grid-cols-4 gap-2 p-2 text-[#D5E2D6] items-center">
                        <span className="font-medium truncate">{s.name}</span>
                        <span className="truncate opacity-80">{s.type}</span>
                        <span>{s.count} Qs</span>
                        <span>{s.marks} M</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Style Rules Learned */}
              <div>
                <span className={LabelCls}>Synthesized School Style Rules</span>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  rows={3}
                  className="fm-textarea w-full rounded-xl p-3 text-xs"
                  placeholder="e.g. Focuses on statement questions, Newton laws, direct derivations..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setStage("upload")}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-[#94B49C] hover:bg-[rgba(82,125,111,0.1)] transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveAndApply}
                  className="fm-btn-primary flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold"
                >
                  <CheckCircle2 className="w-4 h-4" /> Apply & Save Model
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
