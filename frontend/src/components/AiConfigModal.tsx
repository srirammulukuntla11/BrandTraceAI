import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { AiConfigStatus } from '../types';
import {
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Trash2,
  Clock,
  Eye,
  EyeOff,
  ShieldCheck,
  Cpu,
  RefreshCw,
} from 'lucide-react';

interface AiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (status: AiConfigStatus) => void;
}

function parseDelaySeconds(delayStr?: string): number {
  if (!delayStr) return 30;
  const m = delayStr.match(/([0-9]+(?:\.[0-9]+)?)/);
  return m ? Math.ceil(parseFloat(m[1])) : 30;
}

export const AiConfigModal: React.FC<AiConfigModalProps> = ({
  isOpen,
  onClose,
  onStatusChange,
}) => {
  const [status, setStatus] = useState<AiConfigStatus | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('auto');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [isModelsStale, setIsModelsStale] = useState(false);
  const [rateLimitCooldownUntil, setRateLimitCooldownUntil] = useState<number | null>(null);
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number>(0);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Rate limit countdown timer
  useEffect(() => {
    if (!rateLimitCooldownUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((rateLimitCooldownUntil - Date.now()) / 1000));
      setRateLimitRemaining(remaining);
      if (remaining <= 0) {
        setRateLimitCooldownUntil(null);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimitCooldownUntil]);

  const handleRefreshModels = async (explicitKey?: string) => {
    // Respect rate limit / quota delay (Requirement 9)
    if (rateLimitCooldownUntil && Date.now() < rateLimitCooldownUntil) {
      return;
    }

    const keyToUse = explicitKey || apiKeyInput.trim() || undefined;
    if (!keyToUse && !status?.configured) {
      setModelsError('Please enter a Gemini API key above to discover available models.');
      return;
    }

    setRefreshingModels(true);
    setModelsError(null);

    try {
      const res = await api.refreshAiModels(keyToUse);
      if (res.models && Array.isArray(res.models) && res.models.length > 0) {
        setAvailableModels(res.models);
        setIsModelsStale(false);
        setModelsError(null);
      } else if (res.models && Array.isArray(res.models) && res.models.length === 0) {
        setAvailableModels([]);
        setIsModelsStale(false);
        setModelsError('No models supporting generateContent were returned by Google for this account.');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Failed to refresh models from Google Generative Language API';
      setModelsError(errMsg);
      // Requirement 7: Preserve previously cached list if available, marking it as stale
      if (availableModels.length > 0) {
        setIsModelsStale(true);
      }
      // Requirement 9: Detect 429 / quota rate limit and initiate cooldown
      if (/429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(errMsg)) {
        const secs = parseDelaySeconds(err.retryDelay || errMsg);
        setRateLimitCooldownUntil(Date.now() + secs * 1000);
        setRateLimitRemaining(secs);
      }
    } finally {
      setRefreshingModels(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await api.getAiConfig();
      setStatus(res);
      if (res.selectedModel) {
        setSelectedModel(res.selectedModel);
      }
      if (res.availableModels && Array.isArray(res.availableModels) && res.availableModels.length > 0) {
        setAvailableModels(res.availableModels);
        setIsModelsStale(false);
      }
      if (res.modelsError) {
        setModelsError(res.modelsError);
        if (res.retryDelay) {
          const secs = parseDelaySeconds(res.retryDelay);
          setRateLimitCooldownUntil(Date.now() + secs * 1000);
          setRateLimitRemaining(secs);
        }
      }
      if (onStatusChange) onStatusChange(res);

      // Requirement 3: When user opens the modal, if configured and availableModels is empty, discover models
      if (res.configured && (!res.availableModels || res.availableModels.length === 0)) {
        handleRefreshModels();
      }
    } catch (err: any) {
      console.warn('Could not fetch AI config status', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setTestResult(null);
      setActionMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;

    setLoading(true);
    setTestResult(null);
    setActionMessage(null);

    try {
      const res = await api.saveAiKey(apiKeyInput.trim(), selectedModel);
      setActionMessage(res.message);
      setApiKeyInput('');
      if (res.availableModels && res.availableModels.length > 0) {
        setAvailableModels(res.availableModels);
        setIsModelsStale(false);
        setModelsError(null);
      }
      await fetchStatus();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Failed to save key' });
      if (/429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(err.message)) {
        const secs = parseDelaySeconds(err.retryDelay || err.message);
        setRateLimitCooldownUntil(Date.now() + secs * 1000);
        setRateLimitRemaining(secs);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setLoading(true);
    setTestResult(null);
    setActionMessage(null);

    try {
      const keyToTest = apiKeyInput.trim() || undefined;
      const res = await api.testAiKey(keyToTest, selectedModel);
      setTestResult({ success: true, message: res.message });
      if (res.availableModels && res.availableModels.length > 0) {
        setAvailableModels(res.availableModels);
        setIsModelsStale(false);
        setModelsError(null);
      }
      await fetchStatus();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Verification failed' });
      if (/429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(err.message)) {
        const secs = parseDelaySeconds(err.retryDelay || err.message);
        setRateLimitCooldownUntil(Date.now() + secs * 1000);
        setRateLimitRemaining(secs);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateModel = async () => {
    setLoading(true);
    setTestResult(null);
    setActionMessage(null);

    try {
      const res = await api.updateAiModel(selectedModel);
      setActionMessage(res.message);
      await fetchStatus();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Failed to update model' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setTestResult(null);
    setActionMessage(null);

    try {
      const res = await api.deleteAiKey();
      setActionMessage(res.message);
      setSelectedModel('auto');
      setAvailableModels([]);
      setModelsError(null);
      setIsModelsStale(false);
      await fetchStatus();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Failed to remove key' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Personal Gemini AI Configuration
            </h2>
            <p className="text-xs text-slate-500">
              Configure your own Google Gemini API key and select your preferred model.
            </p>
          </div>
        </div>

        {/* Current Status Banner */}
        <div
          className={`my-5 p-4 rounded-xl border flex items-center justify-between gap-3 ${
            status?.configured
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full shrink-0 ${
                status?.configured ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
              }`}
            />
            <div>
              <div className="text-xs font-bold">
                {status?.configured
                  ? 'Personal API Key Active (User-Scoped)'
                  : 'No Personal API Key Configured'}
              </div>
              <div className="text-[11px] text-slate-600">
                Active Engine:{' '}
                <span className="font-mono font-semibold text-slate-800">
                  {status?.activeModel || status?.model || 'gemini-2.0-flash'}
                </span>
                {status?.selectedModel && status.selectedModel !== 'auto' && (
                  <span className="ml-1 text-slate-500">
                    (Manual: <span className="font-mono text-slate-700">{status.selectedModel}</span>)
                  </span>
                )}
              </div>
            </div>
          </div>

          {status?.configured && (
            <button
              type="button"
              disabled={loading}
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 shadow-xs transition-colors shrink-0"
              title="Remove your API key from session memory"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              Remove Key
            </button>
          )}
        </div>

        {/* Success / Error Notifications */}
        {actionMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{actionMessage}</span>
          </div>
        )}

        {testResult && (
          <div
            className={`mb-4 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            )}
            <div className="break-all leading-relaxed">{testResult.message}</div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Gemini API Key
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
              >
                Get a free key
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={status?.configured ? '•••••••••••••••••••••••••••••• (Key active in session)' : 'AIzaSy...'}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Feature B: Model Selection Dropdown */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                Gemini Model Selection
              </label>
              {(status?.configured || apiKeyInput.trim().length >= 10) && (
                <button
                  type="button"
                  disabled={refreshingModels || loading || Boolean(rateLimitRemaining > 0)}
                  onClick={() => handleRefreshModels()}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                  title="Query Google API for models supporting generateContent"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshingModels ? 'animate-spin' : ''}`} />
                  {rateLimitRemaining > 0
                    ? `Cooldown (${rateLimitRemaining}s)`
                    : refreshingModels
                    ? 'Discovering...'
                    : 'Refresh Models'}
                </button>
              )}
            </div>

            {/* Model Discovery Error / Notice Banner (Requirement 6 & 7) */}
            {modelsError && (
              <div className="mb-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-semibold">Model discovery notice:</span> {modelsError}
                  {isModelsStale && (
                    <div className="text-[11px] text-amber-700 font-medium mt-0.5">
                      Preserving previously fetched model list (may be stale).
                    </div>
                  )}
                  {rateLimitRemaining > 0 && (
                    <div className="text-[11px] text-amber-700 font-medium mt-0.5">
                      Quota limit reached. Cooldown active for {rateLimitRemaining} seconds.
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={refreshingModels}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors disabled:opacity-60"
              >
                <option value="auto">✨ Auto-select compatible model (Recommended)</option>

                {/* Loading state (Requirement 6) */}
                {refreshingModels && availableModels.length === 0 && (
                  <option disabled value="">
                    ⏳ Discovering models from Google AI...
                  </option>
                )}

                {/* Empty / Error state (Requirement 6) */}
                {!refreshingModels && availableModels.length === 0 && (
                  <option disabled value="">
                    {modelsError
                      ? `⚠️ Discovery failed: ${modelsError.slice(0, 50)}...`
                      : !status?.configured && !apiKeyInput.trim()
                      ? '🔑 Enter your Gemini API key above to load models'
                      : '⚠️ No models supporting generateContent found for this key'}
                  </option>
                )}

                {/* Available Models (Requirement 4 & 5) */}
                {availableModels && availableModels.length > 0 && (
                  <optgroup
                    label={
                      isModelsStale
                        ? 'Available Models (Previously Cached — May be stale)'
                        : 'Google Verified Models (generateContent)'
                    }
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m} {isModelsStale ? '(cached)' : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {status?.configured && selectedModel !== (status?.selectedModel || 'auto') && (
                <button
                  type="button"
                  disabled={loading || refreshingModels}
                  onClick={handleUpdateModel}
                  className="px-3.5 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-semibold shrink-0 transition-colors shadow-xs"
                  title="Apply and verify selected model"
                >
                  Apply Model
                </button>
              )}
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
              <span>
                Active engine:{' '}
                <span className="font-mono font-semibold text-indigo-700">
                  {status?.activeModel || status?.model || 'gemini-2.0-flash'}
                </span>
                {isModelsStale && (
                  <span className="ml-1 text-amber-600 font-medium text-[10px]">(List is stale)</span>
                )}
              </span>
              <span>
                {refreshingModels ? (
                  <span className="text-indigo-600 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3 animate-spin" /> Querying Google API...
                  </span>
                ) : availableModels.length > 0 ? (
                  <span className="text-slate-500 font-medium">
                    {availableModels.length} models supporting generateContent
                  </span>
                ) : (
                  <span className="text-slate-400">0 models loaded</span>
                )}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              disabled={loading || (!apiKeyInput.trim() && !status?.configured)}
              onClick={handleTest}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors disabled:opacity-50"
            >
              {loading ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-violet-600" />}
              Test Connection
            </button>

            <button
              type="submit"
              disabled={loading || !apiKeyInput.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              Save & Activate Key
            </button>
          </div>
        </form>

        {/* Security & Isolation Callout */}
        <div className="mt-6 pt-5 border-t border-slate-200 text-xs text-slate-500 space-y-2">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Security & Privacy Protections:
          </div>
          <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-600 leading-relaxed">
            <li>
              <strong className="text-slate-800">User-Scoped Session Storage:</strong> Your API key is scoped strictly to your account and stored only in backend process memory. Other users cannot access or use your key.
            </li>
            <li>
              <strong className="text-slate-800">Zero Browser Storage:</strong> Your key is never stored in browser localStorage, cookies, or logs.
            </li>
            <li>
              <strong className="text-slate-800">Strict Model Verification:</strong> Models are validated with a real generation request against Google API before activation.
            </li>
            <li>
              <strong className="text-slate-800">Deterministic Rules Always Run:</strong> Prohibited terms and disclaimer checks operate 100% even without a Gemini API key.
            </li>
            <li>
              <strong className="text-slate-800">Session Lifecycle:</strong> Keys are cleared upon server restart or when you click &quot;Remove Key&quot;.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
