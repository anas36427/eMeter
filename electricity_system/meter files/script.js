// =============================================
//  AMU eMeter Admin Dashboard - script.js
// =============================================


// ── Sidebar Toggle ─────────────────────────
document.getElementById('sidebarToggle')?.addEventListener('click', function () {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
});


// ── Smooth Scroll ──────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});


// ── Table Row Click ────────────────────────
document.querySelectorAll('.custom-table tbody tr').forEach(row => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', function (e) {
        if (!e.target.closest('.btn-action')) {
            console.log('Row clicked');
        }
    });
});


// =============================================
//  REAL-TIME BILL CALCULATOR
// =============================================

const currentReadingInput  = document.querySelector('input[type="number"][value="1700"]');
const previousReadingInput = document.querySelector('input[type="number"][value="1250"]');
const rateInput            = document.querySelector('input[type="number"][step="0.01"]');

function calculateBill() {
    if (!currentReadingInput || !previousReadingInput || !rateInput) return;

    const current  = parseFloat(currentReadingInput.value)  || 0;
    const previous = parseFloat(previousReadingInput.value) || 0;
    const rate     = parseFloat(rateInput.value)            || 0;

    const unitsConsumed = Math.max(0, current - previous);
    const energyCharges = unitsConsumed * rate;
    const fixedCharges  = 8.00;
    const totalAmount   = energyCharges + fixedCharges;

    const calcSummary = document.querySelector('.calculation-summary');
    if (calcSummary) {
        calcSummary.innerHTML = `
            <div class="calc-row">
                <span>Units Consumed:</span>
                <strong>${unitsConsumed} kWh</strong>
            </div>
            <div class="calc-row">
                <span>Energy Charges:</span>
                <strong>$${energyCharges.toFixed(2)}</strong>
            </div>
            <div class="calc-row">
                <span>Fixed Charges:</span>
                <strong>$${fixedCharges.toFixed(2)}</strong>
            </div>
            <div class="calc-row total">
                <span>Total Amount:</span>
                <strong>$${totalAmount.toFixed(2)}</strong>
            </div>
        `;
    }
}

if (currentReadingInput) currentReadingInput.addEventListener('input', calculateBill);
if (rateInput)           rateInput.addEventListener('input', calculateBill);


// =============================================
//  GENERATE BILL — Validate + Print-Ready Bill
// =============================================

function generateBill() {
    const form = document.getElementById('generateBillForm');

    const consumer = form.querySelector('select').value;
    const period   = form.querySelector('input[type="month"]').value;
    const curr     = parseFloat(form.querySelectorAll('input[type="number"]')[1]?.value) || 0;
    const prev     = parseFloat(form.querySelectorAll('input[type="number"]')[0]?.value) || 0;
    const rate     = parseFloat(form.querySelector('input[step="0.01"]')?.value)         || 0;

    // Validation
    if (!consumer)    { showToast('Please select a consumer.', 'warning'); return; }
    if (!period)      { showToast('Please select a billing period.', 'warning'); return; }
    if (curr <= prev) { showToast('Current reading must be greater than previous reading.', 'warning'); return; }

    const FIXED   = 8.00;
    const units   = curr - prev;
    const energy  = units * rate;
    const total   = energy + FIXED;
    const billNo  = 'BILL-' + Date.now().toString().slice(-6);
    const dueDate = getDueDate(period);

    const billHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Bill ${billNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #f4f6fb; padding: 40px; color: #1a1a2e; }
    .bill-wrapper { max-width: 680px; margin: auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.12); }
    .bill-header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%); color: #fff; padding: 36px 40px; display: flex; justify-content: space-between; align-items: center; }
    .bill-header h1 { font-size: 26px; letter-spacing: -0.5px; }
    .bill-header h1 span { color: #e94560; }
    .bill-header .bill-no { text-align: right; opacity: .8; font-size: 13px; }
    .bill-header .bill-no strong { display: block; font-size: 16px; color: #fff; opacity: 1; }
    .bill-body { padding: 36px 40px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; margin-bottom: 14px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .info-item label { display: block; font-size: 11px; color: #9ca3af; margin-bottom: 4px; }
    .info-item span { font-size: 15px; font-weight: 600; }
    .reading-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; text-align: center; }
    .reading-box { background: #f8fafc; border-radius: 10px; padding: 16px; }
    .reading-box .label { font-size: 11px; color: #9ca3af; margin-bottom: 6px; }
    .reading-box .value { font-size: 22px; font-weight: 700; color: #1a1a2e; }
    .reading-box .unit  { font-size: 12px; color: #6b7280; }
    .reading-box.highlight { background: #e94560; }
    .reading-box.highlight .label,
    .reading-box.highlight .value,
    .reading-box.highlight .unit { color: #fff; }
    .charges-table { width: 100%; border-collapse: collapse; }
    .charges-table td { padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .charges-table td:last-child { text-align: right; font-weight: 600; }
    .charges-table tr.total td { border-bottom: none; border-top: 2px solid #1a1a2e; font-size: 16px; font-weight: 700; padding-top: 14px; }
    .due-banner { background: #fff7ed; border: 1.5px solid #fed7aa; border-radius: 10px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; }
    .due-banner .due-label { font-size: 13px; color: #92400e; }
    .due-banner .due-amount { font-size: 24px; font-weight: 800; color: #ea580c; }
    .due-banner .due-date { font-size: 12px; color: #b45309; text-align: right; }
    .bill-footer { background: #f8fafc; border-top: 1px solid #e5e7eb; padding: 20px 40px; text-align: center; font-size: 12px; color: #9ca3af; }
    @media print { body { padding: 0; background: #fff; } .bill-wrapper { box-shadow: none; border-radius: 0; } }
  </style>
</head>
<body>
  <div class="bill-wrapper">
    <div class="bill-header">
      <div>
        <h1>Power<span>Grid</span></h1>
        <div style="opacity:.7;font-size:13px;margin-top:4px;">Electricity Billing Statement</div>
      </div>
      <div class="bill-no">
        Bill Number
        <strong>${billNo}</strong>
        ${formatPeriod(period)}
      </div>
    </div>
    <div class="bill-body">
      <div class="section">
        <div class="section-title">Consumer Information</div>
        <div class="info-grid">
          <div class="info-item"><label>Consumer Name</label><span>${consumer.split(' (')[0]}</span></div>
          <div class="info-item"><label>Meter Number</label><span>${consumer.match(/\(([^)]+)\)/)?.[1] || 'N/A'}</span></div>
          <div class="info-item"><label>Billing Period</label><span>${formatPeriod(period)}</span></div>
          <div class="info-item"><label>Issue Date</label><span>${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span></div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Meter Readings</div>
        <div class="reading-grid">
          <div class="reading-box">
            <div class="label">Previous Reading</div>
            <div class="value">${prev.toLocaleString()}</div>
            <div class="unit">kWh</div>
          </div>
          <div class="reading-box">
            <div class="label">Current Reading</div>
            <div class="value">${curr.toLocaleString()}</div>
            <div class="unit">kWh</div>
          </div>
          <div class="reading-box highlight">
            <div class="label">Units Consumed</div>
            <div class="value">${units.toLocaleString()}</div>
            <div class="unit">kWh</div>
          </div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Charge Breakdown</div>
        <table class="charges-table">
          <tr><td>Energy Charges (${units} kWh × $${rate.toFixed(3)})</td><td>$${energy.toFixed(2)}</td></tr>
          <tr><td>Fixed / Service Charge</td><td>$${FIXED.toFixed(2)}</td></tr>
          <tr class="total"><td>Total Amount Due</td><td>$${total.toFixed(2)}</td></tr>
        </table>
      </div>
      <div class="due-banner">
        <div>
          <div class="due-label">Amount Due</div>
          <div class="due-amount">$${total.toFixed(2)}</div>
        </div>
        <div class="due-date">
          Due Date<br>
          <strong style="font-size:14px;">${dueDate}</strong>
        </div>
      </div>
    </div>
    <div class="bill-footer">
      AMU eMeter Utility Services &nbsp;|&nbsp; support@AMU eMeter.com &nbsp;|&nbsp; 1-800-PWR-GRID<br>
      Please pay before the due date to avoid late payment charges.
    </div>
  </div>
  <script>window.onload = () => window.print();<\/script>
</body>
</html>`;

    const billWindow = window.open('', '_blank');
    if (billWindow) {
        billWindow.document.write(billHTML);
        billWindow.document.close();
    }

    const modal = bootstrap.Modal.getInstance(document.getElementById('generateBillModal'));
    if (modal) modal.hide();

    showToast(`Bill ${billNo} generated for ${consumer.split(' (')[0]}!`, 'success');
}


// =============================================
//  EXPORT REPORT — Download as CSV
// =============================================

document.addEventListener('DOMContentLoaded', function () {

    // Attach Export Report button
    const exportBtn = document.querySelector('.btn-outline-primary');
    if (exportBtn && exportBtn.textContent.trim().includes('Export')) {
        exportBtn.addEventListener('click', exportReport);
    }

    // Form submit validation (kept from original)
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (form.checkValidity()) {
                if (form.id === 'generateBillForm') generateBill();
            } else {
                form.classList.add('was-validated');
            }
        });
    });
});

function exportReport() {
    const btn = document.querySelector('.btn-outline-primary');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Generating...';
    btn.disabled = true;

    setTimeout(() => {
        const rows = [
            ['Report: AMU eMeter Admin Dashboard', '', '', '', ''],
            [`Generated: ${new Date().toLocaleString()}`, '', '', '', ''],
            ['', '', '', '', ''],
            ['--- SUMMARY ---', '', '', '', ''],
            ['Metric', 'Value', 'Change vs Last Month', '', ''],
            ['Total Consumers', '1247', '+12%', '', ''],
            ['Bills Generated', '856', '+8%', '', ''],
            ['Total Revenue', '$124,890', '+15%', '', ''],
            ['Pending Payments', '143', '-5%', '', ''],
            ['', '', '', '', ''],
            ['--- BILL STATUS ---', '', '', '', ''],
            ['Status', 'Count', 'Percentage', '', ''],
            ['Paid', '713', '83%', '', ''],
            ['Pending', '143', '17%', '', ''],
            ['Overdue', '28', '8%', '', ''],
            ['', '', '', '', ''],
            ['--- CONSUMER LIST ---', '', '', '', ''],
            ['Name', 'Meter No', 'Address', 'Status', ''],
            ['John Martinez', 'MTR-2024-001', '123 Oak Street, Downtown', 'Active', ''],
            ['Sarah Johnson', 'MTR-2024-002', '456 Maple Avenue, Westside', 'Active', ''],
            ['Mike Chen', 'MTR-2024-003', '789 Pine Road, Eastgate', 'Inactive', ''],
            ['Emma Williams', 'MTR-2024-004', '321 Elm Street, Northpark', 'Active', ''],
            ['David Brown', 'MTR-2024-005', '654 Cedar Lane, Southview', 'Active', ''],
            ['', '', '', '', ''],
            ['--- RECENT METER READINGS ---', '', '', '', ''],
            ['Meter No', 'Reading (kWh)', 'Time', '', ''],
            ['MTR-2024-001', '450', '2 hours ago', '', ''],
            ['MTR-2024-007', '320', '5 hours ago', '', ''],
            ['MTR-2024-015', '580', '1 day ago', '', ''],
        ];

        const csv = rows.map(row =>
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\r\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href     = url;
        link.download = `AMU eMeter-report-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        btn.innerHTML = originalHTML;
        btn.disabled  = false;

        showToast('Report exported successfully!', 'success');
    }, 800);
}


// =============================================
//  TOAST NOTIFICATION
// =============================================

function showToast(message, type = 'success') {
    const existing = document.getElementById('pg-toast');
    if (existing) existing.remove();

    const colors = { success: '#10b981', warning: '#f59e0b', error: '#ef4444' };

    const toast = document.createElement('div');
    toast.id = 'pg-toast';
    toast.style.cssText = `
        position: fixed; bottom: 28px; right: 28px; z-index: 9999;
        background: ${colors[type] || colors.success}; color: #fff;
        padding: 14px 22px; border-radius: 12px;
        font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
        box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        opacity: 0; transform: translateY(16px);
        transition: opacity .3s ease, transform .3s ease;
        max-width: 360px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(16px)';
        setTimeout(() => toast.remove(), 350);
    }, 3500);
}


// =============================================
//  HELPERS
// =============================================

function formatPeriod(yearMonth) {
    if (!yearMonth) return '';
    const [y, m] = yearMonth.split('-');
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    return `${months[parseInt(m, 10) - 1]} ${y}`;
}

function getDueDate(period) {
    const [y, m] = period.split('-').map(Number);
    const due = new Date(y, m, 15); // 15th of the following month
    return due.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
