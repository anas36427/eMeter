import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useConsumerAuth, consumerFetch } from '@/contexts/ConsumerAuthContext';
import { BarChart2, Receipt, KeyRound, User, MapPin, Zap, Calendar, FileText } from 'lucide-react';
import { generateBillHtml } from '@/lib/billHtml';

interface Stats {
  total_readings: number;
  total_bills: number;
  paid_bills: number;
  unpaid_bills: number;
  last_bill_amount: string | null;
  last_bill_id: number | null;
  last_reading_date: string | null;
}

export default function ConsumerDashboard() {
  const { profile, token } = useConsumerAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { navigate('/consumer/login'); return; }
    loadStats();
  }, [token]);

  const loadStats = async () => {
    try {
      const [billsData, readingsData] = await Promise.all([
        consumerFetch('/api/consumer/portal/bills/?page_size=100', token!),
        consumerFetch('/api/consumer/portal/readings/?page_size=1', token!),
      ]);
      const bills: any[] = billsData.results || [];
      const paid = bills.filter((b: any) => b.is_paid).length;
      setStats({
        total_readings: readingsData.count,
        total_bills: billsData.count,
        paid_bills: paid,
        unpaid_bills: bills.length - paid,
        last_bill_amount: bills[0]?.total_amount ?? null,
        last_bill_id: bills[0]?.id ?? null,
        last_reading_date: readingsData.results?.[0]?.reading_date || null,
      });
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (s: string) =>
    s === 'active' ? 'text-green-400 bg-green-400/10 border-green-400/20' :
    s === 'inactive' ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' :
    'text-red-400 bg-red-400/10 border-red-400/20';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome back, {profile?.name || 'Consumer'}</p>
      </div>

      {/* Profile card */}
      <div className="stat-card rounded-xl p-6 bg-gradient-to-r from-blue-600/10 to-blue-800/5 border border-blue-600/20">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-blue-400">
              {profile?.name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-foreground">{profile?.name || '—'}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              {profile?.consumer_number && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs font-semibold text-muted-foreground border border-border">
                  <User className="w-3 h-3" /> ID: {profile.consumer_number}
                </span>
              )}
              {profile?.meter_number && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs font-semibold text-muted-foreground border border-border">
                  <Zap className="w-3 h-3" /> Meter: {profile.meter_number}
                </span>
              )}
              {profile?.status && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusColor(profile.status)}`}>
                  {profile.status.toUpperCase()}
                </span>
              )}
            </div>
            {profile?.address && (
              <p className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" /> {profile.address}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Readings" value={loading ? '…' : String(stats?.total_readings ?? 0)} icon={<BarChart2 className="w-5 h-5 text-blue-400" />} accent="blue" />
        <StatCard label="Total Bills" value={loading ? '…' : String(stats?.total_bills ?? 0)} icon={<Receipt className="w-5 h-5 text-indigo-400" />} accent="indigo" />
        <StatCard label="Paid Bills" value={loading ? '…' : String(stats?.paid_bills ?? 0)} icon={<span className="text-lg">✅</span>} accent="green" />
        <StatCard label="Unpaid Bills" value={loading ? '…' : String(stats?.unpaid_bills ?? 0)} icon={<span className="text-lg">⚠️</span>} accent={stats?.unpaid_bills ? 'amber' : 'slate'} />
      </div>

      {/* Quick nav cards */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Access</h3>
        <div className="grid gap-3">
          <NavCard to="/consumer/readings" icon={<BarChart2 className="w-5 h-5 text-blue-400" />} title="My Readings" desc="View your complete meter reading history" />
          <NavCard to="/consumer/bills" icon={<Receipt className="w-5 h-5 text-indigo-400" />} title="My Bills" desc="Check paid and unpaid electricity bills" />
          <NavCard to="/consumer/change-password" icon={<KeyRound className="w-5 h-5 text-slate-400" />} title="Change Password" desc="Update your login password securely" />
        </div>
      </div>

      {/* Last activity strip */}
      {!loading && stats && (stats.last_reading_date || stats.last_bill_amount !== null) && (
        <div className="flex flex-wrap gap-6 p-4 rounded-xl bg-muted/30 border border-border text-sm text-muted-foreground items-center justify-between">
          <div className="flex flex-wrap gap-6">
            {stats.last_reading_date && (
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Last reading: <strong className="text-foreground">{stats.last_reading_date}</strong>
              </span>
            )}
            {stats.last_bill_amount !== null && (
              <span className="flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                Last bill: <strong className="text-foreground">₹{Number(stats.last_bill_amount).toFixed(2)}</strong>
              </span>
            )}
          </div>
          {stats.last_bill_id && (
            <button
              onClick={async () => {
                try {
                  const res = await consumerFetch('/api/consumer/portal/bills/?page=1&page_size=50', token);
                  const fullBill = res.results?.find((b: any) => b.id === stats.last_bill_id);
                  if (!fullBill) throw new Error("Bill not found in recent bills");

                  const html = generateBillHtml({
                    bill_number: fullBill.bill_number,
                    bill_date: fullBill.bill_date,
                    due_date: fullBill.due_date,
                    billing_period: fullBill.billing_period,
                    connection_type: fullBill.connection_type,
                    billing_type: fullBill.billing_type,
                    load_kw: fullBill.load_kw,
                    meter_type: fullBill.meter_type,
                    reading_date: fullBill.reading_date || fullBill.meter_reading_date || 'N/A',
                    payment_date: fullBill.payment_date || fullBill.paid_date || 'N/A',
                    consumer_name: fullBill.consumer_name,
                    consumer_number: fullBill.consumer_number,
                    meter_number: fullBill.meter_number,
                    address: fullBill.address,
                    department: fullBill.department || fullBill.consumer_department || 'N/A',
                    post: fullBill.post || fullBill.designation || fullBill.consumer_designation || 'N/A',
                    previous_reading: fullBill.previous_reading,
                    current_reading: fullBill.current_reading,
                    units: fullBill.units,
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

                  // Position iframe off-screen without display:none so browser layout engine retains canonical styling and print rules
                  const iframe = document.createElement('iframe');
                  iframe.style.position = 'fixed';
                  iframe.style.right = '0';
                  iframe.style.bottom = '0';
                  iframe.style.width = '800px';
                  iframe.style.height = '1000px';
                  iframe.style.border = '0';
                  iframe.style.opacity = '0';
                  iframe.style.pointerEvents = 'none';
                  document.body.appendChild(iframe);
                  iframe.contentDocument!.write(html);
                  iframe.contentDocument!.close();
                  iframe.contentWindow!.focus();
                  
                  // Wait for rendering before printing
                  setTimeout(() => {
                    iframe.contentWindow!.print();
                    setTimeout(() => document.body.removeChild(iframe), 1000);
                  }, 500);

                } catch (e) {
                  console.error(e);
                  alert('Error generating bill PDF');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors font-medium text-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              Download PDF
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent: string }) {
  const accentMap: Record<string, string> = {
    blue:   'border-t-blue-500',
    indigo: 'border-t-indigo-500',
    green:  'border-t-green-500',
    amber:  'border-t-amber-500',
    slate:  'border-t-slate-500',
  };
  return (
    <div className={`stat-card p-4 border-t-2 ${accentMap[accent] || 'border-t-blue-500'}`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground font-medium mt-0.5 uppercase tracking-wide">{label}</p>
    </div>
  );
}

function NavCard({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-blue-600/40 hover:bg-blue-600/5 transition-all duration-200 group"
    >
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600/10 transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <span className="text-muted-foreground text-lg group-hover:text-blue-400 transition-colors">›</span>
    </Link>
  );
}
