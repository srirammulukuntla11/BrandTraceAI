import React, { useState, useEffect } from 'react';
import { Finding, UserRole } from '../../types';
import { FindingTypeBadge, SeverityBadge, FindingStatusBadge } from '../../components/Badge';
import {
  Copy,
  Check,
  CheckCircle,
  XCircle,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';

interface FindingCardProps {
  finding: Finding;
  userRole: UserRole;
  onStatusChange?: (findingId: string, newStatus: 'accepted' | 'rejected' | 'open') => Promise<void>;
  onApplySuggestion?: (findingOrOldText: Finding | string, maybeNewText?: string) => void;
  forceExpand?: boolean;
}

export const FindingCard: React.FC<FindingCardProps> = ({
  finding,
  userRole,
  onStatusChange,
  onApplySuggestion,
  forceExpand,
}) => {
  const [copied, setCopied] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Sync with global Expand All / Collapse All when toggled from list header
  useEffect(() => {
    if (typeof forceExpand === 'boolean') {
      setIsExpanded(forceExpand);
    }
  }, [forceExpand]);

  const effectiveReplacement = finding.replacementText || finding.suggestedCorrection;
  const hasCorrection = Boolean(effectiveReplacement || finding.suggestedCorrection);

  const handleCopy = () => {
    const textToCopy = effectiveReplacement || finding.suggestedCorrection;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
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
  const isRuleViolation = finding.type === 'Rule Violation';
  const isConcern = finding.type === 'Potential Concern';

  return (
    <div
      className={`rounded-xl border bg-white transition-all shadow-xs hover:shadow-sm overflow-hidden ${
        isRuleViolation
          ? 'border-rose-200 border-l-4 border-l-rose-500'
          : isConcern
          ? 'border-amber-200 border-l-4 border-l-amber-500'
          : 'border-violet-200 border-l-4 border-l-violet-500'
      }`}
    >
      <div className="p-3 sm:p-3.5">
        {/* Row 1: Header - Type Badge, Severity, Finding Title, Status, Details Toggle */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <FindingTypeBadge type={finding.type} />
            <SeverityBadge severity={finding.severity} />
            <h4
              className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md md:max-w-lg"
              title={finding.title}
            >
              {finding.title}
            </h4>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <FindingStatusBadge status={finding.status} />

            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Hide finding details' : 'Show finding details'}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors"
              title={isExpanded ? 'Collapse additional explanation & source' : 'Expand full explanation & guideline source'}
            >
              <span>{isExpanded ? 'Less' : 'Details'}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Row 2: Problem Text & Suggested Correction Strip with Instant Action Controls */}
        <div className="mt-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          {/* Quoted problematic passage -> suggested replacement */}
          <div className="flex flex-wrap items-center gap-2 text-xs min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 shrink-0">
                Draft:
              </span>
              <span
                className="font-mono text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200/90 font-medium truncate max-w-[200px] sm:max-w-xs"
                title={`Flagged draft text: "${finding.quotedText}"`}
              >
                "{finding.quotedText}"
              </span>
            </div>

            {hasCorrection && (
              <div className="flex items-center gap-1.5 min-w-0">
                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 shrink-0">
                  Fix:
                </span>
                <span
                  className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 font-semibold truncate max-w-[220px] sm:max-w-sm"
                  title={`Suggested replacement: "${effectiveReplacement}"`}
                >
                  {finding.actionType === 'insert'
                    ? `+ "${effectiveReplacement}"`
                    : finding.actionType === 'remove'
                    ? `[Remove]`
                    : `"${effectiveReplacement}"`}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons: Apply, Copy, Accept, Reject */}
          <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
            {onApplySuggestion && hasCorrection && (
              <button
                type="button"
                onClick={() => onApplySuggestion(finding)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors shrink-0"
                title="Apply replacement directly into draft editor"
              >
                <ArrowRight className="w-3 h-3" />
                Apply
              </button>
            )}

            {hasCorrection && (
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-md transition-colors border border-slate-200 shrink-0"
                title="Copy suggested replacement text to clipboard"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}

            {onStatusChange && (
              <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-slate-200">
                <button
                  type="button"
                  disabled={!isReviewer || isUpdating || finding.status === 'accepted'}
                  onClick={() => handleAction('accepted')}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md transition-all ${
                    finding.status === 'accepted'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default'
                      : isReviewer
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 shadow-xs'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60 border border-slate-200'
                  }`}
                  title={
                    isReviewer
                      ? 'Accept this suggested finding'
                      : 'Switch to Reviewer role above to record approval decisions'
                  }
                >
                  <CheckCircle className="w-3 h-3" />
                  Accept
                </button>

                <button
                  type="button"
                  disabled={!isReviewer || isUpdating || finding.status === 'rejected'}
                  onClick={() => handleAction('rejected')}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md transition-all ${
                    finding.status === 'rejected'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300 cursor-default'
                      : isReviewer
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 shadow-xs'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60 border border-slate-200'
                  }`}
                  title={
                    isReviewer
                      ? 'Reject this suggested finding'
                      : 'Switch to Reviewer role above to record approval decisions'
                  }
                >
                  <XCircle className="w-3 h-3" />
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Expandable Progressive-Disclosure Details Section */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs flex flex-col gap-2.5 bg-slate-50/80 -mx-3 sm:-mx-3.5 -mb-3 sm:-mb-3.5 p-3 sm:p-3.5">
            {/* Full Explanation */}
            <div>
              <span className="font-semibold text-slate-700 block mb-0.5">Explanation & Context:</span>
              <p className="text-slate-600 leading-relaxed text-xs">
                {finding.explanation}
              </p>
            </div>

            {/* Full Correction instruction (if different from bare replacement) */}
            {finding.suggestedCorrection && finding.suggestedCorrection !== effectiveReplacement && (
              <div>
                <span className="font-semibold text-slate-700 block mb-0.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-violet-600" />
                  Full Suggestion Instruction:
                </span>
                <div className="p-2 rounded bg-white border border-slate-200 font-mono text-xs text-slate-800">
                  {finding.suggestedCorrection}
                </div>
              </div>
            )}

            {/* Guideline / Source Rule Metadata */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-slate-500 pt-1">
              {finding.guidelineTitle && (
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Rule Source:</span>
                  <span className="font-medium text-slate-800">{finding.guidelineTitle}</span>
                </div>
              )}

              {finding.guidelineId && (
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <span>Guideline ID:</span>
                  <code className="text-slate-600">{finding.guidelineId}</code>
                </div>
              )}

              {finding.actionType && (
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <span>Action:</span>
                  <span className="font-mono text-slate-700 font-semibold">{finding.actionType}</span>
                </div>
              )}
            </div>

            {/* Helpful note if user is not in reviewer role */}
            {!isReviewer && onStatusChange && (
              <div className="text-[11px] text-slate-400 italic">
                * Note: Accept and Reject decision buttons require Reviewer permissions. Switch to Reviewer in the top bar to record official signoffs.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
