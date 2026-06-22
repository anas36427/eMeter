import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { spacing, borderRadius, fontSize } from '../theme/colors';

import DashboardScreen from '../screens/DashboardScreen';
import SearchScreen from '../screens/SearchScreen';
import SubmitReadingScreen from '../screens/SubmitReadingScreen';
import BillPreviewScreen from '../screens/BillPreviewScreen';
import HistoryScreen from '../screens/HistoryScreen';
import AddConsumerScreen from '../screens/AddConsumerScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

function DashboardTab() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="DashboardHome" component={DashboardScreen} />
        </Stack.Navigator>
    );
}

function SearchTab() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="SearchHome" component={SearchScreen} />
            <Stack.Screen name="SubmitReading" component={SubmitReadingScreen} />
            <Stack.Screen name="BillPreview" component={BillPreviewScreen} />
            <Stack.Screen name="AddConsumer" component={AddConsumerScreen} />
        </Stack.Navigator>
    );
}

function HistoryTab() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="HistoryHome" component={HistoryScreen} />
        </Stack.Navigator>
    );
}

function MainTabs() {
    const { colors } = useTheme();

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: colors.bgCard,
                    borderTopColor: colors.border,
                    borderTopWidth: 1,
                    height: 85,
                    paddingBottom: 28,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: colors.accent,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                },
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;
                    if (route.name === 'Dashboard') {
                        iconName = focused ? 'grid' : 'grid-outline';
                    } else if (route.name === 'Search') {
                        iconName = focused ? 'search' : 'search-outline';
                    } else if (route.name === 'History') {
                        iconName = focused ? 'time' : 'time-outline';
                    } else if (route.name === 'Profile') {
                        iconName = focused ? 'person' : 'person-outline';
                    }
                    return <Ionicons name={iconName} size={22} color={color} />;
                },
            })}
        >
            <Tab.Screen name="Dashboard" component={DashboardTab} />
            <Tab.Screen name="Search" component={SearchTab} />
            <Tab.Screen name="History" component={HistoryTab} />
            <Tab.Screen name="Profile" component={ProfileTab} />
        </Tab.Navigator>
    );
}

export default function AppNavigator() {
    return <MainTabs />;
}

// Simple Profile/Settings tab
function ProfileTab({ navigation }) {
    const { colors, isDark, toggleTheme } = useTheme();
    const { user, logout } = useAuth();
    const styles = createProfileStyles(colors);

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: logout },
        ]);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.avatarCircle}>
                    <Ionicons name="person" size={40} color={colors.primary} />
                </View>
                <Text style={styles.username}>{user?.username || 'Meter Reader'}</Text>
                <Text style={styles.role}>{user?.role || 'meter_reader'}</Text>
            </View>

            <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                    <Ionicons name="shield-checkmark" size={20} color={colors.success} />
                    <Text style={styles.infoLabel}>Role</Text>
                    <Text style={styles.infoValue}>
                        {user?.role === 'admin' ? 'Administrator' : 'Meter Reader'}
                    </Text>
                </View>
                <View style={styles.infoRow}>
                    <Ionicons name="business" size={20} color={colors.info} />
                    <Text style={styles.infoLabel}>Organization</Text>
                    <Text style={styles.infoValue}>eMeter-AMU</Text>
                </View>
                <View style={styles.infoRow}>
                    <Ionicons name="phone-portrait" size={20} color={colors.accent} />
                    <Text style={styles.infoLabel}>App Version</Text>
                    <Text style={styles.infoValue}>1.0.0</Text>
                </View>
            </View>

            {/* Dark Appearance Card */}
            <View style={styles.themeToggleCard}>
                <View style={styles.themeToggleInfo}>
                    <Ionicons
                        name={isDark ? "moon-outline" : "sunny-outline"}
                        size={22}
                        color={colors.textPrimary}
                    />
                    <Text style={styles.themeToggleText}>Dark Appearance</Text>
                </View>
                <Switch
                    value={isDark}
                    onValueChange={toggleTheme}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.white}
                />
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
                <Ionicons name="log-out-outline" size={22} color={colors.danger} />
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
        </View>
    );
}

const createProfileStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
        paddingTop: 80,
        paddingHorizontal: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    avatarCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.infoBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: colors.primary,
    },
    username: {
        fontSize: 22,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    role: {
        fontSize: 14,
        color: colors.accent,
        fontWeight: '600',
        textTransform: 'capitalize',
        marginTop: 4,
    },
    infoCard: {
        backgroundColor: colors.bgCard,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 24,
        gap: 16,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    infoLabel: {
        fontSize: 14,
        color: colors.textSecondary,
        flex: 1,
    },
    infoValue: {
        fontSize: 14,
        color: colors.textPrimary,
        fontWeight: '600',
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.dangerBg,
        paddingVertical: 16,
        borderRadius: 12,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.danger,
    },
    themeToggleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.bgCard,
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.border,
    },
    themeToggleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    themeToggleText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },
});
