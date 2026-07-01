/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { login as loginApi, logout as logoutApi } from "@/lib/api";

type Role = "admin" | "meter_reader" | "consumer";

interface AuthState {
  isAuthenticated: boolean;
  username: string;
  role: Role | null;
}

interface AuthContextType extends AuthState {
  isInitializing: boolean;
  login: (username: string, password: string) => Promise<Role>;
  logout: () => Promise<void>;
}

const API_BASE = import.meta.env.VITE_API_URL || "";
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    username: "",
    role: null,
  });
  const [isInitializing, setIsInitializing] = useState(true);

  // Track whether initialization is complete so the force-logout listener
  // does NOT fire while we are still probing the stored token.
  // Using a ref so the event listener always sees the latest value.
  const initCompleteRef = useRef(false);

  // ── Startup token validation ────────────────────────────────────
  // Uses plain fetch() intentionally — NOT the shared Axios api instance.
  // This prevents the Axios 401 interceptor from firing and logging the user
  // out during the startup probe (which is a read-only check, not an assertion).
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      initCompleteRef.current = true;
      setIsInitializing(false);
      return;
    }

    // Validate the stored token directly against /api/me/
    fetch(`${API_BASE}/api/me/`, {
      headers: { Authorization: `Token ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Token invalid or expired");
        const data = await res.json();
        setAuth({
          isAuthenticated: true,
          username: data.username,
          role: data.role as Role,
        });
        localStorage.setItem(
          "auth",
          JSON.stringify({ isAuthenticated: true, username: data.username, role: data.role })
        );
      })
      .catch(() => {
        // Token is stale — clear silently, user will see login page
        localStorage.removeItem("token");
        localStorage.removeItem("auth");
        setAuth({ isAuthenticated: false, username: "", role: null });
      })
      .finally(() => {
        initCompleteRef.current = true;
        setIsInitializing(false);
      });
  }, []);

  // ── Mid-session force logout (e.g. 401 on a real data request) ─
  // Only fires AFTER initialization is complete. This prevents a temporary
  // backend hiccup during startup from logging the user out incorrectly.
  useEffect(() => {
    const handleForceLogout = () => {
      // Ignore 401s that happen during the startup validation phase
      if (!initCompleteRef.current) return;

      console.warn("Forced logout triggered by 401 Unauthorized.");
      localStorage.removeItem("token");
      localStorage.removeItem("auth");
      setAuth({ isAuthenticated: false, username: "", role: null });
    };

    window.addEventListener("auth:logout", handleForceLogout);
    return () => window.removeEventListener("auth:logout", handleForceLogout);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await loginApi(username, password);
    const serverRole = res.data.role as Role;
    const token = res.data.token;
    if (token) {
      localStorage.setItem("token", token);
    }
    const state: AuthState = {
      isAuthenticated: true,
      username: res.data.username || username,
      role: serverRole,
    };
    localStorage.setItem("auth", JSON.stringify(state));
    setAuth(state);
    return serverRole;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch (e) {
      console.warn("Backend logout failed or session already expired.", e);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("auth");
      setAuth({ isAuthenticated: false, username: "", role: null });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...auth, isInitializing, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
