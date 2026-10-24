import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { IContentItem, IGuideline } from '../../types';
import { ContentStatusBadge } from '../../components/Badge';
import {
  BookOpen,
  Layers,
  Wand2,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  History,
  ShieldCheck,
  Compass,
  RefreshCw,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const [guidelines, setGuidelines] = useState<IGuideline[]>([]);
  const [items, setItems] = useState<IContentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    Promise.all([
      api.getGuidelines('all').catch((err) => {
        console.warn('Could not load guidelines', err);
        return { guidelines: [] };
      }),
      api.getContentItems().catch((err) => {
        console.warn('Could not load submissions', err);
        return { items: [] };
      }),
    ])
      .then(([gRes, iRes]) => {
        setGuidelines(Array.isArray(gRes?.guidelines) ? gRes.guidelines : []);
        setItems(Array.isArray(iRes?.items) ? iRes.items : []);
      })
      .catch((err) => {
        setFetchError(err?.message || 'Unable to connect to BrandTrace AI API server');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const activeGuidelinesCount = (guidelines || []).filter((g) => g?.status === 'active').length;
  const approvedCount = (items || []).filter((i) => i?.status === 'approved').length;
  const totalFindingsCount = (items || []).reduce(
    (sum, item) => sum + (item?.versions?.[item.versions.length - 1]?.findings?.length || 0),
    0
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {fetchError && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center justify-between">
          <span>{fetchError}</span>
          <button
            onClick={() => window.location.reload()}
            className="text-xs font-semibold px-3 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 border border-slate-200 p-8 sm:p-10 shadow-xs">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Brand Governance &amp; Compliance
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Explainable Brand Compliance Platform
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
              BrandTrace AI audits marketing copy, release notes, and announcements against approved brand guidelines with deterministic rule precision, explainable Gemini AI tone analysis, and strict human review governance.
            </p>
          </div>

          {/* Quick CTA */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <Link
              to="/check"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all hover:scale-[1.02]"
            >
              <Wand2 className="w-4 h-4" />
              New Compliance Check
            </Link>

            <Link
              to="/guidelines"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-colors"
            >
              <BookOpen className="w-4 h-4 text-indigo-600" />
              Explore Guidelines Library
            </Link>
          </div>
        </div>
      </div>

      {/* Compliance Workflow Path */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Compass className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Brand Compliance Workflow
          </h2>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 ml-auto">
            Ready
          </span>
        </div>

        <p className="text-xs text-slate-600 mb-4 max-w-3xl leading-relaxed">
          Standardized four-stage workflow to verify content from deterministic rule matching to human reviewer signoff:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200">
            <div className="font-bold text-indigo-700 mb-1">1. Approved Guidelines</div>
            <p className="text-slate-600 leading-relaxed">
              Define standards for brand terminology, claim verification, prohibited phrases, and required disclaimers.
            </p>
          </div>

          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200">
            <div className="font-bold text-indigo-700 mb-1">2. Run Compliance Check</div>
            <p className="text-slate-600 leading-relaxed">
              Submit drafts to execute deterministic rule checking and Gemini-powered tone and nuance analysis.
            </p>
          </div>

          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200">
            <div className="font-bold text-indigo-700 mb-1">3. Explainable Findings</div>
            <p className="text-slate-600 leading-relaxed">
              Inspect flagged excerpts, severity ratings, detailed rationale, and directly apply suggested corrections.
            </p>
          </div>

          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200">
            <div className="font-bold text-indigo-700 mb-1">4. Human Review &amp; Signoff</div>
            <p className="text-slate-600 leading-relaxed">
              Reviewers examine revisions, accept or reject proposed changes, and record final approval decisions.
            </p>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-colors flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{activeGuidelinesCount}</div>
            <div className="text-xs text-slate-500 font-medium">Active Brand Guidelines</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-colors flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{items.length}</div>
            <div className="text-xs text-slate-500 font-medium">Submitted Drafts</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-colors flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalFindingsCount}</div>
            <div className="text-xs text-slate-500 font-medium">Findings Detected</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-colors flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{approvedCount}</div>
            <div className="text-xs text-slate-500 font-medium">Approved Content Items</div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Submissions + Round 3 Roadmap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Recent Submissions */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              Recent Submissions & Decisions
            </h3>
            <Link
              to="/history"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              View all
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
              <span>Loading dashboard records...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No submissions recorded yet. Click "Test Compliance Checker" above to create one.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.slice(0, 5).map((item) => (
                <div
                  key={item.id || item._id}
                  className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 px-2.5 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/history/${item.id || item._id}`}
                      className="text-sm font-semibold text-slate-900 hover:text-indigo-600 truncate block"
                    >
                      {item.title}
                    </Link>
                    <span className="text-[11px] text-slate-500 font-mono">
                      v{item.currentVersion} • {item.contentType}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <ContentStatusBadge status={item.status} />
                    <Link
                      to={`/history/${item.id || item._id}`}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      Inspect
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Platform Governance & Architecture */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-indigo-700">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Governance Standards</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Explainable Compliance Framework</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              BrandTrace AI enforces brand integrity through balanced deterministic and machine intelligence layers:
            </p>

            <ul className="space-y-3 text-xs">
              <li className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <strong className="text-slate-800 block mb-0.5">1. Deterministic Rule Precision</strong>
                <span className="text-slate-600">
                  Exact string matching for prohibited terms, preferred vocabulary, and mandatory disclaimers with zero hallucinations.
                </span>
              </li>

              <li className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <strong className="text-slate-800 block mb-0.5">2. Explainable Gemini AI Analysis</strong>
                <span className="text-slate-600">
                  Detects subtle brand tone inconsistencies and unsupported comparative claims with grounded citations.
                </span>
              </li>

              <li className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <strong className="text-slate-800 block mb-0.5">3. Human-in-the-Loop Governance</strong>
                <span className="text-slate-600">
                  AI suggestions never auto-approve content. Only authenticated reviewers can grant official compliance approval.
                </span>
              </li>
            </ul>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 text-[11px] text-slate-400">
            Security: User-provided API keys are scoped in session memory and never shared or logged.
          </div>
        </div>
      </div>
    </div>
  );
};
