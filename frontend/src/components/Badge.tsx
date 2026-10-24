import React from 'react';
import { FindingType, Severity, ContentStatus, FindingStatus } from '../types';
import { ShieldAlert, AlertTriangle, HelpCircle, CheckCircle2, Clock, XCircle, FileText } from 'lucide-react';

interface FindingTypeBadgeProps {
  type: FindingType;
  className?: string;
}

export const FindingTypeBadge: React.FC<FindingTypeBadgeProps> = ({ type, className = '' }) => {
  switch (type) {
    case 'Rule Violation':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 ${className}`}
          title="Deterministic Rule Violation - Explicit configured rule matched"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          Rule Violation
        </span>
      );
    case 'Potential Concern':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 ${className}`}
          title="AI-Assisted Potential Concern - Tone, nuance, or messaging inconsistency"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          Potential Concern
        </span>
      );
    case 'Needs Verification':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 ${className}`}
          title="Needs Verification - Factual claim lacks explicit support in approved guidelines"
        >
          <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
          Needs Verification
        </span>
      );
    default:
      return null;
  }
};

export const SeverityBadge: React.FC<{ severity: Severity }> = ({ severity }) => {
  switch (severity) {
    case 'high':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-950 text-red-300 border border-red-800/50">
          High Severity
        </span>
      );
    case 'medium':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-950 text-yellow-300 border border-yellow-800/50">
          Medium Severity
        </span>
      );
    case 'low':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
          Low Severity
        </span>
      );
  }
};

export const ContentStatusBadge: React.FC<{ status: ContentStatus }> = ({ status }) => {
  switch (status) {
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          Approved
        </span>
      );
    case 'changes_required':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30">
          <XCircle className="w-3.5 h-3.5 text-rose-400" />
          Changes Required
        </span>
      );
    case 'under_review':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          Under Review
        </span>
      );
    case 'draft':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
          <FileText className="w-3.5 h-3.5 text-slate-400" />
          Draft
        </span>
      );
  }
};

export const FindingStatusBadge: React.FC<{ status: FindingStatus }> = ({ status }) => {
  switch (status) {
    case 'accepted':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          Suggestion Accepted
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">
          Suggestion Rejected
        </span>
      );
    case 'resolved':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/40">
          Resolved
        </span>
      );
    case 'open':
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
          Open Finding
        </span>
      );
  }
};
