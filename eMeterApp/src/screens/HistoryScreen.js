import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Alert,
    RefreshControl,
    StatusBar,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { getReadingsAPI, editReadingAPI } from '../services/api';
import { exportReadingsToExcel } from '../services/offlineStorage';
import { useTheme } from '../context/ThemeContext';

export default function HistoryScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors);

    const [readings, setReadings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [editModal, setEditModal] = useState(false);
    const [editReading, setEditReading] = useState(null);
    const [newReadingValue, setNewReadingValue] = useState('');
    const [editLoading, setEditLoading] = useState(false);

    const today = new Date().toISOString().split('T')[0];

    const formatRecordedTime = (isoString) => {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            return date.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch (e) {
            return '';
        }
    };

    const [sortOrder, setSortOrder] = useState('desc'); // 'desc' for most recent, 'asc' for oldest

    const fetchReadings = useCallback(async () => {
        try {
            const data = await getReadingsAPI();
            let fetchedReadings = data.readings || [];
            
            // Sort readings based on sortOrder
            fetchedReadings.sort((a, b) => {
                if (sortOrder === 'desc') {
                    return new Date(b.reading_date) - new Date(a.reading_date);
                } else {
                    return new Date(a.reading_date) - new Date(b.reading_date);
                }
            });
            setReadings(fetchedReadings);
        } catch (err) {
            console.warn('Failed to fetch readings:', err.message);
        } finally {
            setLoading(false);
        }
    }, [sortOrder]);

    useEffect(() => {
        fetchReadings();
    }, [fetchReadings]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchReadings();
        setRefreshing(false);
    };

    const handleEditPress = (reading) => {
        setEditReading(reading);
        setNewReadingValue(String(reading.current_reading));
        setEditModal(true);
    };

    const handleEditSubmit = async () => {
        if (!newReadingValue.trim()) return;

        setEditLoading(true);
        try {
            const data = await editReadingAPI(editReading.id, Number(newReadingValue));
            if (data.success) {
                Alert.alert('Updated ✅', 'Reading has been updated successfully.');
                setEditModal(false);
                fetchReadings(); // Refresh list
            } else {
                Alert.alert('Error', data.error || 'Failed to update reading');
            }
        } catch (err) {
            const errorMsg =
                err.response?.data?.error ||
                err.response?.data?.detail ||
                'Update failed. Please try again.';
            Alert.alert('Error', errorMsg);
        } finally {
            setEditLoading(false);
        }
    };

    const isToday = (dateStr) => dateStr === today;

    const renderReading = ({ item }) => {
        const canEdit = isToday(item.reading_date);

        return (
            <View style={styles.readingCard}>
                <View style={styles.readingHeader}>
                    <View style={styles.readingIconBg}>
                        <Ionicons name="speedometer" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.readingHeaderText}>
                        <Text style={styles.consumerName}>{item.consumer_name}</Text>
                        <Text style={styles.meterNumber}>Meter: {item.meter_number}</Text>
                    </View>
                    {canEdit && (
                        <TouchableOpacity
                            style={styles.editBtn}
                            onPress={() => handleEditPress(item)}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="create-outline" size={16} color={colors.accent} />
                            <Text style={styles.editBtnText}>Edit</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.readingStats}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Previous</Text>
                        <Text style={styles.statValue}>{item.previous_reading}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Current</Text>
                        <Text style={[styles.statValue, { color: colors.accent }]}>{item.current_reading}</Text>
                    </View>
                    <View style={[styles.statItem, styles.unitsBadge]}>
                        <Text style={styles.statLabel}>Units</Text>
                        <Text style={[styles.statValue, { color: colors.success }]}>
                            {item.units_consumed}
                        </Text>
                    </View>
                </View>

                <View style={styles.readingFooter}>
                    <View style={styles.dateChip}>
                        <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.dateText}>
                            {item.reading_date} {item.created_at ? `at ${formatRecordedTime(item.created_at)}` : ''}
                        </Text>
                    </View>
                    {canEdit && (
                        <View style={styles.todayChip}>
                            <Text style={styles.todayText}>Today</Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    const handleExport = async () => {
        try {
            await exportReadingsToExcel(readings, 'Reading_History');
        } catch (err) {
            Alert.alert('Export Error', err.message);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnHeader}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Reading History</Text>
                
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity 
                        onPress={handleExport} 
                        style={styles.backBtnHeader}
                        disabled={readings.length === 0}
                    >
                        <Ionicons name="download-outline" size={24} color={readings.length === 0 ? colors.textMuted : colors.textPrimary} />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} 
                        style={styles.backBtnHeader}
                    >
                        <Ionicons name={sortOrder === 'desc' ? "arrow-down" : "arrow-up"} size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading readings...</Text>
                </View>
            ) : readings.length === 0 ? (
                <View style={styles.centerContent}>
                    <Ionicons name="document-text-outline" size={64} color={colors.textMuted} />
                    <Text style={styles.emptyTitle}>No Readings Yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Submit your first meter reading to see it here.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={readings}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderReading}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                    }
                />
            )}

            {/* Edit Modal */}
            <Modal visible={editModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Edit Reading</Text>
                        <Text style={styles.modalSubtitle}>
                            {editReading?.consumer_name} — {editReading?.meter_number}
                        </Text>

                        <View style={styles.modalInputGroup}>
                            <Text style={styles.modalLabel}>Previous Reading</Text>
                            <Text style={styles.modalPreviousValue}>{editReading?.previous_reading} kWh</Text>
                        </View>

                        <View style={styles.modalInputGroup}>
                            <Text style={styles.modalLabel}>New Current Reading</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={newReadingValue}
                                onChangeText={(text) => setNewReadingValue(text.replace(/[^0-9.]/g, ''))}
                                keyboardType="numeric"
                                autoFocus
                                placeholder="Enter new reading"
                                placeholderTextColor={colors.textMuted}
                            />
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setEditModal(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalSaveBtn, editLoading && { opacity: 0.7 }]}
                                onPress={handleEditSubmit}
                                disabled={editLoading}
                            >
                                {editLoading ? (
                                    <ActivityIndicator size="small" color={colors.white} />
                                ) : (
                                    <Text style={styles.modalSaveText}>Save Changes</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const createStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDark },
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
    backBtnHeader: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: {
        flex: 1,
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.textPrimary,
        textAlign: 'center',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    loadingText: {
        color: colors.textSecondary,
        marginTop: spacing.md,
    },
    emptyTitle: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.textPrimary,
        marginTop: spacing.lg,
    },
    emptySubtitle: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.sm,
    },
    listContent: {
        padding: spacing.lg,
        paddingBottom: 120,
    },
    readingCard: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    readingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    readingIconBg: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.infoBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    readingHeaderText: { flex: 1 },
    consumerName: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    meterNumber: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    editBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warningBg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        gap: 4,
    },
    editBtnText: {
        fontSize: fontSize.xs,
        fontWeight: '700',
        color: colors.accent,
    },
    readingStats: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: colors.bgCardLight,
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    statItem: { alignItems: 'center' },
    statLabel: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        marginBottom: 2,
    },
    statValue: {
        fontSize: fontSize.lg,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    unitsBadge: {
        backgroundColor: colors.successBg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
    },
    readingFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    dateChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    dateText: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
    },
    todayChip: {
        backgroundColor: colors.successBg,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
    },
    todayText: {
        fontSize: fontSize.xs,
        color: colors.success,
        fontWeight: '700',
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: spacing.lg,
    },
    modalCard: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalTitle: {
        fontSize: fontSize.xl,
        fontWeight: '800',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginBottom: spacing.lg,
    },
    modalInputGroup: {
        marginBottom: spacing.md,
    },
    modalLabel: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    modalPreviousValue: {
        fontSize: fontSize.lg,
        color: colors.textMuted,
        fontWeight: '700',
    },
    modalInput: {
        backgroundColor: colors.bgCardLight,
        borderRadius: borderRadius.sm,
        borderWidth: 2,
        borderColor: colors.primary,
        padding: spacing.md,
        fontSize: fontSize.xl,
        fontWeight: '800',
        color: colors.accent,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.lg,
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    modalCancelText: {
        color: colors.textSecondary,
        fontSize: fontSize.md,
        fontWeight: '600',
    },
    modalSaveBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.primary,
        alignItems: 'center',
    },
    modalSaveText: {
        color: colors.white,
        fontSize: fontSize.md,
        fontWeight: '700',
    },
});
