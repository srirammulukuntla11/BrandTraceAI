import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navbar } from './components/Navbar';
import { DashboardView } from './features/dashboard/DashboardView';
import { ContentCheckView } from './features/check/ContentCheckView';
import { GuidelineList } from './features/guidelines/GuidelineList';
import { HistoryListView } from './features/history/HistoryListView';
import { ContentDetailView } from './features/history/ContentDetailView';
import { UserRole } from './types';
import { getStoredRole } from './lib/api';

export const App: React.FC = () => {
  const [, setRoleState] = useState<UserRole>(getStoredRole());

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
          <Navbar onRoleChange={(newRole) => setRoleState(newRole)} />

          <main className="flex-1">
            <Routes>
              <Route path="/" element={<DashboardView />} />
              <Route path="/check" element={<ContentCheckView />} />
              <Route path="/guidelines" element={<GuidelineList />} />
              <Route path="/history" element={<HistoryListView />} />
              <Route path="/history/:id" element={<ContentDetailView />} />
            </Routes>
          </main>

          <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <strong className="text-slate-800 font-semibold">BrandTrace AI</strong> — Explainable Brand Compliance Platform
              </div>
              <div className="text-slate-400">
                Deterministic Rule Engine &amp; Explainable AI Analysis
              </div>
            </div>
          </footer>
        </div>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
