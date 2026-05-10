import AsyncStorage from '@react-native-async-storage/async-storage';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const OFFLINE_QUEUE_KEY = 'offline_readings_queue';

/**
 * Save a reading to offline queue (when no internet)
 */
export const saveOfflineReading = async (readingData) => {
    try {
        const queue = await getOfflineQueue();
        
        // Find existing reading for same consumer on same date
        const existingIndex = queue.findIndex(r => 
            r.consumer_id === readingData.consumer_id && 
            r.reading_date === readingData.reading_date &&
            r.status !== 'synced' // Only update pending/failed
        );

        let offlineReading;
        if (existingIndex >= 0) {
            offlineReading = {
                ...queue[existingIndex],
                ...readingData,
                status: readingData.status || 'pending',
                lastError: null,
                updatedAt: new Date().toISOString(),
            };
            queue[existingIndex] = offlineReading;
            console.log('🔄 [Storage] Updated existing offline reading:', offlineReading.id);
        } else {
            offlineReading = {
                ...readingData,
                id: `offline_${Date.now()}`,
                status: readingData.status || 'pending',
                savedAt: new Date().toISOString(),
            };
            queue.push(offlineReading);
            console.log('✅ [Storage] Saved new offline reading:', offlineReading.id);
        }
        
        await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        
        return offlineReading;
    } catch (error) {
        console.error('❌ [Storage] Error saving offline reading:', error);
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
    // Count both fresh 'pending' and server-rejected 'failed' readings
    return queue.filter((r) => r.status === 'pending' || r.status === 'failed').length;
};

/**
 * Clear all readings from the queue (manual reset)
 */
export const clearOfflineQueue = async () => {
    try {
        await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
        console.log('🧹 [Storage] Offline queue cleared manually');
    } catch (error) {
        console.error('Error clearing offline queue:', error);
    }
};

/**
 * Sync all pending readings with the server
 * @param {Function} submitFn - the API function to call for each reading
 * @returns {Object} { synced: number, failed: number }
 */
export const markAsFailed = async (offlineId, errorMessage) => {
    try {
        const queue = await getOfflineQueue();
        const updated = queue.map((r) =>
            r.id === offlineId ? { ...r, status: 'failed', lastError: errorMessage } : r
        );
        await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
    } catch (error) {
        console.error('Error marking as failed:', error);
    }
};

export const syncOfflineReadings = async (submitFn) => {
    const queue = await getOfflineQueue();
    // Try to sync both 'pending' and previously 'failed' ones (in case they were fixed or transient)
    const toSync = queue.filter((r) => r.status === 'pending' || r.status === 'failed');

    let synced = 0;
    let failed = 0;
    const errors = [];

    for (const reading of toSync) {
        try {
            await submitFn(reading.consumer_id, reading.current_reading, reading.reading_date);
            await markAsSynced(reading.id);
            synced++;
        } catch (error) {
            const errorDetail = error.response?.data?.error || error.response?.data?.detail || error.message;
            console.error('Failed to sync reading:', reading.id, errorDetail);
            
            // Mark as failed locally so we know WHY it failed
            await markAsFailed(reading.id, errorDetail);
            
            errors.push({ id: reading.id, consumer: reading.consumer_name, error: errorDetail });
            failed++;
        }
    }

    // Clean up synced readings older than 24 hours
    const updatedQueue = await getOfflineQueue();
    const cleaned = updatedQueue.filter((r) => {
        if (r.status === 'synced') {
            const savedTime = new Date(r.savedAt).getTime();
            const now = Date.now();
            return (now - savedTime) < 24 * 60 * 60 * 1000; // Keep synced for 24h, then drop
        }
        return true;
    });
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(cleaned));

    return { synced, failed, errors };
};

/**
 * Export specific readings to an Excel file and trigger sharing.
 */
export const exportReadingsToExcel = async (readings, title = 'Readings') => {
    try {
        if (!readings || readings.length === 0) {
            throw new Error('No readings to export.');
        }

        const now = new Date();
        const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];

        const headerRow = [
            'Consumer Number',   // A
            'Consumer Name',     // B
            'Meter Number',      // C
            'Current Reading',   // D
            'Previous Reading',  // E
            'Units Consumed',    // F
            'Reading Date',      // G
        ];

        const dataRows = readings.map((r) => [
            String(r.consumer_number || r.consumer_id || ''), 
            String(r.consumer_name || ''),
            String(r.meter_number || ''),
            Number(r.current_reading || r.reading || 0),
            Number(r.previous_reading || r.prev || 0),
            Number(r.units_consumed || r.usage || 0),
            r.reading_date || r.date || today,
        ]);

        const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
        ws['!cols'] = [
            { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Readings');

        const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        const fileName = `${title.replace(/\s+/g, '_')}_${today}.xlsx`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;

        await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: 'base64' });

        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                dialogTitle: `Share ${readings.length} Reading(s)`,
                UTI: 'com.microsoft.excel.xlsx',
            });
            return { shared: true, count: readings.length };
        } else {
            throw new Error('Sharing is not available');
        }
    } catch (error) {
        console.error('Error exporting:', error);
        throw error;
    }
};

export const exportQueueToExcel = async () => {
    try {
        const queue = await getOfflineQueue();
        // Export everything from the last 24 hours (pending, failed, OR synced)
        const toExport = queue.filter((r) => {
            if (r.status === 'pending' || r.status === 'failed') return true;
            if (r.status === 'synced') {
                const savedTime = new Date(r.savedAt).getTime();
                const now = Date.now();
                return (now - savedTime) < 24 * 60 * 60 * 1000;
            }
            return false;
        });

        if (toExport.length === 0) {
            throw new Error('No recent readings to export.');
        }

        return await exportReadingsToExcel(toExport, 'Recent_Readings');
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        throw error;
    }
};
