import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { getSettingsAPI, updateSettingsAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function SettingsScreen({ navigation }) {
    const { themeMode, toggleTheme, colors, isDark } = useTheme();
    const styles = createStyles(colors);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        rate_per_unit: '',
        fixed_charge_per_kw: '',
        phase_1_rent: '',
        phase_3_rent: '',
        duty_percentage: '',
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const data = await getSettingsAPI();
            setSettings({
                rate_per_unit: data.rate_per_unit.toString(),
                fixed_charge_per_kw: data.fixed_charge_per_kw.toString(),
                phase_1_rent: data.phase_1_rent.toString(),
                phase_3_rent: data.phase_3_rent.toString(),
                duty_percentage: data.duty_percentage.toString(),
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to fetch settings from server.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateSettingsAPI(settings);
            Alert.alert('Success', 'Billing settings updated successfully!');
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || 'Please try again later.';
            Alert.alert('Error', `Failed to update settings: ${errorMsg}`);
        } finally {
            setSaving(false);
        }

    };

    const updateField = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={100}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    {saving ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                        <Text style={styles.saveBtnText}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                {/* Theme Toggle Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>App Appearance</Text>
                    <View style={styles.themeToggleCard}>
                        <View style={styles.themeToggleInfo}>
                            <Ionicons
                                name={isDark ? "moon-outline" : "sunny-outline"}
                                size={22}
                                color={colors.textPrimary}
                            />
                            <View style={{ marginLeft: 12 }}>
                                <Text style={styles.themeToggleTitle}>
                                    {isDark ? 'Dark Mode' : 'Light Mode'}
                                </Text>
                                <Text style={styles.themeToggleSub}>
                                    Switch between themes
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={isDark}
                            onValueChange={toggleTheme}
                            trackColor={{ false: colors.border, true: colors.accent }}
                            thumbColor={colors.white}
                        />
                    </View>
                </View>

                <View style={styles.infoBox}>
                    <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
                    <Text style={styles.infoText}>
                        Billing rates are used for all future calculations. Changes will not affect already generated bills.
                    </Text>
                </View>

                {/* Energy Charges */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Energy & Fixed Charges</Text>

                    <SettingInput
                        label="Rate per Unit (₹)"
                        value={settings.rate_per_unit}
                        onChangeText={(val) => updateField('rate_per_unit', val)}
                        placeholder="e.g. 8.56"
                        icon="flash-outline"
                        colors={colors}
                    />

                    <SettingInput
                        label="Fixed Charge per KW (₹)"
                        value={settings.fixed_charge_per_kw}
                        onChangeText={(val) => updateField('fixed_charge_per_kw', val)}
                        placeholder="e.g. 400.0"
                        icon="business-outline"
                        colors={colors}
                    />
                </View>

                {/* Meter Rent */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Meter Rent (Phase Based)</Text>

                    <SettingInput
                        label="1 Phase Meter Rent (₹)"
                        value={settings.phase_1_rent}
                        onChangeText={(val) => updateField('phase_1_rent', val)}
                        placeholder="e.g. 10.0"
                        icon="timer-outline"
                        colors={colors}
                    />

                    <SettingInput
                        label="3 Phase Meter Rent (₹)"
                        value={settings.phase_3_rent}
                        onChangeText={(val) => updateField('phase_3_rent', val)}
                        placeholder="e.g. 25.0"
                        icon="speedometer-outline"
                        colors={colors}
                    />
                </View>

                {/* Taxes & Duty */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Taxes & Goverment Duty</Text>

                    <SettingInput
                        label="Electricity Duty (%)"
                        value={settings.duty_percentage}
                        onChangeText={(val) => updateField('duty_percentage', val)}
                        placeholder="e.g. 7.5"
                        icon="receipt-outline"
                        colors={colors}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.disabledBtn]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        <>
                            <Ionicons name="save-outline" size={20} color={colors.white} />
                            <Text style={styles.saveButtonText}>Update All Rates</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function SettingInput({ label, value, onChangeText, placeholder, icon, colors }) {
    const inputStyles = createStyles(colors);
    return (
        <View style={inputStyles.inputContainer}>
            <Text style={inputStyles.label}>{label}</Text>
            <View style={inputStyles.inputWrapper}>
                <Ionicons name={icon} size={20} color={colors.textMuted} style={inputStyles.inputIcon} />
                <TextInput
                    style={inputStyles.input}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                />
            </View>
        </View>
    );
}

const createStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDark },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgDark },
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
    backBtn: { padding: 4 },
    headerTitle: {
        flex: 1,
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.textPrimary,
        marginLeft: spacing.md,
    },
    saveBtnText: {
        color: colors.accent,
        fontWeight: '700',
        fontSize: fontSize.md,
    },
    content: { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingBottom: 40 },
    themeToggleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.bgCard,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    themeToggleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    themeToggleTitle: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    themeToggleSub: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: colors.isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(11, 79, 159, 0.08)',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
        alignItems: 'center',
        gap: spacing.sm,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: fontSize.md,
        fontWeight: '800',
        color: colors.textPrimary,
        marginBottom: spacing.lg,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    inputContainer: {
        marginBottom: spacing.lg,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCardLight,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
    },
    inputIcon: { marginRight: spacing.sm },
    input: {
        flex: 1,
        height: 50,
        color: colors.textPrimary,
        fontSize: fontSize.md,
        fontWeight: '600',
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.accent,
        height: 56,
        borderRadius: borderRadius.md,
        marginTop: spacing.md,
        gap: spacing.sm,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonText: {
        color: colors.white,
        fontSize: fontSize.md,
        fontWeight: '800',
    },
    disabledBtn: {
        opacity: 0.6,
    },
});
