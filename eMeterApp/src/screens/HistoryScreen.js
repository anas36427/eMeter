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
    Modal,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { getReadingsAPI, editReadingAPI } from '../services/api';
import { exportReadingsToExcel, getOfflineQueue } from '../services/offlineStorage';
import { useTheme } from '../context/ThemeContext';

export default function HistoryScreen({ navigation }) {
    const { colors } = useTheme();
    const styles = createStyles(colors);

    // Core Readings list and Loading states
    const [readings, setReadings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Edit Reading states
    const [editModal, setEditModal] = useState(false);
    const [editReading, setEditReading] = useState(null);
    const [newReadingValue, setNewReadingValue] = useState('');
    const [editLoading, setEditLoading] = useState(false);

    // Pagination states
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Filter states (Month and Year selection)
    const [selectedMonth, setSelectedMonth] = useState('all'); // 'all' or '1'..'12'
    const [selectedYear, setSelectedYear] = useState('all');   // 'all' or '2024'..'2026'
    const [customYearInput, setCustomYearInput] = useState('');
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [tempMonth, setTempMonth] = useState('all');
    const [tempYear, setTempYear] = useState('all');

    const [sortOrder, setSortOrder] = useState('desc'); // 'desc' for most recent, 'asc' for oldest

    const now = new Date();
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
                    .toISOString().split('T')[0];

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const years = ['2024', '2025', '2026'];

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

    // ── Fetch Readings with Server-side Pagination & Filtering ──
    const fetchReadings = useCallback(async (pageNum = 1, shouldAppend = false, monthVal = selectedMonth, yearVal = selectedYear) => {
        if (pageNum === 1) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }
        try {
            const params = {
                page: pageNum,
                limit: 10,
            };
            if (monthVal !== 'all') {
                params.month = monthVal;
            }
            if (yearVal !== 'all') {
                params.year = yearVal;
            }
            
            const data = await getReadingsAPI(params);
            const fetchedReadings = data.readings || [];
            
            setReadings(prev => shouldAppend ? [...prev, ...fetchedReadings] : fetchedReadings);
            setPage(pageNum);
            setHasMore(data.has_more || false);
        } catch (err) {
            console.warn('Failed to fetch readings, falling back to local SQLite database queue:', err.message);
            try {
                const localQueue = await getOfflineQueue();
                // Format SQLite rows to map history card representation
                const localReadings = localQueue.map(item => ({
                    id: item.id,
                    consumer_name: item.consumer_name,
                    consumer_number: item.consumer_number,
                    meter_number: item.meter_number,
                    previous_reading: item.previous_reading,
                    current_reading: item.current_reading,
                    units_consumed: Math.max(0, item.current_reading - item.previous_reading),
                    reading_date: item.reading_date,
                    created_at: item.saved_at,
                    is_offline_pending: true
                }));
                setReadings(localReadings);
                setHasMore(false);
            } catch (localErr) {
                console.error('Failed to query offline SQLite storage:', localErr);
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        fetchReadings(1, false);
    }, [fetchReadings]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchReadings(1, false);
        setRefreshing(false);
    };

    // Triggered when scrolling flatlist to load next page
    const handleLoadMore = () => {
        if (!loading && !loadingMore && hasMore) {
            fetchReadings(page + 1, true);
        }
    };

    const handleApplyFilters = (newMonth, newYear) => {
        setSelectedMonth(newMonth);
        setSelectedYear(newYear);
        setFilterModalVisible(false);
        if (newYear === 'all') {
            setCustomYearInput('');
        }
        fetchReadings(1, false, newMonth, newYear);
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
                fetchReadings(1, false); // Reload first page
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

    // ── Export to Excel featuring Full Month/Year query range ──
    const handleExport = async () => {
        try {
            setLoading(true);
            // Fetch ALL matching readings without pagination for the selected month/year
            const params = {};
            if (selectedMonth !== 'all') {
                params.month = selectedMonth;
            }
            if (selectedYear !== 'all') {
                params.year = selectedYear;
            }
            const data = await getReadingsAPI(params);
            const allReadings = data.readings || [];
            
            if (allReadings.length === 0) {
                Alert.alert('No Data', 'No readings found for the selected month/year.');
                return;
            }
            
            const monthLabel = selectedMonth !== 'all' ? `Month_${selectedMonth}` : 'All_Months';
            const yearLabel = selectedYear !== 'all' ? `Year_${selectedYear}` : 'All_Years';
            const exportTitle = `Readings_${monthLabel}_${yearLabel}`;
            
            await exportReadingsToExcel(allReadings, exportTitle);
        } catch (err) {
            Alert.alert('Export Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    // Sort active visible readings array
    const sortedReadings = [...readings].sort((a, b) => {
        if (sortOrder === 'desc') {
            return new Date(b.reading_date) - new Date(a.reading_date);
        } else {
            return new Date(a.reading_date) - new Date(b.reading_date);
        }
    });

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

    // Render footer loading spinner during pagination scroll loading
    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.footerLoaderText}>Loading more readings...</Text>
            </View>
        );
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

            {/* Premium Interactive Filter Bar */}
            <View style={styles.filterBar}>
                <TouchableOpacity 
                    style={styles.filterBtn} 
                    onPress={() => {
                        setTempMonth(selectedMonth);
                        setTempYear(selectedYear);
                        if (selectedYear !== 'all' && !['2024', '2025', '2026'].includes(selectedYear)) {
                            setCustomYearInput(selectedYear);
                        } else {
                            setCustomYearInput('');
                        }
                        setFilterModalVisible(true);
                    }}
                    activeOpacity={0.7}
                >
                    <Ionicons name="calendar-clear-outline" size={16} color={colors.primary} />
                    <Text style={styles.filterBtnText}>
                        {(selectedMonth === 'all' && selectedYear === 'all') 
                            ? 'All Historical Readings' 
                            : `${selectedMonth !== 'all' ? months[parseInt(selectedMonth) - 1] : 'All Months'} ${selectedYear !== 'all' ? selectedYear : 'All Years'}`.trim()}
                    </Text>
                    <Ionicons name="chevron-down-outline" size={14} color={colors.textSecondary} />
                </TouchableOpacity>

                {(selectedMonth !== 'all' || selectedYear !== 'all') && (
                    <TouchableOpacity 
                        style={styles.clearFilterBtn}
                        onPress={() => handleApplyFilters('all', 'all')}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.clearFilterText}>Reset</Text>
                        <Ionicons name="close-circle" size={14} color={colors.accent} />
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading readings...</Text>
                </View>
            ) : sortedReadings.length === 0 ? (
                <View style={styles.centerContent}>
                    <Ionicons name="document-text-outline" size={64} color={colors.textMuted} />
                    <Text style={styles.emptyTitle}>No Readings Found</Text>
                    <Text style={styles.emptySubtitle}>
                        No meter readings match the selected month and year criteria.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={sortedReadings}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderReading}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                    }
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.3}
                    ListFooterComponent={renderFooter}
                />
            )}

            {/* Filter Selection Modal (Month & Year) */}
            <Modal visible={filterModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.filterModalCard}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Filter Readings</Text>
                            <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Month Selector */}
                            <Text style={styles.filterSectionTitle}>Select Month</Text>
                            <View style={styles.chipsContainer}>
                                <TouchableOpacity
                                    style={[styles.chip, tempMonth === 'all' && styles.activeChip]}
                                    onPress={() => setTempMonth('all')}
                                >
                                    <Text style={[styles.chipText, tempMonth === 'all' && styles.activeChipText]}>All Months</Text>
                                </TouchableOpacity>
                                {months.map((m, idx) => {
                                    const value = String(idx + 1);
                                    return (
                                        <TouchableOpacity
                                            key={value}
                                            style={[styles.chip, tempMonth === value && styles.activeChip]}
                                            onPress={() => setTempMonth(value)}
                                        >
                                            <Text style={[styles.chipText, tempMonth === value && styles.activeChipText]}>{m}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Year Chips Selector */}
                            <Text style={styles.filterSectionTitle}>Select Year</Text>
                            <View style={styles.chipsContainer}>
                                <TouchableOpacity
                                    style={[styles.chip, tempYear === 'all' && styles.activeChip]}
                                    onPress={() => {
                                        setTempYear('all');
                                        setCustomYearInput('');
                                    }}
                                >
                                    <Text style={[styles.chipText, tempYear === 'all' && styles.activeChipText]}>All Years</Text>
                                </TouchableOpacity>
                                {years.map((y) => (
                                    <TouchableOpacity
                                        key={y}
                                        style={[styles.chip, tempYear === y && styles.activeChip]}
                                        onPress={() => {
                                            setTempYear(y);
                                            setCustomYearInput('');
                                        }}
                                    >
                                        <Text style={[styles.chipText, tempYear === y && styles.activeChipText]}>{y}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Manual Enterable Year Input */}
                            <View style={styles.customYearContainer}>
                                <Text style={styles.customYearLabel}>Or enter custom year:</Text>
                                <TextInput
                                    style={styles.customYearInput}
                                    value={customYearInput}
                                    onChangeText={(text) => {
                                        const cleaned = text.replace(/[^0-9]/g, '').substring(0, 4);
                                        setCustomYearInput(cleaned);
                                        if (cleaned.length === 4) {
                                            setTempYear(cleaned);
                                        } else if (cleaned.length === 0) {
                                            setTempYear('all');
                                        }
                                    }}
                                    placeholder="e.g. 2023"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="numeric"
                                    maxLength={4}
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setFilterModalVisible(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalSaveBtn}
                                onPress={() => handleApplyFilters(tempMonth, tempYear)}
                            >
                                <Text style={styles.modalSaveText}>Apply Filters</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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
    backBtnHeader: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: {
        flex: 1,
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.textPrimary,
        textAlign: 'center',
    },
    filterBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.bgCardLight,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: 8,
    },
    filterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCard,
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 8,
        flex: 1,
    },
    filterBtnText: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.textPrimary,
        flex: 1,
    },
    clearFilterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warningBg,
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        borderRadius: borderRadius.sm,
        gap: 6,
    },
    clearFilterText: {
        fontSize: fontSize.xs,
        fontWeight: '700',
        color: colors.accent,
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
    footerLoader: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing.lg,
        gap: 8,
    },
    footerLoaderText: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    // Modal & Filters
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: spacing.lg,
    },
    filterModalCard: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        maxHeight: '80%',
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    modalTitle: {
        fontSize: fontSize.xl,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    filterSectionTitle: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.textPrimary,
        marginTop: spacing.md,
        marginBottom: spacing.sm,
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: spacing.md,
    },
    chip: {
        backgroundColor: colors.bgCardLight,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        borderRadius: borderRadius.md,
    },
    activeChip: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    chipText: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    activeChipText: {
        color: colors.white,
        fontWeight: '700',
    },
    modalCard: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
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
    customYearContainer: {
        marginTop: spacing.md,
        marginBottom: spacing.lg,
        paddingHorizontal: 2,
    },
    customYearLabel: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    customYearInput: {
        backgroundColor: colors.bgCardLight,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        fontSize: fontSize.md,
        color: colors.textPrimary,
        fontWeight: '600',
    },
});
