import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Megaphone,
  Settings,
  Bell,
  Menu,
  X,
  Activity,
  ChevronRight,
  LogOut,
  Zap,
} from 'lucide-react';

const clinicName = import.meta.env.VITE_CLINIC_NAME || 'ABC Healthcare';

const navItems = [
  { to: '/staff', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/staff/feedback', label: 'Feedback', icon: MessageSquare },
  { to: '/staff/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/staff/settings', label: 'Settings', icon: Settings },
];

export function StaffLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-stone-50 flex">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-stone-200 flex flex-col',
          'transform transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:relative lg:translate-x-0',
        ].join(' ')}
        aria-label="Staff navigation"
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-stone-100 shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #16a34a, #ea580c)' }}
          >
            <Activity className="h-4 w-4 text-white" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">ReviewBridge</p>
            <p className="text-xs text-slate-500 truncate">{clinicName}</p>
          </div>
          <button
            className="ml-auto lg:hidden text-slate-400 hover:text-slate-600"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-green-50 text-green-700'
                    : 'text-slate-600 hover:bg-stone-100 hover:text-slate-900',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-4 w-4 shrink-0 ${isActive ? 'text-green-600' : 'text-slate-400'}`}
                    aria-hidden
                  />
                  {label}
                  {isActive && (
                    <ChevronRight className="h-3 w-3 ml-auto text-green-400" aria-hidden />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="p-4 border-t border-stone-100 space-y-1 shrink-0">
          <button
            onClick={() => { navigate('/demo'); setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-amber-700 hover:bg-amber-50 transition-colors"
          >
            <Zap className="h-4 w-4 text-amber-500 shrink-0" aria-hidden />
            Demo Launcher
          </button>
          <button
            onClick={() => { navigate('/login'); setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-stone-100 transition-colors"
          >
            <LogOut className="h-4 w-4 text-slate-400 shrink-0" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="h-16 bg-white border-b border-stone-200 flex items-center gap-4 px-4 lg:px-6 shrink-0">
          <button
            className="lg:hidden text-slate-500 hover:text-slate-700"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          {/* Gradient page title bar */}
          <div
            className="hidden sm:block h-6 w-1 rounded-full"
            style={{ background: 'linear-gradient(180deg, #16a34a, #ea580c)' }}
            aria-hidden
          />

          <div className="flex-1" />

          <span className="hidden sm:block text-sm text-slate-500">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>

          <button
            className="relative text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" aria-hidden />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-500" aria-hidden />
          </button>

          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: 'linear-gradient(135deg, #16a34a, #ca8a04)' }}
            aria-label="Staff profile"
          >
            DR
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
