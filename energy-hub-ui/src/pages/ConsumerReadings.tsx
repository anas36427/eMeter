import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConsumerAuth, consumerFetch } from '@/contexts/ConsumerAuthContext';
import { Calendar, Zap, TrendingUp, Printer, Filter, RotateCcw } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Reading {
  id: number;
  reading_date: string;
  previous_reading: number;
  current_reading: number;
  units_consumed: number;
}

export default function ConsumerReadings() {
  const { token, profile } = useConsumerAuth();
  const navigate = useNavigate();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [filteredReadings, setFilteredReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  useEffect(() => {
    if (!token) { navigate('/consumer/login'); return; }
    // Fetch a large page_size to allow client-side filtering effectively
    consumerFetch('/api/consumer/portal/readings/?page_size=500', token)
      .then(data => {
        const sortedData = [...(data.results || [])].sort((a, b) => new Date(b.reading_date).getTime() - new Date(a.reading_date).getTime());
        setReadings(sortedData);
        setFilteredReadings(sortedData);
      })
      .catch(() => setError('Failed to load readings.'))
      .finally(() => setLoading(false));
  }, [token]);

  const applyFilter = () => {
    let filtered = [...readings];
    if (fromDate) {
      filtered = filtered.filter(r => r.reading_date >= fromDate);
    }
    if (toDate) {
      filtered = filtered.filter(r => r.reading_date <= toDate);
    }
    
    filtered.sort((a, b) => {
      if (sortOrder === "desc") {
        return new Date(b.reading_date).getTime() - new Date(a.reading_date).getTime();
      } else {
        return new Date(a.reading_date).getTime() - new Date(b.reading_date).getTime();
      }
    });

    setFilteredReadings(filtered);
  };

  useEffect(() => {
    applyFilter();
  }, [sortOrder]);

  const clearFilter = () => {
    setFromDate("");
    setToDate("");
    setSortOrder("desc");
    const sortedData = [...readings].sort((a, b) => new Date(b.reading_date).getTime() - new Date(a.reading_date).getTime());
    setFilteredReadings(sortedData);
  };

  const handlePrint = () => {
    const totalUsage = filteredReadings.reduce((sum, r) => sum + r.units_consumed, 0);

    const rows = filteredReadings.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td>${r.reading_date}</td>
        <td style="text-align:right">${r.current_reading.toLocaleString()}</td>
        <td style="text-align:right;color:#6b7280">${r.previous_reading.toLocaleString()}</td>
        <td style="text-align:right">
          <span style="
            display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:600;
            background:${r.units_consumed > 0 ? '#dcfce7' : r.units_consumed < 0 ? '#fee2e2' : '#f3f4f6'};
            color:${r.units_consumed > 0 ? '#16a34a' : r.units_consumed < 0 ? '#dc2626' : '#6b7280'}
          ">${r.units_consumed > 0 ? '+' : ''}${r.units_consumed} kWh</span>
        </td>
      </tr>
    `).join('');

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8"/>
          <title>Reading History — ${profile?.name || 'Consumer'}</title>
          <style>
            @page { margin: 20mm 16mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; font-size: 13px; position: relative; }

            /* Watermark */
            body::before {
              content: "";
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 500px;
              height: 500px;
              background-image: url('${window.location.origin}/assets/logo.png');
              background-size: contain;
              background-repeat: no-repeat;
              background-position: center;
              opacity: 0.04;
              z-index: -1;
              pointer-events: none;
            }

            /* Header */
            .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1d9e75; padding-bottom: 14px; margin-bottom: 20px; }
            .brand { display: flex; align-items: center; gap: 12px; }
            .brand-icon { width: 46px; height: 46px; background: #1d9e75; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
            .brand-icon svg { width: 26px; height: 26px; fill: white; }
            .brand-name { font-size: 20px; font-weight: 800; color: #1d9e75; letter-spacing: -0.5px; }
            .brand-sub { font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
            .print-meta { text-align: right; }
            .print-meta p { font-size: 11px; color: #6b7280; line-height: 1.8; }

            /* Consumer card */
            .consumer-card { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; display: flex; gap: 40px; }
            .consumer-card h2 { font-size: 17px; font-weight: 700; color: #111; }
            .consumer-card .label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; margin-bottom: 2px; }
            .consumer-card .value { font-size: 13px; font-weight: 600; color: #111; font-family: monospace; }

            /* Stats row */
            .stats { display: flex; gap: 16px; margin-bottom: 20px; }
            .stat-box { flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
            .stat-box .s-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; }
            .stat-box .s-value { font-size: 18px; font-weight: 800; color: #1d9e75; margin-top: 4px; }
            .stat-box .s-unit { font-size: 11px; color: #6b7280; margin-left: 2px; font-weight: 400; }

            /* Table */
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            thead tr { background: #1d9e75; color: white; }
            thead th { padding: 10px 12px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
            thead th:not(:first-child) { text-align: right; }
            tbody td { padding: 9px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
            tbody td:not(:first-child) { text-align: right; }

            /* Footer */
            .footer { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
            .total-row { margin-top: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; }
            .total-row span { font-size: 13px; font-weight: 700; color: #1d9e75; }
          </style>
        </head>
        <body>
          <!-- Header -->
          <div class="header">
            <div class="brand">
              <div class="brand-icon">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              </div>
              <div>
                <div class="brand-name">eMeter AMU</div>
                <div class="brand-sub">Electricity Management System</div>
              </div>
            </div>
            <div class="print-meta">
              <p><strong>Reading History Report</strong></p>
              <p>Printed: ${new Date().toLocaleString()}</p>
            </div>
          </div>

          <!-- Consumer Info -->
          <div class="consumer-card">
            <div>
              <h2>${profile?.name || 'Consumer'}</h2>
              <div style="margin-top:4px;font-size:12px;color:#6b7280">Electricity Consumer Account</div>
            </div>
            <div>
              <div class="label">Consumer Number</div>
              <div class="value">${profile?.consumer_number || '—'}</div>
            </div>
            <div>
              <div class="label">Meter Number</div>
              <div class="value">${profile?.meter_number || '—'}</div>
            </div>
          </div>

          <!-- Stats -->
          <div class="stats">
            <div class="stat-box">
              <div class="s-label">Total Records</div>
              <div class="s-value">${filteredReadings.length}<span class="s-unit">entries</span></div>
            </div>
            <div class="stat-box">
              <div class="s-label">Total Usage</div>
              <div class="s-value">${totalUsage.toLocaleString()}<span class="s-unit">kWh</span></div>
            </div>
            <div class="stat-box">
              <div class="s-label">Average Usage</div>
              <div class="s-value">${filteredReadings.length ? Math.round(totalUsage / filteredReadings.length).toLocaleString() : 0}<span class="s-unit">kWh/entry</span></div>
            </div>
            <div class="stat-box">
              <div class="s-label">Latest Reading</div>
              <div class="s-value">${filteredReadings[0]?.current_reading?.toLocaleString() ?? '—'}<span class="s-unit">kWh</span></div>
            </div>
          </div>

          <!-- Table -->
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reading (kWh)</th>
                <th>Previous (kWh)</th>
                <th>Usage</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <!-- Total Row -->
          <div class="total-row">
            <span>${filteredReadings.length} Records in this report</span>
            <span>Total Usage: ${totalUsage.toLocaleString()} kWh</span>
          </div>

          <!-- Footer -->
          <div class="footer">
            <span>eMeter AMU — Electricity Management System</span>
            <span>Generated: ${new Date().toLocaleString()}</span>
          </div>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Readings</h1>
        <p className="text-muted-foreground text-sm mt-1">Complete history of your meter readings</p>
      </div>

      {/* Summary banner */}
      {!loading && readings.length > 0 && (
        <div className="stat-card p-4 bg-gradient-to-r from-blue-600/10 to-blue-800/5 border-blue-600/20 flex flex-wrap gap-4 justify-between items-center">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <span className="text-sm text-muted-foreground">
              <strong className="text-foreground">{filteredReadings.length}</strong> reading records found
            </span>
          </div>
          <Button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print History
          </Button>
        </div>
      )}

      {/* Filter Bar */}
      {!loading && readings.length > 0 && (
        <div className="px-6 py-4 border rounded-xl bg-muted/20">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">From</label>
              <Input 
                type="date" 
                className="h-9 w-36" 
                value={fromDate} 
                onChange={(e) => setFromDate(e.target.value)} 
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">To</label>
              <Input 
                type="date" 
                className="h-9 w-36" 
                value={toDate} 
                onChange={(e) => setToDate(e.target.value)} 
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sort</label>
              <Select value={sortOrder} onValueChange={(val: "desc" | "asc") => setSortOrder(val)}>
                <SelectTrigger className="h-9 w-36">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Most Recent</SelectItem>
                  <SelectItem value="asc">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" size="sm" className="h-9 gap-2 bg-background" onClick={clearFilter}>
                <RotateCcw className="w-3.5 h-3.5" /> Clear
              </Button>
              <Button size="sm" className="h-9 gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={applyFilter}>
                <Filter className="w-3.5 h-3.5" /> Apply Filter
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
          Loading readings…
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      ) : filteredReadings.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
          <Zap className="w-8 h-8 opacity-30" />
          <p>No readings match your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReadings.map((r, i) => (
            <div key={r.id} className="stat-card p-4 hover:border-blue-600/30 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Date + index */}
                <div className="flex items-center gap-3 min-w-0 sm:w-40">
                  <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-600/20 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Reading #{sortOrder === 'desc' ? filteredReadings.length - i : i + 1}
                    </p>
                    <p className="text-sm font-semibold text-foreground">{r.reading_date}</p>
                  </div>
                </div>

                {/* Readings */}
                <div className="flex flex-1 gap-4 flex-wrap">
                  <ReadingPill label="Previous" value={r.previous_reading} unit="units" />
                  <ReadingPill label="Current" value={r.current_reading} unit="units" highlight />
                  <ReadingPill label="Consumed" value={r.units_consumed} unit="kWh" accent />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReadingPill({ label, value, unit, highlight, accent }: { label: string; value: number; unit: string; highlight?: boolean; accent?: boolean }) {
  return (
    <div className={`flex flex-col px-4 py-2 rounded-lg border ${
      accent   ? 'bg-blue-600/10 border-blue-600/20' :
      highlight ? 'bg-muted/50 border-border' :
                  'bg-transparent border-transparent'
    }`}>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">{label}</span>
      <span className={`text-lg font-bold ${accent ? 'text-blue-400' : 'text-foreground'}`}>
        {value} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
      </span>
    </div>
  );
}
