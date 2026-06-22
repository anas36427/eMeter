import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    StatusBar,
    Image,
    Modal,
    Alert
} from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { loginAPI } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';

export default function LoginScreen({ onLogin }) {
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Server Configuration State
    const [modalVisible, setModalVisible] = useState(false);
    const [serverUrl, setServerUrl] = useState('');
    const [serverUrlInput, setServerUrlInput] = useState('');
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState(null); // null | 'ok' | 'fail'

    useEffect(() => {
        loadServerUrl();
    }, []);

    const loadServerUrl = async () => {
        const saved = await AsyncStorage.getItem('serverUrl');
        const fallback = process.env.EXPO_PUBLIC_API_URL || '';
        const current = saved?.trim() || fallback;
        setServerUrl(current);
        setServerUrlInput(current);
    };

    const handleTestAndSaveUrl = async () => {
        const url = serverUrlInput.trim().replace(/\/$/, '');
        if (!url) {
            Alert.alert('Invalid URL', 'Please enter a valid server address.');
            return;
        }
        setTestingConnection(true);
        setConnectionStatus(null);
        try {
            await axios.get(`${url}/api/`, { timeout: 5000 });
            await AsyncStorage.setItem('serverUrl', url);
            setServerUrl(url);
            setConnectionStatus('ok');
            Alert.alert('Connected', `Server URL saved:\n${url}`);
            setTimeout(() => setModalVisible(false), 1000);
        } catch (err) {
            setConnectionStatus('fail');
            Alert.alert(
                'Connection Failed',
                `Could not reach:\n${url}\n\nMake sure the IP is correct and the server is running.`
            );
        } finally {
            setTestingConnection(false);
        }
    };

    const handleLogin = async () => {
        if (!username.trim() || !password.trim()) {
            setError('Please enter both username and password');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const data = await loginAPI(username.trim(), password);

            if (data.success) {
                if (data.role !== 'meter_reader' && data.role !== 'admin') {
                    setError('Access denied. This app is for meter readers only.');
                    setLoading(false);
                    return;
                }
                await AsyncStorage.setItem('user', JSON.stringify(data));
                onLogin(data);
            } else {
                setError(data.detail || 'Login failed');
            }
        } catch (err) {
            const msg =
                err.response?.data?.detail ||
                err.response?.data?.error ||
                'Connection failed. Check your internet and server.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                {/* Logo Area */}
                <View style={styles.logoArea}>
                    <View style={styles.iconCircle}>
                        <Image 
                            source={require('../../assets/amu-logo.png')} 
                            style={{ width: 80, height: 80, resizeMode: 'contain' }} 
                        />
                    </View>
                    <Text style={styles.appName}>eMeter</Text>
                    <Text style={styles.subtitle}>Meter Reader Portal</Text>
                    <Text style={styles.org}>Aligarh Muslim University</Text>
                </View>

                {/* Login Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Sign In</Text>
                    <Text style={styles.cardSubtitle}>Enter your credentials to continue</Text>

                    {error ? (
                        <View style={styles.errorBox}>
                            <Ionicons name="alert-circle" size={18} color={colors.danger} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    {/* Username */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Username</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="person-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                value={username}
                                onChangeText={setUsername}
                                placeholder="Enter username"
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="none"
                                autoCorrect={false}
                                returnKeyType="next"
                            />
                        </View>
                    </View>

                    {/* Password */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { flex: 1 }]}
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Enter password"
                                placeholderTextColor={colors.textMuted}
                                secureTextEntry={!showPassword}
                                returnKeyType="go"
                                onSubmitEditing={handleLogin}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.eyeBtn}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                    size={20}
                                    color={colors.textMuted}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Login Button */}
                    <TouchableOpacity
                        style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.white} size="small" />
                        ) : (
                            <>
                                <Ionicons name="log-in-outline" size={22} color={colors.white} />
                                <Text style={styles.loginBtnText}>Sign In</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <Text style={styles.footer}>AMU eMeter System v1.0</Text>
            </KeyboardAvoidingView>

            {/* Server Settings Icon */}
            <TouchableOpacity 
                style={styles.settingsIcon} 
                onPress={() => {
                    loadServerUrl();
                    setModalVisible(true);
                    setConnectionStatus(null);
                }}
            >
                <Ionicons name="settings-outline" size={26} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Server Settings Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Server Configuration</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        
                        <Text style={styles.modalDesc}>
                            Update your backend IP address if the server has moved. (e.g. http://192.168.x.x:8000)
                        </Text>

                        <View style={[styles.inputWrapper, { marginBottom: 16, backgroundColor: colors.bgDark }]}>
                            <Ionicons name="server-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { flex: 1 }]}
                                value={serverUrlInput}
                                onChangeText={(v) => { setServerUrlInput(v); setConnectionStatus(null); }}
                                placeholder="Enter server URL"
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="url"
                            />
                            {connectionStatus === 'ok' && (
                                <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                            )}
                            {connectionStatus === 'fail' && (
                                <Ionicons name="close-circle" size={22} color="#ef4444" />
                            )}
                        </View>

                        <TouchableOpacity
                            style={[styles.loginBtn, testingConnection && styles.loginBtnDisabled]}
                            onPress={handleTestAndSaveUrl}
                            disabled={testingConnection}
                        >
                            {testingConnection ? (
                                <ActivityIndicator color={colors.white} size="small" />
                            ) : (
                                <>
                                    <Ionicons name="wifi-outline" size={20} color={colors.white} />
                                    <Text style={styles.loginBtnText}>Test & Save Connection</Text>
                                </>
                            )}
                        </TouchableOpacity>
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
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
    },
    logoArea: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    iconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: colors.bgCard,
        borderWidth: 2,
        borderColor: colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    appName: {
        fontSize: fontSize.hero,
        fontWeight: '800',
        color: colors.textPrimary,
        letterSpacing: 1,
    },
    subtitle: {
        fontSize: fontSize.lg,
        color: colors.accent,
        fontWeight: '600',
        marginTop: 2,
    },
    org: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    card: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardTitle: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    cardSubtitle: {
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
    inputGroup: {
        marginBottom: spacing.md,
    },
    label: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCardLight,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    inputIcon: {
        paddingLeft: spacing.md,
    },
    input: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: spacing.md,
        color: colors.textPrimary,
        fontSize: fontSize.md,
    },
    eyeBtn: {
        padding: spacing.md,
    },
    loginBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: borderRadius.sm,
        marginTop: spacing.md,
        gap: spacing.sm,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 4,
    },
    loginBtnDisabled: {
        opacity: 0.7,
    },
    loginBtnText: {
        color: colors.white,
        fontSize: fontSize.lg,
        fontWeight: '700',
    },
    footer: {
        textAlign: 'center',
        marginTop: spacing.xl,
        color: colors.textMuted,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    settingsIcon: {
        position: 'absolute',
        top: 60,
        right: spacing.lg,
        padding: spacing.sm,
        backgroundColor: colors.bgCard,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.bgCard,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: spacing.xl,
        paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xl,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    modalTitle: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    modalDesc: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.lg,
        lineHeight: 20,
    },
});
