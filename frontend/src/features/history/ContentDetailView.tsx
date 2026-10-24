import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, getStoredRole } from '../../lib/api';
import { IContentItem, UserRole } from '../../types';
import { ContentStatusBadge } from '../../components/Badge';
import { FindingCard } from '../findings/FindingCard';
import {
  ArrowLeft,
  Layers,
  CheckCircle,
  XCircle,
  FileText,
  Clock,
  Sparkles,
  Send,
  User,
  AlertCircle,
} from 'lucide-react';

export const ContentDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [userRole] = useState<UserRole>(getStoredRole());
  const [item, setItem] = useState<IContentItem | null>(null);
  const [selectedVersionNum, setSelectedVersionNum] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review Decision State
  const [reviewNotes, setReviewNotes] = useState('');
  const [isDeciding, setIsDeciding] = useState(false);
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null);

  // New Revision Form State
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionText, setRevisionText] = useState('');
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);

  const isReviewer = userRole === 'reviewer' || userRole === 'admin';

  const fetchItem = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.getContentItem(id);
      setItem(res.item);
      setSelectedVersionNum(res.item.currentVersion);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load content item');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItem();
  }, [id]);

  const activeVersion = item?.versions?.find((v) => v.versionNumber === selectedVersionNum);

  const handleDecision = async (decision: 'approved' | 'changes_required') => {
    if (!item || !id) return;
    if (!isReviewer) {
      alert('Access denied: Only reviewers and admins can record approval decisions.');
      return;
    }

    setIsDeciding(true);
    setDecisionFeedback(null);
    try {
      const res = await api.recordDecision(id, selectedVersionNum, decision, reviewNotes);
      setItem(res.item);
      setDecisionFeedback(`Decision recorded: ${decision.replace('_', ' ').toUpperCase()}`);
      setReviewNotes('');
    } catch (err: any) {
      setDecisionFeedback(`Error: ${err.message}`);
    } finally {
      setIsDeciding(false);
    }
  };

  const handleFindingStatusChange = async (findingId: string, status: 'accepted' | 'rejected' | 'open') => {
    if (!item || !id) return;
    try {
      const res = await api.updateFindingStatus(id, selectedVersionNum, findingId, status);
      setItem(res.item);
    } catch (err: any) {
      alert(`Could not update finding: ${err.message}`);
    }
  };

  const handleOpenRevision = () => {
    if (activeVersion) {
      setRevisionText(activeVersion.text);
      setShowRevisionForm(true);
    }
  };

  const handleRevisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionText.trim() || !id) {
      setRevisionError('Revision text cannot be empty.');
      return;
    }

    setIsSubmittingRevision(true);
    setRevisionError(null);
    try {
      const res = await api.submitRevision(id, revisionText);
      setItem(res.item);
      setSelectedVersionNum(res.item.currentVersion);
      setShowRevisionForm(false);
    } catch (err: any) {
      setRevisionError(err.message || 'Failed to submit revision');
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <Clock className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading submission audit data...</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm mb-4">
          {error || 'Content item not found.'}
        </div>
        <Link to="/history" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to History
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <Link
          to="/history"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Submission History
        </Link>

        <button
          type="button"
          onClick={handleOpenRevision}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all hover:shadow"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Submit Revision Version
        </button>
      </div>

      {/* Main Title Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {item.contentType}
              </span>
              <ContentStatusBadge status={item.status} />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">{item.title}</h1>
          </div>

          <div className="text-right text-xs text-slate-500">
            <div className="flex items-center gap-1 justify-end">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Created by: {item.createdBy?.name || 'Creator'}</span>
            </div>
            <div className="flex items-center gap-1 justify-end mt-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{new Date(item.createdAt || '').toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Chronological Version Switcher Tabs */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Preserved Audit Versions ({item.versions.length}):</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {item.versions.map((ver) => {
              const isSelected = ver.versionNumber === selectedVersionNum;
              return (
                <button
                  key={ver.versionNumber}
                  type="button"
                  onClick={() => setSelectedVersionNum(ver.versionNumber)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  <span>Version {ver.versionNumber}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      ver.status === 'approved'
                        ? 'bg-emerald-400'
                        : ver.status === 'changes_required'
                        ? 'bg-rose-400'
                        : 'bg-amber-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Revision Form Modal / Expander */}
      {showRevisionForm && (
        <div className="bg-white border border-indigo-200 rounded-2xl p-6 mb-8 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Submit Revision (Creates Version {(item.currentVersion || item.versions.length) + 1})
            </h3>
            <button
              type="button"
              onClick={() => setShowRevisionForm(false)}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-slate-500 mb-4">
            Edit your draft to resolve compliance findings. Your previous versions will remain completely preserved in the audit history.
          </p>

          {revisionError && (
            <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {revisionError}
            </div>
          )}

          <form onSubmit={handleRevisionSubmit}>
            <textarea
              rows={8}
              value={revisionText}
              onChange={(e) => setRevisionText(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-4 text-sm text-slate-900 font-mono leading-relaxed focus:outline-none focus:border-indigo-600 focus:bg-white mb-4"
            />

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRevisionForm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingRevision || !revisionText.trim()}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 shadow-xs"
              >
                {isSubmittingRevision ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    Submitting & Checking...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Submit Revision Version
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid: Left Draft Text & Human Decision, Right Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Active Version Text & Review Decision Card */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          {/* Active Version Draft Display */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                Version {selectedVersionNum} Content Draft
              </span>
              <span className="text-[11px] text-slate-500">
                Submitted: {activeVersion ? new Date(activeVersion.createdAt).toLocaleTimeString() : ''}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-sm text-slate-800 whitespace-pre-wrap leading-relaxed max-h-[420px] overflow-y-auto">
              {activeVersion?.text || '(Empty)'}
            </div>
          </div>

          {/* Human Review Decision Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Human Review Signoff
              </h3>
              <span className="text-xs text-slate-500 font-medium">Version {selectedVersionNum}</span>
            </div>

            {/* Existing Decision Record if any */}
            {activeVersion?.reviewDecision ? (
              <div className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600">Status:</span>
                    <ContentStatusBadge status={activeVersion.reviewDecision.decision} />
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {new Date(activeVersion.reviewDecision.decidedAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-slate-700">
                  <strong className="text-indigo-600">Reviewer: </strong>
                  {activeVersion.reviewDecision.reviewerName} ({activeVersion.reviewDecision.reviewerRole})
                </div>
                {activeVersion.reviewDecision.notes && (
                  <div className="text-xs text-slate-600 mt-2 bg-white p-2.5 rounded-lg border border-slate-200">
                    <strong className="text-slate-800">Notes: </strong>
                    {activeVersion.reviewDecision.notes}
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-4 text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200">
                Pending reviewer evaluation. The system never approves automatically.
              </div>
            )}

            {decisionFeedback && (
              <div className="mb-4 p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs">
                {decisionFeedback}
              </div>
            )}

            {/* Decision Input Controls */}
            {isReviewer ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reviewer Notes / Feedback
                </label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Provide guidance or rationale for changes required..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white mb-4"
                />

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isDeciding}
                    onClick={() => handleDecision('changes_required')}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors disabled:opacity-50 shadow-xs"
                  >
                    <XCircle className="w-4 h-4 text-rose-600" />
                    Request Changes
                  </button>

                  <button
                    type="button"
                    disabled={isDeciding}
                    onClick={() => handleDecision('approved')}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve Content
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800">Creator Role Active:</strong> Backend permissions strictly enforce that only reviewers can sign off on approval or request changes. Use the role switcher in the navbar to test reviewer actions.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Version Findings List */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-600" />
                Version {selectedVersionNum} Findings ({activeVersion?.findings?.length || 0})
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                {activeVersion?.findings?.filter((f) => f.type === 'Rule Violation').length} Violations
              </span>
            </div>

            {/* AI Status for this version */}
            {activeVersion?.aiStatus && !activeVersion.aiStatus.available && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  {activeVersion.aiStatus.message || 'AI analysis was unavailable for this version. Deterministic findings preserved.'}
                </span>
              </div>
            )}
          </div>

          {!activeVersion?.findings || activeVersion.findings.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-200">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-semibold text-slate-900 mb-1">Clean Compliance Check</h4>
              <p className="text-xs text-slate-500">
                No rule violations or concerns detected in Version {selectedVersionNum}.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {activeVersion.findings.map((f) => (
                <FindingCard
                  key={f.id}
                  finding={f}
                  userRole={userRole}
                  onStatusChange={handleFindingStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
