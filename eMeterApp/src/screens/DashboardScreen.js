import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { getDashboardStatsAPI } from '../services/api';
import { getPendingCount } from '../services/offlineStorage';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function DashboardScreen({ navigation }) {
    const { user } = useAuth();
    const { themeMode, colors, isDark } = useTheme();
    const styles = createStyles(colors);


    const [stats, setStats] = useState(null);
    const [offlinePending, setOfflinePending] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchDashboard = useCallback(async () => {
        try {
            const data = await getDashboardStatsAPI();
            setStats(data);
        } catch (err) {
            console.warn('Dashboard fetch failed:', err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchOffline = useCallback(async () => {
        const count = await getPendingCount();
        setOfflinePending(count);
    }, []);

    useEffect(() => {
        fetchDashboard();
        fetchOffline();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchDashboard(), fetchOffline()]);
        setRefreshing(false);
    };

    const today = new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const statCards = [
        {
            title: 'Total Consumers',
            value: stats?.total_consumers ?? '—',
            icon: 'people',
            color: colors.info,
            bg: colors.infoBg,
        },
        {
            title: 'Total Readings',
            value: stats?.total_readings ?? '—',
            icon: 'speedometer',
            color: colors.success,
            bg: colors.successBg,
        },
        {
            title: 'Unpaid Bills',
            value: stats?.unpaid_bills ?? '—',
            icon: 'alert-circle',
            color: colors.warning,
            bg: colors.warningBg,
        },
        {
            title: 'Total Revenue',
            value: stats?.total_revenue ? `₹${Number(stats.total_revenue).toLocaleString('en-IN')}` : '—',
            icon: 'cash',
            color: colors.accent,
            bg: colors.warningBg,
        },
    ];

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Welcome back,</Text>
                    <Text style={styles.username}>{user?.username || 'Reader'}</Text>
                </View>
                <View style={styles.roleBadge}>
                    <Ionicons name="flash" size={14} color={colors.accent} />
                    <Text style={styles.roleText}>Meter Reader</Text>
                </View>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Date */}
                <Text style={styles.date}>{today}</Text>

                {/* Offline Banner */}
                {offlinePending > 0 && (
                    <View style={styles.offlineBanner}>
                        <Ionicons name="cloud-offline" size={20} color={colors.warning} />
                        <Text style={styles.offlineText}>
                            {offlinePending} reading{offlinePending !== 1 ? 's' : ''} pending sync
                        </Text>
                        <TouchableOpacity style={styles.syncBtn}>
                            <Ionicons name="sync" size={16} color={colors.white} />
                            <Text style={styles.syncBtnText}>Sync</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    {statCards.map((card, i) => (
                        <View key={i} style={styles.statCard}>
                            <View style={[styles.statIconBg, { backgroundColor: card.bg }]}>
                                <Ionicons name={card.icon} size={24} color={card.color} />
                            </View>
                            <Text style={styles.statValue}>{card.value}</Text>
                            <Text style={styles.statTitle}>{card.title}</Text>
                        </View>
                    ))}
                </View>

                {/* Quick Actions */}
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsRow}>
                    <TouchableOpacity
                        style={[styles.actionCard, { backgroundColor: colors.primary }]}
                        onPress={() => navigation.navigate('Search')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="search" size={28} color={colors.white} />
                        <Text style={styles.actionText}>Search &{'\n'}Submit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionCard, { backgroundColor: colors.bgCardLight }]}
                        onPress={() => navigation.navigate('History')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="time" size={28} color={colors.accent} />
                        <Text style={[styles.actionText, { color: isDark ? colors.white : colors.textPrimary }]}>
                            Reading{'\n'}History
                        </Text>
                    </TouchableOpacity>
                </View>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: 60,
        paddingBottom: spacing.md,
        backgroundColor: colors.bgCard,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    greeting: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
    },
    username: {
        fontSize: fontSize.xl,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warningBg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        gap: 4,
    },
    roleText: {
        fontSize: fontSize.xs,
        color: colors.accent,
        fontWeight: '700',
    },
    scroll: { flex: 1 },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: 120,
    },
    date: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        marginBottom: spacing.lg,
    },
    offlineBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warningBg,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.lg,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    offlineText: {
        flex: 1,
        fontSize: fontSize.sm,
        color: colors.warning,
        fontWeight: '600',
    },
    syncBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warning,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        gap: 4,
    },
    syncBtnText: {
        fontSize: fontSize.xs,
        color: colors.white,
        fontWeight: '700',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    statCard: {
        width: '47%',
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    statIconBg: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    statValue: {
        fontSize: fontSize.xxl,
        fontWeight: '800',
        color: colors.textPrimary,
        marginBottom: 2,
    },
    statTitle: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    sectionTitle: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: spacing.md,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    actionCard: {
        flex: 1,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        minHeight: 110,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    actionText: {
        color: colors.white,
        fontSize: fontSize.sm,
        fontWeight: '700',
        textAlign: 'center',
    },
});
