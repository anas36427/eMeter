import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { useState, useEffect } from "react";
import { getReportsData } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ["hsl(217, 91%, 60%)", "hsl(160, 84%, 39%)"];

const Reports = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReportsData()
      .then(res => setData(res.data))
      .catch(err => console.error("Failed to fetch reports:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in p-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  const { monthly_usage = [], revenue_breakdown = [], top_consumers = [] } = data || {};

  const handleExportCSV = () => {
    // Basic CSV export logic
    const headers = ["Name", "Units (kWh)"];
    const rows = top_consumers.map((c: any) => [c.name, c.units]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "top_consumers_report.csv");
    link.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Live insights from PostgreSQL database</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Usage */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Monthly Usage Trends</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly_usage}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214, 32%, 91%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
              <Bar dataKey="units" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Breakdown */}
        <div className="stat-card">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Revenue Breakdown</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie 
                data={revenue_breakdown} 
                cx="50%" 
                cy="50%" 
                innerRadius={60} 
                outerRadius={100} 
                dataKey="value" 
                paddingAngle={5}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {revenue_breakdown.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Consumers */}
        <div className="stat-card lg:col-span-2">
          <h3 className="text-sm font-semibold mb-6 text-muted-foreground uppercase tracking-wider">Top 10 Consumers by Total Usage</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            {top_consumers.map((c: any, i: number) => {
              const maxUnits = top_consumers[0]?.units || 1;
              return (
                <div key={c.name + i} className="flex items-center gap-4 group">
                  <span className="text-lg font-bold text-muted-foreground/30 w-8">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-semibold group-hover:text-primary transition-colors">{c.name}</span>
                      <span className="text-sm font-medium">₹{c.units.toLocaleString()} <span className="text-[10px] text-muted-foreground">kWh</span></span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-1000"
                        style={{ width: `${(c.units / maxUnits) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {top_consumers.length === 0 && (
            <div className="py-12 text-center text-muted-foreground italic">No consumption data recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
