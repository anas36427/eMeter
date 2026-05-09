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
 * Export pending readings to an Excel file and trigger sharing.
 *
 * Column layout (matches the backend import endpoint):
 *   A  – Consumer Number  (required by backend)
 *   B  – Current Reading  (required by backend)
 *   C  – Reading Date     (YYYY-MM-DD, optional by backend)
 *   D  – Consumer Name    (reference only, ignored by backend)
 *   E  – Previous Reading (reference only, ignored by backend)
 */
export const exportQueueToExcel = async () => {
    try {
        const queue = await getOfflineQueue();
        // Export everything that hasn't been successfully synced yet
        const toExport = queue.filter((r) => r.status === 'pending' || r.status === 'failed');

        if (toExport.length === 0) {
            throw new Error('No pending or failed readings to export.');
        }

        const now = new Date();
        const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];

        // ── Row 0: header (row 1 in Excel) ─────────────────────────
        const headerRow = [
            'Consumer Number',   // A  ← backend reads this
            'Current Reading',   // B  ← backend reads this
            'Reading Date',      // C  ← backend reads this (optional)
            'Consumer Name',     // D  ← reference only
            'Previous Reading',  // E  ← reference only
        ];

        // ── Data rows (row 2+ in Excel) ─────────────────────────────
        const dataRows = toExport.map((r) => [
            String(r.consumer_number || ''),          // A
            Number(r.current_reading),                // B
            r.reading_date || today,                  // C  (YYYY-MM-DD)
            String(r.consumer_name || ''),            // D
            Number(r.previous_reading || 0),          // E
        ]);

        // Build worksheet from array-of-arrays to guarantee column order
        const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

        // Column widths for readability
        ws['!cols'] = [
            { wch: 18 },   // A  Consumer Number
            { wch: 16 },   // B  Current Reading
            { wch: 14 },   // C  Reading Date
            { wch: 22 },   // D  Consumer Name
            { wch: 16 },   // E  Previous Reading
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Readings');

        // Generate base64 string and write to device
        const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        const fileName = `Readings_${today}_${toExport.length}rows.xlsx`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;

        await FileSystem.writeAsStringAsync(fileUri, wbout, {
            encoding: 'base64',
        });

        // Share / save
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                dialogTitle: `Share ${toExport.length} Reading(s) — ${today}`,
                UTI: 'com.microsoft.excel.xlsx',
            });
            return { shared: true, count: toExport.length, fileName };
        } else {
            throw new Error('Sharing is not available on this device.');
        }
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        throw error;
    }
};
