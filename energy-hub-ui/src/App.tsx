import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import ConsumerLayout from "@/components/layout/ConsumerLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AuthProvider } from "@/contexts/AuthContext";
import { SearchProvider } from "@/contexts/SearchContext";
import { ConsumerAuthProvider } from "@/contexts/ConsumerAuthContext";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Consumers from "./pages/Consumers";
import Readings from "./pages/Readings";
import Billing from "./pages/Billing";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import ImportReadings from "./pages/ImportReadings";
import NotFound from "./pages/NotFound";
// Consumer Portal Pages
import ConsumerLogin from "./pages/ConsumerLogin";
import ConsumerDashboard from "./pages/ConsumerDashboard";
import ConsumerReadings from "./pages/ConsumerReadings";
import ConsumerBills from "./pages/ConsumerBills";
import ConsumerChangePassword from "./pages/ConsumerChangePassword";

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
        {/* ── Admin / Meter Reader Routes ─────────────────────── */}
        <AuthProvider>
          <SearchProvider>
            <ConsumerAuthProvider>
              <Routes>
                {/* Root Landing Page */}
                <Route path="/" element={<Landing />} />

                {/* Admin login */}
                <Route path="/login" element={<Login />} />

                {/* Admin protected pages */}
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

                {/* ── Consumer Portal Routes ── */}
                <Route path="/consumer/login" element={<ConsumerLogin />} />
                <Route path="/consumer" element={<ConsumerLayout />}>
                  <Route path="dashboard" element={<ConsumerDashboard />} />
                  <Route path="readings" element={<ConsumerReadings />} />
                  <Route path="bills" element={<ConsumerBills />} />
                  <Route path="change-password" element={<ConsumerChangePassword />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </ConsumerAuthProvider>
          </SearchProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;