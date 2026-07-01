/**
 * billHtml.ts
 * Single source-of-truth HTML bill template for AMU eMeter.
 * Matches the original design. Used by the web Billing module AND the mobile BillPreviewScreen.
 */

export interface BillHtmlData {
  bill_number?: string;
  bill_date?: string;
  due_date?: string;
  billing_period?: string;
  connection_type?: string;
  load_kw?: number | string;
  meter_type?: string; // '10' = 1-Phase, else 3-Phase

  consumer_name?: string;
  consumer_number?: string;
  meter_number?: string;
  address?: string;

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
  grand_total?: number;
  total_amount?: number;
  status?: string;
}

const fmt2 = (n: number | undefined | null) => Number(n ?? 0).toFixed(2);

export function generateBillHtml(bill: BillHtmlData): string {
  const grandTotal = Number(bill.grand_total ?? bill.total_amount ?? 0);
  const totalPayable = Math.round(grandTotal);
  const arrears = Number(bill.arrears ?? 0);
  const lps = Number(bill.late_payment_surcharge ?? 0);
  const regulatory = Number(bill.regulatory_surcharge ?? 0);

  const connType = bill.connection_type
    ? String(bill.connection_type).charAt(0).toUpperCase() + String(bill.connection_type).slice(1).toLowerCase()
    : 'N/A';

  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"/>
    <title>Electricity Bill Preview - AMU eMeter</title>
    <style>
        body { 
            font-family: 'Helvetica', Arial, sans-serif; 
            color: #333; 
            margin: 0; 
            padding: 20px; 
            line-height: 1.4;
            background: #f5f5f5;
        }
        .page-container {
            max-width: 850px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            position: relative;
        }
        .header { 
            text-align: center; 
            border-bottom: 2px solid #064e3b; 
            padding-bottom: 10px; 
            margin-bottom: 20px; 
        }
        .header h1 { 
            color: #064e3b; 
            margin: 0; 
            font-size: 24px; 
            text-transform: uppercase; 
        }
        .header p { 
            margin: 5px 0; 
            font-size: 13px; 
            font-weight: bold; 
        }
        .bill-meta { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 20px; 
            font-size: 13px; 
        }
        .bill-meta .col { flex: 1; }
        .section-title { 
            background: #f0f4f8; 
            padding: 5px 10px; 
            font-weight: bold; 
            font-size: 13px; 
            border-left: 4px solid #064e3b; 
            margin-bottom: 10px; 
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px; 
            font-size: 12px; 
        }
        th, td { 
            border: 1px solid #ddd; 
            padding: 10px; 
            text-align: left; 
        }
        th { 
            background-color: #064e3b; 
            color: white; 
        }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .total-box { 
            background: #064e3b; 
            color: white; 
            padding: 20px; 
            text-align: right; 
            border-radius: 4px; 
            margin-top: 20px; 
        }
        .total-box h2 { 
            margin: 0; 
            font-size: 28px; 
        }
        .footer { 
            margin-top: 50px; 
            font-size: 11px; 
            color: #777; 
            text-align: center; 
            border-top: 1px solid #eee; 
            padding-top: 10px; 
        }
        .watermark { 
            position: absolute; 
            top: 50%; 
            left: 50%; 
            transform: translate(-50%, -50%); 
            width: 350px;
            height: 350px;
            z-index: -1; 
            opacity: 0.05;
        }
        .watermark img {
            width: 100%;
            height: auto;
        }
        .arrear-row { background: #fff5f5; }
        .arrear-text { color: #c53030; }
        @media print {
            body { background: white; }
            .page-container { box-shadow: none; padding: 10px; }
        }
    </style>
</head>
<body>
    <div class="page-container">
        <div class="watermark">
            <img src="/logo.png" alt="AMU Logo Watermark" />
        </div>

        <div class="header">
            <h1>eMeter AMU</h1>
            <p>Aligarh Muslim University Electricity Billing System</p>
        </div>

        <div class="bill-meta">
            <div class="col">
                <strong>Bill No:</strong> ${bill.bill_number || 'N/A'}<br/>
                <strong>Bill Date:</strong> ${bill.bill_date || 'N/A'}<br/>
                <strong>Due Date:</strong> <span style="color:#c53030; font-weight:bold;">${bill.due_date || 'N/A'}</span>
            </div>
            <div class="col" style="text-align: right;">
                <strong>Connection Type:</strong> ${connType}<br/>
                <strong>Load:</strong> ${bill.load_kw || 1.0} KW<br/>
                <strong>Billing Period:</strong> ${bill.billing_period || 'N/A'}
            </div>
        </div>

        <div class="section-title">CONSUMER DETAILS</div>
        <table>
            <tr>
                <td width="30%"><strong>Consumer Name</strong></td>
                <td>${bill.consumer_name || 'N/A'}</td>
            </tr>
            <tr>
                <td><strong>Account ID / Consumer No</strong></td>
                <td>${bill.consumer_number || 'N/A'}</td>
            </tr>
            <tr>
                <td><strong>Meter Number</strong></td>
                <td>${bill.meter_number || 'N/A'}</td>
            </tr>
            <tr>
                <td><strong>Address</strong></td>
                <td>${bill.address || 'N/A'}</td>
            </tr>
        </table>

        <div class="section-title">READING DETAILS</div>
        <table>
            <tr>
                <th>Description</th>
                <th>Previous Reading</th>
                <th>Current Reading</th>
                <th>Consumption (Units)</th>
            </tr>
            <tr>
                <td>Meter Reading (kWh)</td>
                <td>${Number(bill.previous_reading ?? 0).toFixed(0)}</td>
                <td>${Number(bill.current_reading ?? 0).toFixed(0)}</td>
                <td><strong>${Number(bill.units ?? 0).toFixed(0)}</strong></td>
            </tr>
        </table>

        <div class="section-title">BILLING DETAILS (Charges in ₹)</div>
        <table>
            <tr>
                <th>Description</th>
                <th class="text-right">Amount</th>
            </tr>
            <tr>
                <td>Energy Charges (${Number(bill.units ?? 0).toFixed(0)} units × ₹${Number(bill.rate_per_unit ?? 0).toFixed(2)})</td>
                <td class="text-right">${fmt2(bill.energy_charges)}</td>
            </tr>
            <tr>
                <td>Fixed / Service Charges</td>
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
                <td class="arrear-text">Previous Arrears</td>
                <td class="text-right arrear-text"><strong>${fmt2(arrears)}</strong></td>
            </tr>` : ''}
            ${lps > 0 ? `
            <tr class="arrear-row">
                <td class="arrear-text">Late Payment Surcharge</td>
                <td class="text-right arrear-text"><strong>${fmt2(lps)}</strong></td>
            </tr>` : ''}
            <tr class="bold">
                <td>TOTAL NET AMOUNT</td>
                <td class="text-right">₹${fmt2(grandTotal)}</td>
            </tr>
        </table>

        <div class="total-box">
            <div style="font-size: 14px; margin-bottom: 8px;">TOTAL PAYABLE AMOUNT</div>
            <h2>₹${totalPayable.toLocaleString('en-IN')}</h2>
        </div>

        <div class="footer">
            <p>This is a computer generated bill and does not require a physical signature.</p>
            <p>For support or queries, please contact AMU Electricity Department.</p>
        </div>
    </div>
</body>
</html>`;
}
