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
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/90 shrink-0 ${className}`}
          title="Deterministic Rule Violation - Explicit configured rule matched"
        >
          <ShieldAlert className="w-3 h-3 text-rose-600 shrink-0" />
          Rule Violation
        </span>
      );
    case 'Potential Concern':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/90 shrink-0 ${className}`}
          title="AI-Assisted Potential Concern - Tone, nuance, or messaging inconsistency"
        >
          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
          Potential Concern
        </span>
      );
    case 'Needs Verification':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-200/90 shrink-0 ${className}`}
          title="Needs Verification - Factual claim lacks explicit support in approved guidelines"
        >
          <HelpCircle className="w-3 h-3 text-violet-600 shrink-0" />
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
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200 shrink-0">
          High
        </span>
      );
    case 'medium':
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
          Med
        </span>
      );
    case 'low':
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
          Low
        </span>
      );
  }
};

export const ContentStatusBadge: React.FC<{ status: ContentStatus }> = ({ status }) => {
  switch (status) {
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Approved
        </span>
      );
    case 'changes_required':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3 h-3 text-rose-600" />
          Changes Required
        </span>
      );
    case 'under_review':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          Under Review
        </span>
      );
    case 'draft':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          <FileText className="w-3 h-3 text-slate-500" />
          Draft
        </span>
      );
  }
};

export const FindingStatusBadge: React.FC<{ status: FindingStatus }> = ({ status }) => {
  switch (status) {
    case 'accepted':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
          Accepted
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
          Rejected
        </span>
      );
    case 'resolved':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
          Resolved
        </span>
      );
    case 'open':
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
          Open
        </span>
      );
  }
};
