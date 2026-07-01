import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Zap } from "lucide-react";

export function ProtectedRoute() {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  // While the app is verifying the stored token with the server,
  // render a loading spinner instead of redirecting.
  // This prevents the "flash to login page" on every refresh.
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm font-medium">Loading eMeter...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Preserve the attempted URL so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
