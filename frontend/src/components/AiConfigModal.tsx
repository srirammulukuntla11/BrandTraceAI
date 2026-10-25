import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { AiConfigStatus, ModelTestRecord, ModelTestStatus } from '../types';
import { PREDEFINED_GEMINI_MODELS, PredefinedGeminiModel } from '../config/models';
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
  Check,
  Zap,
  Activity,
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
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
  const [modelTestResults, setModelTestResults] = useState<Record<string, ModelTestRecord>>({});
  const [showKey, setShowKey] = useState(false);
  const [testingModel, setTestingModel] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [activatingModel, setActivatingModel] = useState(false);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [diagnosticsResult, setDiagnosticsResult] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [rateLimitCooldownUntil, setRateLimitCooldownUntil] = useState<number | null>(null);
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number>(0);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; modelId?: string } | null>(null);
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

  const fetchStatus = async () => {
    try {
      const res = await api.getAiConfig();
      setStatus(res);
      if (res.activeModel) {
        setSelectedModel(res.activeModel);
      } else if (res.selectedModel) {
        setSelectedModel(res.selectedModel);
      }
      if (res.modelTestResults) {
        setModelTestResults(res.modelTestResults);
      }
      if (onStatusChange) onStatusChange(res);
    } catch (err: any) {
      console.warn('Could not fetch AI config status', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setTestResult(null);
      setActionMessage(null);
      setDiagnosticsResult(null);
      setShowDiagnostics(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Selected model details
  const selectedModelCandidate = PREDEFINED_GEMINI_MODELS.find((m) => m.id === selectedModel);
  const currentModelTest = modelTestResults[selectedModel];
  const isSelectedModelPassed = currentModelTest?.status === 'passed';
  const isSelectedModelActive = Boolean(status?.activeModel && status.activeModel === selectedModel);

  // Check if input has masked bullet characters
  const inputContainsBullets = apiKeyInput.includes('•');

  // Save API key directly to session/database
  const handleSaveKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanKey = apiKeyInput.trim();
    if (!cleanKey) return;

    if (inputContainsBullets) {
      setTestResult({
        success: false,
        message: 'The key input contains masked placeholder characters (•). Please paste your real API key copied from Google AI Studio.',
      });
      return;
    }

    setSavingKey(true);
    setTestResult(null);
    setActionMessage(null);

    try {
      const res = await api.saveAiKeyOnly(cleanKey);
      setActionMessage(res.message);
      setApiKeyInput('');
      await fetchStatus();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Failed to save key' });
    } finally {
      setSavingKey(false);
    }
  };

  // Test explicitly selected model
  const handleTestModel = async () => {
    const rawKey = apiKeyInput.trim();

    if (inputContainsBullets) {
      setTestResult({
        success: false,
        message: 'The key input contains masked characters (•). Please clear the input to test using your saved key, or paste a real key.',
      });
      return;
    }

    const keyToUse = rawKey || undefined;
    if (!keyToUse && !status?.configured) {
      setTestResult({
        success: false,
        message: 'Please enter a Gemini API key above to test this model.',
      });
      return;
    }

    setTestingModel(true);
    setTestResult(null);
    setActionMessage(null);

    // Optimistically mark this model as testing
    setModelTestResults((prev) => ({
      ...prev,
      [selectedModel]: {
        modelId: selectedModel,
        status: 'testing',
        message: `Testing model "${selectedModel}" with Google Gemini API...`,
        testedAt: new Date().toISOString(),
      },
    }));

    try {
      const res = await api.testAiModel(selectedModel, keyToUse);
      setTestResult({ success: true, message: res.message, modelId: selectedModel });
      if (res.modelTestResults) {
        setModelTestResults(res.modelTestResults);
      } else if (res.test) {
        setModelTestResults((prev) => ({ ...prev, [selectedModel]: res.test }));
      }
      await fetchStatus();
    } catch (err: any) {
      const errMsg = err.message || 'Model test failed';
      setTestResult({ success: false, message: errMsg, modelId: selectedModel });

      if (err.modelTestResults) {
        setModelTestResults(err.modelTestResults);
      } else if (err.test) {
        setModelTestResults((prev) => ({ ...prev, [selectedModel]: err.test }));
      } else {
        // Fallback error record
        setModelTestResults((prev) => ({
          ...prev,
          [selectedModel]: {
            modelId: selectedModel,
            status: /429|quota|rate limit/i.test(errMsg)
              ? 'quota_exceeded'
              : /404|not found/i.test(errMsg)
              ? 'model_not_found'
              : /permission|403/i.test(errMsg)
              ? 'permission_denied'
              : /401|invalid key/i.test(errMsg)
              ? 'invalid_key'
              : 'request_error',
            message: errMsg,
            testedAt: new Date().toISOString(),
          },
        }));
      }

      if (/429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(errMsg)) {
        const secs = parseDelaySeconds(err.retryDelay || errMsg);
        setRateLimitCooldownUntil(Date.now() + secs * 1000);
        setRateLimitRemaining(secs);
      }
      await fetchStatus();
    } finally {
      setTestingModel(false);
    }
  };

  // Activate successfully tested model
  const handleActivateModel = async () => {
    if (!isSelectedModelPassed) return;

    setActivatingModel(true);
    setTestResult(null);
    setActionMessage(null);

    try {
      const rawKey = apiKeyInput.trim();
      const keyToUse = !inputContainsBullets && rawKey ? rawKey : undefined;
      const res = await api.activateAiModel(selectedModel, keyToUse);
      setActionMessage(res.message);
      if (keyToUse) {
        setApiKeyInput('');
      }
      await fetchStatus();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Failed to activate model' });
    } finally {
      setActivatingModel(false);
    }
  };

  // Delete key & model configuration
  const handleDelete = async () => {
    setSavingKey(true);
    setTestResult(null);
    setActionMessage(null);

    try {
      const res = await api.deleteAiKey();
      setActionMessage(res.message);
      setModelTestResults({});
      setApiKeyInput('');
      await fetchStatus();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Failed to remove key' });
    } finally {
      setSavingKey(false);
    }
  };

  // Run internal diagnostics via GET /api/ai-config/diagnose
  const handleRunDiagnostics = async () => {
    setRunningDiagnostics(true);
    try {
      const res = await api.diagnoseAiModels();
      setDiagnosticsResult(res);
      setShowDiagnostics(true);
    } catch (err: any) {
      setDiagnosticsResult({ error: err.message || 'Failed to run diagnostics' });
      setShowDiagnostics(true);
    } finally {
      setRunningDiagnostics(false);
    }
  };

  const getStatusBadge = (statusType?: ModelTestStatus) => {
    switch (statusType) {
      case 'passed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Check className="w-2.5 h-2.5 text-emerald-600" />
            Passed
          </span>
        );
      case 'quota_exceeded':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
            Quota Exceeded (429)
          </span>
        );
      case 'invalid_key':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <X className="w-2.5 h-2.5 text-rose-600" />
            Invalid Key
          </span>
        );
      case 'permission_denied':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            Permission Denied (403)
          </span>
        );
      case 'model_not_found':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Not Found (404)
          </span>
        );
      case 'unsupported_model':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Unsupported
          </span>
        );
      case 'network_error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
            Timeout / Network Error
          </span>
        );
      case 'server_error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
            Server Error (5xx)
          </span>
        );
      case 'request_error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
            Request Error
          </span>
        );
      case 'testing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Clock className="w-2.5 h-2.5 animate-spin text-indigo-600" />
            Testing...
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500">
            Not Tested
          </span>
        );
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
              Configure your Google Gemini API key, test candidate models individually, and activate your engine.
            </p>
          </div>
        </div>

        {/* Current Status Banner */}
        <div
          className={`my-4 p-4 rounded-xl border flex items-center justify-between gap-3 ${
            status?.configured && status?.activeModel
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : status?.configured
              ? 'bg-blue-50 border-blue-200 text-blue-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full shrink-0 ${
                status?.configured && status?.activeModel
                  ? 'bg-emerald-500'
                  : status?.configured
                  ? 'bg-blue-500'
                  : 'bg-amber-500 animate-pulse'
              }`}
            />
            <div>
              <div className="text-xs font-bold">
                {status?.configured && status?.activeModel
                  ? 'Personal API Key Active & Engine Verified'
                  : status?.configured
                  ? 'Personal API Key Configured (Awaiting Model Activation)'
                  : 'No Personal API Key Configured'}
              </div>
              <div className="text-[11px] text-slate-600">
                Active Engine:{' '}
                {status?.configured && status?.activeModel ? (
                  <span className="font-mono font-semibold text-emerald-800 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                    {status.activeModel}
                  </span>
                ) : (
                  <span className="font-mono italic text-slate-500">
                    {status?.configured ? 'None (Test and activate a model below)' : 'None (API key required)'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {status?.configured && (
            <button
              type="button"
              disabled={savingKey || testingModel || activatingModel}
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 shadow-xs transition-colors shrink-0"
              title="Remove your API key and active model"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              Remove Key
            </button>
          )}
        </div>

        {/* Action & Notification Messages */}
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
            <div className="break-all leading-relaxed flex-1">
              {testResult.modelId && (
                <div className="font-mono font-semibold mb-0.5">[{testResult.modelId}]</div>
              )}
              {testResult.message}
            </div>
          </div>
        )}

        {/* Form: API Key Input & Saved Key Status */}
        <div className="space-y-4">
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
                Get a free key from Google AI Studio
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Saved Key Indicator Pill */}
            {status?.configured && (
              <div className="mb-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-slate-600 font-medium">Active Saved Key:</span>
                  <span className="font-mono font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {status.maskedKey || 'AIza••••••••••••'}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Durable in Backend
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  id="gemini_api_key_input"
                  name="gemini_api_key_input"
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  spellCheck={false}
                  autoCorrect="off"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={
                    status?.configured
                      ? 'Leave empty to use saved key, or paste new key to update...'
                      : 'AIzaSy... (Paste your Google Gemini API key)'
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {apiKeyInput.trim().length >= 10 && !inputContainsBullets && (
                <button
                  type="button"
                  disabled={savingKey}
                  onClick={() => handleSaveKey()}
                  className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-xl text-xs font-semibold shrink-0 transition-colors shadow-xs"
                  title="Save new key to session and database"
                >
                  {savingKey ? 'Saving...' : 'Save Key'}
                </button>
              )}
            </div>

            {/* Clear, distinct status helpers */}
            {apiKeyInput.trim().length > 0 && !inputContainsBullets && (
              <p className="mt-1 text-[11px] text-indigo-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Unsaved key in field — Click &quot;Save Key&quot; or &quot;Test Model&quot; to persist and verify it.
              </p>
            )}

            {apiKeyInput.trim().length === 0 && status?.configured && (
              <p className="mt-1 text-[11px] text-slate-500">
                ✓ Using saved backend key ({status.maskedKey}). Leaving this field empty preserves your saved key.
              </p>
            )}

            {inputContainsBullets && (
              <p className="mt-1 text-[11px] text-amber-700">
                ⚠️ The input contains masked characters (•). Please clear the field to use your saved key, or paste a real key copied from Google AI Studio.
              </p>
            )}
          </div>

          {/* Section: Predefined Model Candidates & Individual Testing */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                Select & Test Candidate Models
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                {PREDEFINED_GEMINI_MODELS.length} Predefined Models
              </span>
            </div>

            {/* Model Selection Dropdown (Predefined List Loaded Immediately) */}
            <select
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                setTestResult(null);
                setActionMessage(null);
              }}
              disabled={testingModel || activatingModel}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors disabled:opacity-60"
            >
              {PREDEFINED_GEMINI_MODELS.map((m: PredefinedGeminiModel) => {
                const record = modelTestResults[m.id];
                const statusTag =
                  record?.status === 'passed'
                    ? ' [✓ Passed]'
                    : record?.status === 'quota_exceeded'
                    ? ' [⚠️ 429 Quota Exceeded]'
                    : record?.status === 'invalid_key'
                    ? ' [❌ Invalid Key]'
                    : record?.status === 'model_not_found'
                    ? ' [⚠️ 404 Not Found]'
                    : record?.status === 'permission_denied'
                    ? ' [⚠️ 403 Forbidden]'
                    : record?.status === 'network_error'
                    ? ' [⚠️ Timeout / Network Error]'
                    : record?.status === 'server_error'
                    ? ' [⚠️ Server Error]'
                    : record?.status === 'request_error'
                    ? ' [⚠️ Error]'
                    : '';
                const activeTag = status?.activeModel === m.id ? ' (ACTIVE)' : '';
                return (
                  <option key={m.id} value={m.id}>
                    {m.name} {activeTag}
                    {statusTag}
                  </option>
                );
              })}
            </select>

            {/* Selected Model Details & Status Card */}
            {selectedModelCandidate && (
              <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{selectedModelCandidate.name}</span>
                    <span className="font-mono text-[11px] text-slate-500">({selectedModelCandidate.id})</span>
                    {selectedModelCandidate.badge && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {selectedModelCandidate.badge}
                      </span>
                    )}
                  </div>
                  <div>{getStatusBadge(currentModelTest?.status)}</div>
                </div>

                <p className="text-slate-600 text-[11px] leading-relaxed mb-3">
                  {selectedModelCandidate.description}
                </p>

                {/* Per-model status message if tested */}
                {currentModelTest && currentModelTest.status !== 'passed' && (
                  <div className="mb-3 p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                    <strong className="font-semibold">Test Result: </strong>
                    {currentModelTest.message}
                  </div>
                )}

                {/* Test & Activate Action Buttons for Selected Model */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={testingModel || (!apiKeyInput.trim() && !status?.configured)}
                      onClick={handleTestModel}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors shadow-xs disabled:opacity-50"
                      title={`Send a real verification ping to ${selectedModel}`}
                    >
                      {testingModel ? (
                        <>
                          <Clock className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                          Testing Model...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                          Test Model
                        </>
                      )}
                    </button>
                    {rateLimitRemaining > 0 && (
                      <span className="text-[11px] text-amber-700 font-medium">
                        Cooldown: {rateLimitRemaining}s
                      </span>
                    )}
                  </div>

                  <div>
                    {isSelectedModelActive ? (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-100/80 border border-emerald-300 rounded-lg">
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        Currently Active Engine
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={activatingModel || !isSelectedModelPassed}
                        onClick={handleActivateModel}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        title={
                          isSelectedModelPassed
                            ? `Set ${selectedModel} as the authoritative compliance engine`
                            : 'Model must pass generation test before activation'
                        }
                      >
                        {activatingModel ? (
                          <>
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            Activating...
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            Activate Model
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Diagnostic Endpoint Toggle (Internal Backend Diagnostic via GET /v1beta/models) */}
          {status?.configured && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  if (!showDiagnostics && !diagnosticsResult) {
                    handleRunDiagnostics();
                  } else {
                    setShowDiagnostics(!showDiagnostics);
                  }
                }}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 font-medium transition-colors"
              >
                <Activity className="w-3.5 h-3.5 text-indigo-500" />
                {runningDiagnostics
                  ? 'Querying Google models list API...'
                  : showDiagnostics
                  ? 'Hide Google Project Diagnostics'
                  : 'Check Google Project Model Access (Diagnostics)'}
              </button>

              {showDiagnostics && diagnosticsResult && (
                <div className="mt-2 p-3 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono max-h-48 overflow-y-auto">
                  {diagnosticsResult.error ? (
                    <div className="text-rose-400">Diagnostic error: {diagnosticsResult.error}</div>
                  ) : (
                    <div>
                      <div className="text-emerald-400 mb-1">
                        ✓ Connected to Google AI Studio ({diagnosticsResult.generateContentModelsCount} models support generateContent)
                      </div>
                      {diagnosticsResult.liveGenerationTest && (
                        <div className="my-2 p-2 rounded bg-slate-800 text-[11px] border border-slate-700">
                          <div className="font-semibold text-slate-300">Live Provider Generation Test:</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span>Candidate: [{diagnosticsResult.liveGenerationTest.candidateId}]</span>
                            <span className={diagnosticsResult.liveGenerationTest.generationSucceeded ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                              {diagnosticsResult.liveGenerationTest.generationSucceeded
                                ? '✓ Generation Succeeded (HTTP 200)'
                                : `✗ Failed (HTTP ${diagnosticsResult.liveGenerationTest.httpStatus})`}
                            </span>
                          </div>
                          <div className="text-slate-400 text-[10px] mt-0.5">{diagnosticsResult.liveGenerationTest.message}</div>
                        </div>
                      )}
                      <div className="text-[11px] text-slate-400 mb-2">Predefined Candidate Verification:</div>
                      {diagnosticsResult.predefinedCandidates?.map((pc: any) => (
                        <div key={pc.id} className="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-800">
                          <span>{pc.id}</span>
                          <span className={pc.accessible ? 'text-emerald-400' : 'text-amber-400'}>
                            {pc.accessible ? 'Accessible' : 'Not in project list'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Security & Isolation Callout */}
        <div className="mt-6 pt-5 border-t border-slate-200 text-xs text-slate-500 space-y-2">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Security & Compliance Architecture:
          </div>
          <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-600 leading-relaxed">
            <li>
              <strong className="text-slate-800">Predefined Models:</strong> Official Gemini models loaded instantly from configuration. The UI does not depend on dynamic external discovery.
            </li>
            <li>
              <strong className="text-slate-800">Independent Testing:</strong> Each model is tested individually with a real generation request. Failures never remove candidate models.
            </li>
            <li>
              <strong className="text-slate-800">Gated Activation:</strong> A model can only be activated after it has passed a real generation test.
            </li>
            <li>
              <strong className="text-slate-800">Deterministic Checks Always Run:</strong> Prohibited terms and required disclaimers always execute reliably even if Gemini is unavailable.
            </li>
            <li>
              <strong className="text-slate-800">Encrypted Persistence:</strong> Keys are encrypted at rest with AES-256-GCM in MongoDB Atlas and never exposed in browser storage or plaintext responses.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
