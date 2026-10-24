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
      className={`rounded-xl border transition-all p-5 ${
        isRuleViolation
          ? 'bg-slate-900/90 border-rose-900/40 hover:border-rose-700/60 shadow-sm'
          : finding.type === 'Potential Concern'
          ? 'bg-slate-900/90 border-amber-900/40 hover:border-amber-700/60 shadow-sm'
          : 'bg-slate-900/90 border-cyan-900/40 hover:border-cyan-700/60 shadow-sm'
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
      <h4 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
        {finding.title}
      </h4>

      {/* Quoted Text */}
      <div className="mb-3.5 bg-slate-950/90 rounded-lg p-3 border border-slate-800">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
          <span>Quoted Passage in Draft:</span>
        </div>
        <p className="font-mono text-sm text-amber-200/90 bg-amber-950/30 px-2 py-1 rounded inline-block">
          "{finding.quotedText}"
        </p>
      </div>

      {/* Explanation */}
      <p className="text-sm text-slate-300 leading-relaxed mb-3.5">
        {finding.explanation}
      </p>

      {/* Associated Guideline if available */}
      {finding.guidelineTitle && (
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-3.5 bg-slate-800/40 px-3 py-1.5 rounded-lg border border-slate-700/40">
          <BookOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>Guideline:</span>
          <span className="font-medium text-slate-200">{finding.guidelineTitle}</span>
        </div>
      )}

      {/* Suggested Correction Section */}
      {finding.suggestedCorrection && (
        <div className="mt-4 pt-3.5 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Suggested Correction:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-md transition-colors"
                title="Copy suggested correction to clipboard"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>

              {onApplySuggestion && (
                <button
                  type="button"
                  onClick={() => onApplySuggestion(finding.quotedText, finding.suggestedCorrection || '')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-300 bg-blue-900/40 hover:bg-blue-800/60 rounded-md transition-colors border border-blue-700/40"
                  title="Apply replacement to draft editor"
                >
                  <ArrowRight className="w-3 h-3" />
                  Apply
                </button>
              )}
            </div>
          </div>
          <div className="text-sm bg-slate-950 p-2.5 rounded-md text-emerald-300/90 font-mono border border-slate-800/60">
            {finding.suggestedCorrection}
          </div>
        </div>
      )}

      {/* Human Reviewer Actions (Accept / Reject suggestion) */}
      {onStatusChange && (
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {isReviewer ? (
              <span className="text-blue-400 font-medium">Reviewer Decision Action:</span>
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
                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 cursor-default'
                  : isReviewer
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'
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
                  ? 'bg-rose-600/30 text-rose-300 border border-rose-500/50 cursor-default'
                  : isReviewer
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'
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
