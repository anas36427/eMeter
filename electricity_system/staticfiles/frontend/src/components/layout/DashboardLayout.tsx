import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopNavbar } from "./TopNavbar";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/consumers": "Consumer Management",
  "/readings": "Meter Readings",
  "/billing": "Billing",
  "/reports": "Reports & Analytics",
  "/settings": "Settings",
};

export function DashboardLayout() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "Dashboard";

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNavbar title={title} />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
