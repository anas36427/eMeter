import {
  LayoutDashboard,
  Users,
  Gauge,
  Receipt,
  BarChart3,
  Settings,
  Zap,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Upload,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const adminNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Consumers", url: "/consumers", icon: Users },
  { title: "Meter Readings", url: "/readings", icon: Gauge },
  { title: "Billing", url: "/billing", icon: Receipt },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Import Readings", url: "/import-readings", icon: Upload },
];

const meterReaderNav = [
  { title: "Meter Readings", url: "/readings", icon: Gauge },
];

const consumerNav = [
  { title: "Billing", url: "/billing", icon: Receipt },
];

const bottomNav = [
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { role, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // Role-based navigation
  const mainNav = role === "meter_reader" ? meterReaderNav 
    : role === "consumer" ? consumerNav 
    : adminNav;

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-64"
      } bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-all duration-300 min-h-screen`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-white p-1">
          <img src="/assets/logo.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-bold text-base leading-none tracking-tight">eMeter AMU</span>
            <span className="text-[10px] text-sidebar-foreground/50 font-bold uppercase tracking-wider mt-1">ADMIN PORTAL</span>
          </div>
        )}
      </div>

      {/* Main Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {mainNav.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/dashboard"}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-150 group"
            activeClassName="bg-blue-600/10 text-blue-600 border border-blue-600/20 shadow-sm"
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="py-4 px-2 border-t border-sidebar-border space-y-1">
        {bottomNav.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-150 group"
            activeClassName="bg-blue-600/10 text-blue-600 border border-blue-600/20 shadow-sm"
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        ))}
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors w-full">
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-3 border-t border-sidebar-border hover:bg-sidebar-accent transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-sidebar-muted" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-sidebar-muted" />
        )}
      </button>
    </aside>
  );
}
