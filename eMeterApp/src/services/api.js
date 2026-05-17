import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ================================================
// API Configuration
// Change this to your Django server's IP address
// For local dev: use your computer's local IP (not localhost)
// e.g., 'http://192.168.1.100:8000'
// ================================================
const BASE_URL = 'http://10.11.53.13:8000';

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

// Session/Token management
let authToken = null;
let csrfToken = null;
let sessionId = null;

// Attach auth tokens to every request
api.interceptors.request.use(async (config) => {
    // Always fetch latest token from storage to avoid stale module variable state
    const currentToken = await AsyncStorage.getItem('authToken');
    const currentCsrfToken = await AsyncStorage.getItem('csrfToken');

    if (currentToken) {
        config.headers['Authorization'] = `Token ${currentToken}`;
        console.log('DEBUG: Sending request with Token:', currentToken.substring(0, 5) + '...');
    }
    
    return config;
});

// Handle 401 Unauthorized globally
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response && error.response.status === 401) {
            console.log('DEBUG: 401 Unauthorized detected. Clearing stale tokens.');
            await AsyncStorage.multiRemove(['authToken', 'user', 'csrfToken', 'sessionId']);
            // The app will naturally redirect to login on next reload or if it checks AsyncStorage
        }
        return Promise.reject(error);
    }
);

// ========================
// Auth APIs
// ========================

export const loginAPI = async (username, password, role = 'admin') => {
    const response = await api.post('/api/login/', {
        username,
        password,
        role,
    });

    // Extract session cookies from response (handles both lower and Pascal case)
    const setCookieHeader = response.headers['set-cookie'] || response.headers['Set-Cookie'];
    if (setCookieHeader) {
        console.log('DEBUG: set-cookie header found:', setCookieHeader);
        const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader.split(',');
        for (const cookie of cookies) {
            if (cookie.includes('sessionid=')) {
                const match = cookie.match(/sessionid=([^;]+)/);
                if (match) {
                    sessionId = match[1];
                    console.log('DEBUG: Extracted sessionId from header:', sessionId);
                    await AsyncStorage.setItem('sessionId', sessionId);
                }
            }
            if (cookie.includes('csrftoken=')) {
                const match = cookie.match(/csrftoken=([^;]+)/);
                if (match) {
                    csrfToken = match[1];
                    console.log('DEBUG: Extracted csrfToken from header:', csrfToken);
                    await AsyncStorage.setItem('csrfToken', csrfToken);
                }
            }
        }
    }
    
    // Token Fallback: Preferred for Mobile
    if (response.data.token) {
        authToken = response.data.token;
        console.log('DEBUG: Found authToken in response body:', authToken);
        await AsyncStorage.setItem('authToken', authToken);
    }
    if (response.data.csrftoken) {
        csrfToken = response.data.csrftoken;
        console.log('DEBUG: Found csrfToken in response body:', csrfToken);
        await AsyncStorage.setItem('csrfToken', csrfToken);
    }


    // Also check response data for tokens
    if (response.data.success) {
        await AsyncStorage.setItem('user', JSON.stringify(response.data));
    }

    return response.data;
};

export const checkAuthAPI = async () => {
    const response = await api.get('/api/me/');
    return response.data;
};

export const logoutAPI = async () => {
    try {
        await api.post('/api/logout/');
    } finally {
        authToken = null;
        sessionId = null;
        csrfToken = null;
        await AsyncStorage.multiRemove(['authToken', 'sessionId', 'csrfToken', 'user']);
    }
};

// ========================
// Consumer APIs
// ========================

export const getConsumersAPI = async () => {
    const response = await api.get('/api/consumers/');
    return response.data;
};

export const searchConsumerAPI = async (meterNumber) => {
    const response = await api.get('/api/consumers/search/', {
        params: { meter_number: meterNumber },
    });
    return response.data;
};

export const getConsumerDetailAPI = async (consumerId) => {
    const response = await api.get(`/api/consumer/${consumerId}/`);
    return response.data;
};

// ========================
// Reading + Bill APIs
// ========================

export const submitReadingAndBillAPI = async (consumerId, currentReading, readingDate) => {
    const response = await api.post('/api/reading-and-bill/', {
        consumer_id: consumerId,
        current_reading: currentReading,
        reading_date: readingDate,
    });
    return response.data;
};

export const editReadingAPI = async (readingId, currentReading) => {
    const response = await api.patch(`/api/edit-reading/${readingId}/`, {
        current_reading: currentReading,
    });
    return response.data;
};

export const getReadingsAPI = async () => {
    const response = await api.get('/api/readings/');
    return response.data;
};

// ========================
// SMS API
// ========================

export const sendBillSmsAPI = async (billId) => {
    const response = await api.post('/api/send-bill-sms/', {
        bill_id: billId,
    });
    return response.data;
};

// ========================
// Dashboard API
// ========================

export const getDashboardStatsAPI = async () => {
    const response = await api.get('/api/dashboard-stats/');
    return response.data;
};

// ========================
// Settings API
// ========================

export const getSettingsAPI = async () => {
    const response = await api.get('/api/settings/');
    return response.data;
};

export const updateSettingsAPI = async (settingsData) => {
    const response = await api.post('/api/settings/update/', settingsData);
    return response.data;
};

// ========================
// Consumer Management API
// ========================

export const addConsumerAPI = async (consumerData) => {
    const response = await api.post('/api/consumers/', consumerData);
    return response.data;
};

// ========================
// Bill PDF API
// ========================

export const getBillPdfUrl = (billId) => {
    return `${BASE_URL}/bill/${billId}/pdf/`;
};

// ========================
// Estimate API
// ========================

/**
 * Fetch a real-time bill estimate from the server.
 * Uses the live BillingSettings from the DB — single source of truth.
 * @param {number} consumerId
 * @param {number} currentReading
 * @param {number} previousReading
 * @returns {Promise<Object>} Full cost breakdown + total_amount
 */
export const calculateEstimateAPI = async (consumerId, currentReading, previousReading) => {
    const response = await api.post('/api/calculate-estimate/', {
        consumer_id: consumerId,
        current_reading: currentReading,
        previous_reading: previousReading,
    });
    return response.data;
};


export { BASE_URL };
export default api;
