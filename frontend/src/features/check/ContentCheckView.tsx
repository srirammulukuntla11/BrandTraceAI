import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getStoredRole } from '../../lib/api';
import { Finding, IContentItem, UserRole } from '../../types';
import { FindingCard } from '../findings/FindingCard';
import { AiConfigModal } from '../../components/AiConfigModal';
import { applyFindingCorrection } from '../../lib/correctionApplier';
import {
  Sparkles,
  Send,
  AlertCircle,
  FileCheck2,
  Wand2,
  Clock,
  ExternalLink,
  RotateCcw,
  Key,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const SAMPLE_DRAFT_WITH_VIOLATIONS = `Introducing the bot! Our team is proud to launch this cheap tool today.
It guarantees 100% bug-free operation and guaranteed zero errors across all your workflows.
Buy right now or regret it before the offer expires!
Our AI script has processed over 100 million compliance checks with absolute perfection.`;

export const ContentCheckView: React.FC = () => {
  const navigate = useNavigate();
  const [userRole] = useState<UserRole>(getStoredRole());
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState('social_post');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyFeedback, setApplyFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  // Results state
  const [submittedItem, setSubmittedItem] = useState<IContentItem | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [aiStatus, setAiStatus] = useState<{ available: boolean; message?: string; model?: string } | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Filters and expansion for findings
  const [activeFilter, setActiveFilter] = useState<'all' | 'rule' | 'concern' | 'verification'>('all');
  const [allExpanded, setAllExpanded] = useState<boolean | undefined>(undefined);

  const handleLoadSample = () => {
    setTitle('Product Launch Social Announcement');
    setContentType('social_post');
    setText(SAMPLE_DRAFT_WITH_VIOLATIONS);
    setError(null);
  };

  const handleClear = () => {
    setTitle('');
    setText('');
    setError(null);
    setApplyFeedback(null);
    setSubmittedItem(null);
    setFindings([]);
    setAiStatus(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError('Please enter or paste your written content draft.');
      return;
    }
    if (text.length > 50000) {
      setError('Draft exceeds maximum limit of 50,000 characters.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await api.submitDraft(
        title.trim() || `Draft - ${new Date().toLocaleTimeString()}`,
        text,
        contentType
      );

      setSubmittedItem(response.item);
      const v1 = response.item.versions[0];
      setFindings(v1.findings || []);
      setAiStatus(v1.aiStatus || null);
    } catch (err: any) {
      setError(err.message || 'Submission failed. Please check backend connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFindingStatusChange = async (findingId: string, newStatus: 'accepted' | 'rejected' | 'open') => {
    if (!submittedItem) return;
    try {
      const updated = await api.updateFindingStatus(
        submittedItem.id || submittedItem._id || '',
        submittedItem.currentVersion,
        findingId,
        newStatus
      );
      setSubmittedItem(updated.item);
      const currentVer = updated.item.versions.find((v) => v.versionNumber === updated.item.currentVersion);
      if (currentVer) {
        setFindings(currentVer.findings);
      }
    } catch (err: any) {
      alert(`Could not update finding: ${err.message}`);
    }
  };

  const handleApplySuggestion = (findingOrOldText: Finding | string, maybeNewText?: string) => {
    let targetFinding: Partial<Finding>;
    if (typeof findingOrOldText === 'string') {
      targetFinding = {
        quotedText: findingOrOldText,
        suggestedCorrection: maybeNewText,
      };
    } else {
      targetFinding = findingOrOldText;
    }

    const result = applyFindingCorrection(text, targetFinding);
    if (!result.success) {
      setApplyFeedback({ type: 'error', message: result.message });
      return;
    }

    // Immediately update draft editor text
    setText(result.updatedText);
    if (error) setError(null);

    // If change was made and finding has an ID, mark finding as accepted
    if (targetFinding.id) {
      setFindings((prev) =>
        prev.map((f) => (f.id === targetFinding.id ? { ...f, status: 'accepted' as const } : f))
      );
    }

    setApplyFeedback({
      type: result.changeType === 'already_applied' ? 'info' : 'success',
      message: result.message,
    });
  };

  const filteredFindings = findings.filter((f) => {
    if (activeFilter === 'rule') return f.type === 'Rule Violation';
    if (activeFilter === 'concern') return f.type === 'Potential Concern';
    if (activeFilter === 'verification') return f.type === 'Needs Verification';
    return true;
  });

  const ruleCount = findings.filter((f) => f.type === 'Rule Violation').length;
  const concernCount = findings.filter((f) => f.type === 'Potential Concern').length;
  const verificationCount = findings.filter((f) => f.type === 'Needs Verification').length;

  return (
    <div className="max-w-7xl xl:max-w-[1440px] 2xl:max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            New Content Compliance Check
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Submit draft copy to run instant deterministic rule validation and explainable AI tone/claims analysis.
          </p>
        </div>

        {/* Quick Sample Button */}
        <button
          type="button"
          onClick={handleLoadSample}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 shadow-xs transition-all hover:scale-[1.02] shrink-0"
        >
          <Wand2 className="w-4 h-4 text-indigo-600" />
          Load Sample Draft (With Violations)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: Draft Input Form (Sticky on desktop so no empty space appears while reviewing findings) */}
        <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-5 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
            {/* Title & Content Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Draft Title (Optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q1 Product Launch Social Copy"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-indigo-600 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Content Type
                </label>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-hidden focus:border-indigo-600 focus:bg-white transition-colors"
                >
                  <option value="social_post">Social Media Post</option>
                  <option value="ad_copy">Advertising Copy</option>
                  <option value="blog_post">Blog / Article</option>
                  <option value="website">Web Landing Page</option>
                  <option value="press_release">Press Release</option>
                  <option value="email">Email Campaign</option>
                </select>
              </div>
            </div>

            {/* Content Textarea */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Written Content Draft
                </label>
                <span className={`text-xs ${text.length > 48000 ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
                  {text.length.toLocaleString()} / 50,000 characters
                </span>
              </div>

              <textarea
                rows={12}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Paste or write your marketing copy, social draft, or announcement here..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-4 text-sm text-slate-900 placeholder-slate-400 font-mono leading-relaxed focus:outline-hidden focus:border-indigo-600 focus:bg-white transition-colors resize-y"
              />
            </div>

            {/* Apply Feedback notification banner */}
            {applyFeedback && (
              <div
                className={`mb-4 flex items-center justify-between gap-2.5 p-3.5 rounded-xl border text-xs transition-all ${
                  applyFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : applyFeedback.type === 'info'
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {applyFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : applyFeedback.type === 'info' ? (
                    <Sparkles className="w-4 h-4 shrink-0 text-blue-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  )}
                  <span className="font-medium">{applyFeedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setApplyFeedback(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs px-1 font-bold"
                  title="Dismiss notification"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="mb-4 flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !text.trim()}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin text-indigo-200" />
                    Checking Compliance...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Run Compliance Check & Submit
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Compliance Architecture Notice */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 text-xs text-slate-600 leading-relaxed shadow-xs">
            <h5 className="font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-indigo-600" />
              How Brand Compliance Verification Works:
            </h5>
            <ul className="list-disc pl-4 space-y-1.5 text-slate-600">
              <li><strong className="text-rose-700">Deterministic Rules:</strong> Prohibited terms and missing required disclaimers run strictly via reproducible code.</li>
              <li><strong className="text-violet-700">Gemini AI Analysis:</strong> Evaluates subtle tone, messaging inconsistencies, and claims requiring verification.</li>
              <li><strong className="text-slate-800">Human Decision:</strong> Suggestions are never applied automatically; only authorized reviewers make final approval decisions.</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Findings & Results Panel (Full width of available 7 columns) */}
        <div className="lg:col-span-7 xl:col-span-7 flex flex-col gap-4">
          {!submittedItem && !isSubmitting && (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[460px] shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 text-indigo-600">
                <FileCheck2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">No Compliance Check Performed Yet</h3>
              <p className="text-sm text-slate-500 max-w-sm mb-6">
                Paste draft copy on the left or click "Load Sample Draft" to test deterministic and AI compliance checking.
              </p>
              <button
                type="button"
                onClick={handleLoadSample}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors"
              >
                Click to Load Sample Draft with Violations
              </button>
            </div>
          )}

          {isSubmitting && (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[460px] shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 text-indigo-600 animate-pulse">
                <Sparkles className="w-8 h-8 animate-spin" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Analyzing Brand Compliance...</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Running deterministic terminology checks, inspecting disclaimers, and validating brand voice.
              </p>
            </div>
          )}

          {submittedItem && !isSubmitting && (
            <div className="flex flex-col gap-4">
              {/* Submission Header & History Link */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                      Version {submittedItem.currentVersion} Created
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">{submittedItem.title}</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/history/${submittedItem.id || submittedItem._id}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                  >
                    View Version History & Decisions
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* AI Status Notification */}
                {aiStatus && !aiStatus.available && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 mb-3">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <strong className="font-semibold text-amber-900">
                        {/rate limit|quota|429/i.test(aiStatus.message || '')
                          ? 'Gemini Rate Limit / Quota Exceeded (429): '
                          : /No personal Gemini API key/i.test(aiStatus.message || '')
                          ? 'Personal Gemini Key Required: '
                          : /No active Gemini model/i.test(aiStatus.message || '')
                          ? 'Model Activation Required: '
                          : 'Contextual AI Analysis Unavailable: '}
                      </strong>
                      <span className="text-slate-700">{aiStatus.message}</span>
                      <p className="text-slate-600 mt-1 font-medium">
                        ✓ Deterministic rule checking is 100% active and all explicit violations below are verified.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsAiModalOpen(true)}
                        className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-amber-900 border border-amber-300 hover:bg-amber-100/60 shadow-xs transition-colors"
                      >
                        <Key className="w-3.5 h-3.5 text-amber-700" />
                        Configure & Test Gemini Models
                      </button>
                    </div>
                  </div>
                )}

                {aiStatus && aiStatus.available && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>
                        <strong className="font-semibold">AI Analysis Complete: </strong>
                        Evaluated with active model <span className="font-mono font-bold text-emerald-800">{aiStatus.model}</span>.
                      </span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                      Verified Active
                    </span>
                  </div>
                )}

                {/* Finding Filter Tabs and Expand All Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        activeFilter === 'all'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({findings.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveFilter('rule')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        activeFilter === 'rule'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:text-rose-700'
                      }`}
                    >
                      Violations ({ruleCount})
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveFilter('concern')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        activeFilter === 'concern'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:text-amber-700'
                      }`}
                    >
                      Concerns ({concernCount})
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveFilter('verification')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        activeFilter === 'verification'
                          ? 'bg-violet-50 text-violet-700 border border-violet-200 shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:text-violet-700'
                      }`}
                    >
                      Needs Verification ({verificationCount})
                    </button>
                  </div>

                  {filteredFindings.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAllExpanded((prev) => !prev)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors ml-auto"
                      title={allExpanded ? 'Collapse all finding details' : 'Expand all finding details'}
                    >
                      {allExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>{allExpanded ? 'Collapse Details' : 'Expand All Details'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Findings List */}
              {filteredFindings.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 border ${
                      findings.length === 0 && aiStatus && !aiStatus.available
                        ? 'bg-amber-50 text-amber-600 border-amber-200'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}
                  >
                    {findings.length === 0 && aiStatus && !aiStatus.available ? (
                      <AlertCircle className="w-6 h-6" />
                    ) : (
                      <FileCheck2 className="w-6 h-6" />
                    )}
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 mb-1">
                    {findings.length === 0
                      ? aiStatus && !aiStatus.available
                        ? 'Deterministic Rules Passed (AI Analysis Incomplete)'
                        : 'No Compliance Violations Detected'
                      : 'No Findings in this Category'}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {findings.length === 0
                      ? aiStatus && !aiStatus.available
                        ? 'No deterministic rule violations were found in this draft. AI tone and claims analysis was skipped or encountered an error (see details above).'
                        : 'The submitted draft passed all active brand compliance rules and AI tone checks.'
                      : 'Try switching the filter tabs above to view other findings.'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredFindings.map((finding) => (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      userRole={userRole}
                      onStatusChange={handleFindingStatusChange}
                      onApplySuggestion={handleApplySuggestion}
                      forceExpand={allExpanded}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Key Configuration Modal */}
      <AiConfigModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />
    </div>
  );
};
