import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { sendBillSmsAPI, getBillPdfUrl } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function BillPreviewScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors);

    const bill = route?.params?.bill;
    const reading = route?.params?.reading;
    const consumer = route?.params?.consumer;

    console.log("Bill:", bill);

    // BUG-28 FIX: All hooks must come before any conditional return.
    // Moving useState calls here prevents the React rules-of-hooks violation.
    const [whatsappSending, setWhatsappSending] = React.useState(false);
    const [whatsappSent, setWhatsappSent] = React.useState(false);
    const [pdfDownloading, setPdfDownloading] = React.useState(false);

    // BUG-30 FIX: Guard against missing bill or reading before any field access.
    // reading may be undefined if navigation didn't pass it (see BUG-29).
    if (!bill || !reading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors?.bgDark || '#111' }}>
                <Text style={{ color: colors?.danger || '#ef4444', fontSize: 15, textAlign: 'center', paddingHorizontal: 32 }}>
                    Bill data is unavailable.{`\n`}Please go back and try again.
                </Text>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{ marginTop: 24, paddingVertical: 12, paddingHorizontal: 28, backgroundColor: colors?.primary || '#3b82f6', borderRadius: 10 }}
                >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const formatTimestamp = (isoString) => {
        if (!isoString) return new Date().toLocaleString();
        try {
            const date = new Date(isoString);
            return date.toLocaleString('en-IN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch (e) {
            return isoString;
        }
    };

    const handleSendWhatsApp = async () => {
        setWhatsappSending(true);
        try {
            const data = await sendBillSmsAPI(bill.id);
            if (data.success) {
                setWhatsappSent(true);
                if (data.sms_sent) {
                    Alert.alert('WhatsApp Sent ✅', `Bill notification sent to ${data.phone} via WhatsApp`);
                } else {
                    Alert.alert(
                        'Notification Preview',
                        `${data.reason}\n\nMessage:\n${data.message_preview}`,
                        [{ text: 'OK' }]
                    );
                    setWhatsappSent(true);
                }
            }
        } catch (err) {
            console.error('WhatsApp send failed:', err);
            const errorMsg = err.response?.data?.error || err.message || 'Unknown error';
            Alert.alert('Error', `Failed to send WhatsApp notification: ${errorMsg}`);
        } finally {
            setWhatsappSending(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.popToTop()} style={styles.backBtn}>
                    <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Bill Generated</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Success Banner */}
                <View style={styles.successBanner}>
                    <View style={styles.successIconCircle}>
                        <Ionicons name="checkmark-circle" size={56} color={colors.success} />
                    </View>
                    <Text style={styles.successTitle}>Bill Generated Successfully!</Text>
                    <Text style={styles.billNumber}>{bill?.bill_number || "N/A"}</Text>
                    <Text style={styles.billTimestamp}>Generated on: {bill?.created_at ? formatTimestamp(bill.created_at) : "N/A"}</Text>
                </View>

                {/* Consumer Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Consumer Details</Text>
                    <View style={styles.infoGrid}>
                        <InfoRow label="Name" value={bill.consumer_name} colors={colors} />
                        <InfoRow label="Consumer #" value={bill.consumer_number} colors={colors} />
                        <InfoRow label="Meter #" value={bill.meter_number} colors={colors} />
                        <InfoRow label="Load (KW)" value={`${bill.load_kw || 1.0} KW`} colors={colors} />
                        <InfoRow
                            label="Meter Type"
                            value={bill.meter_type === '10' ? '1 Phase' : '3 Phase'}
                            colors={colors}
                        />
                        <InfoRow label="Address" value={bill.address || 'N/A'} colors={colors} />
                    </View>
                </View>

                {/* Reading Details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Meter Reading</Text>
                    <View style={styles.readingGrid}>
                        <View style={styles.readingBox}>
                            <Text style={styles.readingLabel}>Previous</Text>
                            <Text style={styles.readingVal}>{reading.previous_reading}</Text>
                            <Text style={styles.readingUnit}>kWh</Text>
                        </View>
                        <View style={styles.arrowBox}>
                            <Ionicons name="arrow-forward" size={24} color={colors.accent} />
                        </View>
                        <View style={styles.readingBox}>
                            <Text style={styles.readingLabel}>Current</Text>
                            <Text style={[styles.readingVal, { color: colors.accent }]}>
                                {reading.current_reading}
                            </Text>
                            <Text style={styles.readingUnit}>kWh</Text>
                        </View>
                        <View style={styles.unitsBox}>
                            <Ionicons name="flash" size={18} color={colors.accent} />
                            <Text style={styles.unitsVal}>{bill.units}</Text>
                            <Text style={styles.readingUnit}>units</Text>
                        </View>
                    </View>
                </View>

                {/* Charge Breakdown */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Charge Breakdown</Text>
                    <View style={styles.chargeTable}>
                        <ChargeRow
                            label={`Energy (${bill.units || 0} kWh × ₹${bill.rate_per_unit || '8.56'})`}
                            amount={`₹${Number(bill.energy_charges || 0).toFixed(2)}`}
                            colors={colors}
                        />
                        <ChargeRow label="Fixed Charges (Load Based)" amount={`₹${Number(bill.fixed_charges || 0).toFixed(2)}`} colors={colors} />
                        <ChargeRow label="Electricity Duty" amount={`₹${Number(bill.duty_charge || 0).toFixed(2)}`} colors={colors} />
                        <ChargeRow label="Meter Rent" amount={`₹${Number(bill.meter_rent || 0).toFixed(2)}`} colors={colors} />

                        {(bill.regulatory_surcharge || 0) > 0 && (
                            <ChargeRow label="Regulatory Surcharge" amount={`₹${(bill.regulatory_surcharge || 0).toFixed(2)}`} colors={colors} />
                        )}

                        <View style={styles.chargeDivider} />

                        {((bill.arrears || 0) > 0 || (bill.late_payment_surcharge || 0) > 0) && (
                            <>
                                <ChargeRow
                                    label="Previous Arrears"
                                    amount={`₹${Number(bill.arrears || 0).toFixed(2)}`}
                                    color={colors.danger}
                                    colors={colors}
                                />
                                <ChargeRow
                                    label="Late Payment Surcharge"
                                    amount={`₹${Number(bill.late_payment_surcharge || 0).toFixed(2)}`}
                                    color={colors.danger}
                                    colors={colors}
                                />
                                <View style={styles.chargeDivider} />
                            </>
                        )}

                        <View style={styles.grandTotalBar}>
                            <Text style={styles.grandTotalLabel}>TOTAL AMOUNT DUE</Text>
                            <Text style={styles.grandTotalValue}>₹{Math.round(bill.grand_total || bill.total_amount || 0)}</Text>
                        </View>
                    </View>
                </View>

                {/* Due Date & Period */}
                <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                        <Ionicons name="calendar" size={16} color={colors.textMuted} />
                        <Text style={styles.metaLabel}>Billing Period</Text>
                        <Text style={styles.metaValue}>{bill.billing_period}</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Ionicons name="time" size={16} color={colors.textMuted} />
                        <Text style={styles.metaLabel}>Generated On</Text>
                        <Text style={styles.metaValue}>{bill?.created_at ? formatTimestamp(bill.created_at).split(',')[1]?.trim() : "N/A"}</Text>
                        <Text style={styles.metaDate}>{bill?.created_at ? formatTimestamp(bill.created_at).split(',')[0]?.trim() : "N/A"}</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Ionicons name="alert-circle" size={16} color={colors.warning} />
                        <Text style={styles.metaLabel}>Due Date</Text>
                        <Text style={[styles.metaValue, { color: colors.warning }]}>{bill.due_date}</Text>
                    </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                    {/* Send WhatsApp */}
                    <TouchableOpacity
                        style={[
                            styles.actionBtn,
                            styles.whatsappBtn,
                            whatsappSent && styles.whatsappSentBtn,
                        ]}
                        onPress={handleSendWhatsApp}
                        disabled={whatsappSending || whatsappSent}
                        activeOpacity={0.8}
                    >
                        {whatsappSending ? (
                            <ActivityIndicator color={colors.white} size="small" />
                        ) : (
                            <>
                                <Ionicons
                                    name={whatsappSent ? 'checkmark-circle' : 'logo-whatsapp'}
                                    size={22}
                                    color={colors.white}
                                />
                                <Text style={styles.actionBtnText}>
                                    {whatsappSent ? 'WhatsApp Sent' : 'Send WhatsApp Notification'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Download PDF (UPPCL Format) */}
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.pdfBtn]}
                        onPress={async () => {
                            setPdfDownloading(true);
                            try {
                                const htmlContent = `
                                    <!DOCTYPE html>
                                    <html>
                                    <head>
                                        <meta charset="utf-8"/>
                                        <style>
                                            body { font-family: 'Helvetica', Arial, sans-serif; color: #333; margin: 0; padding: 20px; line-height: 1.4; }
                                            .header { text-align: center; border-bottom: 2px solid #064e3b; padding-bottom: 10px; margin-bottom: 20px; }
                                            .header h1 { color: #064e3b; margin: 0; font-size: 20px; text-transform: uppercase; }
                                            .header p { margin: 5px 0; font-size: 12px; font-weight: bold; }
                                            
                                            .bill-meta-table { width: 100%; margin-bottom: 20px; font-size: 12px; border: none; }
                                            .bill-meta-table td { border: none; padding: 2px 0; vertical-align: top; }
                                            
                                            .section-title { background: #f0f4f8; padding: 5px 10px; font-weight: bold; font-size: 13px; border-left: 4px solid #064e3b; margin-bottom: 10px; }
                                            
                                            table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
                                            table.data-table th, table.data-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                                            table.data-table th { background-color: #064e3b; color: white; font-weight: bold; }
                                            .text-right { text-align: right; }
                                            .bold { font-weight: bold; }
                                            
                                            .total-box { background: #064e3b; color: white; padding: 15px; text-align: right; border-radius: 4px; margin-top: 20px; }
                                            .total-box h2 { margin: 0; font-size: 18px; }
                                            
                                            .footer { margin-top: 50px; font-size: 10px; color: #777; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
                                            .watermark { position: absolute; top: 50%; left: 50%; margin-left: -250px; margin-top: -50px; transform: rotate(-45deg); font-size: 100px; color: rgba(0,0,0,0.03); z-index: -1; white-space: nowrap; }
                                        </style>
                                    </head>
                                    <body>
                                        <div class="watermark">AMU EMETER</div>
                                        
                                        <div class="header">
                                            <h1 style="color: #064e3b;">eMeter AMU</h1>
                                            <p>Aligarh Muslim University Electricity Billing System.</p>
                                        </div>
                                        
                                        <table class="bill-meta-table">
                                            <tr>
                                                <td width="50%">
                                                    <strong>Bill No:</strong> ${bill.bill_number || 'N/A'}<br/>
                                                    <strong>Bill Date:</strong> ${bill?.created_at ? formatTimestamp(bill.created_at) : "N/A"}<br/>
                                                    <strong>Due Date:</strong> <span style="color: #dc2626; font-weight: bold;">${bill.due_date}</span>
                                                </td>
                                                <td width="50%" style="text-align: right;">
                                                    <strong>Connection Type:</strong> ${bill.connection_type || 'Residential'}<br/>
                                                    <strong>Load:</strong> ${bill.load_kw || 1.0} KW<br/>
                                                    <strong>Billing Period:</strong> ${bill.billing_period}
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <div class="section-title">CONSUMER DETAILS</div>
                                        <table class="data-table">
                                            <tr>
                                                <td width="30%"><strong>Consumer Name</strong></td>
                                                <td>${bill.consumer_name}</td>
                                            </tr>
                                            <tr>
                                                <td><strong>Account ID / Consumer No</strong></td>
                                                <td>${bill.consumer_number}</td>
                                            </tr>
                                            <tr>
                                                <td><strong>Meter Number</strong></td>
                                                <td>${bill.meter_number}</td>
                                            </tr>
                                            <tr>
                                                <td><strong>Address</strong></td>
                                                <td>${bill.address || 'N/A'}</td>
                                            </tr>
                                        </table>
                                        
                                        <div class="section-title">READING DETAILS</div>
                                        <table class="data-table">
                                            <tr>
                                                <th>Description</th>
                                                <th>Previous Reading</th>
                                                <th>Current Reading</th>
                                                <th>Consumption (Units)</th>
                                            </tr>
                                            <tr>
                                                <td>Meter Reading (kWh)</td>
                                                <td>${reading.previous_reading}</td>
                                                <td>${reading.current_reading}</td>
                                                <td>${bill.units}</td>
                                            </tr>
                                        </table>
                                        
                                        <div class="section-title">BILLING DETAILS (Charges in ₹)</div>
                                        <table class="data-table">
                                            <tr>
                                                <th>Description</th>
                                                <th class="text-right">Amount</th>
                                            </tr>
                                            <tr>
                                                <td>Energy Charges (${bill.units || 0} units × ₹${bill.rate_per_unit || '8.56'})</td>
                                                <td class="text-right">${(bill.energy_charges || 0).toFixed(2)}</td>
                                            </tr>
                                            <tr>
                                                <td>Fixed / Service Charges</td>
                                                <td class="text-right">${(bill.fixed_charges || 0).toFixed(2)}</td>
                                            </tr>
                                            <tr>
                                                <td>Electricity Duty</td>
                                                <td class="text-right">${(bill.duty_charge || 0).toFixed(2)}</td>
                                            </tr>
                                            <tr>
                                                <td>Meter Rent</td>
                                                <td class="text-right">${Number(bill.meter_rent || 0).toFixed(2)}</td>
                                            </tr>
                                            ${(bill.regulatory_surcharge || 0) > 0 ? `
                                            <tr>
                                                <td>Regulatory Surcharge</td>
                                                <td class="text-right">${Number(bill.regulatory_surcharge || 0).toFixed(2)}</td>
                                            </tr>` : ''}
                                            ${(bill.arrears || 0) > 0 ? `
                                            <tr>
                                                <td>Previous Arrears</td>
                                                <td class="text-right" style="color: red;">${Number(bill.arrears || 0).toFixed(2)}</td>
                                            </tr>` : ''}
                                            ${(bill.late_payment_surcharge || 0) > 0 ? `
                                            <tr>
                                                <td>Late Payment Surcharge</td>
                                                <td class="text-right" style="color: red;">${Number(bill.late_payment_surcharge || 0).toFixed(2)}</td>
                                            </tr>` : ''}
                                            <tr class="bold">
                                                <td>TOTAL NET AMOUNT</td>
                                                <td class="text-right">₹${Number(bill.grand_total || bill.total_amount || 0).toFixed(2)}</td>
                                            </tr>
                                        </table>
                                        
                                        <div class="total-box">
                                            <div>TOTAL PAYABLE AMOUNT</div>
                                            <h2>₹${Number(bill.grand_total || bill.total_amount || 0).toFixed(2)}</h2>
                                        </div>
                                        
                                        <div class="footer">
                                            <p>This is a computer generated bill and does not require a physical signature.</p>
                                            <p>For support or queries, please contact AMU Electricity Department.</p>
                                        </div>
                                    </body>
                                    </html>
                                `;

                                const { uri } = await Print.printToFileAsync({
                                    html: htmlContent,
                                    base64: false,
                                });

                                await Sharing.shareAsync(uri, {
                                    mimeType: 'application/pdf',
                                    dialogTitle: `Electricity Bill ${bill.bill_number}`,
                                    UTI: 'com.adobe.pdf',
                                });
                            } catch (err) {
                                console.error('PDF generation error:', err);
                                Alert.alert('Error', 'Failed to generate PDF bill.');
                            } finally {
                                setPdfDownloading(false);
                            }
                        }}
                        disabled={pdfDownloading}
                        activeOpacity={0.8}
                    >
                        {pdfDownloading ? (
                            <ActivityIndicator color={colors.white} size="small" />
                        ) : (
                            <>
                                <Ionicons name="document-text" size={22} color={colors.white} />
                                <Text style={styles.actionBtnText}>Download PDF</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Edit Reading */}
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.editBtn]}
                        onPress={() =>
                            navigation.navigate('SubmitReading', {
                                consumer: {
                                    ...consumer,
                                    previous_reading: reading.previous_reading,
                                },
                                editMode: true,
                                readingId: reading.id,
                            })
                        }
                        activeOpacity={0.8}
                    >
                        <Ionicons name="create-outline" size={22} color={colors.accent} />
                        <Text style={[styles.actionBtnText, { color: colors.accent }]}>Edit Reading</Text>
                    </TouchableOpacity>

                    {/* Done */}
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.doneBtn]}
                        onPress={() => navigation.popToTop()}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="home" size={22} color={isDark ? colors.textPrimary : colors.white} />
                        <Text style={[styles.actionBtnText, { color: isDark ? colors.textPrimary : colors.white }]}>
                            Back to Dashboard
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

function InfoRow({ label, value, colors }) {
    const rowStyles = createStyles(colors);
    return (
        <View style={rowStyles.infoRow}>
            <Text style={rowStyles.infoLabel}>{label}</Text>
            <Text style={rowStyles.infoValue}>{value}</Text>
        </View>
    );
}

function ChargeRow({ label, amount, bold, color, colors }) {
    const rowStyles = createStyles(colors);
    return (
        <View style={rowStyles.chargeRow}>
            <Text style={[rowStyles.chargeLabel, bold && rowStyles.chargeBold, color && { color }]}>
                {label}
            </Text>
            <Text style={[rowStyles.chargeAmount, bold && rowStyles.chargeBold, color && { color }]}>
                {amount}
            </Text>
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
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: {
        flex: 1,
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.textPrimary,
        textAlign: 'center',
    },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingBottom: 120 },
    successBanner: {
        alignItems: 'center',
        backgroundColor: colors.successBg,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    successIconCircle: { marginBottom: spacing.sm },
    successTitle: {
        fontSize: fontSize.lg,
        fontWeight: '800',
        color: colors.success,
        marginBottom: 4,
    },
    billNumber: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    billTimestamp: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        marginTop: 4,
    },
    section: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sectionTitle: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: spacing.md,
    },
    infoGrid: { gap: spacing.sm },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    infoLabel: { fontSize: fontSize.sm, color: colors.textMuted },
    infoValue: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '600' },
    readingGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    readingBox: { alignItems: 'center' },
    readingLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: 4 },
    readingVal: { fontSize: fontSize.xl, fontWeight: '800', color: colors.textPrimary },
    readingUnit: { fontSize: fontSize.xs, color: colors.textMuted },
    arrowBox: { paddingHorizontal: spacing.sm },
    unitsBox: {
        alignItems: 'center',
        backgroundColor: colors.warningBg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm,
    },
    unitsVal: { fontSize: fontSize.lg, fontWeight: '800', color: colors.accent },
    chargeTable: { gap: spacing.sm },
    chargeRow: { flexDirection: 'row', justifyContent: 'space-between' },
    chargeLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
    chargeAmount: { fontSize: fontSize.sm, color: colors.textPrimary },
    chargeBold: { fontWeight: '700', color: colors.textPrimary },
    chargeDivider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: spacing.xs,
    },
    grandTotalBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.primaryDark,
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        marginTop: spacing.sm,
    },
    grandTotalLabel: {
        fontSize: fontSize.md,
        fontWeight: '800',
        color: colors.white,
    },
    grandTotalValue: {
        fontSize: fontSize.xl,
        fontWeight: '800',
        color: colors.accentLight,
    },
    metaRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    metaItem: {
        flex: 1,
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: colors.border,
    },
    metaLabel: { fontSize: fontSize.xs, color: colors.textMuted },
    metaValue: {
        fontSize: fontSize.sm,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    metaDate: {
        fontSize: 10,
        color: colors.textMuted,
    },
    actionButtons: { gap: spacing.sm },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: borderRadius.md,
        gap: spacing.sm,
    },
    whatsappBtn: {
        backgroundColor: '#25D366', // WhatsApp Green
        shadowColor: '#25D366',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    whatsappSentBtn: { backgroundColor: colors.textMuted, opacity: 0.7 },
    pdfBtn: {
        backgroundColor: colors.info,
        shadowColor: colors.info,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    editBtn: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: colors.accent,
    },
    doneBtn: {
        backgroundColor: colors.bgCardLight,
    },
    actionBtnText: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.white,
    },
});