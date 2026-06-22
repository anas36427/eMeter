import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
    Keyboard,
    Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { searchConsumerAPI, getConsumersAPI, getConsumerDetailAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';

export default function SearchScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [allConsumers, setAllConsumers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [loadingAll, setLoadingAll] = useState(true);

    const [searchTimeout, setSearchTimeout] = useState(null);

    // Auto-refresh when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            let isActive = true;
            const fetchConsumers = async () => {
                try {
                    const { searchConsumersOffline } = require('../services/offlineStorage');
                    const offlineRows = await searchConsumersOffline('');
                    if (isActive && offlineRows && offlineRows.length > 0) {
                        setAllConsumers(offlineRows);
                    }
                    const data = await getConsumersAPI();
                    if (isActive) {
                        const consumers = data.consumers || [];
                        setAllConsumers(consumers);
                        const { cacheConsumersToDb } = require('../services/offlineStorage');
                        await cacheConsumersToDb(consumers);
                    }
                } catch (err) {
                    console.warn('Network fetch failed, using SQLite cache:', err.message);
                } finally {
                    if (isActive) setLoadingAll(false);
                }
            };
            fetchConsumers();
            return () => { isActive = false; };
        }, [])
    );

    const performSearch = async (searchQuery) => {
        if (!searchQuery.trim()) {
            setSearched(false);
            setResults([]);
            return;
        }
        setLoading(true);
        setSearched(true);
        try {
            const data = await searchConsumerAPI(searchQuery.trim());
            setResults(data.consumers || []);
        } catch (err) {
            console.warn('Search failed, performing SQLite indexed search:', err.message);
            const { searchConsumersOffline } = require('../services/offlineStorage');
            const filtered = await searchConsumersOffline(searchQuery);
            setResults(filtered);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        Keyboard.dismiss();
        if (searchTimeout) clearTimeout(searchTimeout);
        performSearch(query);
    };

    const handleTextChange = (text) => {
        setQuery(text);
        if (searchTimeout) clearTimeout(searchTimeout);
        setSearchTimeout(setTimeout(() => {
            performSearch(text);
        }, 500));
    };

    const handleSelectConsumer = async (consumer) => {
        try {
            // Get full consumer details with previous reading
            const detail = await getConsumerDetailAPI(consumer.id);
            navigation.navigate('SubmitReading', {
                consumer: { ...consumer, ...detail },
            });
        } catch (err) {
            // Navigate with what we have
            navigation.navigate('SubmitReading', { consumer });
        }
    };

    const displayList = searched ? results : allConsumers;

    const renderConsumer = ({ item }) => (
        <TouchableOpacity
            style={styles.consumerCard}
            onPress={() => handleSelectConsumer(item)}
            activeOpacity={0.7}
        >
            <View style={styles.consumerIcon}>
                <Ionicons name="person" size={22} color={colors.primary} />
            </View>
            <View style={styles.consumerInfo}>
                <Text style={styles.consumerName}>{item.name}</Text>
                <View style={[styles.detailRow, { flexWrap: 'wrap' }]}>
                    <Ionicons name="speedometer-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.detailText}>Meter: {item.meter_number}</Text>
                    <Text style={[styles.detailText, { marginLeft: 8 }]}>• {item.load_kw || 1.0} KW</Text>
                    <Text style={styles.detailText}> • {item.meter_type === '10' ? '1 Phase' : '3 Phase'}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Ionicons name="card-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.detailText}>ID: #{item.consumer_number}</Text>
                </View>
            </View>
            <View style={styles.consumerRight}>
                <View
                    style={[
                        styles.statusBadge,
                        { backgroundColor: item.status === 'active' ? colors.successBg : colors.dangerBg },
                    ]}
                >
                    <Text
                        style={[
                            styles.statusText,
                            { color: item.status === 'active' ? colors.success : colors.danger },
                        ]}
                    >
                        {item.status}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Search Consumer</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color={colors.textMuted} />
                    <TextInput
                        style={styles.searchInput}
                        value={query}
                        onChangeText={handleTextChange}
                        placeholder="Search by Meter#, Name, or User ID"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        onSubmitEditing={handleSearch}
                    />
                    {query.length > 0 && (
                        <TouchableOpacity
                            onPress={() => {
                                setQuery('');
                                setSearched(false);
                                setResults([]);
                            }}
                        >
                            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} activeOpacity={0.8}>
                    <Ionicons name="search" size={20} color={colors.white} />
                </TouchableOpacity>
            </View>

            {/* Results */}
            {loading || loadingAll ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Searching...</Text>
                </View>
            ) : searched && results.length === 0 ? (
                <View style={styles.centerContent}>
                    <View style={styles.notFoundIcon}>
                        <Ionicons name="person-remove" size={48} color={colors.danger} />
                    </View>
                    <Text style={styles.notFoundTitle}>User Not Found</Text>
                    <Text style={styles.notFoundSubtitle}>
                        No consumer matches "{query}". Try a different meter number or name.
                    </Text>
                    <TouchableOpacity
                        style={styles.tryAgainBtn}
                        onPress={() => {
                            setQuery('');
                            setSearched(false);
                        }}
                    >
                        <Ionicons name="refresh" size={18} color={colors.white} />
                        <Text style={styles.tryAgainText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    <Text style={styles.resultCount}>
                        {searched ? `${results.length} result(s) found` : `Recent / All Consumers (${allConsumers.length})`}
                    </Text>
                    <FlatList
                        data={displayList}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={renderConsumer}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                </>
            )}

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
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    headerTitle: {
        flex: 1,
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.textPrimary,
        textAlign: 'center',
    },
    searchContainer: {
        flexDirection: 'row',
        padding: spacing.lg,
        gap: spacing.sm,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 14,
        fontSize: fontSize.md,
        color: colors.textPrimary,
    },
    searchBtn: {
        width: 50,
        height: 50,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.sm,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resultCount: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.sm,
    },
    listContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: 100,
    },
    consumerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    consumerIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: colors.infoBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    consumerInfo: {
        flex: 1,
    },
    consumerName: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    detailText: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    consumerRight: {
        alignItems: 'flex-end',
        gap: spacing.sm,
    },
    statusBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
    },
    statusText: {
        fontSize: fontSize.xs,
        fontWeight: '700',
        textTransform: 'uppercase',
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
        fontSize: fontSize.md,
    },
    notFoundIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.dangerBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    notFoundTitle: {
        fontSize: fontSize.xl,
        fontWeight: '800',
        color: colors.danger,
        marginBottom: spacing.sm,
    },
    notFoundSubtitle: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    tryAgainBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.sm,
        gap: spacing.sm,
    },
    tryAgainText: {
        color: colors.white,
        fontSize: fontSize.md,
        fontWeight: '700',
    },
    fab: {
        position: 'absolute',
        bottom: 100,
        right: 24,
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
    },
});
