/**
 * ShimmerSkeleton — a React Native shimmer skeleton using only the built-in
 * Animated API (no extra dependencies). The shimmer sweep animates from left
 * to right on a translucent rectangle, mimicking the standard skeleton loading
 * pattern.
 *
 * Usage:
 *   import { ShimmerSkeleton, DashboardShimmer, SearchShimmer, HistoryShimmer } from '../components/ShimmerSkeleton';
 *
 *   if (loading) return <DashboardShimmer colors={colors} />;
 */

import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';

// ─── Base Shimmer Block ─────────────────────────────────────────────────────

export function ShimmerSkeleton({ width = '100%', height = 16, borderRadius = 8, style = {}, colors }) {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.timing(shimmerAnim, {
                toValue: 1,
                duration: 1100,
                useNativeDriver: true,
            })
        );
        loop.start();
        return () => loop.stop();
    }, [shimmerAnim]);

    const translateX = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-300, 300],
    });

    const bg = colors?.bgCard || '#23272f';
    const shimmerColor = colors?.border || '#2d3340';

    return (
        <View
            style={[
                { width, height, borderRadius, backgroundColor: bg, overflow: 'hidden' },
                style,
            ]}
        >
            <Animated.View
                style={{
                    ...StyleSheet.absoluteFillObject,
                    backgroundColor: shimmerColor,
                    opacity: 0.55,
                    transform: [{ translateX }],
                    width: '60%',
                }}
            />
        </View>
    );
}

// ─── Dashboard Shimmer ──────────────────────────────────────────────────────
// Mirrors: header bar + daily progress card + 4 stat cards + quick actions grid

export function DashboardShimmer({ colors }) {
    const bg = colors?.bgDark || '#181c23';
    const cardBg = colors?.bgCard || '#23272f';

    return (
        <View style={{ flex: 1, backgroundColor: bg, paddingHorizontal: 16, paddingTop: 60 }}>
            {/* Header bar */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <ShimmerSkeleton width={120} height={22} borderRadius={6} colors={colors} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <ShimmerSkeleton width={32} height={32} borderRadius={16} colors={colors} />
                    <ShimmerSkeleton width={32} height={32} borderRadius={16} colors={colors} />
                </View>
            </View>

            {/* Progress / Sync tracker card */}
            <View style={{ backgroundColor: cardBg, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <ShimmerSkeleton width={160} height={14} borderRadius={6} colors={colors} style={{ marginBottom: 12 }} />
                <ShimmerSkeleton width={'100%'} height={8} borderRadius={4} colors={colors} style={{ marginBottom: 8 }} />
                <ShimmerSkeleton width={80} height={12} borderRadius={6} colors={colors} />
            </View>

            {/* 4 stat cards in 2x2 grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                {Array(4).fill(0).map((_, i) => (
                    <View key={i} style={{ backgroundColor: cardBg, borderRadius: 14, padding: 16, width: '47%', minHeight: 90 }}>
                        <ShimmerSkeleton width={28} height={28} borderRadius={8} colors={colors} style={{ marginBottom: 10 }} />
                        <ShimmerSkeleton width={'70%'} height={11} borderRadius={5} colors={colors} style={{ marginBottom: 6 }} />
                        <ShimmerSkeleton width={'50%'} height={18} borderRadius={5} colors={colors} />
                    </View>
                ))}
            </View>

            {/* Quick actions grid (6 boxes) */}
            <ShimmerSkeleton width={100} height={13} borderRadius={5} colors={colors} style={{ marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {Array(6).fill(0).map((_, i) => (
                    <View key={i} style={{ backgroundColor: cardBg, borderRadius: 14, padding: 14, width: '30%', alignItems: 'center', gap: 8 }}>
                        <ShimmerSkeleton width={36} height={36} borderRadius={10} colors={colors} />
                        <ShimmerSkeleton width={'80%'} height={10} borderRadius={5} colors={colors} />
                    </View>
                ))}
            </View>
        </View>
    );
}

// ─── Search Shimmer ─────────────────────────────────────────────────────────
// Mirrors: search bar + 6 consumer result cards

export function SearchShimmer({ colors }) {
    const bg = colors?.bgDark || '#181c23';
    const cardBg = colors?.bgCard || '#23272f';

    return (
        <View style={{ flex: 1, backgroundColor: bg, paddingTop: 60 }}>
            {/* Header */}
            <View style={{ backgroundColor: cardBg, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors?.border || '#2d3340' }}>
                <ShimmerSkeleton width={160} height={22} borderRadius={6} colors={colors} />
            </View>

            {/* Search bar */}
            <View style={{ flexDirection: 'row', padding: 16, gap: 10 }}>
                <ShimmerSkeleton width={'83%'} height={50} borderRadius={10} colors={colors} />
                <ShimmerSkeleton width={50} height={50} borderRadius={10} colors={colors} />
            </View>

            {/* Count label */}
            <ShimmerSkeleton width={140} height={12} borderRadius={5} colors={colors} style={{ marginHorizontal: 16, marginBottom: 12 }} />

            {/* Consumer list cards */}
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
                {Array(6).fill(0).map((_, i) => (
                    <View key={i} style={{ backgroundColor: cardBg, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {/* Avatar */}
                        <ShimmerSkeleton width={48} height={48} borderRadius={14} colors={colors} />
                        {/* Info lines */}
                        <View style={{ flex: 1, gap: 6 }}>
                            <ShimmerSkeleton width={'60%'} height={14} borderRadius={5} colors={colors} />
                            <ShimmerSkeleton width={'80%'} height={11} borderRadius={5} colors={colors} />
                            <ShimmerSkeleton width={'50%'} height={11} borderRadius={5} colors={colors} />
                        </View>
                        {/* Badge + chevron */}
                        <View style={{ gap: 6, alignItems: 'flex-end' }}>
                            <ShimmerSkeleton width={50} height={20} borderRadius={10} colors={colors} />
                            <ShimmerSkeleton width={20} height={20} borderRadius={5} colors={colors} />
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}

// ─── History Shimmer ────────────────────────────────────────────────────────
// Mirrors: page header + 8 reading history rows

export function HistoryShimmer({ colors }) {
    const bg = colors?.bgDark || '#181c23';
    const cardBg = colors?.bgCard || '#23272f';

    return (
        <View style={{ flex: 1, backgroundColor: bg, paddingTop: 60 }}>
            {/* Header */}
            <View style={{ backgroundColor: cardBg, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors?.border || '#2d3340' }}>
                <ShimmerSkeleton width={180} height={22} borderRadius={6} colors={colors} />
            </View>

            <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
                {Array(8).fill(0).map((_, i) => (
                    <View key={i} style={{ backgroundColor: cardBg, borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ gap: 6 }}>
                            <ShimmerSkeleton width={100} height={13} borderRadius={5} colors={colors} />
                            <ShimmerSkeleton width={140} height={11} borderRadius={5} colors={colors} />
                        </View>
                        <View style={{ gap: 6, alignItems: 'flex-end' }}>
                            <ShimmerSkeleton width={70} height={20} borderRadius={10} colors={colors} />
                            <ShimmerSkeleton width={50} height={11} borderRadius={5} colors={colors} />
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}
