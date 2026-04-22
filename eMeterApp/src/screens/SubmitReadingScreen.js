import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { submitReadingAndBillAPI, getSettingsAPI } from '../services/api';
import { saveOfflineReading } from '../services/offlineStorage';
import { useTheme } from '../context/ThemeContext';

export default function SubmitReadingScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors);

    const { consumer } = route.params;
    const previousReading = consumer.previous_reading || 0;

    const [currentReading, setCurrentReading] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [liveSettings, setLiveSettings] = useState(null);

    useEffect(() => {
        const fetchLiveSettings = async () => {
            try {
                const settings = await getSettingsAPI();
                setLiveSettings(settings);
            } catch (err) {
                console.error('Failed to fetch settings:', err);
            }
        };
        fetchLiveSettings();
    }, []);

    const unitsConsumed =
        currentReading && Number(currentReading) >= previousReading
            ? Number(currentReading) - previousReading
            : 0;

    // Use live settings if available, otherwise fallback to defaults
    const rate_per_unit = liveSettings?.rate_per_unit || 8.56;
    const fixed_charge_per_kw = liveSettings?.fixed_charge_per_kw || 400.0;
    const duty_val = liveSettings?.duty_percentage || 7.5;
    const p1_rent = liveSettings?.phase_1_rent || 10.0;
    const p3_rent = liveSettings?.phase_3_rent || 25.0;

    const energyCharges = unitsConsumed * rate_per_unit;
    const fixedCharges = (consumer.load_kw || 1.0) * fixed_charge_per_kw;
    const dutyCharge = (energyCharges + fixedCharges) * (duty_val / 100);
    const meterRent = consumer.meter_type === '10' ? p1_rent : p3_rent;
    const arrears = 0;
    const latePaymentSurcharge = arrears * 0.015;

    const estimatedCharge = Math.round(
        energyCharges + fixedCharges + dutyCharge + meterRent + arrears + latePaymentSurcharge
    );

    const today = new Date().toISOString().split('T')[0];

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

        try {
            const data = await submitReadingAndBillAPI(
                consumer.id,
                Number(currentReading),
                today
            );

            if (data.success) {
                navigation.replace('BillPreview', {
                    bill: data.bill,
                    reading: data.reading,
                    consumer,
                });
            } else {
                setError(data.error || 'Failed to submit reading');
            }
        } catch (err) {
            // If offline, save locally
            if (!err.response || err.message.includes('Network')) {
                try {
                    await saveOfflineReading({
                        consumer_id: consumer.id,
                        consumer_name: consumer.name,
                        meter_number: consumer.meter_number,
                        current_reading: Number(currentReading),
                        previous_reading: previousReading,
                        reading_date: today,
                    });
                    Alert.alert(
                        'Saved Offline',
                        'Reading saved locally. It will sync when internet is available.',
                        [{ text: 'OK', onPress: () => navigation.goBack() }]
                    );
                } catch (offlineErr) {
                    setError('Failed to save offline. Please try again.');
                }
            } else {
                setError(
                    err.response?.data?.error ||
                    err.response?.data?.detail ||
                    'Submission failed. Please try again.'
                );
            }
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

                    {/* Auto-calculated Breakdown */}
                    <View style={styles.breakdownContainer}>
                        <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Energy ({unitsConsumed.toFixed(1)} @ {rate_per_unit})</Text>
                            <Text style={styles.breakdownValue}>₹{energyCharges.toFixed(2)}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Fixed (@ Rs. {fixed_charge_per_kw}/KW)</Text>
                            <Text style={styles.breakdownValue}>₹{fixedCharges.toFixed(2)}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Duty ({duty_val}%)</Text>
                            <Text style={styles.breakdownValue}>₹{dutyCharge.toFixed(2)}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Meter Rent</Text>
                            <Text style={styles.breakdownValue}>₹{meterRent.toFixed(2)}</Text>
                        </View>
                    </View>

                    {/* Grand Total */}
                    {currentReading && Number(currentReading) >= previousReading && (
                        <View style={styles.totalBar}>
                            <Text style={styles.totalLabel}>Grand Total (Est.)</Text>
                            <Text style={styles.totalValue}>₹{estimatedCharge}</Text>
                        </View>
                    )}
                </View>

                {/* Submit Button */}
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
                            <Ionicons name="checkmark-circle" size={24} color={colors.white} />
                            <Text style={styles.submitBtnText}>Submit & Generate Bill</Text>
                        </>
                    )}
                </TouchableOpacity>

                <Text style={styles.disclaimer}>
                    Bill will be generated instantly. You can edit this reading later today if needed.
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
    submitBtnText: {
        color: colors.white,
        fontSize: fontSize.lg,
        fontWeight: '800',
    },
    disclaimer: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: spacing.md,
    },
});
