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
} from 'lucide-react';

interface AiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (status: AiConfigStatus) => void;
}

export const AiConfigModal: React.FC<AiConfigModalProps> = ({
  isOpen,
  onClose,
  onStatusChange,
}) => {
  const [status, setStatus] = useState<AiConfigStatus | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await api.getAiConfig();
      setStatus(res);
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
      const res = await api.saveAiKey(apiKeyInput.trim());
      setActionMessage(res.message);
      setApiKeyInput('');
      await fetchStatus();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Failed to save key' });
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
      const res = await api.testAiKey(keyToTest);
      setTestResult({ success: true, message: res.message });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Verification failed' });
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
      await fetchStatus();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Failed to remove key' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Personal Gemini AI Configuration
            </h2>
            <p className="text-xs text-slate-400">
              Configure your own Google Gemini API key to enable brand tone and claim analysis.
            </p>
          </div>
        </div>

        {/* Current Status Banner */}
        <div className="my-5 p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-full ${
                status?.configured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <div>
              <div className="text-xs font-semibold text-white">
                {status?.configured
                  ? 'Personal API Key Active (User-Scoped)'
                  : 'No Personal API Key Configured'}
              </div>
              <div className="text-[11px] text-slate-400">
                Model: <span className="font-mono text-cyan-300">{status?.model || 'gemini-1.5-flash'}</span>
              </div>
            </div>
          </div>

          {status?.configured && (
            <button
              type="button"
              disabled={loading}
              onClick={handleDelete}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors"
              title="Remove your API key from session memory"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove Key
            </button>
          )}
        </div>

        {/* Success / Error Notifications */}
        {actionMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{actionMessage}</span>
          </div>
        )}

        {testResult && (
          <div
            className={`mb-4 p-3 rounded-xl border text-xs flex items-start gap-2 ${
              testResult.success
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            )}
            <div className="break-all">{testResult.message}</div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Gemini API Key
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
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
                placeholder={status?.configured ? '•••••••••••••••••••••••••••••• (Key saved in session)' : 'AIzaSy...'}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              disabled={loading || (!apiKeyInput.trim() && !status?.configured)}
              onClick={handleTest}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors disabled:opacity-50"
            >
              {loading ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
              Test Connection
            </button>

            <button
              type="submit"
              disabled={loading || !apiKeyInput.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl shadow-lg shadow-cyan-600/20 transition-all disabled:opacity-50"
            >
              Save & Activate Key
            </button>
          </div>
        </form>

        {/* Security & Isolation Callout */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 text-xs text-slate-400 space-y-2">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Security & Privacy Protections:
          </div>
          <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-400">
            <li>
              <strong className="text-slate-300">User-Scoped Session Storage:</strong> Your API key is scoped strictly to your account and stored only in backend memory. Other users cannot access or use your key.
            </li>
            <li>
              <strong className="text-slate-300">Zero Browser LocalStorage:</strong> Your key is never stored in browser storage, never sent in GET responses, and never logged.
            </li>
            <li>
              <strong className="text-slate-300">Deterministic Rules Always Run:</strong> Prohibited terms and disclaimer checks operate 100% even without a Gemini API key.
            </li>
            <li>
              <strong className="text-slate-300">Session Lifecycle:</strong> Keys are cleared upon server restart or when you click "Remove Key".
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
