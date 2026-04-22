import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { addConsumerAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const LOAD_OPTIONS = [1.0, 2.0, 3.0, 4.0, 5.0];
const METER_TYPES = [
    { value: '10', label: '1 Phase (Standard)' },
    { value: '25', label: '3 Phase (Enhanced)' },
];
const CONNECTION_TYPES = [
    { value: 'residential', label: 'Residential' },
    { value: 'commercial', label: 'Commercial' },
    { value: 'industrial', label: 'Industrial' },
];

export default function AddConsumerScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors);

    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        meter_number: '',
        load_kw: 1.0,
        meter_type: '10',
        connection_type: 'residential',
    });

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        if (!form.name.trim()) {
            Alert.alert('Required', 'Please enter the consumer name.');
            return;
        }
        if (!form.meter_number.trim()) {
            Alert.alert('Required', 'Please enter the meter number.');
            return;
        }

        setSaving(true);
        try {
            const data = await addConsumerAPI(form);
            if (data.success) {
                Alert.alert(
                    'Consumer Added ✅',
                    `${data.name} has been registered successfully.\nConsumer #: ${data.consumer_number}\nMeter #: ${data.meter_number}`,
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert('Error', data.error || 'Failed to add consumer.');
            }
        } catch (err) {
            const errorMsg =
                err.response?.data?.error ||
                err.response?.data?.detail ||
                err.message ||
                'Something went wrong.';
            Alert.alert('Error', errorMsg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={100}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add New Consumer</Text>
                <TouchableOpacity onPress={handleSubmit} disabled={saving}>
                    {saving ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                        <Text style={styles.saveBtnText}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Info Banner */}
                <View style={styles.infoBanner}>
                    <Ionicons name="person-add" size={20} color={colors.accent} />
                    <Text style={styles.infoText}>
                        Register a new electricity consumer. A unique Consumer ID will be auto-generated.
                    </Text>
                </View>

                {/* Personal Details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Details</Text>

                    <FormInput
                        label="Full Name *"
                        value={form.name}
                        onChangeText={(val) => updateField('name', val)}
                        placeholder="e.g. Mohammad Ahmad"
                        icon="person-outline"
                        colors={colors}
                    />

                    <FormInput
                        label="Phone Number"
                        value={form.phone}
                        onChangeText={(val) => updateField('phone', val)}
                        placeholder="e.g. 9876543210"
                        icon="call-outline"
                        keyboardType="phone-pad"
                        colors={colors}
                    />

                    <FormInput
                        label="Email (Optional)"
                        value={form.email}
                        onChangeText={(val) => updateField('email', val)}
                        placeholder="e.g. user@example.com"
                        icon="mail-outline"
                        keyboardType="email-address"
                        colors={colors}
                    />

                    <FormInput
                        label="Address"
                        value={form.address}
                        onChangeText={(val) => updateField('address', val)}
                        placeholder="e.g. House #12, Block A, AMU Campus"
                        icon="location-outline"
                        multiline
                        colors={colors}
                    />
                </View>

                {/* Meter Details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Meter Details</Text>

                    <FormInput
                        label="Meter Number *"
                        value={form.meter_number}
                        onChangeText={(val) => updateField('meter_number', val)}
                        placeholder="e.g. MTR-2024-001"
                        icon="speedometer-outline"
                        colors={colors}
                    />

                    {/* Load KW Selector */}
                    <Text style={styles.fieldLabel}>Load (KW)</Text>
                    <View style={styles.chipRow}>
                        {LOAD_OPTIONS.map((load) => (
                            <TouchableOpacity
                                key={load}
                                style={[
                                    styles.chip,
                                    form.load_kw === load && styles.chipActive,
                                ]}
                                onPress={() => updateField('load_kw', load)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        form.load_kw === load && styles.chipTextActive,
                                    ]}
                                >
                                    {load} KW
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Meter Type Selector */}
                    <Text style={styles.fieldLabel}>Meter Type (Phase)</Text>
                    <View style={styles.chipRow}>
                        {METER_TYPES.map((type) => (
                            <TouchableOpacity
                                key={type.value}
                                style={[
                                    styles.chip,
                                    styles.chipWide,
                                    form.meter_type === type.value && styles.chipActive,
                                ]}
                                onPress={() => updateField('meter_type', type.value)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        form.meter_type === type.value && styles.chipTextActive,
                                    ]}
                                >
                                    {type.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Connection Type Selector */}
                    <Text style={styles.fieldLabel}>Connection Type</Text>
                    <View style={styles.chipRow}>
                        {CONNECTION_TYPES.map((type) => (
                            <TouchableOpacity
                                key={type.value}
                                style={[
                                    styles.chip,
                                    form.connection_type === type.value && styles.chipActive,
                                ]}
                                onPress={() => updateField('connection_type', type.value)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        form.connection_type === type.value && styles.chipTextActive,
                                    ]}
                                >
                                    {type.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                    style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={saving}
                    activeOpacity={0.8}
                >
                    {saving ? (
                        <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                        <>
                            <Ionicons name="person-add" size={22} color={colors.white} />
                            <Text style={styles.submitBtnText}>Register Consumer</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function FormInput({ label, value, onChangeText, placeholder, icon, keyboardType, multiline, colors }) {
    const inputStyles = createStyles(colors);
    return (
        <View style={inputStyles.inputContainer}>
            <Text style={inputStyles.inputLabel}>{label}</Text>
            <View style={[inputStyles.inputWrapper, multiline && { alignItems: 'flex-start' }]}>
                <Ionicons
                    name={icon}
                    size={20}
                    color={colors.textMuted}
                    style={[inputStyles.inputIcon, multiline && { marginTop: 14 }]}
                />
                <TextInput
                    style={[inputStyles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    keyboardType={keyboardType || 'default'}
                    multiline={multiline}
                />
            </View>
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
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingBottom: 60 },
    infoBanner: {
        flexDirection: 'row',
        backgroundColor: colors.isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
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
    inputLabel: {
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
        fontWeight: '500',
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 10,
        marginTop: 4,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    chip: {
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        borderRadius: borderRadius.full,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.bgCardLight,
    },
    chipWide: {
        flex: 1,
        alignItems: 'center',
    },
    chipActive: {
        borderColor: colors.accent,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
    },
    chipText: {
        fontSize: fontSize.sm,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    chipTextActive: {
        color: colors.accent,
        fontWeight: '700',
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        height: 56,
        borderRadius: borderRadius.md,
        marginTop: spacing.md,
        gap: spacing.sm,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    submitBtnText: {
        color: colors.white,
        fontSize: fontSize.md,
        fontWeight: '800',
    },
    submitBtnDisabled: {
        opacity: 0.6,
    },
});
