/**
 * Web API entry point.
 * All business logic lives in @emeter/api-client.
 * This file creates the web-specific axios instance (cookie/CSRF auth)
 * and binds every function so existing imports keep working.
 */
import { createApiClient } from '@emeter/api-client';
import * as Client from '@emeter/api-client';

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : null;
}

// Use relative URL so Vite proxy handles routing correctly in dev.
// In production, set VITE_API_URL to the full backend URL (e.g. https://api.yourdomain.com)
const apiBaseUrl = import.meta.env.VITE_API_URL || '';

/** Shared axios instance for the web app */
export const api = createApiClient({
  baseURL: apiBaseUrl,
  getCsrfToken,
  onUnauthorized: () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  },
});

// ─── Bind every API function to the web instance ─────────────────

export const login = (u: string, p: string, r?: string) => Client.login(api, u, p, r);
export const logout = () => Client.logout(api);
export const getCurrentUser = () => Client.getCurrentUser(api);
export const updateProfile = (d: any) => Client.updateProfile(api, d);
export const fetchCsrfToken = () => Client.fetchCsrfToken(api);

export const getConsumers = () => Client.getConsumers(api);
export const getConsumer = (id: number) => Client.getConsumer(api, id);
export const getConsumerReadings = (id: number, params?: any) => Client.getConsumerReadings(api, id, params);
export const createConsumer = (data: any) => Client.createConsumer(api, data);
export const updateConsumer = (id: number, data: any) => Client.updateConsumer(api, id, data);
export const deleteConsumer = (id: number) => Client.deleteConsumer(api, id);
export const searchConsumer = (m: string) => Client.searchConsumer(api, m);

export const getReadings = () => Client.getReadings(api);
export const submitReading = (p: any) => Client.submitReading(api, p);
export const submitReadingAndBill = (c: number, r: number, d: string) => Client.submitReadingAndBill(api, c, r, d);
export const bulkSubmitReadings = (p: any) => Client.bulkSubmitReadings(api, p);
export const editReading = (id: number, r: number) => Client.editReading(api, id, r);
export const importReadingsFile = (f: File) => Client.importReadingsFile(api, f);
export const importReadingsExcel = (f: File) => Client.importReadingsExcel(api, f);

export const getBills = (params?: any) => Client.getBills(api, params);
export const getBill = (id: number) => Client.getBill(api, id);
export const markPaid = (id: number) => Client.markPaid(api, id);
export const markUnpaid = (id: number) => Client.markUnpaid(api, id);
export const calculateBill = (u: number, r: number, f: number) => Client.calculateBill(api, u, r, f);
export const getBillingSettings = () => Client.getBillingSettings(api);
export const updateBillingSettings = (d: any) => Client.updateBillingSettings(api, d);
export const getBillPdfUrl = (id: number) => Client.getBillPdfUrl(api, id);
export const sendBillSms = (id: number) => Client.sendBillSms(api, id);

export const bulkGenerateBills = (d: any) => Client.bulkGenerateBills(api, d);
export const manualGenerateBill = (d: any) => Client.manualGenerateBill(api, d);

export const getDashboardStats = () => Client.getDashboardStats(api);
export const getReportsData = () => Client.getReportsData(api);
