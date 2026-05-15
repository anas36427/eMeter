import axios from 'axios';

export const createApiClient = (config) => {
  const instance = axios.create({
    withCredentials: true,
    ...config
  });
  
  if (config.getCsrfToken) {
    instance.interceptors.request.use(req => {
      const token = config.getCsrfToken();
      if (token) req.headers['X-CSRFToken'] = token;
      return req;
    });
  }
  
  instance.interceptors.response.use(
    res => {
      // Flatten common Django JSONResponse dictionary wrappers into arrays for the UI
      if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
        // Preserve full response if pagination metadata is present
        if (res.data.total_pages !== undefined) return res;

        if (res.data.consumers && Array.isArray(res.data.consumers)) res.data = res.data.consumers;
        else if (res.data.readings && Array.isArray(res.data.readings)) res.data = res.data.readings;
        else if (res.data.bills && Array.isArray(res.data.bills)) res.data = res.data.bills;
      }
      return res;
    },
    error => {
      if (config.onUnauthorized && (error.response?.status === 401 || error.response?.status === 403)) {
        config.onUnauthorized();
      }
      return Promise.reject(error);
    }
  );
  
  return instance;
};

export const login = (api, u, p, r) => api.post('/api/login/', { username: u, password: p, role: r });
export const logout = (api) => api.post('/api/logout/');
export const getCurrentUser = (api) => api.get('/api/me/');
export const fetchCsrfToken = (api) => api.get('/api/csrf-token/');

export const getConsumers = (api) => api.get('/api/consumers/');
export const getConsumer = (api, id) => api.get(`/api/consumer/${id}/`).then(res => res.data);
export const getConsumerReadings = (api, id, params) => api.get(`/api/consumer/${id}/readings/`, { params }).then(res => res.data);
export const createConsumer = (api, data) => api.post('/api/consumers/', data);
export const updateConsumer = (api, id, data) => api.patch(`/api/consumer/${id}/`, data);
export const deleteConsumer = (api, id) => api.delete(`/api/consumer/${id}/`);
export const searchConsumer = (api, m) => api.get('/api/consumers/search/', { params: { q: m } });

export const getReadings = (api) => api.get('/api/readings/');
export const submitReading = (api, p) => api.post('/api/reading/', p);
export const submitReadingAndBill = (api, c, r, d) => api.post('/api/reading-and-bill/', { consumer_id: c, reading: r, date: d });
export const bulkSubmitReadings = (api, p) => api.post('/api/bulk-readings/', p);
export const editReading = (api, id, r) => api.patch(`/api/edit-reading/${id}/`, { reading: r });
export const importReadingsFile = (api, f) => {
  const formData = new FormData();
  formData.append('file', f);
  return api.post('/api/import-readings/', formData);
};

export const importReadingsExcel = (api, f) => {
  const formData = new FormData();
  formData.append('file', f);
  return api.post('/api/readings/import-excel/', formData);
};

export const getBills = (api, params) => api.get('/api/bills/', { params });
export const getBill = (api, id) => api.get(`/api/bill/${id}/`).then(res => res.data);
export const markPaid = (api, id) => api.post(`/api/bills/${id}/mark-paid/`);
export const markUnpaid = (api, id) => api.post(`/api/bills/${id}/mark-unpaid/`);
export const calculateBill = (api, u, r, f) => api.post('/api/calculate-bill/', { units: u, rate: r, fixed: f });
export const getBillingSettings = (api) => api.get('/api/settings/');
export const updateBillingSettings = (api, d) => api.post('/api/settings/update/', d);
export const getBillPdfUrl = (api, id) => `/api/bill/${id}/pdf/`;
export const sendBillSms = (api, id) => api.post('/api/send-bill-sms/', { bill_id: id });
export const bulkGenerateBills = (api, d) => api.post('/api/bills/bulk-generate/', d);
export const manualGenerateBill = (api, d) => api.post('/api/bills/manual-generate/', d);

export const getDashboardStats = (api) => api.get('/api/dashboard-stats/');
export const getReportsData = (api) => api.get('/api/reports-data/');
