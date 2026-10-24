import React, { useEffect, useState } from 'react';
import { api, getStoredRole } from '../../lib/api';
import { IGuideline, GuidelineCategory, UserRole } from '../../types';
import {
  BookOpen,
  Plus,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Archive,
  CheckCircle2,
  X,
  SlidersHorizontal,
} from 'lucide-react';

export const GuidelineList: React.FC = () => {
  const [userRole] = useState<UserRole>(getStoredRole());
  const [guidelines, setGuidelines] = useState<IGuideline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<GuidelineCategory>('terminology');
  const [ruleDescription, setRuleDescription] = useState('');
  const [prohibitedTermsInput, setProhibitedTermsInput] = useState('');
  const [preferredTerm, setPreferredTerm] = useState('');
  const [requiredTermsInput, setRequiredTermsInput] = useState('');
  const [applicableContentTypes, setApplicableContentTypes] = useState<string[]>(['all']);

  const isReviewerOrAdmin = userRole === 'reviewer' || userRole === 'admin';

  const fetchGuidelines = async () => {
    setLoading(true);
    try {
      const res = await api.getGuidelines(statusFilter);
      setGuidelines(res.guidelines);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load guidelines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuidelines();
  }, [statusFilter]);

  const handleSeedSamples = async () => {
    try {
      setLoading(true);
      await api.seedGuidelines();
      await fetchGuidelines();
    } catch (err: any) {
      alert(`Could not seed guidelines: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (guideline: IGuideline) => {
    if (!isReviewerOrAdmin) {
      alert('Only reviewers and admins can change guideline status.');
      return;
    }
    const id = guideline.id || guideline._id;
    if (!id) return;
    const newStatus = guideline.status === 'active' ? 'archived' : 'active';
    try {
      await api.updateGuideline(id, { status: newStatus });
      await fetchGuidelines();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !ruleDescription.trim()) {
      setFormError('Title and rule description are required.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    const prohibitedTerms = prohibitedTermsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const requiredTerms = requiredTermsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await api.createGuideline({
        title: title.trim(),
        category,
        ruleDescription: ruleDescription.trim(),
        prohibitedTerms,
        preferredTerm: preferredTerm.trim(),
        requiredTerms,
        applicableContentTypes,
        status: 'active',
      });

      setIsModalOpen(false);
      // Reset form
      setTitle('');
      setRuleDescription('');
      setProhibitedTermsInput('');
      setPreferredTerm('');
      setRequiredTermsInput('');
      setApplicableContentTypes(['all']);
      await fetchGuidelines();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create guideline.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const filteredGuidelines = guidelines.filter((g) => {
    if (categoryFilter !== 'all' && g.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Brand Guidelines Library
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Approved rules, prohibited vocabulary, required disclaimers, and voice standards.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSeedSamples}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title="Reload official sample guidelines for testing"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            Seed Sample Rules
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            New Guideline
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1 mr-1">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Status:
          </span>
          {['all', 'active', 'archived'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="terminology">Terminology</option>
            <option value="tone">Tone</option>
            <option value="messaging">Messaging</option>
            <option value="disclaimer">Disclaimer</option>
            <option value="approved_fact">Approved Fact</option>
          </select>
        </div>
      </div>

      {/* Guidelines Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading guidelines library...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-400" />
          <span>{error}</span>
        </div>
      ) : filteredGuidelines.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">No Guidelines Found</h3>
          <p className="text-xs text-slate-400 mb-4">
            No guidelines match the selected filters. Click below to reload sample guidelines.
          </p>
          <button
            type="button"
            onClick={handleSeedSamples}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white"
          >
            Seed Sample Guidelines
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGuidelines.map((g) => {
            const isActive = g.status === 'active';
            return (
              <div
                key={g.id || g._id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-all shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      {g.category}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleToggleStatus(g)}
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                      title={isActive ? 'Click to Archive' : 'Click to Activate'}
                    >
                      {isActive ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Active
                        </>
                      ) : (
                        <>
                          <Archive className="w-3 h-3 text-slate-400" />
                          Archived
                        </>
                      )}
                    </button>
                  </div>

                  <h3 className="text-base font-bold text-white mb-2">{g.title}</h3>

                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    {g.ruleDescription}
                  </p>

                  {/* Prohibited Terms Tags */}
                  {g.prohibitedTerms && g.prohibitedTerms.length > 0 && (
                    <div className="mb-3">
                      <span className="block text-[10px] uppercase font-semibold text-rose-400 tracking-wider mb-1">
                        Prohibited Terms:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {g.prohibitedTerms.map((term, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40 font-mono"
                          >
                            "{term}"
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preferred Term */}
                  {g.preferredTerm && (
                    <div className="mb-3 text-xs">
                      <span className="text-slate-400">Preferred Term: </span>
                      <span className="font-semibold text-emerald-300">{g.preferredTerm}</span>
                    </div>
                  )}

                  {/* Required Terms */}
                  {g.requiredTerms && g.requiredTerms.length > 0 && (
                    <div className="mb-3">
                      <span className="block text-[10px] uppercase font-semibold text-cyan-400 tracking-wider mb-1">
                        Mandatory Disclaimer:
                      </span>
                      <div className="text-xs text-cyan-200/90 bg-cyan-950/40 p-2 rounded border border-cyan-800/40 font-mono">
                        {g.requiredTerms.join('; ')}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Scope: {g.applicableContentTypes?.join(', ') || 'all'}</span>
                  {g.isSample && (
                    <span className="text-blue-400 font-medium">Sample Rule</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Guideline Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              Create Brand Guideline
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Add explicit terminology, mandatory disclaimers, or tone standards.
            </p>

            {formError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Official Product Naming Policy"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as GuidelineCategory)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="terminology">Terminology</option>
                  <option value="tone">Tone</option>
                  <option value="messaging">Messaging</option>
                  <option value="disclaimer">Disclaimer</option>
                  <option value="approved_fact">Approved Fact</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Rule Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={ruleDescription}
                  onChange={(e) => setRuleDescription(e.target.value)}
                  placeholder="Explain the reason for this rule and how writers should comply..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Prohibited Words / Phrases (Comma-separated)
                </label>
                <input
                  type="text"
                  value={prohibitedTermsInput}
                  onChange={(e) => setProhibitedTermsInput(e.target.value)}
                  placeholder="e.g. the bot, cheap checker, AI script"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Preferred Terminology (Optional)
                  </label>
                  <input
                    type="text"
                    value={preferredTerm}
                    onChange={(e) => setPreferredTerm(e.target.value)}
                    placeholder="e.g. BrandTrace AI"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Required Disclaimer (Optional)
                  </label>
                  <input
                    type="text"
                    value={requiredTermsInput}
                    onChange={(e) => setRequiredTermsInput(e.target.value)}
                    placeholder="e.g. BrandTrace is explainable..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : 'Save Guideline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
