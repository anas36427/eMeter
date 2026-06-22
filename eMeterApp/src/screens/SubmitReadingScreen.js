import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { submitReadingAndBillAPI, calculateEstimateAPI, getBillDetailAPI } from '../services/api';  // BUG-29 FIX: added getBillDetailAPI
import { saveOfflineReading, getOfflineQueue, markAsSynced } from '../services/offlineStorage';
import { useTheme } from '../context/ThemeContext';

export default function SubmitReadingScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors);

    const { consumer } = route.params;
    const previousReading = consumer.previous_reading || 0;

    const [currentReading, setCurrentReading] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Server-side estimate — single source of truth from /api/calculate-estimate/
    const [estimate, setEstimate] = useState(null);
    const [estimateLoading, setEstimateLoading] = useState(false);
    const debounceTimer = useRef(null);

    // Restore any pending offline reading for this consumer/date
    useEffect(() => {
        const checkExistingReading = async () => {
            try {
                const now = new Date();
                const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
                const queue = await getOfflineQueue();
                const existing = queue.find(r =>
                    r.consumer_id === consumer.id &&
                    r.reading_date === localDate &&
                    r.status !== 'synced'
                );
                if (existing) {
                    setCurrentReading(String(existing.current_reading));
                }
            } catch (err) {
                console.error('Failed to check existing reading:', err);
            }
        };
        checkExistingReading();
    }, [consumer.id]);

    useEffect(() => {
        let isMounted = true;
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        const parsed = Number(currentReading);
        if (!currentReading || isNaN(parsed) || parsed < previousReading) {
            setEstimate(null);
            return;
        }

        setEstimateLoading(true);

        debounceTimer.current = setTimeout(async () => {
            try {
                const result = await calculateEstimateAPI(
                    consumer.id,
                    parsed,
                    previousReading
                );
                if (isMounted) {
                    setEstimate(result);
                }
            } catch (err) {
                console.warn('Estimate fetch failed online, falling back to local SQLite estimator:', err.message);
                const { calculateOfflineEstimate } = require('../services/offlineStorage');
                const offlineResult = await calculateOfflineEstimate(consumer.id, parsed, previousReading);
                if (isMounted) {
                    setEstimate(offlineResult);
                }
            } finally {
                if (isMounted) {
                    setEstimateLoading(false);
                }
            }
        }, 600);

        return () => {
            isMounted = false;
            clearTimeout(debounceTimer.current);
        };
    }, [currentReading, consumer.id, previousReading]);

    const now = new Date();
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];

    const handleSubmit = async () => {
        if (!currentReading.trim()) {
            setError('Please enter the current meter reading');
            return;
        }
        if (Number(currentReading) < previousReading) {
            setError(`Current reading must be ≥ ${previousReading}`);
            return;
        }

        setLoading(true);
        setError('');

        // STEP 1: Always save locally first (works offline too)
        try {
            await saveOfflineReading({
                consumer_id: consumer.id,
                consumer_number: consumer.consumer_number,
                consumer_name: consumer.name,
                meter_number: consumer.meter_number,
                current_reading: Number(currentReading),
                previous_reading: previousReading,
                reading_date: today,
            });
        } catch (localErr) {
            console.error('Local save failed:', localErr);
            setError('Failed to save reading locally.');
            setLoading(false);
            return;
        }

        // STEP 2: Try to submit online and generate bill
        try {
            const data = await submitReadingAndBillAPI(
                consumer.id,
                Number(currentReading),
                today
            );

            if (data.success) {
                // Mark the local copy as already synced so it doesn't re-sync on next push
                const queue = await getOfflineQueue();
                const match = [...queue].reverse().find(
                    r => r.consumer_id === consumer.id && r.reading_date === today
                );
                if (match) {
                    await markAsSynced(match.id);
                }

                // BUG-29 FIX: backend only returns bill_id — fetch the full bill object
                // so BillPreviewScreen has every field it needs without crashing.
                let fullBill = null;
                try {
                    fullBill = await getBillDetailAPI(data.bill_id);
                } catch (fetchErr) {
                    console.warn('Could not fetch full bill detail:', fetchErr.message);
                    // Minimal fallback so BillPreviewScreen can still render
                    fullBill = {
                        id: data.bill_id,
                        bill_number: data.bill_number,
                        total_amount: data.total_amount,
                        grand_total: data.total_amount,
                        status: data.status,
                        consumer_name: consumer.name,
                        consumer_number: consumer.consumer_number,
                        meter_number: consumer.meter_number,
                        units: Number(currentReading) - previousReading,
                        rate_per_unit: null,
                        energy_charges: 0,
                        fixed_charges: 0,
                        duty_charge: 0,
                        meter_rent: 0,
                        regulatory_surcharge: 0,
                        arrears: 0,
                        late_payment_surcharge: 0,
                        load_kw: consumer.load_kw,
                        meter_type: consumer.meter_type,
                        address: consumer.address,
                        billing_period: today.substring(0, 7),
                        due_date: null,
                        created_at: new Date().toISOString(),
                    };
                }

                const readingPayload = {
                    previous_reading: previousReading,
                    current_reading: Number(currentReading),
                    id: null,
                };

                navigation.replace('BillPreview', {
                    bill: fullBill,
                    reading: readingPayload,
                    consumer,
                });
            } else {
                setError(data.error || 'Submission failed.');
            }
        } catch (err) {
            // Network is down — reading is already saved locally, just inform the reader
            const isOffline = !err.response || err.message?.toLowerCase().includes('network');
            Alert.alert(
                isOffline ? '📶 Saved Offline' : '⚠️ Server Error',
                isOffline
                    ? 'No internet detected. Reading saved locally and will sync when you are back online.'
                    : (err.response?.data?.error || err.response?.data?.detail || 'Reading saved locally but online submission failed.'),
                [{ text: 'OK', onPress: () => navigation.navigate('Search') }]
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Submit Reading</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Consumer Details Card */}
                <View style={styles.consumerCard}>
                    <View style={styles.consumerHeader}>
                        <View style={styles.consumerIconBg}>
                            <Ionicons name="person" size={28} color={colors.primary} />
                        </View>
                        <View style={styles.consumerHeaderText}>
                            <Text style={styles.consumerName}>{consumer.name}</Text>
                            <Text style={styles.consumerNumber}>#{consumer.consumer_number}</Text>
                        </View>
                    </View>
                    <View style={styles.consumerDetails}>
                        <View style={styles.detailRow}>
                            <View style={styles.detailItem}>
                                <Ionicons name="speedometer-outline" size={16} color={colors.textMuted} />
                                <Text style={styles.detailLabel}>Meter</Text>
                                <Text style={styles.detailValue}>{consumer.meter_number}</Text>
                            </View>
                            <View style={styles.detailItem}>
                                <Ionicons name="flash-outline" size={16} color={colors.textMuted} />
                                <Text style={styles.detailLabel}>Load</Text>
                                <Text style={styles.detailValue}>{consumer.load_kw || 1.0} KW</Text>
                            </View>
                        </View>
                        <View style={styles.detailRow}>
                            <View style={styles.detailItem}>
                                <Ionicons name="options-outline" size={16} color={colors.textMuted} />
                                <Text style={styles.detailLabel}>Type</Text>
                                <Text style={styles.detailValue}>
                                    {consumer.meter_type === '10' ? '1 Phase' : '3 Phase'}
                                </Text>
                            </View>
                            <View style={styles.detailItem}>
                                <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                                <Text style={styles.detailLabel}>Addr</Text>
                                <Text style={styles.detailValue} numberOfLines={1}>
                                    {consumer.address || 'N/A'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Reading Input */}
                <View style={styles.readingCard}>
                    <Text style={styles.sectionTitle}>Meter Reading</Text>
                    <Text style={styles.dateText}>Date: {today}</Text>

                    {error ? (
                        <View style={styles.errorBox}>
                            <Ionicons name="alert-circle" size={16} color={colors.danger} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    {/* Previous Reading */}
                    <View style={styles.readingRow}>
                        <View style={styles.readingLabel}>
                            <Ionicons name="arrow-back-circle" size={20} color={colors.textMuted} />
                            <Text style={styles.readingLabelText}>Previous Reading</Text>
                        </View>
                        <View style={styles.previousBox}>
                            <Text style={styles.previousValue}>{previousReading}</Text>
                            <Text style={styles.unit}>kWh</Text>
                        </View>
                    </View>

                    {/* Current Reading Input */}
                    <View style={styles.readingRow}>
                        <View style={styles.readingLabel}>
                            <Ionicons name="arrow-forward-circle" size={20} color={colors.accent} />
                            <Text style={[styles.readingLabelText, { color: colors.textPrimary }]}>
                                Current Reading
                            </Text>
                        </View>
                        <View style={styles.inputRow}>
                            <TextInput
                                style={styles.readingInput}
                                value={currentReading}
                                onChangeText={(text) => {
                                    setCurrentReading(text.replace(/[^0-9.]/g, ''));
                                    setError('');
                                }}
                                placeholder="Enter reading"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="numeric"
                                returnKeyType="done"
                                autoFocus
                            />
                            <Text style={styles.unit}>kWh</Text>
                        </View>
                    </View>

                    {/* Server-Side Live Estimate Breakdown */}
                    {estimateLoading && (
                        <View style={styles.estimateLoadingRow}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={styles.estimateLoadingText}>Calculating live estimate…</Text>
                        </View>
                    )}

                    {!estimateLoading && estimate && (
                        <>
                            <View style={styles.breakdownContainer}>
                                <View style={styles.breakdownRow}>
                                    <Text style={styles.breakdownLabel}>
                                        Energy ({(estimate.units_consumed || 0).toFixed(1)} × ₹{estimate.breakdown.rate_per_unit})
                                    </Text>
                                    <Text style={styles.breakdownValue}>₹{(estimate.breakdown.energy_charges || 0).toFixed(2)}</Text>
                                </View>
                                <View style={styles.breakdownRow}>
                                    <Text style={styles.breakdownLabel}>
                                        Fixed ({estimate.load_kw} KW × ₹{estimate.breakdown.fixed_charge_per_kw})
                                    </Text>
                                    <Text style={styles.breakdownValue}>₹{(estimate.breakdown.fixed_charges || 0).toFixed(2)}</Text>
                                </View>
                                <View style={styles.breakdownRow}>
                                    <Text style={styles.breakdownLabel}>Duty ({estimate.breakdown.duty_percentage}%)</Text>
                                    <Text style={styles.breakdownValue}>₹{(estimate.breakdown.duty_charge || 0).toFixed(2)}</Text>
                                </View>
                                <View style={styles.breakdownRow}>
                                    <Text style={styles.breakdownLabel}>Meter Rent</Text>
                                    <Text style={styles.breakdownValue}>₹{(estimate.breakdown.meter_rent || 0).toFixed(2)}</Text>
                                </View>
                            </View>

                            {/* Grand Total */}
                            <View style={styles.totalBar}>
                                <Text style={styles.totalLabel}>Grand Total (Est.)</Text>
                                <Text style={styles.totalValue}>₹{estimate.total_amount}</Text>
                            </View>
                        </>
                    )}
                </View>

                {/* Single smart button */}
                <TouchableOpacity
                    style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    {loading ? (
                        <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                        <>
                            <Ionicons name="flash" size={24} color={colors.white} />
                            <Text style={styles.submitBtnText}>Submit & Generate Bill</Text>
                        </>
                    )}
                </TouchableOpacity>

                <Text style={styles.disclaimer}>
                    Reading is always saved locally first.{`\n`}Bill is generated instantly if you are online.
                </Text>
            </ScrollView>
        </View>
    );
}

const createStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 60,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.bgCard,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: {
        flex: 1,
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.textPrimary,
        textAlign: 'center',
    },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingBottom: 120 },
    consumerCard: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.lg,
    },
    consumerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    consumerIconBg: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: colors.infoBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    consumerHeaderText: { flex: 1 },
    consumerName: {
        fontSize: fontSize.xl,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    consumerNumber: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginTop: 2,
    },
    consumerDetails: { gap: spacing.sm },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    detailItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    detailLabel: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        width: 60,
    },
    detailValue: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        flex: 1,
    },
    readingCard: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    dateText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginBottom: spacing.lg,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.dangerBg,
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    errorText: {
        color: colors.danger,
        fontSize: fontSize.sm,
        flex: 1,
    },
    readingRow: {
        marginBottom: spacing.lg,
    },
    readingLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    readingLabelText: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    previousBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCardLight,
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    previousValue: {
        fontSize: fontSize.xl,
        fontWeight: '800',
        color: colors.textMuted,
        flex: 1,
    },
    unit: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        fontWeight: '600',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCardLight,
        borderRadius: borderRadius.sm,
        borderWidth: 2,
        borderColor: colors.primary,
    },
    readingInput: {
        flex: 1,
        fontSize: fontSize.xxl,
        fontWeight: '800',
        color: colors.accent,
        paddingVertical: 16,
        paddingHorizontal: spacing.md,
    },
    breakdownContainer: {
        gap: 8,
        marginBottom: spacing.lg,
        paddingHorizontal: 4,
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    breakdownLabel: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    breakdownValue: {
        fontSize: 13,
        color: colors.textPrimary,
        fontWeight: '600',
    },
    totalBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.successBg,
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    totalLabel: {
        fontSize: fontSize.md,
        color: colors.success,
        fontWeight: '700',
    },
    totalValue: {
        fontSize: fontSize.xl,
        fontWeight: '800',
        color: colors.success,
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        paddingVertical: 18,
        borderRadius: borderRadius.md,
        gap: spacing.sm,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 6,
    },
    submitBtnDisabled: { opacity: 0.7 },
    estimateLoadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: 4,
    },
    estimateLoadingText: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        fontStyle: 'italic',
    },
    submitBtnText: {
        color: colors.white,
        fontSize: fontSize.lg,
        fontWeight: '800',
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        paddingVertical: 14,
        borderRadius: borderRadius.md,
        borderWidth: 2,
        borderColor: colors.primary,
        marginTop: spacing.md,
        gap: spacing.sm,
    },
    saveBtnText: {
        color: colors.primary,
        fontSize: fontSize.md,
        fontWeight: '700',
    },
    disclaimer: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: spacing.md,
        lineHeight: 18,
    },
});
