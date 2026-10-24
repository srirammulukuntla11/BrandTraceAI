import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
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

        <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <strong className="text-slate-300">BrandTrace AI</strong> — Explainable Brand Compliance Platform
            </div>
            <div>
              TechCircuit Round 2 • Participant: <span className="text-slate-300">Sriram Mulukuntla</span> • Team: <span className="text-slate-300 font-mono">SRIRAMMULUKUNTLA11</span>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
};

export default App;
