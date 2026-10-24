import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, BookOpen, History, PlusCircle, Activity, UserCheck, Key } from 'lucide-react';
import { api, getStoredRole } from '../lib/api';
import { UserRole, AiConfigStatus } from '../types';
import { AiConfigModal } from './AiConfigModal';

interface NavbarProps {
  onRoleChange?: (newRole: UserRole) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onRoleChange }) => {
  const location = useLocation();
  const [currentRole, setCurrentRole] = useState<UserRole>(getStoredRole());
  const [aiConfig, setAiConfig] = useState<AiConfigStatus | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const fetchStatus = () => {

    api.getAiConfig()
      .then((data) => {
        if (data && typeof data.configured === 'boolean') {
          setAiConfig(data);
        } else {
          setAiConfig(null);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch AI config status', err);
        setAiConfig(null);
      });
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRoleSwitch = async (role: UserRole) => {
    try {
      await api.switchRole(role);
      setCurrentRole(role);
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
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Platform Name */}
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/20 group-hover:bg-indigo-700 transition-colors">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-slate-900 tracking-tight">BrandTrace AI</span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Explainable Brand Compliance Platform</p>
                </div>
              </Link>

              {/* Navigation links */}
              <nav className="hidden md:flex items-center gap-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/80 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right Controls: AI Config & Role Switcher */}
            <div className="flex items-center gap-3">
              {/* AI Key Configuration Button */}
              <button
                type="button"
                onClick={() => setIsAiModalOpen(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  aiConfig?.configured
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-xs'
                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 shadow-xs'
                }`}
                title="Configure personal Gemini API key (user session only)"
              >
                <Key className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {aiConfig?.configured ? 'Gemini Key Active' : 'Setup Gemini Key'}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    aiConfig?.configured ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </button>

              {/* Workspace User Role Switcher */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-xs">
                <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-500 px-2 font-medium">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Role:
                </span>
                <button
                  type="button"
                  onClick={() => handleRoleSwitch('reviewer')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    currentRole === 'reviewer'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                  title="Reviewer role: Can accept/reject suggestions and make final approval decisions."
                >
                  Reviewer
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleSwitch('creator')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    currentRole === 'creator'
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                  title="Creator role: Can submit drafts, view findings, revise content."
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
