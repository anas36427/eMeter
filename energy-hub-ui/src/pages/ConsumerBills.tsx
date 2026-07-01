import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConsumerAuth, consumerFetch } from '@/contexts/ConsumerAuthContext';
import { Receipt, CheckCircle2, Clock, IndianRupee, FileText } from 'lucide-react';
import { generateBillHtml } from '@/lib/billHtml';

interface Bill {
  id: number;
  billing_month?: string;
  total_amount: number;
  is_paid: boolean;
  units_consumed?: number;
  units?: number;
  due_date?: string;
  [key: string]: any; // Allow full bill properties from the updated API
}

export default function ConsumerBills() {
  const { token } = useConsumerAuth();
  const navigate = useNavigate();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  useEffect(() => {
    if (!token) { navigate('/consumer/login'); return; }
    consumerFetch('/api/consumer/portal/bills/?page_size=100', token)
      .then(data => setBills(data.results || []))
      .catch(() => setError('Failed to load bills.'))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = bills.filter(b =>
    filter === 'all' ? true : filter === 'paid' ? b.is_paid : !b.is_paid
  );
  const totalDue = bills.filter(b => !b.is_paid).reduce((s, b) => s + Number(b.total_amount), 0);
  const totalPaid = bills.filter(b => b.is_paid).reduce((s, b) => s + Number(b.total_amount), 0);

  const handleDownloadPdf = (fullBill: any) => {
    try {
      const html = generateBillHtml({
        bill_number: fullBill.bill_number,
        bill_date: fullBill.bill_date,
        due_date: fullBill.due_date,
        billing_period: fullBill.billing_period || fullBill.billing_month,
        connection_type: fullBill.connection_type,
        billing_type: fullBill.billing_type,
        load_kw: fullBill.load_kw,
        meter_type: fullBill.meter_type,
        consumer_name: fullBill.consumer_name,
        consumer_number: fullBill.consumer_number,
        meter_number: fullBill.meter_number,
        address: fullBill.address,
        previous_reading: fullBill.previous_reading,
        current_reading: fullBill.current_reading,
        units: fullBill.units || fullBill.units_consumed,
        rate_per_unit: fullBill.rate_per_unit,
        energy_charges: fullBill.energy_charges,
        fixed_charges: fullBill.fixed_charges,
        duty_charge: fullBill.duty_charge,
        meter_rent: fullBill.meter_rent,
        regulatory_surcharge: fullBill.regulatory_surcharge,
        arrears: fullBill.arrears,
        late_payment_surcharge: fullBill.late_payment_surcharge,
        grand_total: fullBill.total_amount,
        status: fullBill.status,
      });

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      iframe.contentDocument!.write(html);
      iframe.contentDocument!.close();
      iframe.contentWindow!.focus();
      
      setTimeout(() => {
        iframe.contentWindow!.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 500);

    } catch (e) {
      console.error(e);
      alert('Error generating bill PDF');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Bills</h1>
        <p className="text-muted-foreground text-sm mt-1">Your complete billing history</p>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard label="Total Bills" value={String(bills.length)} icon={<Receipt className="w-5 h-5 text-blue-400" />} accent="blue" />
          <SummaryCard label="Amount Paid" value={`₹${totalPaid.toFixed(2)}`} icon={<CheckCircle2 className="w-5 h-5 text-green-400" />} accent="green" />
          <SummaryCard label="Amount Due" value={`₹${totalDue.toFixed(2)}`} icon={<Clock className="w-5 h-5 text-amber-400" />} accent="amber" />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'unpaid', 'paid'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${
              filter === f
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {f === 'all' ? 'All' : f === 'paid' ? 'Paid' : 'Unpaid'}
          </button>
        ))}
      </div>

      {/* Bills list */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading bills…</div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
          <Receipt className="w-8 h-8 opacity-30" />
          <p>No {filter !== 'all' ? filter : ''} bills found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(bill => (
            <div
              key={bill.id}
              className={`stat-card p-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors ${
                !bill.is_paid ? 'border-amber-500/20 hover:border-amber-500/40' : 'hover:border-green-500/20'
              }`}
            >
              {/* Month */}
              <div className="flex items-center gap-3 sm:w-44">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  bill.is_paid ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'
                }`}>
                  {bill.is_paid
                    ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                    : <Clock className="w-4 h-4 text-amber-400" />
                  }
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Billing Month</p>
                  <p className="text-sm font-semibold text-foreground">{bill.billing_month}</p>
                </div>
              </div>

              {/* Details */}
              <div className="flex flex-1 flex-wrap gap-4 items-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Units</p>
                  <p className="text-sm font-semibold text-foreground">{bill.units_consumed} kWh</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Amount</p>
                  <p className="text-lg font-bold text-foreground flex items-center gap-0.5">
                    <IndianRupee className="w-4 h-4" />{Number(bill.total_amount).toFixed(2)}
                  </p>
                </div>
                {bill.due_date && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Due Date</p>
                    <p className="text-sm font-semibold text-foreground">{bill.due_date}</p>
                  </div>
                )}
              </div>

              {/* Actions & Status */}
              <div className="flex flex-col sm:items-end gap-2 self-start sm:self-center">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  bill.is_paid
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {bill.is_paid ? 'PAID' : 'UNPAID'}
                </span>
                <button
                  onClick={() => handleDownloadPdf(bill)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors font-medium text-[10px] uppercase tracking-wide"
                >
                  <FileText className="w-3.5 h-3.5" />
                  PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent: string }) {
  const borderMap: Record<string, string> = { blue: 'border-t-blue-500', green: 'border-t-green-500', amber: 'border-t-amber-500' };
  return (
    <div className={`stat-card p-4 border-t-2 ${borderMap[accent]}`}>
      <div className="flex items-center justify-between mb-2">{icon}</div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground font-medium mt-0.5 uppercase tracking-wide">{label}</p>
    </div>
  );
}
