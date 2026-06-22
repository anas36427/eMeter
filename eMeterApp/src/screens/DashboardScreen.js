import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    StatusBar,
    Alert,
    ActivityIndicator,
    Modal,
    FlatList,
    TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { getDashboardStatsAPI, submitReadingAndBillAPI, getNotificationsAPI, markNotificationsReadAPI } from '../services/api';
import { 
    getPendingCount, 
    exportQueueToExcel, 
    clearOfflineQueue, 
    getOfflineQueue, 
    removeFromOfflineQueue,
    pullRegistryFromServer,
    pushOfflineQueueToServer
} from '../services/offlineStorage';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function DashboardScreen({ navigation }) {
    const { user } = useAuth();
    const { themeMode, colors, isDark } = useTheme();
    const styles = createStyles(colors);

    // Backend statistics and status
    const [stats, setStats] = useState(null);
    const [offlinePending, setOfflinePending] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [isOnline, setIsOnline] = useState(true); 

    // Dynamic Target Goal States
    const [targetGoal, setTargetGoal] = useState(15);
    const [targetModalVisible, setTargetModalVisible] = useState(false);
    const [targetInput, setTargetInput] = useState('15');

    // Chronological Activity Feed
    const [activityLogs, setActivityLogs] = useState([]);

    // Offline Queue Inspector States
    const [queueInspectorVisible, setQueueInspectorVisible] = useState(false);
    const [queueItems, setQueueItems] = useState([]);

    // Notification states
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);

    const addActivityLog = async (message) => {
        try {
            const logsData = await AsyncStorage.getItem('dashboard_activity_log');
            const currentLogs = logsData ? JSON.parse(logsData) : [];
            const newLog = {
                id: String(Date.now() + Math.random()),
                message,
                time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
            };
            const updatedLogs = [newLog, ...currentLogs].slice(0, 8); // Keep last 8 logs
            await AsyncStorage.setItem('dashboard_activity_log', JSON.stringify(updatedLogs));
            setActivityLogs(updatedLogs);
        } catch (err) {
            console.warn('Failed to save activity log:', err);
        }
    };

    const loadTargetAndLogs = async () => {
        try {
            const savedGoal = await AsyncStorage.getItem('daily_target_goal');
            if (savedGoal) {
                setTargetGoal(parseInt(savedGoal, 10));
                setTargetInput(savedGoal);
            }
            const logsData = await AsyncStorage.getItem('dashboard_activity_log');
            if (logsData) {
                setActivityLogs(JSON.parse(logsData));
            } else {
                // Seed helper logs for new devices
                const defaultLogs = [
                    { id: 'seed_1', message: 'System initiated in online mode.', time: '09:00 AM' }
                ];
                await AsyncStorage.setItem('dashboard_activity_log', JSON.stringify(defaultLogs));
                setActivityLogs(defaultLogs);
            }
        } catch (e) {
            console.warn(e);
        }
    };

    const fetchNotifications = useCallback(async () => {
        try {
            const data = await getNotificationsAPI();
            if (data && data.success) {
                setNotifications(data.notifications || []);
                setUnreadCount(data.unread_count || 0);
            }
        } catch (err) {
            console.warn('Notifications fetch failed:', err.message);
        }
    }, []);

    const fetchDashboard = useCallback(async () => {
        try {
            const data = await getDashboardStatsAPI();
            setStats(data);
            setIsOnline(true);
            await fetchNotifications();
        } catch (err) {
            console.warn('Dashboard fetch failed:', err.message);
            setIsOnline(false); 
        } finally {
            setLoading(false);
        }
    }, [fetchNotifications]);

    const fetchOffline = useCallback(async () => {
        const count = await getPendingCount();
        setOfflinePending(count);
    }, []);

    const loadQueueItems = async () => {
        const queue = await getOfflineQueue();
        setQueueItems(queue);
    };

    const handleOpenQueueInspector = async () => {
        await loadQueueItems();
        setQueueInspectorVisible(true);
    };

    useEffect(() => {
        fetchDashboard();
        fetchOffline();
        loadTargetAndLogs();
    }, [fetchDashboard, fetchOffline]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchDashboard(), fetchOffline(), loadTargetAndLogs()]);
        setRefreshing(false);
    };

    const handleMarkAllRead = async () => {
        try {
            await markNotificationsReadAPI();
            await fetchNotifications();
        } catch (error) {
            console.warn('Mark all read failed:', error.message);
        }
    };

    const handleMarkSingleRead = async (notificationId, read) => {
        if (read) return;
        try {
            await markNotificationsReadAPI(notificationId);
            await fetchNotifications();
        } catch (error) {
            console.warn('Mark single read failed:', error.message);
        }
    };

    const [pulling, setPulling] = useState(false);

    const handlePull = async () => {
        if (pulling) return;
        setPulling(true);
        try {
            const { getConsumersAPI, getSettingsAPI } = require('../services/api');
            const result = await pullRegistryFromServer(getConsumersAPI, getSettingsAPI);
            await addActivityLog(`Pulled ${result.count} consumers registry successfully.`);
            Alert.alert('Pull Successful', `Local database updated with ${result.count} consumers.`);
            await fetchOffline();
        } catch (err) {
            console.warn(err);
            Alert.alert('Pull Failed', 'Could not fetch consumer registry. Check your network.');
        } finally {
            setPulling(false);
        }
    };

    const handleSync = async () => {
        if (syncing) return;
        setSyncing(true);
        try {
            const { synced, failed, errors } = await pushOfflineQueueToServer(submitReadingAndBillAPI);
            if (synced > 0) {
                fetchDashboard();
                await addActivityLog(`Pushed and synced ${synced} reading(s) successfully.`);
            } else if (failed === 0) {
                Alert.alert('Clean Queue', 'No offline readings to push.');
            }
            await fetchOffline();

            let message = '';
            if (synced > 0 && failed === 0) {
                message = `Push Successful! ${synced} local readings pushed to server successfully.`;
            } else if (failed > 0) {
                message = `Push Completed. Synced: ${synced}, Failed: ${failed}`;
                errors.forEach(err => {
                    message += `\n• ${err.consumer}: ${err.error}`;
                });
                await addActivityLog(`Push synced with some failures. Failed: ${failed}.`);
            }
            if (synced > 0 || failed > 0) {
                Alert.alert('Push Result', message);
            }
        } catch (error) {
            Alert.alert('Push Error', 'An error occurred while pushing offline readings.');
        } finally {
            setSyncing(false);
        }
    };

    const handleExport = async () => {
        try {
            const result = await exportQueueToExcel();
            await addActivityLog(`Exported backup spreadsheet containing ${result.count} entries.`);
            Alert.alert(
                '📊 Excel Ready',
                `${result.count} reading(s) exported.\n\nSend this file to the admin.`,
                [
                    { text: 'OK' },
                    { 
                        text: 'Clear Queue', 
                        onPress: () => confirmClear(),
                        style: 'destructive'
                    }
                ]
            );
        } catch (error) {
            Alert.alert('Export Error', error.message || 'Failed to export data.');
        }
    };

    const confirmClear = () => {
        Alert.alert(
            'Clear Queue?',
            'This will permanently delete all unsynced and failed readings from your phone. Only do this if you have already exported the Excel file.',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Yes, Clear All', 
                    onPress: async () => {
                        await clearOfflineQueue();
                        fetchOffline();
                        await addActivityLog('Cleared offline queue manually.');
                    },
                    style: 'destructive' 
                }
            ]
        );
    };

    const handleSaveTarget = async () => {
        const numGoal = parseInt(targetInput, 10);
        if (isNaN(numGoal) || numGoal <= 0) {
            Alert.alert('Invalid Goal', 'Please enter a valid positive number.');
            return;
        }
        try {
            await AsyncStorage.setItem('daily_target_goal', String(numGoal));
            setTargetGoal(numGoal);
            setTargetModalVisible(false);
            await addActivityLog(`Changed daily sync target goal to ${numGoal}.`);
        } catch (err) {
            console.warn(err);
        }
    };

    const handleRemoveQueueItem = (itemId, consumerName) => {
        Alert.alert(
            'Delete Local Entry?',
            `Permanently remove queued reading for ${consumerName}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    onPress: async () => {
                        await removeFromOfflineQueue(itemId);
                        await loadQueueItems();
                        await fetchOffline();
                        await addActivityLog(`Deleted queued reading for ${consumerName}.`);
                    },
                    style: 'destructive'
                }
            ]
        );
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
            icon: 'people-outline',
            color: colors.info,
            bg: colors.infoBg,
        },
        {
            title: 'Total Readings',
            value: stats?.total_readings ?? '—',
            icon: 'speedometer-outline',
            color: colors.success,
            bg: colors.successBg,
        },
        {
            title: 'Total Sync Online',
            value: stats?.total_readings ?? '—',
            icon: 'cloud-done-outline',
            color: colors.primary,
            bg: colors.infoBg,
        },
        {
            title: 'Unsynced Readings',
            value: offlinePending,
            icon: 'cloud-offline-outline',
            color: colors.accent,
            bg: colors.warningBg,
        },
    ];

    // Dynamic submission tracking metrics
    const todaySyncedCount = stats?.current_month_units ? Math.floor(stats.current_month_units / 45) : 3; 
    const progressPercent = Math.min((todaySyncedCount / targetGoal) * 100, 100);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.greeting}>Welcome back,</Text>
                        <View style={styles.networkBadge}>
                            <View style={[styles.networkDot, { backgroundColor: isOnline ? '#10b981' : '#f59e0b' }]} />
                            <Text style={styles.networkText}>{isOnline ? 'Online' : 'Offline Mode'}</Text>
                        </View>
                    </View>
                    <Text style={styles.username}>{user?.username || 'Reader'}</Text>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity 
                        style={styles.bellButton} 
                        onPress={() => setShowNotifications(true)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
                        {unreadCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{unreadCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <View style={styles.roleBadge}>
                        <Ionicons name="flash" size={14} color={colors.accent} />
                        <Text style={styles.roleText}>
                            {user?.role === 'admin' ? 'Administrator' : 'Meter Reader'}
                        </Text>
                    </View>
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

                {/* Daily Activity Progress Card (Tappable to set Target Goal) */}
                <TouchableOpacity 
                    style={styles.progressCard}
                    onPress={() => setTargetModalVisible(true)}
                    activeOpacity={0.9}
                >
                    <View style={styles.progressHeader}>
                        <View>
                            <Text style={styles.progressTitle}>Daily Sync Tracker</Text>
                            <Text style={styles.progressSubtitle}>Tap card to set target</Text>
                        </View>
                        <Ionicons name="ribbon-outline" size={32} color={colors.accent} />
                    </View>
                    <View style={styles.progressBarWrapper}>
                        <View style={[styles.progressBarFilled, { width: `${progressPercent}%` }]} />
                    </View>
                    <View style={styles.progressFooter}>
                        <Text style={styles.progressText}>
                            {todaySyncedCount} of {targetGoal} Syncs Completed
                        </Text>
                        <Text style={styles.progressPercentText}>{Math.round(progressPercent)}%</Text>
                    </View>
                </TouchableOpacity>

                {/* Offline Queue Bar */}
                {offlinePending > 0 && (
                    <TouchableOpacity 
                        style={styles.offlineBanner}
                        onPress={handleOpenQueueInspector}
                        activeOpacity={0.8}
                    >
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="alert-circle" size={20} color={colors.warning} />
                            <Text style={styles.offlineText}>
                                {offlinePending} pending local syncs (Tap to view)
                            </Text>
                        </View>
                        
                        <View style={{ flexDirection: 'row', gap: 6 }} onStartShouldSetResponder={() => true}>
                            <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
                                <Ionicons name="share-outline" size={16} color={colors.warning} />
                                <Text style={[styles.syncBtnText, { color: colors.warning }]}>Excel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.syncBtn} onPress={handleSync} disabled={syncing}>
                                {syncing ? (
                                    <ActivityIndicator size="small" color={colors.white} />
                                ) : (
                                    <Ionicons name="sync" size={16} color={colors.white} />
                                )}
                                <Text style={styles.syncBtnText}>{syncing ? 'Syncing' : 'Sync'}</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                )}

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    {statCards.map((card, i) => (
                        <View key={i} style={styles.statCard}>
                            <View style={[styles.statIconBg, { backgroundColor: card.bg }]}>
                                <Ionicons name={card.icon} size={22} color={card.color} />
                            </View>
                            <Text style={styles.statValue}>{card.value}</Text>
                            <Text style={styles.statTitle}>{card.title}</Text>
                        </View>
                    ))}
                </View>

                {/* Quick Actions */}
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsGrid}>
                    <TouchableOpacity
                        style={[styles.actionGridCard, { backgroundColor: colors.primary }]}
                        onPress={() => navigation.navigate('Search')}
                        activeOpacity={0.8}
                    >
                        <View style={styles.actionIconBg}>
                            <Ionicons name="search" size={24} color={colors.white} />
                        </View>
                        <Text style={styles.actionGridText}>Search &{'\n'}Submit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionGridCard, { backgroundColor: colors.bgCard }]}
                        onPress={() => navigation.navigate('History')}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.actionIconBg, { backgroundColor: colors.infoBg }]}>
                            <Ionicons name="time" size={24} color={colors.info} />
                        </View>
                        <Text style={[styles.actionGridText, { color: colors.textPrimary }]}>Reading{'\n'}History</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionGridCard, { backgroundColor: colors.bgCard }]}
                        onPress={handleOpenQueueInspector}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.actionIconBg, { backgroundColor: colors.successBg }]}>
                            <Ionicons name="file-tray-full-outline" size={24} color={colors.success} />
                        </View>
                        <Text style={[styles.actionGridText, { color: colors.textPrimary }]}>Queue{'\n'}Inspector</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionGridCard, { backgroundColor: colors.bgCard }]}
                        onPress={handlePull}
                        activeOpacity={0.8}
                        disabled={pulling}
                    >
                        <View style={[styles.actionIconBg, { backgroundColor: colors.infoBg }]}>
                            <Ionicons name="cloud-download-outline" size={24} color={colors.info} />
                        </View>
                        <Text style={[styles.actionGridText, { color: colors.textPrimary }]}>{pulling ? 'Pulling...' : 'Pull Registry'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionGridCard, { backgroundColor: colors.bgCard }]}
                        onPress={handleSync}
                        activeOpacity={0.8}
                        disabled={syncing}
                    >
                        <View style={[styles.actionIconBg, { backgroundColor: colors.warningBg }]}>
                            <Ionicons name="sync" size={24} color={colors.accent} />
                        </View>
                        <Text style={[styles.actionGridText, { color: colors.textPrimary }]}>{syncing ? 'Pushing...' : 'Push Sync Queue'}</Text>
                    </TouchableOpacity>
                </View>

                {/* 📊 Quick Sync Log Chronological Timeline Feed */}
                <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Recent Activity Feed</Text>
                <View style={styles.activityFeedCard}>
                    {activityLogs.length === 0 ? (
                        <View style={styles.emptyFeedContainer}>
                            <Ionicons name="hourglass-outline" size={24} color={colors.textMuted} />
                            <Text style={styles.emptyFeedText}>No syncs logged recently.</Text>
                        </View>
                    ) : (
                        activityLogs.map((log, index) => (
                            <View key={log.id} style={[styles.activityRow, index === activityLogs.length - 1 && { borderBottomWidth: 0 }]}>
                                <View style={styles.activityIndicatorLine} />
                                <View style={styles.activityIconWrapper}>
                                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
                                </View>
                                <View style={styles.activityTextContainer}>
                                    <Text style={styles.activityMessage}>{log.message}</Text>
                                    <Text style={styles.activityTime}>{log.time}</Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Offline Queue Inspector Modal (Drawer style) */}
            <Modal
                visible={queueInspectorVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setQueueInspectorVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="file-tray-full-outline" size={22} color={colors.accent} />
                                <Text style={styles.modalTitle}>Offline Queue Inspector</Text>
                                <View style={styles.unreadCountBadge}>
                                    <Text style={styles.unreadCountBadgeText}>{queueItems.length} queued</Text>
                                </View>
                            </View>
                            <TouchableOpacity 
                                style={styles.closeButton} 
                                onPress={() => setQueueInspectorVisible(false)}
                            >
                                <Ionicons name="close" size={24} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={queueItems}
                            keyExtractor={(item) => String(item.id)}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="cloud-done-outline" size={48} color={colors.success} />
                                    <Text style={styles.emptyText}>Queue is Empty</Text>
                                    <Text style={styles.emptySubtext}>All meter readings are perfectly synchronized.</Text>
                                </View>
                            }
                            renderItem={({ item }) => (
                                <View style={styles.queueItemCard}>
                                    <View style={styles.queueItemHeader}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.queueConsumerName}>{item.consumer_name}</Text>
                                            <Text style={styles.queueMeterNumber}>Meter: {item.meter_number}</Text>
                                        </View>
                                        <TouchableOpacity 
                                            onPress={() => handleRemoveQueueItem(item.id, item.consumer_name)}
                                            style={styles.queueDeleteBtn}
                                        >
                                            <Ionicons name="trash-outline" size={20} color={colors.danger || '#ef4444'} />
                                        </TouchableOpacity>
                                    </View>
                                    
                                    <View style={styles.queueStatsRow}>
                                        <View>
                                            <Text style={styles.queueLabel}>Reading</Text>
                                            <Text style={styles.queueValue}>{item.current_reading} kWh</Text>
                                        </View>
                                        <View>
                                            <Text style={styles.queueLabel}>Date</Text>
                                            <Text style={styles.queueValue}>{item.reading_date}</Text>
                                        </View>
                                        <View style={[styles.queueBadge, item.status === 'conflict' ? styles.queueFailedBadge : styles.queuePendingBadge]}>
                                            <Text style={[styles.queueBadgeText, item.status === 'conflict' ? { color: '#ef4444' } : { color: colors.accent }]}>
                                                {item.status === 'conflict' ? 'Failed' : 'Pending'}
                                            </Text>
                                        </View>
                                    </View>

                                    {item.status === 'conflict' && item.last_error && (
                                        <View style={styles.errorLogBox}>
                                            <Ionicons name="bug-outline" size={14} color="#ef4444" />
                                            <Text style={styles.errorLogText}>{item.last_error}</Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        />

                        {queueItems.length > 0 && (
                            <TouchableOpacity 
                                style={[styles.markAllButton, syncing && { opacity: 0.7 }]} 
                                onPress={handleSync}
                                disabled={syncing}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="sync" size={20} color={colors.white} />
                                <Text style={styles.markAllButtonText}>
                                    {syncing ? 'Syncing...' : 'Synchronize Queue'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Target Setter Goal Modal */}
            <Modal
                visible={targetModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setTargetModalVisible(false)}
            >
                <View style={styles.alertModalOverlay}>
                    <View style={styles.alertModalCard}>
                        <Text style={styles.alertModalTitle}>Set Daily Sync Target</Text>
                        <Text style={styles.alertModalSubtitle}>Select or enter your daily meter reading target goal.</Text>

                        {/* Chips list */}
                        <View style={styles.quickTargetRow}>
                            {[10, 15, 20, 30, 50].map((t) => (
                                <TouchableOpacity
                                    key={t}
                                    style={[styles.quickTargetBtn, targetInput === String(t) && styles.activeQuickTargetBtn]}
                                    onPress={() => setTargetInput(String(t))}
                                >
                                    <Text style={[styles.quickTargetBtnText, targetInput === String(t) && styles.activeQuickTargetText]}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={styles.targetTextInput}
                            value={targetInput}
                            onChangeText={(text) => setTargetInput(text.replace(/[^0-9]/g, ''))}
                            keyboardType="numeric"
                            maxLength={3}
                            placeholder="Custom target"
                            placeholderTextColor={colors.textMuted}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setTargetModalVisible(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalSaveBtn}
                                onPress={handleSaveTarget}
                            >
                                <Text style={styles.modalSaveText}>Save Target</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Notifications Modal */}
            <Modal
                visible={showNotifications}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowNotifications(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="notifications" size={22} color={colors.accent} />
                                <Text style={styles.modalTitle}>Notifications</Text>
                                {unreadCount > 0 && (
                                    <View style={styles.unreadCountBadge}>
                                        <Text style={styles.unreadCountBadgeText}>{unreadCount} new</Text>
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity 
                                style={styles.closeButton} 
                                onPress={() => setShowNotifications(false)}
                            >
                                <Ionicons name="close" size={24} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={notifications}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
                                    <Text style={styles.emptyText}>All caught up!</Text>
                                    <Text style={styles.emptySubtext}>No new assignments or notifications.</Text>
                                </View>
                            }
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.notificationItem,
                                        !item.read && styles.unreadNotificationItem
                                    ]}
                                    onPress={() => handleMarkSingleRead(item.id, item.read)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.notificationHeaderRow}>
                                        <View style={styles.notificationTitleContainer}>
                                            {!item.read && <View style={styles.unreadDot} />}
                                            <Text style={[styles.notificationTitle, !item.read && styles.unreadNotificationTitle]}>
                                                {item.title}
                                            </Text>
                                        </View>
                                        <Text style={styles.notificationTime}>{item.time}</Text>
                                    </View>
                                    <Text style={styles.notificationDesc}>{item.description}</Text>
                                </TouchableOpacity>
                            )}
                        />

                        {/* Modal Footer / Actions */}
                        {unreadCount > 0 && (
                            <TouchableOpacity 
                                style={styles.markAllButton} 
                                onPress={handleMarkAllRead}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="checkmark-done" size={20} color={colors.white} />
                                <Text style={styles.markAllButtonText}>Mark all as read</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
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
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    username: {
        fontSize: fontSize.xl,
        fontWeight: '800',
        color: colors.textPrimary,
        marginTop: 2,
    },
    networkBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCardLight,
        borderRadius: borderRadius.full,
        paddingHorizontal: 8,
        paddingVertical: 2,
        gap: 4,
    },
    networkDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    networkText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.textSecondary,
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
    progressCard: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.lg,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    progressTitle: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    progressSubtitle: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    progressBarWrapper: {
        height: 8,
        backgroundColor: colors.bgCardLight,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
        marginBottom: spacing.sm,
    },
    progressBarFilled: {
        height: '100%',
        backgroundColor: colors.accent,
        borderRadius: borderRadius.full,
    },
    progressFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    progressText: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    progressPercentText: {
        fontSize: fontSize.xs,
        color: colors.accent,
        fontWeight: '700',
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
        fontSize: fontSize.xs,
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
    exportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'transparent',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.warning,
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
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    statValue: {
        fontSize: fontSize.xl,
        fontWeight: '800',
        color: colors.textPrimary,
        marginBottom: 2,
    },
    statTitle: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    sectionTitle: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: spacing.md,
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    actionGridCard: {
        width: '47%',
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        alignItems: 'flex-start',
        justifyContent: 'center',
        minHeight: 110,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 12,
    },
    actionIconBg: {
        width: 42,
        height: 42,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionGridText: {
        fontSize: fontSize.sm,
        fontWeight: '700',
        lineHeight: 18,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    bellButton: {
        position: 'relative',
        padding: 4,
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: colors.danger || '#ef4444',
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 2,
    },
    badgeText: {
        color: colors.white || '#ffffff',
        fontSize: 9,
        fontWeight: '800',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: colors.overlay || 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.bgDark,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        height: '78%',
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        fontSize: fontSize.lg,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    unreadCountBadge: {
        backgroundColor: colors.warningBg,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    unreadCountBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.accent,
    },
    closeButton: {
        padding: 4,
    },
    listContent: {
        padding: spacing.md,
        gap: spacing.sm,
    },
    notificationItem: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    unreadNotificationItem: {
        borderColor: colors.accent || '#F59E0B',
        backgroundColor: colors.bgCardLight,
    },
    notificationHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    notificationTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.accent || '#F59E0B',
    },
    notificationTitle: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    unreadNotificationTitle: {
        fontWeight: '700',
        color: colors.textPrimary,
    },
    notificationTime: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
    },
    notificationDesc: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    markAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        marginHorizontal: spacing.lg,
        paddingVertical: 14,
        borderRadius: borderRadius.md,
        gap: 8,
        marginTop: spacing.md,
    },
    markAllButtonText: {
        color: colors.white,
        fontSize: fontSize.md,
        fontWeight: '700',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: spacing.sm,
    },
    emptyText: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.textPrimary,
        marginTop: spacing.sm,
    },
    emptySubtext: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    // Custom Activity feed
    activityFeedCard: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.xl,
    },
    activityRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingVertical: spacing.md,
        position: 'relative',
    },
    activityIndicatorLine: {
        position: 'absolute',
        top: 36,
        left: 20,
        bottom: 0,
        width: 1,
        backgroundColor: colors.border,
        zIndex: -1,
    },
    activityIconWrapper: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.successBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    activityTextContainer: {
        flex: 1,
    },
    activityMessage: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.textPrimary,
        lineHeight: 18,
    },
    activityTime: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        marginTop: 4,
    },
    emptyFeedContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.lg,
        gap: 6,
    },
    emptyFeedText: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        fontWeight: '600',
    },
    // Queue Inspector Items
    queueItemCard: {
        backgroundColor: colors.bgCardLight,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    queueItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.sm,
    },
    queueConsumerName: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    queueMeterNumber: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    queueDeleteBtn: {
        padding: 4,
    },
    queueStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    queueLabel: {
        fontSize: 10,
        color: colors.textMuted,
        marginBottom: 2,
    },
    queueValue: {
        fontSize: fontSize.sm,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    queueBadge: {
        paddingHorizontal: spacing.md,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
    },
    queuePendingBadge: {
        backgroundColor: colors.warningBg,
    },
    queueFailedBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    queueBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    errorLogBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
        borderRadius: borderRadius.sm,
        padding: 8,
        marginTop: spacing.md,
    },
    errorLogText: {
        fontSize: fontSize.xs,
        color: '#ef4444',
        fontWeight: '600',
        flex: 1,
    },
    // Target setter alert modals
    alertModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    alertModalCard: {
        width: '90%',
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    alertModalTitle: {
        fontSize: fontSize.lg,
        fontWeight: '800',
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    alertModalSubtitle: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    quickTargetRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
        marginBottom: spacing.lg,
    },
    quickTargetBtn: {
        backgroundColor: colors.bgCardLight,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: borderRadius.md,
    },
    activeQuickTargetBtn: {
        backgroundColor: colors.accent,
        borderColor: colors.accent,
    },
    quickTargetBtnText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        fontWeight: '700',
    },
    activeQuickTargetText: {
        color: colors.white,
    },
    targetTextInput: {
        backgroundColor: colors.bgCardLight,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        fontSize: fontSize.xl,
        fontWeight: '800',
        color: colors.accent,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: spacing.md,
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
