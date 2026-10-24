import React, { useState } from 'react';
import { Finding, UserRole } from '../../types';
import { FindingTypeBadge, SeverityBadge, FindingStatusBadge } from '../../components/Badge';
import { Copy, Check, CheckCircle, XCircle, ArrowRight, BookOpen, Sparkles } from 'lucide-react';

interface FindingCardProps {
  finding: Finding;
  userRole: UserRole;
  onStatusChange?: (findingId: string, newStatus: 'accepted' | 'rejected' | 'open') => Promise<void>;
  onApplySuggestion?: (oldText: string, newText: string) => void;
}

export const FindingCard: React.FC<FindingCardProps> = ({
  finding,
  userRole,
  onStatusChange,
  onApplySuggestion,
}) => {
  const [copied, setCopied] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCopy = () => {
    if (finding.suggestedCorrection) {
      navigator.clipboard.writeText(finding.suggestedCorrection);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAction = async (status: 'accepted' | 'rejected') => {
    if (!onStatusChange) return;
    setIsUpdating(true);
    try {
      await onStatusChange(finding.id, status);
    } finally {
      setIsUpdating(false);
    }
  };

  const isReviewer = userRole === 'reviewer' || userRole === 'admin';

  // Distinct styling based on finding type
  const isRuleViolation = finding.type === 'Rule Violation';

  return (
    <div
      className={`rounded-xl border transition-all p-5 shadow-xs ${
        isRuleViolation
          ? 'bg-white border-rose-200 hover:border-rose-300'
          : finding.type === 'Potential Concern'
          ? 'bg-white border-amber-200 hover:border-amber-300'
          : 'bg-white border-violet-200 hover:border-violet-300'
      }`}
    >
      {/* Top Header: Type badge, Severity, Finding Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <FindingTypeBadge type={finding.type} />
          <SeverityBadge severity={finding.severity} />
        </div>
        <FindingStatusBadge status={finding.status} />
      </div>

      {/* Title */}
      <h4 className="text-base font-semibold text-slate-900 mb-2 flex items-center gap-2">
        {finding.title}
      </h4>

      {/* Quoted Text */}
      <div className="mb-3.5 bg-slate-50 rounded-lg p-3 border border-slate-200">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1 flex items-center gap-1.5">
          <span>Quoted Passage in Draft:</span>
        </div>
        <p className="font-mono text-sm text-amber-900 bg-amber-100/80 px-2 py-1 rounded inline-block border border-amber-200">
          "{finding.quotedText}"
        </p>
      </div>

      {/* Explanation */}
      <p className="text-sm text-slate-600 leading-relaxed mb-3.5">
        {finding.explanation}
      </p>

      {/* Associated Guideline if available */}
      {finding.guidelineTitle && (
        <div className="flex items-center gap-2 text-xs text-slate-600 mb-3.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>Guideline:</span>
          <span className="font-medium text-slate-900">{finding.guidelineTitle}</span>
        </div>
      )}

      {/* Suggested Correction Section */}
      {finding.suggestedCorrection && (
        <div className="mt-4 pt-3.5 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-600" />
              Suggested Correction:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-md transition-colors border border-slate-200"
                title="Copy suggested correction to clipboard"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>

              {onApplySuggestion && (
                <button
                  type="button"
                  onClick={() => onApplySuggestion(finding.quotedText, finding.suggestedCorrection || '')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors border border-indigo-200"
                  title="Apply replacement to draft editor"
                >
                  <ArrowRight className="w-3 h-3" />
                  Apply
                </button>
              )}
            </div>
          </div>
          <div className="text-sm bg-emerald-50/70 p-2.5 rounded-md text-emerald-900 font-mono border border-emerald-200">
            {finding.suggestedCorrection}
          </div>
        </div>
      )}

      {/* Human Reviewer Actions (Accept / Reject suggestion) */}
      {onStatusChange && (
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {isReviewer ? (
              <span className="text-indigo-600 font-medium">Reviewer Decision Action:</span>
            ) : (
              <span className="text-slate-400">Switch to Reviewer role above to record decision</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!isReviewer || isUpdating || finding.status === 'accepted'}
              onClick={() => handleAction('accepted')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                finding.status === 'accepted'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default'
                  : isReviewer
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60 border border-slate-200'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Accept
            </button>

            <button
              type="button"
              disabled={!isReviewer || isUpdating || finding.status === 'rejected'}
              onClick={() => handleAction('rejected')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                finding.status === 'rejected'
                  ? 'bg-rose-100 text-rose-800 border border-rose-300 cursor-default'
                  : isReviewer
                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 shadow-xs'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60 border border-slate-200'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
