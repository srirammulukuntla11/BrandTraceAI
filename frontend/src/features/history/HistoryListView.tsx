import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { IContentItem } from '../../types';
import { ContentStatusBadge } from '../../components/Badge';
import { History, FileText, ArrowRight, RefreshCw, Calendar, Layers } from 'lucide-react';

export const HistoryListView: React.FC = () => {
  const [items, setItems] = useState<IContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.getContentItems();
      setItems(res.items);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch content history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Content Submission History
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Review past submissions, audit trails, preserved version histories, and human signoffs.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchItems}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${loading ? 'animate-spin' : ''}`} />
          Refresh History
        </button>
      </div>

      {/* Content Table */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading submission audit history...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">No Submissions Recorded Yet</h3>
          <p className="text-xs text-slate-400 mb-6 max-w-sm mx-auto">
            Once you submit copy for compliance evaluation, every draft and revision version is safely cataloged here.
          </p>
          <Link
            to="/check"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20"
          >
            <FileText className="w-4 h-4" />
            Submit Your First Draft
          </Link>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-4 px-6">Content Title</th>
                  <th className="py-4 px-6">Type</th>
                  <th className="py-4 px-6">Versions</th>
                  <th className="py-4 px-6">Review Status</th>
                  <th className="py-4 px-6">Submitted By</th>
                  <th className="py-4 px-6">Last Updated</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {items.map((item) => {
                  const id = item.id || item._id;
                  const dateStr = item.updatedAt || item.createdAt
                    ? new Date(item.updatedAt || item.createdAt!).toLocaleDateString()
                    : 'Recent';

                  return (
                    <tr key={id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-6 font-semibold text-white">
                        <Link
                          to={`/history/${id}`}
                          className="hover:text-blue-400 transition-colors flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                          <span>{item.title}</span>
                        </Link>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-400">
                        {item.contentType}
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                          <Layers className="w-3 h-3" />
                          v{item.currentVersion} ({item.versions.length} {item.versions.length === 1 ? 'ver' : 'vers'})
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <ContentStatusBadge status={item.status} />
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-400">
                        {item.createdBy?.name || 'Anonymous'}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-400 flex items-center gap-1.5 mt-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {dateStr}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          to={`/history/${id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Review
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
