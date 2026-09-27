import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Megaphone, Settings,
  Brain, Menu, X, ChevronRight, Activity, LogOut,
  Bell, Users, ArrowUpRight,
} from 'lucide-react';

const clinicName = import.meta.env.VITE_CLINIC_NAME || 'ABC Healthcare';

const navItems = [
  { to: '/staff',            label: 'Dashboard',  icon: LayoutDashboard, end: true },
  { to: '/staff/feedback',   label: 'Feedback',   icon: MessageSquare },
  { to: '/staff/campaigns',  label: 'Campaigns',  icon: Megaphone },
  { to: '/staff/settings',   label: 'Settings',   icon: Settings },
];

export function StaffLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-subtle flex">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-ink-DEFAULT/30 lg:hidden"
          onClick={() => setSidebarOpen(false)} aria-hidden />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Sidebar                                                             */}
      {/* ------------------------------------------------------------------ */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-30 w-60 bg-white border-r border-surface-border flex flex-col',
          'transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:relative lg:translate-x-0',
        ].join(' ')}
        aria-label="Staff navigation"
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-surface-border shrink-0">
          <div className="w-7 h-7 rounded-lg bg-ink-DEFAULT flex items-center justify-center shrink-0">
            <Brain className="h-3.5 w-3.5 text-white" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink-DEFAULT leading-none">ReviewBridge</p>
            <p className="text-[10px] text-ink-subtle leading-none mt-0.5 truncate">{clinicName}</p>
          </div>
          <button className="lg:hidden text-ink-subtle hover:text-ink-DEFAULT"
            onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => [
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-ink-muted hover:bg-surface-raised hover:text-ink-DEFAULT',
              ].join(' ')}
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary-600' : 'text-ink-subtle'}`} aria-hidden />
                  {label}
                  {isActive && <ChevronRight className="h-3 w-3 ml-auto text-primary-400" aria-hidden />}
                </>
              )}
            </NavLink>
          ))}

          {/* Divider */}
          <div className="pt-4 pb-1">
            <p className="px-3 text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Quick Access</p>
          </div>

          <button
            onClick={() => { navigate('/desk'); setSidebarOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-ink-muted hover:bg-surface-raised hover:text-ink-DEFAULT transition-colors"
          >
            <Activity className="h-4 w-4 text-ink-subtle shrink-0" aria-hidden />
            Automation Desk
            <ArrowUpRight className="h-3 w-3 ml-auto text-ink-subtle" aria-hidden />
          </button>

          <button
            onClick={() => { navigate('/staff/feedback'); setSidebarOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-ink-muted hover:bg-surface-raised hover:text-ink-DEFAULT transition-colors"
          >
            <Users className="h-4 w-4 text-ink-subtle shrink-0" aria-hidden />
            All Patients
            <ArrowUpRight className="h-3 w-3 ml-auto text-ink-subtle" aria-hidden />
          </button>
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-surface-border shrink-0">
          <button
            onClick={() => { navigate('/'); setSidebarOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-ink-subtle hover:bg-surface-raised hover:text-ink-DEFAULT transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            Exit to Setup
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Main                                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="h-14 bg-white border-b border-surface-border flex items-center gap-3 px-4 lg:px-6 shrink-0">
          <button className="lg:hidden text-ink-subtle hover:text-ink-DEFAULT"
            onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          <div className="flex-1" />

          {/* Date */}
          <span className="hidden md:block text-xs text-ink-subtle">
            {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>

          {/* Notification */}
          <button
            className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-raised text-ink-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" aria-hidden />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden />
          </button>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-ink-DEFAULT text-white text-xs font-bold flex items-center justify-center select-none">
            DR
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
