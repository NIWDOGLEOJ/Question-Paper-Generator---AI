import { useState, useEffect } from 'react';
import { Settings, Check, X, Loader2, Cpu, RefreshCw, ChevronDown } from 'lucide-react';
import {
  getLMStudioConfig,
  saveLMStudioConfig,
  testLMStudioConnection,
  fetchAvailableModels,
  type LMStudioConfig,
} from '../services/lmStudioService';

export function LMStudioSettings() {
  const [config, setConfig]       = useState<LMStudioConfig>(getLMStudioConfig());
  const [isOpen, setIsOpen]       = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [errorMsg, setErrorMsg]   = useState('');
  const [models, setModels]       = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => { setConfig(getLMStudioConfig()); }, []);

  const loadModels = async () => {
    setLoadingModels(true);
    const list = await fetchAvailableModels(config.apiUrl, config.apiToken);
    setModels(list);
    if (list.length > 0 && !config.model) {
      setConfig(c => ({ ...c, model: list[0] }));
    }
    setLoadingModels(false);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setErrorMsg('');
    await loadModels();
    const ok = await testLMStudioConnection(config.apiUrl, config.apiToken);
    setTestResult(ok ? 'success' : 'error');
    if (!ok) setErrorMsg('Could not connect. Make sure LM Studio is running and CORS is enabled.');
    setIsTesting(false);
    if (ok) setTimeout(() => setTestResult(null), 3000);
  };

  const handleSave = () => {
    saveLMStudioConfig(config);
    setIsOpen(false);
  };

  const field = (label: string, id: string, child: React.ReactNode, hint?: string) => (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-[#94B49C] mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {child}
      {hint && <p className="mt-1 text-xs text-[#527D6F]">{hint}</p>}
    </div>
  );

  const inputClass = "fm-input w-full h-9 rounded-lg px-3 text-sm";

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
        style={{
          background: config.enabled ? "rgba(82,125,111,0.18)" : "rgba(255,255,255,0.06)",
          border: `1px solid ${config.enabled ? "rgba(82,125,111,0.4)" : "rgba(148,180,156,0.18)"}`,
          color: config.enabled ? "#94B49C" : "#527D6F",
        }}
      >
        <Cpu className="w-4 h-4" />
        <span>LM Studio</span>
        {config.enabled && (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
            style={{ background: "rgba(82,125,111,0.3)", color: "#94B49C" }}>
            ON
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Panel */}
          <div
            className="absolute right-0 mt-2 w-[22rem] z-50 rounded-2xl p-6 space-y-5 shadow-2xl"
            style={{
              background: "#1e2c31",
              border: "1px solid rgba(148,180,156,0.18)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#94B49C]" />
                <h3 className="font-bold text-[#D5E2D6] text-sm">LM Studio Settings</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-[#527D6F] hover:text-[#94B49C] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Enable toggle */}
            <div
              className="flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,180,156,0.12)" }}
              onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
            >
              <div>
                <p className="text-sm font-semibold text-[#D5E2D6]">Enable AI Generation</p>
                <p className="text-xs text-[#527D6F] mt-0.5">Use local LLM for questions</p>
              </div>
              {/* Toggle switch */}
              <div className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${config.enabled ? "bg-[#527D6F]" : "bg-[rgba(148,180,156,0.15)]"}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${config.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
            </div>

            {/* API URL */}
            {field("API URL", "api-url",
              <input id="api-url" type="text" value={config.apiUrl}
                onChange={e => setConfig(c => ({ ...c, apiUrl: e.target.value }))}
                placeholder="http://localhost:1234/v1"
                className={inputClass} />,
              "Default: http://localhost:1234/v1"
            )}

            {/* API Token */}
            {field("API Token", "api-token",
              <input id="api-token" type="password" value={config.apiToken}
                onChange={e => setConfig(c => ({ ...c, apiToken: e.target.value }))}
                placeholder="Leave empty if not required"
                className={`${inputClass} font-mono`} />,
              "Optional — most local LM Studio setups don't need this"
            )}

            {/* Model picker */}
            {field("Model", "model-select",
              <div className="flex gap-2">
                {models.length > 0 ? (
                  <div className="relative flex-1">
                    <select
                      id="model-select"
                      value={config.model}
                      onChange={e => setConfig(c => ({ ...c, model: e.target.value }))}
                      className="fm-select w-full h-9 pr-8 appearance-none"
                    >
                      {models.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-2 w-4 h-4 text-[#527D6F] pointer-events-none" />
                  </div>
                ) : (
                  <input type="text" value={config.model}
                    onChange={e => setConfig(c => ({ ...c, model: e.target.value }))}
                    placeholder="Click ↻ to detect loaded model"
                    className={`${inputClass} flex-1`} />
                )}
                <button
                  onClick={loadModels}
                  disabled={loadingModels}
                  title="Auto-detect models"
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-all shrink-0"
                  style={{ background: "rgba(82,125,111,0.15)", border: "1px solid rgba(82,125,111,0.25)", color: "#94B49C" }}
                >
                  <RefreshCw className={`w-4 h-4 ${loadingModels ? "animate-spin" : ""}`} />
                </button>
              </div>,
              models.length > 0 ? `${models.length} model(s) detected` : "Click ↻ to auto-detect from LM Studio"
            )}

            {/* Advanced: max tokens + context */}
            <div className="grid grid-cols-2 gap-3">
              {field("Max Tokens", "max-tokens",
                <input id="max-tokens" type="number" min="512" max="8192" step="256"
                  value={config.maxTokens}
                  onChange={e => setConfig(c => ({ ...c, maxTokens: parseInt(e.target.value) || 2048 }))}
                  className={inputClass} />,
                "2048 recommended"
              )}
              {field("Context Chars", "ctx-chars",
                <input id="ctx-chars" type="number" min="1000" max="20000" step="500"
                  value={config.contextChars}
                  onChange={e => setConfig(c => ({ ...c, contextChars: parseInt(e.target.value) || 6000 }))}
                  className={inputClass} />,
                "PDF text sent to LLM"
              )}
            </div>

            {/* Setup hint */}
            <div className="rounded-xl p-3 text-xs space-y-1"
              style={{ background: "rgba(82,125,111,0.08)", border: "1px solid rgba(82,125,111,0.2)" }}>
              <p className="font-semibold text-[#94B49C]">Quick Setup</p>
              <ol className="text-[#527D6F] space-y-0.5 list-decimal list-inside">
                <li>Open LM Studio → load a model</li>
                <li>Go to Developer tab → Start Server</li>
                <li>Enable <strong className="text-[#94B49C]">CORS</strong> in server settings</li>
                <li>Click ↻ above to detect the model, then Test</li>
              </ol>
            </div>

            {/* Test result */}
            {testResult === 'error' && (
              <div className="rounded-xl p-3 text-xs"
                style={{ background: "rgba(192,80,74,0.1)", border: "1px solid rgba(192,80,74,0.25)" }}>
                <p className="text-[#c0504a] font-semibold">Connection failed</p>
                <p className="text-[#c0504a] mt-1 opacity-80">{errorMsg}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleTest}
                disabled={isTesting}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(148,180,156,0.2)",
                  color: testResult === 'success' ? "#94B49C" : testResult === 'error' ? "#c0504a" : "#94B49C",
                }}
              >
                {isTesting       ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing…</>
                : testResult === 'success' ? <><Check className="w-4 h-4" /> Connected</>
                : testResult === 'error'   ? <><X className="w-4 h-4" /> Failed</>
                :                            'Test Connection'}
              </button>

              <button
                onClick={handleSave}
                className="flex-1 py-2 rounded-xl text-sm font-semibold fm-btn-primary"
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
