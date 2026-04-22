import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_QUEUE_KEY = 'offline_readings_queue';

/**
 * Save a reading to offline queue (when no internet)
 */
export const saveOfflineReading = async (readingData) => {
    try {
        const queue = await getOfflineQueue();
        const offlineReading = {
            ...readingData,
            id: `offline_${Date.now()}`,
            status: 'pending', // pending | synced | failed
            savedAt: new Date().toISOString(),
        };
        queue.push(offlineReading);
        await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        return offlineReading;
    } catch (error) {
        console.error('Error saving offline reading:', error);
        throw error;
    }
};

/**
 * Get all offline readings from the queue
 */
export const getOfflineQueue = async () => {
    try {
        const data = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error getting offline queue:', error);
        return [];
    }
};

/**
 * Remove a synced reading from the offline queue
 */
export const removeFromOfflineQueue = async (offlineId) => {
    try {
        const queue = await getOfflineQueue();
        const updated = queue.filter((r) => r.id !== offlineId);
        await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
    } catch (error) {
        console.error('Error removing from offline queue:', error);
    }
};

/**
 * Mark a reading as synced in the queue
 */
export const markAsSynced = async (offlineId) => {
    try {
        const queue = await getOfflineQueue();
        const updated = queue.map((r) =>
            r.id === offlineId ? { ...r, status: 'synced' } : r
        );
        await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
    } catch (error) {
        console.error('Error marking as synced:', error);
    }
};

/**
 * Get count of pending (unsynced) readings
 */
export const getPendingCount = async () => {
    const queue = await getOfflineQueue();
    return queue.filter((r) => r.status === 'pending').length;
};

/**
 * Sync all pending readings with the server
 * @param {Function} submitFn - the API function to call for each reading
 * @returns {Object} { synced: number, failed: number }
 */
export const syncOfflineReadings = async (submitFn) => {
    const queue = await getOfflineQueue();
    const pending = queue.filter((r) => r.status === 'pending');

    let synced = 0;
    let failed = 0;

    for (const reading of pending) {
        try {
            await submitFn(reading.consumer_id, reading.current_reading, reading.reading_date);
            await markAsSynced(reading.id);
            synced++;
        } catch (error) {
            console.error('Failed to sync reading:', reading.id, error);
            failed++;
        }
    }

    // Clean up synced readings older than 24 hours
    const updatedQueue = await getOfflineQueue();
    const cleaned = updatedQueue.filter((r) => {
        if (r.status === 'synced') {
            const savedTime = new Date(r.savedAt).getTime();
            const now = Date.now();
            return now - savedTime < 24 * 60 * 60 * 1000; // Keep for 24h
        }
        return true;
    });
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(cleaned));

    return { synced, failed };
};
