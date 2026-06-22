import { query, initDatabase } from './sqliteDb';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

/**
 * Initialize the SQLite database tables on app launch
 */
export const initializeAppDb = async () => {
    try {
        await initDatabase();
        console.log('✅ SQLite Database successfully initialized');
    } catch (err) {
        console.error('❌ Failed to initialize SQLite database:', err);
    }
};

/**
 * Cache downloaded consumer registry into local SQLite consumers table
 */
export const cacheConsumersToDb = async (consumers) => {
    try {
        for (const c of consumers) {
            await query(
                `INSERT OR REPLACE INTO consumers 
                (id, consumer_number, name, email, phone, address, meter_number, meter_type, load_kw, previous_reading, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    c.id,
                    c.consumer_number,
                    c.name,
                    c.email || '',
                    c.phone || '',
                    c.address || '',
                    c.meter_number || '',
                    c.meter_type || '10',
                    Number(c.load_kw || 1.0),
                    Number(c.previous_reading || 0.0),
                    c.status || 'active'
                ]
            );
        }
        console.log(`✅ Cached ${consumers.length} consumers into local SQLite`);
    } catch (err) {
        console.error('Error caching consumers in SQLite:', err);
    }
};

/**
 * Perform completely offline consumer search inside SQLite
 */
export const searchConsumersOffline = async (searchQuery) => {
    try {
        if (!searchQuery.trim()) {
            const result = await query(`SELECT * FROM consumers LIMIT 50`);
            return result.rows;
        }
        const term = `%${searchQuery.trim()}%`;
        const result = await query(
            `SELECT * FROM consumers WHERE 
            name LIKE ? OR 
            consumer_number LIKE ? OR 
            meter_number LIKE ?`,
            [term, term, term]
        );
        return result.rows;
    } catch (err) {
        console.error('Offline consumer search failed:', err);
        return [];
    }
};

/**
 * Cache central billing settings to local SQLite for offline estimate computations
 */
export const cacheBillingSettings = async (settings) => {
    try {
        await query(
            `INSERT OR REPLACE INTO billing_settings 
            (id, rate_per_unit, fixed_charge_per_kw, duty_percentage, phase_1_rent, phase_3_rent, surcharge_percentage)
            VALUES (1, ?, ?, ?, ?, ?, ?)`,
            [
                Number(settings.rate_per_unit || 6.50),
                Number(settings.fixed_charge_per_kw || 50.00),
                Number(settings.duty_percentage || 5.00),
                Number(settings.phase_1_rent || 10.00),
                Number(settings.phase_3_rent || 25.00),
                Number(settings.surcharge_percentage || 2.00)
            ]
        );
        console.log('✅ SQLite: Saved latest billing settings locally');
    } catch (err) {
        console.error('Failed to cache settings in SQLite:', err);
    }
};

/**
 * Perform 100% offline billing estimate calculation using SQLite values
 */
export const calculateOfflineEstimate = async (consumerId, currentVal, prevVal) => {
    try {
        const settingsRes = await query(`SELECT * FROM billing_settings WHERE id = 1`);
        const settings = settingsRes.rows[0] || {
            rate_per_unit: 6.50,
            fixed_charge_per_kw: 50.00,
            duty_percentage: 5.00,
            meter_rent: 10.00,
            surcharge_percentage: 2.00
        };

        const consumerRes = await query(`SELECT * FROM consumers WHERE id = ?`, [consumerId]);
        const consumer = consumerRes.rows[0] || { load_kw: 1.0 };

        const units = Number(currentVal) - Number(prevVal);
        const energyCharges = units * settings.rate_per_unit;
        const fixedCharges = (consumer.load_kw || 1.0) * settings.fixed_charge_per_kw;
        const dutyCharge = energyCharges * (settings.duty_percentage / 100);
        
        // Dynamic meter rent based on meter_type
        const actualMeterRent = String(consumer.meter_type) === '10' ? settings.phase_1_rent : settings.phase_3_rent;
        
        const regulatorySurcharge = energyCharges * (settings.surcharge_percentage / 100);
        const total = energyCharges + fixedCharges + dutyCharge + actualMeterRent + regulatorySurcharge;

        return {
            units_consumed: units,
            load_kw: consumer.load_kw,
            total_amount: Number(total.toFixed(2)),
            breakdown: {
                rate_per_unit: settings.rate_per_unit,
                energy_charges: energyCharges,
                fixed_charge_per_kw: settings.fixed_charge_per_kw,
                fixed_charges: fixedCharges,
                duty_percentage: settings.duty_percentage,
                duty_charge: dutyCharge,
                meter_rent: actualMeterRent,
                regulatory_surcharge: regulatorySurcharge
            }
        };
    } catch (err) {
        console.error('Error calculating offline estimate:', err);
        return null;
    }
};

/**
 * Save a new reading into the offline queue in SQLite
 */
export const saveOfflineReading = async (readingData) => {
    try {
        const id = `offline_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        await query(
            `INSERT OR REPLACE INTO meter_readings 
            (id, consumer_id, consumer_number, consumer_name, meter_number, current_reading, previous_reading, reading_date, status, saved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_create', ?)`,
            [
                id,
                readingData.consumer_id,
                readingData.consumer_number,
                readingData.consumer_name,
                readingData.meter_number,
                Number(readingData.current_reading),
                Number(readingData.previous_reading),
                readingData.reading_date,
                new Date().toISOString()
            ]
        );
        console.log('✅ SQLite: Saved new offline reading:', id);
        return { id, ...readingData, status: 'pending_create' };
    } catch (error) {
        console.error('❌ SQLite: Error saving offline reading:', error);
        throw error;
    }
};

/**
 * Retrieve all offline readings from SQLite queue
 */
export const getOfflineQueue = async () => {
    try {
        const result = await query(`SELECT * FROM meter_readings ORDER BY saved_at DESC`);
        return result.rows;
    } catch (error) {
        console.error('Error getting offline queue from SQLite:', error);
        return [];
    }
};

/**
 * Get count of pending (unsynced) readings in SQLite
 */
export const getPendingCount = async () => {
    try {
        const result = await query(
            `SELECT COUNT(*) as count FROM meter_readings WHERE status = 'pending_create' OR status = 'pending_update'`
        );
        return result.rows[0]?.count || 0;
    } catch (err) {
        return 0;
    }
};

/**
 * Clear SQLite offline queue (manual reset)
 */
export const clearOfflineQueue = async () => {
    try {
        await query(`DELETE FROM meter_readings`);
        console.log('🧹 SQLite: Queue cleared');
    } catch (err) {
        console.error(err);
    }
};

/**
 * Mark a specific offline reading as synced after successful server submission.
 * Prevents duplicates accumulating in the queue indefinitely.
 */
export const markAsSynced = async (id) => {
    try {
        await query(`UPDATE meter_readings SET status = 'synced' WHERE id = ?`, [id]);
        console.log('✅ SQLite: Marked reading as synced:', id);
    } catch (err) {
        console.error('❌ SQLite: Failed to mark reading as synced:', err);
        throw err;
    }
};

/**
 * Pull and Download Latest Registry from Server (Pull Button Trigger)
 */
export const pullRegistryFromServer = async (getConsumersFn, getSettingsFn) => {
    try {
        const data = await getConsumersFn();
        const consumers = data.consumers || [];
        await cacheConsumersToDb(consumers);

        const settings = await getSettingsFn();
        if (settings) {
            await cacheBillingSettings(settings);
        }
        return { success: true, count: consumers.length };
    } catch (err) {
        console.error('Pull registry failed:', err);
        throw err;
    }
};

export const pushOfflineQueueToServer = async (submitFn) => {
    const readings = await getOfflineQueue();
    const toPush = readings.filter(r => r.status === 'pending_create' || r.status === 'pending_update');
    
    let synced = 0;
    let failed = 0;
    const errors = [];

    for (const r of toPush) {
        try {
            await submitFn(r.consumer_id, r.current_reading, r.reading_date);
            await query(`UPDATE meter_readings SET status = 'synced' WHERE id = ?`, [r.id]);
            // Only update local previous_reading AFTER server confirms success
            await query(
                `UPDATE consumers SET previous_reading = ? WHERE id = ?`,
                [Number(r.current_reading), r.consumer_id]
            );
            synced++;
        } catch (error) {
            const errorDetail = error.response?.data?.error || error.response?.data?.detail || error.message;
            
            // BUG-FIX: Handle cases where the reading actually succeeded previously but network dropped
            if (errorDetail && errorDetail.toLowerCase().includes('already exists')) {
                await query(`UPDATE meter_readings SET status = 'synced', last_error = NULL WHERE id = ?`, [r.id]);
                await query(
                    `UPDATE consumers SET previous_reading = ? WHERE id = ?`,
                    [Number(r.current_reading), r.consumer_id]
                );
                synced++;
            } else {
                await query(`UPDATE meter_readings SET status = 'conflict', last_error = ? WHERE id = ?`, [errorDetail, r.id]);
                errors.push({ id: r.id, consumer: r.consumer_name, error: errorDetail });
                failed++;
            }
        }
    }

    return { synced, failed, errors };
};

/**
 * Export offline readings to spreadsheet
 */
export const exportQueueToExcel = async () => {
    try {
        const queue = await getOfflineQueue();
        if (queue.length === 0) {
            throw new Error('No readings to export.');
        }

        const now = new Date();
        const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];

        const headerRow = [
            'Consumer Number',
            'Consumer Name',
            'Meter Number',
            'Current Reading',
            'Previous Reading',
            'Units Consumed',
            'Reading Date',
            'Sync Status'
        ];

        const dataRows = queue.map((r) => [
            String(r.consumer_number || ''),
            String(r.consumer_name || ''),
            String(r.meter_number || ''),
            Number(r.current_reading || 0),
            Number(r.previous_reading || 0),
            Number(r.current_reading - r.previous_reading),
            r.reading_date || today,
            r.status
        ]);

        const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Readings');

        const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        const fileUri = `${FileSystem.documentDirectory}Offline_Readings_${today}.xlsx`;

        await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: 'base64' });

        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri);
            return { success: true, count: queue.length };
        } else {
            throw new Error('Sharing is not available');
        }
    } catch (err) {
        console.error(err);
        throw err;
    }
};

/**
 * Remove a specific reading from the offline queue
 */
export const removeFromOfflineQueue = async (itemId) => {
    try {
        await query(`DELETE FROM meter_readings WHERE id = ?`, [itemId]);
        console.log('✅ SQLite: Removed offline reading:', itemId);
    } catch (err) {
        console.error('❌ SQLite: Failed to remove reading:', err);
        throw err;
    }
};

/**
 * Export specific readings array to spreadsheet
 */
export const exportReadingsToExcel = async (readings, title) => {
    try {
        if (!readings || readings.length === 0) {
            throw new Error('No readings to export.');
        }

        const now = new Date();
        const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        const safeTitle = title ? title.replace(/[^a-zA-Z0-9]/g, '_') : 'Readings';

        const headerRow = [
            'Consumer Number',
            'Consumer Name',
            'Meter Number',
            'Previous Reading',
            'Current Reading',
            'Units',
            'Date',
            'Status'
        ];

        const dataRows = readings.map(r => [
            String(r.consumer_number || ''),
            String(r.consumer_name || ''),
            String(r.meter_number || ''),
            Number(r.previous_reading || 0),
            Number(r.current_reading || 0),
            Number(r.units_consumed || (Number(r.current_reading) - Number(r.previous_reading)) || 0),
            String(r.reading_date || today),
            String(r.is_offline_pending ? 'Offline' : (r.status || 'Synced'))
        ]);

        const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Readings');

        const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        const fileUri = `${FileSystem.documentDirectory}${safeTitle}_${today}.xlsx`;

        await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: 'base64' });

        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri);
            return { success: true, count: readings.length };
        } else {
            throw new Error('Sharing is not available');
        }
    } catch (err) {
        console.error(err);
        throw err;
    }
};
