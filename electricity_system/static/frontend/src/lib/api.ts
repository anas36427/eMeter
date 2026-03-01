const getCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
};

async function request<T>(
  path: string,
  options: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const { json, ...init } = options;
  const headers: HeadersInit = {
    ...(init.headers as Record<string, string>),
  };
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const method = (init.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    const csrf = getCookie("csrftoken");
    if (csrf) headers["X-CSRFToken"] = csrf;
  }
  const body = json !== undefined ? JSON.stringify(json) : init.body;
  const res = await fetch(path, { ...init, headers, body, credentials: "include" });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const data = JSON.parse(text);
      detail = data.detail || data.error || text;
    } catch {
      // use text as-is
    }
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  const contentType = res.headers.get("Content-Type");
  if (contentType && contentType.includes("application/json")) return res.json() as Promise<T>;
  return undefined as T;
}

export type UserRole = "admin" | "meter_reader" | "consumer";

export interface MeResponse {
  authenticated: boolean;
  username: string;
  role: UserRole;
}

export interface LoginPayload {
  username: string;
  password: string;
  role: UserRole;
}

export interface LoginResponse {
  success: boolean;
  username: string;
  role: UserRole;
}

export interface ConsumerItem {
  id: number;
  name: string;
  meter_number: string;
  consumer_number: string;
}

export interface BillItem {
  id: number;
  units: number;
  total_amount: number;
  status: string;
  billing_period: string | null;
  due_date: string | null;
}

export interface DashboardStats {
  total_consumers: number;
  active_consumers: number;
  total_bills: number;
  paid_bills: number;
  unpaid_bills: number;
  overdue_bills: number;
  total_revenue: number;
}

export const api = {
  me: () => request<MeResponse>("/api/me/"),
  login: (payload: LoginPayload) =>
    request<LoginResponse>("/api/login/", { method: "POST", json: payload }),
  logout: () => request<unknown>("/logout/", { method: "GET" }),
  consumers: () =>
    request<{ consumers: ConsumerItem[] }>("/api/consumers/"),
  consumer: (id: number) =>
    request<ConsumerItem & { address?: string; status?: string; previous_reading?: number }>(
      `/api/consumer/${id}/`
    ),
  bills: () => request<{ bills: BillItem[] }>("/api/bills/"),
  bill: (id: number) =>
    request<{
      id: number;
      consumer: string;
      units: number;
      rate: number;
      fixed_charges: number;
      energy_charges: number;
      total_amount: number;
      status: string;
      due_date: string;
    }>(`/api/bill/${id}/`),
  calculateBill: (params: { units?: number; rate?: number; fixed_charges?: number }) => {
    const sp = new URLSearchParams();
    if (params.units != null) sp.set("units", String(params.units));
    if (params.rate != null) sp.set("rate", String(params.rate));
    if (params.fixed_charges != null) sp.set("fixed_charges", String(params.fixed_charges));
    return request<{ units: number; energy_charges: number; fixed_charges: number; total_amount: number }>(
      "/api/calculate-bill/?" + sp.toString()
    );
  },
  submitReading: (payload: { consumer_id: number; current_reading: number; reading_date: string }) =>
    request<{ success: boolean; reading_id?: number; units_consumed?: number }>(
      "/api/submit-reading/",
      { method: "POST", json: payload }
    ),
  dashboardStats: () => request<DashboardStats>("/api/dashboard-stats/"),
  generateBill: (payload: {
    consumer_id: number;
    units: number;
    rate_per_unit?: number;
    fixed_charges?: number;
    billing_period?: string;
    due_date?: string;
  }) =>
    request<{ success: boolean; bill_id?: number; bill_number?: string }>(
      "/api/generate-bill/",
      { method: "POST", json: payload }
    ),
};
