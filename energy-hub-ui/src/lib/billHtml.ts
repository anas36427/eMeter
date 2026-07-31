/**
 * billHtml.ts
 * Single source-of-truth HTML bill template for AMU eMeter.
 * Matches the canonical institutional design. Used across the web Billing module AND mobile application.
 */

export interface BillHtmlData {
  bill_number?: string;
  bill_date?: string;
  due_date?: string;
  billing_period?: string;
  connection_type?: string;
  billing_type?: string;
  load_kw?: number | string;
  meter_type?: string; // '1' = 1-Phase, else 3-Phase
  reading_date?: string;
  payment_date?: string;

  consumer_name?: string;
  consumer_number?: string;
  meter_number?: string;
  address?: string;
  department?: string;
  post?: string;
  phone?: string;
  email?: string;

  previous_reading?: number;
  current_reading?: number;
  units?: number;
  rate_per_unit?: number | string;
  energy_charges?: number;
  fixed_charges?: number;
  duty_charge?: number;
  meter_rent?: number;
  regulatory_surcharge?: number;
  arrears?: number;
  late_payment_surcharge?: number;
  lps_rate?: number;
  grand_total?: number;
  total_amount?: number;
  status?: string;
}

const fmt2 = (n: number | undefined | null) => Number(n ?? 0).toFixed(2);
const escapeHtml = (str?: string | number | null): string => {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export function generateBillHtml(bill: BillHtmlData): string {
  const grandTotal = Number(bill.grand_total ?? bill.total_amount ?? 0);
  const totalPayable = Math.round(grandTotal);
  const lps = Number(bill.late_payment_surcharge ?? 0);
  const lpsRate = bill.lps_rate ? Number(bill.lps_rate).toFixed(2) : '1.50';
  const regulatory = Number(bill.regulatory_surcharge ?? 0);

  const connType = bill.connection_type
    ? String(bill.connection_type).charAt(0).toUpperCase() + String(bill.connection_type).slice(1).toLowerCase()
    : 'N/A';
  const billingType = bill.billing_type
    ? String(bill.billing_type).charAt(0).toUpperCase() + String(bill.billing_type).slice(1).toLowerCase()
    : 'Salary';
  const statusStr = bill.status ? bill.status.toUpperCase() : 'DRAFT';
  const statusClass = bill.status ? bill.status.toLowerCase() : 'draft';

  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"/>
    <title>Electricity Bill Preview - AMU eMeter</title>
    <style>
        @page {
            size: A4;
            margin: 0.5cm;
        }
        body { 
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
            color: #1f2937; 
            margin: 0; 
            padding: 10px; 
            line-height: 1.25;
            background: #f5f5f5;
            font-size: 11px;
        }
        .page-container {
            max-width: 780px;
            margin: 0 auto;
            background: white;
            padding: 18px 28px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            position: relative;
            border-radius: 4px;
        }
        .header-table { 
            width: 100%;
            border-bottom: 2px solid #064e3b; 
            padding-bottom: 6px; 
            margin-bottom: 10px; 
        }
        .header-title {
            text-align: center;
        }
        .header-title h1 { 
            color: #064e3b; 
            margin: 0; 
            font-size: 22px; 
            font-weight: 800;
            text-transform: uppercase; 
            letter-spacing: 1px;
        }
        .header-title p { 
            color: #4b5563;
            margin: 3px 0 0 0; 
            font-size: 11px; 
            font-weight: 600; 
        }
        .bill-meta { 
            width: 100%;
            margin-bottom: 8px; 
            line-height: 1.4;
        }
        .section-title { 
            background: #f0f4f8; 
            padding: 3px 8px; 
            font-weight: bold; 
            font-size: 10.5px; 
            color: #064e3b;
            border-left: 3px solid #064e3b; 
            margin-top: 6px;
            margin-bottom: 6px; 
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 6px; 
            font-size: 10.5px; 
        }
        th, td { 
            border: 1px solid #e5e7eb; 
            padding: 3.5px 6px; 
            text-align: left; 
        }
        th { 
            background-color: #064e3b; 
            color: white; 
            font-weight: 700;
        }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .status-badge {
            font-weight: bold;
            padding: 1px 5px;
            border-radius: 2px;
            font-size: 9.5px;
            text-transform: uppercase;
        }
        .status-paid { color: #065f46; background-color: #d1fae5; }
        .status-issued, .status-unpaid { color: #1e40af; background-color: #dbeafe; }
        .status-overdue { color: #991b1b; background-color: #fee2e2; }
        .status-draft { color: #4b5563; background-color: #e5e7eb; }
        .total-box { 
            background: #064e3b; 
            color: white; 
            padding: 7px 14px; 
            text-align: right; 
            border-radius: 4px; 
            margin-top: 8px; 
        }
        .total-box h2 { 
            margin: 0; 
            font-size: 20px; 
            font-weight: bold;
        }
        .footer { 
            margin-top: 10px; 
            font-size: 9px; 
            color: #6b7280; 
            text-align: center; 
            border-top: 1px solid #e5e7eb; 
            padding-top: 6px;
            line-height: 1.3;
        }
        .footer p { margin: 1px 0; }
        .watermark { 
            position: absolute; 
            top: 45%; 
            left: 50%; 
            transform: translate(-50%, -50%); 
            width: 300px;
            height: 300px;
            z-index: 0; 
            opacity: 0.05;
            pointer-events: none;
        }
        .watermark img {
            width: 100%;
            height: auto;
        }
        .arrear-row { background: #fff5f5; }
        .arrear-text { color: #b91c1c; font-weight: 600; }
        @media print {
            html, body { 
                background: white; 
                padding: 0; 
                height: 99%;
                max-height: 100vh;
                overflow: hidden;
                page-break-inside: avoid;
            }
            .page-container { 
                box-shadow: none; 
                padding: 0; 
                max-width: 100%; 
                page-break-inside: avoid;
                overflow: hidden;
            }
        }
    </style>
</head>
<body>
    <div class="page-container">
        <div class="watermark">
            <img src="/logo.png" alt="AMU Logo Watermark" onerror="this.style.display='none'" />
        </div>

        <table class="header-table" style="border: none; margin-bottom: 12px;">
            <tr style="border: none;">
                <td style="border: none; text-align: center; padding: 0 0 8px 0;">
                    <div class="header-title">
                        <h1>eMeter AMU</h1>
                        <p>Aligarh Muslim University Electricity Billing System</p>
                    </div>
                </td>
            </tr>
        </table>

        <table class="bill-meta" style="border: none; margin-bottom: 8px;">
            <tr style="border: none;">
                <td style="border: none; width: 50%; vertical-align: top; padding: 0;">
                    <strong>Bill No:</strong> ${escapeHtml(bill.bill_number || 'N/A')}<br/>
                    <strong>Bill Date:</strong> ${escapeHtml(bill.bill_date || 'N/A')}<br/>
                    <strong>Due Date:</strong> <span style="color:#dc2626; font-weight:bold;">${escapeHtml(bill.due_date || 'N/A')}</span><br/>
                    <strong>Status:</strong> <span class="status-badge status-${escapeHtml(statusClass)}">${escapeHtml(statusStr)}</span>
                    ${bill.status === 'paid' && bill.payment_date && bill.payment_date !== 'N/A' ? `<span style="font-size:10px; color:#065f46;">(Paid on ${escapeHtml(bill.payment_date)})</span>` : ''}
                </td>
                <td style="border: none; width: 50%; text-align: right; vertical-align: top; padding: 0;">
                    <strong>Connection Type:</strong> ${escapeHtml(connType)} (${bill.meter_type === '1' ? '1-Phase' : '3-Phase'})<br/>
                    <strong>Billing Category:</strong> ${escapeHtml(billingType)}<br/>
                    <strong>Connected Load:</strong> ${Number(bill.load_kw || 1.0)} KW<br/>
                    <strong>Billing Period:</strong> ${escapeHtml(bill.billing_period || 'N/A')}
                </td>
            </tr>
        </table>

        <div class="section-title">CONSUMER DETAILS</div>
        <table style="margin-bottom: 8px;">
            <tr>
                <td width="30%"><strong>Consumer Name</strong></td>
                <td><strong>${escapeHtml(bill.consumer_name || 'N/A')}</strong></td>
            </tr>
            ${bill.department && bill.department !== 'N/A' ? `
            <tr>
                <td><strong>Department / Office</strong></td>
                <td>${escapeHtml(bill.department)}</td>
            </tr>` : ''}
            ${bill.post && bill.post !== 'N/A' ? `
            <tr>
                <td><strong>Designation / Post</strong></td>
                <td>${escapeHtml(bill.post)}</td>
            </tr>` : ''}
            <tr>
                <td><strong>Account ID / Consumer No</strong></td>
                <td>${escapeHtml(bill.consumer_number || 'N/A')}</td>
            </tr>
            <tr>
                <td><strong>Meter Number</strong></td>
                <td style="font-family: monospace; font-weight: bold;">${escapeHtml(bill.meter_number || 'N/A')}</td>
            </tr>
            <tr>
                <td><strong>Address</strong></td>
                <td>${escapeHtml(bill.address || 'N/A')}</td>
            </tr>
            ${bill.phone ? `
            <tr>
                <td><strong>Phone</strong></td>
                <td>${escapeHtml(bill.phone)}</td>
            </tr>` : ''}
            ${bill.email ? `
            <tr>
                <td><strong>Email</strong></td>
                <td>${escapeHtml(bill.email)}</td>
            </tr>` : ''}
        </table>

        <div class="section-title">READING DETAILS</div>
        <table style="margin-bottom: 8px;">
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Reading Date</th>
                    <th>Previous Reading</th>
                    <th>Current Reading</th>
                    <th>Consumption (Units)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Meter Reading (kWh)</td>
                    <td>${bill.reading_date || 'N/A'}</td>
                    <td>${Number(bill.previous_reading ?? 0).toFixed(1)}</td>
                    <td>${Number(bill.current_reading ?? 0).toFixed(1)}</td>
                    <td><strong style="font-size: 11.5px;">${Number(bill.units ?? 0).toFixed(1)}</strong></td>
                </tr>
            </tbody>
        </table>

        <div class="section-title">BILLING DETAILS (Charges in ₹)</div>
        <table style="margin-bottom: 8px;">
            <thead>
                <tr>
                    <th>Description</th>
                    <th class="text-right" style="width: 140px;">Amount (₹)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Energy Charges (${Number(bill.units ?? 0).toFixed(1)} units × ₹${Number(bill.rate_per_unit ?? 0).toFixed(2)})</td>
                    <td class="text-right">${fmt2(bill.energy_charges)}</td>
                </tr>
                <tr>
                    <td>Fixed / Demand Charges</td>
                    <td class="text-right">${fmt2(bill.fixed_charges)}</td>
                </tr>
                <tr>
                    <td>Electricity Duty</td>
                    <td class="text-right">${fmt2(bill.duty_charge)}</td>
                </tr>
                <tr>
                    <td>Meter Rent</td>
                    <td class="text-right">${fmt2(bill.meter_rent)}</td>
                </tr>
                ${regulatory > 0 ? `
                <tr>
                    <td>Regulatory Surcharge</td>
                    <td class="text-right">${fmt2(regulatory)}</td>
                </tr>` : ''}
                ${arrears > 0 ? `
                <tr class="arrear-row">
                    <td class="arrear-text">Prior Arrears (Outstanding Balance)</td>
                    <td class="text-right arrear-text"><strong>${fmt2(arrears)}</strong></td>
                </tr>` : ''}
                ${lps > 0 ? `
                <tr class="arrear-row">
                    <td class="arrear-text">Late Payment Surcharge (${lpsRate}%)</td>
                    <td class="text-right arrear-text"><strong>${fmt2(lps)}</strong></td>
                </tr>` : ''}
                <tr class="bold" style="background-color: #f9fafb;">
                    <td>TOTAL NET AMOUNT</td>
                    <td class="text-right">₹${fmt2(grandTotal)}</td>
                </tr>
            </tbody>
        </table>

        <div class="total-box">
            <div style="font-size: 11px; margin-bottom: 2px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px;">TOTAL PAYABLE AMOUNT</div>
            <h2>₹ ${totalPayable.toLocaleString('en-IN')}</h2>
        </div>

        <div class="footer">
            <p>This is a computer-generated bill. For queries, contact the Electricity Section, AMU.</p>
            <p>Generated by eMeter AMU — Aligarh Muslim University Electricity Billing System</p>
        </div>
    </div>
</body>
</html>`;
}
