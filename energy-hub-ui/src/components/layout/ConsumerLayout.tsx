import React from 'react';
import { NavLink, useNavigate, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useConsumerAuth } from '@/contexts/ConsumerAuthContext';
import {
  LayoutDashboard,
  BarChart2,
  Receipt,
  KeyRound,
  LogOut,
  Zap,
  User,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/consumer/dashboard',        label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/consumer/readings',         label: 'My Readings',     icon: BarChart2 },
  { to: '/consumer/bills',            label: 'My Bills',        icon: Receipt },
  { to: '/consumer/change-password',  label: 'Change Password', icon: KeyRound },
];

export default function ConsumerLayout() {
  const { profile, logout, isInitializing, token } = useConsumerAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/consumer/login');
  };

  // While verifying stored token with server — show spinner, not login redirect
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="w-12 h-12 rounded-full bg-blue-600/10 flex items-center justify-center animate-pulse">
            <Zap className="w-6 h-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium">Loading Consumer Portal...</p>
        </div>
      </div>
    );
  }

  // Token invalid or not present — redirect to consumer login preserving attempted URL
  if (!token) {
    return <Navigate to="/consumer/login" state={{ from: location }} replace />;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 flex flex-col bg-card border-r border-border">
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
          <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-white p-1 shadow-sm border border-border/50">
            <img src="/assets/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <p className="text-base font-bold text-foreground leading-none tracking-tight">eMeter AMU</p>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">Consumer Portal</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-600/20'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-400' : 'group-hover:text-foreground'}`} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Profile + Logout */}
        <div className="border-t border-border p-4 space-y-3">
          {/* Profile mini-card */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{profile?.name || 'Consumer'}</p>
              <p className="text-[10px] text-muted-foreground truncate">ID: {profile?.consumer_number || '—'}</p>
            </div>
          </div>
          {/* Logout button */}
          <button
            onClick={handleLogout}
            id="consumer-logout-btn"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 group"
          >
            <LogOut className="w-4 h-4 flex-shrink-0 group-hover:text-red-400" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
