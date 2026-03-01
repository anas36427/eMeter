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
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Consumers", url: "/consumers", icon: Users },
  { title: "Meter Readings", url: "/readings", icon: Gauge },
  { title: "Billing", url: "/billing", icon: Receipt },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

const bottomNav = [
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/login");
  };

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-64"
      } bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-all duration-300 min-h-screen`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-bold text-base tracking-tight">ElectriFlow</span>
        )}
      </div>

      {/* Main Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {mainNav.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/dashboard"}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            activeClassName="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-foreground"
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
