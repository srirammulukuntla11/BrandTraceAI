import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, BookOpen, History, PlusCircle, Activity, UserCheck, Key } from 'lucide-react';
import { api, getStoredRole } from '../lib/api';
import { HealthStatus, UserRole, AiConfigStatus } from '../types';
import { AiConfigModal } from './AiConfigModal';

interface NavbarProps {
  onRoleChange?: (newRole: UserRole) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onRoleChange }) => {
  const location = useLocation();
  const [currentRole, setCurrentRole] = useState<UserRole>(getStoredRole());
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [aiConfig, setAiConfig] = useState<AiConfigStatus | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const fetchStatus = () => {
    api.getHealth()
      .then(setHealth)
      .catch((err) => console.warn('Could not fetch health status', err));

    api.getAiConfig()
      .then(setAiConfig)
      .catch((err) => console.warn('Could not fetch AI config status', err));
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRoleSwitch = async (role: UserRole) => {
    try {
      await api.switchRole(role);
      setCurrentRole(role);
      // Re-fetch AI config for the switched role to reflect user isolation
      api.getAiConfig().then(setAiConfig).catch(() => null);
      if (onRoleChange) {
        onRoleChange(role);
      }
    } catch (err) {
      console.error('Role switch failed', err);
    }
  };

  const navItems = [
    { label: 'Dashboard', path: '/', icon: Activity },
    { label: 'New Check', path: '/check', icon: PlusCircle },
    { label: 'Guidelines', path: '/guidelines', icon: BookOpen },
    { label: 'Content History', path: '/history', icon: History },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Platform Name */}
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-white tracking-tight">BrandTrace AI</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Round 2 MVP
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Explainable Brand Compliance Platform</p>
                </div>
              </Link>

              {/* Navigation links */}
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right Controls: AI Config, Demo Switcher, & Health */}
            <div className="flex items-center gap-3">
              {/* AI Key Configuration Button */}
              <button
                type="button"
                onClick={() => setIsAiModalOpen(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  aiConfig?.configured
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 shadow-sm'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 shadow-sm'
                }`}
                title="Configure your own Gemini API key (user-scoped session)"
              >
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">
                  {aiConfig?.configured ? 'Gemini Key Active' : 'Setup Gemini Key'}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    aiConfig?.configured ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                  }`}
                />
              </button>

              {/* System Health indicator */}
              {health && (
                <div
                  className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-full text-xs bg-slate-800/80 border border-slate-700/80 text-slate-300"
                  title={`Database: ${health.database.message}`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      health.database.connected ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  <span className="font-mono text-[11px]">
                    DB: {health.database.mode === 'mongodb' ? 'Atlas' : 'Memory'}
                  </span>
                </div>
              )}

              {/* Demo Role Switcher for Judges */}
              <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700/80">
                <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-400 px-2 font-medium">
                  <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                  Role:
                </span>
                <button
                  type="button"
                  onClick={() => handleRoleSwitch('reviewer')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    currentRole === 'reviewer'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                  title="Reviewer role: Can accept/reject suggestions and make final approval/changes-required decisions."
                >
                  Reviewer
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleSwitch('creator')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    currentRole === 'creator'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                  title="Creator role: Can submit drafts, view findings, revise content. Backend strictly blocks approval actions (403)."
                >
                  Creator
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* AI Key Configuration Modal */}
      <AiConfigModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onStatusChange={(newStatus) => setAiConfig(newStatus)}
      />
    </>
  );
};
