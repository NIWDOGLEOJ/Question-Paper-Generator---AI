import { useState, useEffect } from "react";
import {
  Cpu, User, FileText, Trash2, RefreshCw, Check, X,
  Loader2, ChevronDown, AlertTriangle, Save, HardDrive,
  LayoutTemplate, BookOpen,
} from "lucide-react";
import {
  getLMStudioConfig, saveLMStudioConfig,
  testLMStudioConnection, fetchAvailableModels,
  type LMStudioConfig,
} from "../services/lmStudioService";
import * as sourceService from "../services/sourceService";
import * as pdfService from "../services/pdfService";
import { getTemplates, deleteTemplate } from "../services/templateService";
import { toast } from "sonner";

// ── User profile stored in localStorage ──
const PROFILE_KEY = "qpg_profile";
interface UserProfile { name: string; role: string; }
function getProfile(): UserProfile {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}"); } catch { return {}; }
}
function saveProfile(p: UserProfile) { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }

// ── Default paper prefs ──
const PREFS_KEY = "qpg_prefs";
interface PaperPrefs { duration: string; marksPerQ: string; difficulty: string; }
function getPrefs(): PaperPrefs {
  try { return { duration: "120", marksPerQ: "1", difficulty: "Mixed", ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; }
  catch { return { duration: "120", marksPerQ: "1", difficulty: "Mixed" }; }
}
function savePrefs(p: PaperPrefs) { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); }

// ── Small section card wrapper ──
function Card({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="fm-glass rounded-2xl overflow-hidden">
      <div className="px-6 py-4 flex items-center gap-2.5"
        style={{ borderBottom: "1px solid rgba(148,180,156,0.1)" }}>
        <Icon className="w-4 h-4 text-[#94B49C]" />
        <h2 className="text-sm font-bold text-[#D5E2D6] tracking-wide">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

// ── Labelled input row ──
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
      <div className="pt-1.5">
        <p className="text-xs font-semibold text-[#94B49C] uppercase tracking-wide">{label}</p>
        {hint && <p className="text-xs text-[#3a5560] mt-0.5">{hint}</p>}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

const inputCls = "fm-input w-full h-9 rounded-lg px-3 text-sm";
const selectCls = "fm-select w-full h-9 rounded-lg px-3 text-sm";

// ══════════════════════════════════════════
export function SettingsPage() {
  // ── LM Studio ──
  const [cfg, setCfg]               = useState<LMStudioConfig>(getLMStudioConfig());
  const [testing, setTesting]       = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "err" | null>(null);
  const [testMsg, setTestMsg]       = useState("");
  const [models, setModels]         = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // ── Profile ──
  const [profile, setProfile] = useState<UserProfile>({ name: "Jane Doe", role: "Teacher Account", ...getProfile() });
  const [profileSaved, setProfileSaved] = useState(false);

  // ── Prefs ──
  const [prefs, setPrefs]       = useState<PaperPrefs>(getPrefs());
  const [prefsSaved, setPrefsSaved] = useState(false);

  // ── Danger zone ──
  const [confirmClear, setConfirmClear] = useState<"papers" | "sources" | "templates" | "all" | null>(null);

  // ── Stats ──
  const [stats, setStats] = useState({ papers: 0, sources: 0, templates: 0 });
  useEffect(() => {
    setStats({
      papers:    pdfService.getPapers().length,
      sources:   sourceService.getSources().length,
      templates: getTemplates().length,
    });
  }, []);

  // ── LM Studio helpers ──
  const loadModels = async () => {
    setLoadingModels(true);
    const list = await fetchAvailableModels(cfg.apiUrl, cfg.apiToken);
    setModels(list);
    if (list.length > 0 && !cfg.model) setCfg(c => ({ ...c, model: "local-model" }));
    setLoadingModels(false);
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null); setTestMsg("");
    await loadModels();
    const ok = await testLMStudioConnection(cfg.apiUrl, cfg.apiToken);
    setTestResult(ok ? "ok" : "err");
    if (!ok) setTestMsg("Could not connect. Make sure LM Studio is running and CORS is enabled.");
    setTesting(false);
    if (ok) setTimeout(() => setTestResult(null), 3000);
  };

  const saveLM = () => { saveLMStudioConfig(cfg); toast.success("LM Studio settings saved!"); };

  // ── Profile save ──
  const handleSaveProfile = () => {
    saveProfile(profile);
    setProfileSaved(true);
    toast.success("Profile saved!");
    setTimeout(() => setProfileSaved(false), 2000);
  };

  // ── Prefs save ──
  const handleSavePrefs = () => {
    savePrefs(prefs);
    setPrefsSaved(true);
    toast.success("Default preferences saved!");
    setTimeout(() => setPrefsSaved(false), 2000);
  };

  // ── Danger zone actions ──
  const handleClear = (what: typeof confirmClear) => {
    if (what === "papers" || what === "all") {
      localStorage.removeItem("questionPapers");
      setStats(s => ({ ...s, papers: 0 }));
    }
    if (what === "sources" || what === "all") {
      localStorage.removeItem("qpg_sources");
      setStats(s => ({ ...s, sources: 0 }));
    }
    if (what === "templates" || what === "all") {
      localStorage.removeItem("qpg_templates");
      setStats(s => ({ ...s, templates: 0 }));
    }
    setConfirmClear(null);
    toast.success(what === "all" ? "All data cleared" : `${what} cleared`);
  };

  const storageStats = sourceService.getStorageStats();

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 fm-fadein space-y-6">

      {/* Header */}
      <div className="mb-2">
        <p className="text-xs font-semibold tracking-widest text-[#527D6F] uppercase mb-1">Configuration</p>
        <h1 className="text-3xl font-bold text-[#D5E2D6]"
          style={{ fontFamily: "'Playfair Display', serif" }}>Settings</h1>
        <p className="mt-1 text-sm text-[#94B49C]">Manage your profile, AI connection, and app preferences.</p>
      </div>

      {/* ── Profile ── */}
      <Card title="User Profile" icon={User}>
        <Field label="Display Name">
          <input value={profile.name}
            onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
            placeholder="Your name" className={inputCls} />
        </Field>
        <Field label="Role">
          <input value={profile.role}
            onChange={e => setProfile(p => ({ ...p, role: e.target.value }))}
            placeholder="e.g. Teacher, Professor" className={inputCls} />
        </Field>
        <div className="flex justify-end pt-1">
          <button onClick={handleSaveProfile}
            className="fm-btn-primary flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold">
            {profileSaved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Profile</>}
          </button>
        </div>
      </Card>

      {/* ── Default paper prefs ── */}
      <Card title="Default Paper Preferences" icon={FileText}>
        <Field label="Duration" hint="Default exam duration in minutes">
          <input type="number" min="10" value={prefs.duration}
            onChange={e => setPrefs(p => ({ ...p, duration: e.target.value }))}
            className={inputCls} />
        </Field>
        <Field label="Marks / Question" hint="Default marks per question">
          <input type="number" min="1" value={prefs.marksPerQ}
            onChange={e => setPrefs(p => ({ ...p, marksPerQ: e.target.value }))}
            className={inputCls} />
        </Field>
        <Field label="Difficulty">
          <select value={prefs.difficulty}
            onChange={e => setPrefs(p => ({ ...p, difficulty: e.target.value }))}
            className={selectCls}>
            {["Easy", "Medium", "Hard", "Mixed"].map(d => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <div className="flex justify-end pt-1">
          <button onClick={handleSavePrefs}
            className="fm-btn-primary flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold">
            {prefsSaved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Preferences</>}
          </button>
        </div>
      </Card>

      {/* ── LM Studio ── */}
      <Card title="LM Studio / Local AI" icon={Cpu}>

        {/* Enable toggle */}
        <div className="flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,180,156,0.12)" }}
          onClick={() => setCfg(c => ({ ...c, enabled: !c.enabled }))}>
          <div>
            <p className="text-sm font-semibold text-[#D5E2D6]">Enable AI Generation</p>
            <p className="text-xs text-[#527D6F] mt-0.5">Use local LLM for intelligent questions</p>
          </div>
          <div className={`w-11 h-6 rounded-full relative transition-colors duration-200
            ${cfg.enabled ? "bg-[#527D6F]" : "bg-[rgba(148,180,156,0.15)]"}`}>
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
              ${cfg.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </div>
        </div>

        <Field label="API URL" hint="Default: http://localhost:1234/v1">
          <input type="text" value={cfg.apiUrl}
            onChange={e => setCfg(c => ({ ...c, apiUrl: e.target.value }))}
            placeholder="http://localhost:1234/v1" className={inputCls} />
        </Field>

        <Field label="API Token" hint="Leave empty for most local setups">
          <input type="password" value={cfg.apiToken}
            onChange={e => setCfg(c => ({ ...c, apiToken: e.target.value }))}
            placeholder="Optional" className={`${inputCls} font-mono`} />
        </Field>

        <Field label="Model" hint={models.length > 0 ? `${models.length} model(s) detected` : "Click ↻ to auto-detect"}>
          <div className="flex gap-2">
            {models.length > 0 ? (
              <div className="relative flex-1">
                <select value={cfg.model || "local-model"}
                  onChange={e => setCfg(c => ({ ...c, model: e.target.value }))}
                  className="fm-select w-full h-9 pr-8 appearance-none">
                  <option value="local-model">Use currently loaded model (Auto)</option>
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-2 w-4 h-4 text-[#527D6F] pointer-events-none" />
              </div>
            ) : (
              <input type="text" value={cfg.model || "local-model"}
                onChange={e => setCfg(c => ({ ...c, model: e.target.value }))}
                placeholder="local-model" className={`${inputCls} flex-1`} />
            )}
            <button onClick={loadModels} disabled={loadingModels} title="Auto-detect models"
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all"
              style={{ background: "rgba(82,125,111,0.15)", border: "1px solid rgba(82,125,111,0.25)", color: "#94B49C" }}>
              <RefreshCw className={`w-4 h-4 ${loadingModels ? "animate-spin" : ""}`} />
            </button>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Max Tokens" hint="2048 recommended">
            <input type="number" min="512" max="8192" step="256" value={cfg.maxTokens}
              onChange={e => setCfg(c => ({ ...c, maxTokens: parseInt(e.target.value) || 2048 }))}
              className={inputCls} />
          </Field>
          <Field label="Context Chars" hint="PDF text sent to LLM">
            <input type="number" min="1000" max="20000" step="500" value={cfg.contextChars}
              onChange={e => setCfg(c => ({ ...c, contextChars: parseInt(e.target.value) || 6000 }))}
              className={inputCls} />
          </Field>
        </div>

        {/* Quick setup hint */}
        <div className="rounded-xl p-3 text-xs space-y-1"
          style={{ background: "rgba(82,125,111,0.08)", border: "1px solid rgba(82,125,111,0.2)" }}>
          <p className="font-semibold text-[#94B49C]">Quick Setup</p>
          <ol className="text-[#527D6F] space-y-0.5 list-decimal list-inside">
            <li>Open LM Studio → load a model</li>
            <li>Go to Developer tab → Start Server</li>
            <li>Enable <strong className="text-[#94B49C]">CORS</strong> in server settings</li>
            <li>Click ↻ to detect the model, then Test Connection</li>
          </ol>
        </div>

        {/* Test result */}
        {testResult === "err" && (
          <div className="rounded-xl p-3 text-xs"
            style={{ background: "rgba(192,80,74,0.1)", border: "1px solid rgba(192,80,74,0.25)" }}>
            <p className="text-[#c0504a] font-semibold">Connection failed</p>
            <p className="text-[#c0504a] mt-1 opacity-80">{testMsg}</p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={handleTest} disabled={testing}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(148,180,156,0.2)",
              color: testResult === "ok" ? "#94B49C" : testResult === "err" ? "#c0504a" : "#94B49C",
            }}>
            {testing            ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing…</>
            : testResult === "ok"  ? <><Check className="w-4 h-4" /> Connected</>
            : testResult === "err" ? <><X className="w-4 h-4" /> Failed</>
            : "Test Connection"}
          </button>
          <button onClick={saveLM}
            className="flex-1 fm-btn-primary flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold">
            <Save className="w-4 h-4" /> Save
          </button>
        </div>
      </Card>

      {/* ── Storage & Data ── */}
      <Card title="Storage & Data" icon={HardDrive}>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Papers",    value: stats.papers,    icon: FileText },
            { label: "Sources",   value: stats.sources,   icon: BookOpen },
            { label: "Templates", value: stats.templates, icon: LayoutTemplate },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl p-4 text-center"
              style={{ background: "rgba(82,125,111,0.07)", border: "1px solid rgba(148,180,156,0.1)" }}>
              <Icon className="w-4 h-4 text-[#527D6F] mx-auto mb-1.5" />
              <p className="text-xl font-bold text-[#94B49C]">{value}</p>
              <p className="text-xs text-[#527D6F] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-[#527D6F] px-1">
          <HardDrive className="w-3.5 h-3.5" />
          Source library: {storageStats.estimatedKB > 1024
            ? `${(storageStats.estimatedKB / 1024).toFixed(1)} MB`
            : `${storageStats.estimatedKB} KB`} used in localStorage
        </div>
      </Card>

      {/* ── Danger zone ── */}
      <Card title="Danger Zone" icon={AlertTriangle}>
        <p className="text-xs text-[#527D6F]">
          These actions are permanent and cannot be undone.
        </p>

        <div className="space-y-3">
          {([
            { key: "papers" as const,    label: "Clear all papers",    count: stats.papers,    color: "#c0504a" },
            { key: "sources" as const,   label: "Clear source library", count: stats.sources,   color: "#c0504a" },
            { key: "templates" as const, label: "Clear all templates", count: stats.templates, color: "#c0504a" },
            { key: "all" as const,       label: "Clear everything",    count: stats.papers + stats.sources + stats.templates, color: "#8b1a1a" },
          ]).map(({ key, label, count, color }) => (
            <div key={key}>
              {confirmClear === key ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(192,80,74,0.08)", border: "1px solid rgba(192,80,74,0.25)" }}>
                  <AlertTriangle className="w-4 h-4 text-[#c0504a] shrink-0" />
                  <p className="flex-1 text-sm text-[#c0504a]">
                    Really {label.toLowerCase()}? ({count} item{count !== 1 ? "s" : ""})
                  </p>
                  <button onClick={() => setConfirmClear(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#94B49C]
                      hover:bg-[rgba(82,125,111,0.15)] transition-all">
                    Cancel
                  </button>
                  <button onClick={() => handleClear(key)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white
                      hover:opacity-90 transition-all"
                    style={{ background: "rgba(192,80,74,0.85)" }}>
                    Yes, delete
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(key)}
                  disabled={count === 0}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm
                    font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed
                    hover:bg-[rgba(192,80,74,0.06)]"
                  style={{ border: `1px solid rgba(192,80,74,0.2)`, color }}
                >
                  <span className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4" /> {label}
                  </span>
                  <span className="text-xs opacity-60">{count} item{count !== 1 ? "s" : ""}</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

    </div>
  );
}
