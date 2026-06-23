/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { login as loginApi, logout as logoutApi } from "@/lib/api";

type Role = "admin" | "meter_reader" | "consumer";

interface AuthState {
  isAuthenticated: boolean;
  username: string;
  role: Role | null;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<Role>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    const saved = sessionStorage.getItem("auth");
    return saved ? JSON.parse(saved) : { isAuthenticated: false, username: "", role: null };
  });

  // Listen for global auth:logout events (e.g. from Axios 401 interceptor)
  useEffect(() => {
    const handleForceLogout = () => {
      console.warn("Forced logout triggered by 401 Unauthorized.");
      localStorage.removeItem("token");
      sessionStorage.removeItem("auth");
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
      role: serverRole 
    };
    sessionStorage.setItem("auth", JSON.stringify(state));
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
      sessionStorage.removeItem("auth");
      setAuth({ isAuthenticated: false, username: "", role: null });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
