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
  Rocket,
  Compass,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const [guidelines, setGuidelines] = useState<IGuideline[]>([]);
  const [items, setItems] = useState<IContentItem[]>([]);

  useEffect(() => {
    Promise.all([
      api.getGuidelines('all').catch(() => ({ guidelines: [] })),
      api.getContentItems().catch(() => ({ items: [] })),
      api.getHealth().catch(() => null),
    ]).then(([gRes, iRes]) => {
      setGuidelines(gRes.guidelines);
      setItems(iRes.items);
    });
  }, []);

  const activeGuidelinesCount = guidelines.filter((g) => g.status === 'active').length;
  const approvedCount = items.filter((i) => i.status === 'approved').length;
  const totalFindingsCount = items.reduce(
    (sum, item) => sum + (item.versions?.[item.versions.length - 1]?.findings?.length || 0),
    0
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hackathon Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900 border border-slate-800 p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                TechCircuit — Round 2: The Build
              </span>
              <span className="text-xs font-mono text-slate-400">
                Team: <strong className="text-white">SRIRAMMULUKUNTLA11</strong> | Sriram Mulukuntla
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Explainable Brand Compliance Platform
            </h1>
            <p className="mt-2 text-base text-slate-300 leading-relaxed">
              BrandTrace AI audits marketing copy and releases against approved brand guidelines with deterministic rule precision, explainable Gemini AI tone analysis, and strict human review governance.
            </p>
          </div>

          {/* Quick CTA */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <Link
              to="/check"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02]"
            >
              <Wand2 className="w-4 h-4 text-cyan-200" />
              Test Compliance Checker
            </Link>

            <Link
              to="/guidelines"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <BookOpen className="w-4 h-4 text-blue-400" />
              Explore Guidelines Library
            </Link>
          </div>
        </div>
      </div>

      {/* 1-Click Judge Quickstart Path */}
      <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-2 mb-3">
          <Compass className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-bold text-white uppercase tracking-wider">
            Judge Rapid Evaluation Path
          </h2>
          <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 ml-auto">
            100% Ready to Test
          </span>
        </div>

        <p className="text-xs text-slate-300 mb-4 max-w-3xl">
          Follow this 30-second workflow to verify all functional requirements from rule matching to human signoff:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="font-bold text-blue-400 mb-1">1. Approved Guidelines</div>
            <p className="text-slate-400">
              Pre-seeded rules for brand naming ("BrandTrace AI"), guarantees ("100% bug-free"), and mandatory disclaimers.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="font-bold text-blue-400 mb-1">2. Run Compliance Check</div>
            <p className="text-slate-400">
              Go to "New Check" & click <em>"Load Judge Sample Draft"</em> to immediately test prohibited term & disclaimer detection.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="font-bold text-blue-400 mb-1">3. Explainable Findings</div>
            <p className="text-slate-400">
              Inspect quoted passages, severity, rule explanation, and copy/apply suggested corrections.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="font-bold text-blue-400 mb-1">4. Human Decision</div>
            <p className="text-slate-400">
              Use navbar switch to test Reviewer signoff ("Approve" or "Request Changes") and submit version revisions.
            </p>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{activeGuidelinesCount}</div>
            <div className="text-xs text-slate-400">Active Brand Guidelines</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{items.length}</div>
            <div className="text-xs text-slate-400">Submitted Drafts</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{totalFindingsCount}</div>
            <div className="text-xs text-slate-400">Findings Detected</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">{approvedCount}</div>
            <div className="text-xs text-slate-400">Approved Content Items</div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Submissions + Round 3 Roadmap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Recent Submissions */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" />
              Recent Submissions & Decisions
            </h3>
            <Link
              to="/history"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              View all
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {items.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No submissions recorded yet. Click "Test Compliance Checker" above to create one.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {items.slice(0, 5).map((item) => (
                <div
                  key={item.id || item._id}
                  className="py-3 flex items-center justify-between gap-4 hover:bg-slate-800/30 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/history/${item.id || item._id}`}
                      className="text-sm font-semibold text-white hover:text-blue-400 truncate block"
                    >
                      {item.title}
                    </Link>
                    <span className="text-[11px] text-slate-400 font-mono">
                      v{item.currentVersion} • {item.contentType}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <ContentStatusBadge status={item.status} />
                    <Link
                      to={`/history/${item.id || item._id}`}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                    >
                      Inspect
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Round 3 Planned Improvements (Honest Submission requirement) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-cyan-400">
              <Rocket className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Round 3 Proposals</span>
            </div>
            <h3 className="text-base font-bold text-white mb-2">Planned Architecture Enhancements</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Per Hackathon specifications, these candidate capabilities are scheduled for Round 3 expansion:
            </p>

            <ul className="space-y-3 text-xs">
              <li className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <strong className="text-slate-200 block mb-0.5">1. Side-by-Side Revision Diff</strong>
                <span className="text-slate-400">
                  Visual word-level diffing highlighting resolved violations and newly introduced issues between versions.
                </span>
              </li>

              <li className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <strong className="text-slate-200 block mb-0.5">2. Compliance History Insights</strong>
                <span className="text-slate-400">
                  Departmental compliance rates and frequent rule violation trends with sample-size insufficiency warnings.
                </span>
              </li>

              <li className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <strong className="text-slate-200 block mb-0.5">3. Approved-Asset Semantic Retrieval</strong>
                <span className="text-slate-400">
                  Vector index retrieval for massive 1,000+ brand rule repositories with contextual prompt injection.
                </span>
              </li>
            </ul>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-800 text-[11px] text-slate-500">
            Status: Planned for Round 3 (Clearly distinguished from active Round 2 MVP features).
          </div>
        </div>
      </div>
    </div>
  );
};
