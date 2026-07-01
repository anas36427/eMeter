import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// ================================================
// API Configuration
// ================================================
// Always use the production URL from the environment variable.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';

if (!BASE_URL) {
    console.warn(
        '⚠️ WARNING: EXPO_PUBLIC_API_URL is not set. API calls will fail. ' +
        'Offline SQLite features remain fully functional.'
    );
}

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': 'true'
    },
    // BUG-03 FIX: removed withCredentials: true as it has no effect on React Native and complicates CORS
});

// Attach auth token to every request
// Reads from SecureStore (encrypted) instead of AsyncStorage
api.interceptors.request.use(async (config) => {
    // Always fetch latest token from SecureStore to avoid stale module variable state (BUG-05 FIX)
    const currentToken = await SecureStore.getItemAsync('authToken');

    if (currentToken) {
        config.headers['Authorization'] = `Token ${currentToken}`;
        if (__DEV__) {
            console.log('DEBUG: Sending request with Token:', currentToken.substring(0, 5) + '...');
        }
    }

    return config;
});

// Handle 401 Unauthorized globally
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response && error.response.status === 401) {
            console.log('DEBUG: 401 Unauthorized detected. Clearing stale tokens.');
            // Clear auth token from SecureStore; keep consumer cache in AsyncStorage intact
            await SecureStore.deleteItemAsync('authToken');
            await AsyncStorage.removeItem('user');
        }
        return Promise.reject(error);
    }
);

// ========================
// Auth APIs
// ========================

export const loginAPI = async (username, password) => {
    const response = await api.post('/api/login/', {
        username,
        password,
        source: 'mobile',
    });

    // Token Authentication: store the token securely using SecureStore (encrypted)
    // The mobile app uses Token Auth exclusively — no CSRF cookies needed.
    if (response.data.token) {
        const authToken = response.data.token;
        if (__DEV__) console.log('DEBUG: Auth token received and stored securely.');
        await SecureStore.setItemAsync('authToken', authToken);
    }

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
        // Clear auth token from SecureStore; keep SQLite consumer cache intact
        await SecureStore.deleteItemAsync('authToken');
        await AsyncStorage.removeItem('user');
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
    const response = await api.get(`/api/consumers/${consumerId}/`);
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

export const getReadingsAPI = async (params = {}) => {
    const response = await api.get('/api/readings/', { params });
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
// Bill Detail API
// ========================

/**
 * BUG-29 FIX: Fetch full bill details by bill ID.
 * The /api/reading-and-bill/ endpoint only returns bill_id, not a full bill object.
 * BillPreviewScreen needs the complete bill, so we fetch it here after submission.
 */
export const getBillDetailAPI = async (billId) => {
    const response = await api.get(`/api/bill/${billId}/`);
    return response.data;
};

// ========================
// Bill PDF API
// ========================

export const getBillPdfUrl = async (billId) => {
    return `${BASE_URL}/api/bill/${billId}/pdf/`;
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

// ========================
// Notifications API
// ========================

export const getNotificationsAPI = async () => {
    const response = await api.get('/api/notifications/');
    return response.data;
};

export const markNotificationsReadAPI = async (notificationId = null) => {
    const payload = notificationId ? { notification_id: notificationId } : {};
    const response = await api.post('/api/notifications/mark-read/', payload);
    return response.data;
};
export default api;
