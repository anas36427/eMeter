/**
 * ConsumerAuthContext.tsx
 * Isolated authentication context for the consumer portal.
 * Completely separate from the admin auth context — no interference.
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';
const CONSUMER_TOKEN_KEY = 'consumer_auth_token';
const CONSUMER_PROFILE_KEY = 'consumer_profile';

interface ConsumerProfile {
  consumer_number: string;
  name: string;
  meter_number: string;
  email: string;
  phone: string;
  address: string;
  connection_type: string;
  billing_type: string;
  status: string;
}

interface ConsumerAuthContextType {
  token: string | null;
  profile: ConsumerProfile | null;
  isLoading: boolean;
  isInitializing: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const ConsumerAuthContext = createContext<ConsumerAuthContextType | null>(null);

export function ConsumerAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<ConsumerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  // Ref so event listener always sees whether init is complete
  const initCompleteRef = useRef(false);

  // On mount: validate any stored token against /api/consumer/portal/me/
  useEffect(() => {
    const savedToken = localStorage.getItem(CONSUMER_TOKEN_KEY);

    if (!savedToken) {
      initCompleteRef.current = true;
      setIsInitializing(false);
      return;
    }

    // Token exists — verify it is still valid with the server
    fetch(`${API_BASE}/api/consumer/portal/me/`, {
      headers: { Authorization: `Token ${savedToken}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Token invalid');
        const data: ConsumerProfile = await res.json();
        // Token is valid — restore session
        setToken(savedToken);
        setProfile(data);
        // Keep localStorage in sync with latest server data
        localStorage.setItem(CONSUMER_PROFILE_KEY, JSON.stringify(data));
      })
      .catch(() => {
        // Token is expired or invalid — clear silently
        localStorage.removeItem(CONSUMER_TOKEN_KEY);
        localStorage.removeItem(CONSUMER_PROFILE_KEY);
        setToken(null);
        setProfile(null);
      })
      .finally(() => {
        initCompleteRef.current = true;
        setIsInitializing(false);
      });
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      // Step 1: Authenticate and get token (same /api/login/ endpoint as admin)
      const loginRes = await fetch(`${API_BASE}/api/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const loginData = await loginRes.json();

      if (!loginRes.ok || !loginData.success) {
        throw new Error(loginData.detail || 'Invalid username or password.');
      }

      if (loginData.role !== 'consumer') {
        throw new Error('Access denied. This portal is for consumers only.');
      }

      const authToken: string = loginData.token;

      // Step 2: Fetch consumer profile
      const profileRes = await fetch(`${API_BASE}/api/consumer/portal/me/`, {
        headers: { Authorization: `Token ${authToken}` },
      });

      if (!profileRes.ok) {
        throw new Error('Could not load your profile. Contact your administrator.');
      }

      const profileData: ConsumerProfile = await profileRes.json();

      // Persist
      localStorage.setItem(CONSUMER_TOKEN_KEY, authToken);
      localStorage.setItem(CONSUMER_PROFILE_KEY, JSON.stringify(profileData));
      setToken(authToken);
      setProfile(profileData);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(CONSUMER_TOKEN_KEY);
    localStorage.removeItem(CONSUMER_PROFILE_KEY);
    setToken(null);
    setProfile(null);
  };

  return (
    <ConsumerAuthContext.Provider value={{ token, profile, isLoading, isInitializing, login, logout }}>
      {children}
    </ConsumerAuthContext.Provider>
  );
}

export function useConsumerAuth(): ConsumerAuthContextType {
  const ctx = useContext(ConsumerAuthContext);
  if (!ctx) throw new Error('useConsumerAuth must be used inside ConsumerAuthProvider');
  return ctx;
}

/** Typed fetch helper pre-wired with consumer Token auth */
export async function consumerFetch(path: string, token: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${token}`,
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).detail || `Request failed (${res.status})`);
  }
  return res.json();
}
