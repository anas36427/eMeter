import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AuthProvider } from "@/contexts/AuthContext";
import { SearchProvider } from "@/contexts/SearchContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Consumers from "./pages/Consumers";
import Readings from "./pages/Readings";
import Billing from "./pages/Billing";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import ImportReadings from "./pages/ImportReadings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      throwOnError: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <SearchProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/consumers" element={<Consumers />} />
                  <Route path="/readings" element={<Readings />} />
                  <Route path="/billing" element={<Billing />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/import-readings" element={<ImportReadings />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SearchProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;