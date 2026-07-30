import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Gauge, IndianRupee, FileText, Activity, CreditCard, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDashboardStats } from "@/lib/api";
import { DashboardSkeleton } from "@/components/ui/page-skeletons";
import { useAuth } from "@/contexts/AuthContext";

const Dashboard = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats()
      .then(res => setStats(res.data))
      .catch(err => console.error("Dashboard stats failed:", err))
      .finally(() => setLoading(false));
  }, []);

  const summaryCards = [
    { 
      label: "Total Consumers", 
      value: stats?.total_consumers ?? 0, 
      icon: Users, 
      color: "text-blue-600 bg-blue-50",
      description: "Registered connections",
      path: "/consumers"
    },
    { 
      label: "Meter Readings", 
      value: stats?.total_readings ?? 0, 
      icon: Gauge, 
      color: "text-purple-600 bg-purple-50",
      description: "Total records submitted",
      path: "/readings"
    },
    { 
      label: "Revenue (Paid)", 
      value: `₹${(stats?.total_revenue ?? 0).toLocaleString()}`, 
      icon: IndianRupee, 
      color: "text-green-600 bg-green-50",
      description: "Total collections to date",
      path: "/reports"
    },
    { 
      label: "Pending Amount", 
      value: `₹${(stats?.pending_amount ?? 0).toLocaleString()}`, 
      icon: CreditCard, 
      color: "text-amber-600 bg-amber-50",
      description: "Unpaid bill total",
      path: "/reports"
    },
    { 
      label: "Current Consumption", 
      value: `${(stats?.current_month_units ?? 0).toLocaleString()} kWh`, 
      icon: Zap, 
      color: "text-orange-600 bg-orange-50",
      description: "Units billed this month",
      path: "/reports"
    },
    { 
      label: "Total Bills", 
      value: stats?.total_bills ?? 0, 
      icon: FileText, 
      color: "text-indigo-600 bg-indigo-50",
      description: "Invoices generated",
      path: "/billing"
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Quick snapshot of your utility system</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2 shadow-sm" onClick={() => navigate('/consumers')}>
            <PlusIcon className="w-4 h-4" /> Add Consumer
          </Button>
          {role !== "admin" && (
            <Button variant="outline" className="gap-2 bg-white" onClick={() => navigate('/readings')}>
              <Gauge className="w-4 h-4" /> New Reading
            </Button>
          )}
          <Button variant="outline" className="gap-2 bg-white" onClick={() => navigate('/billing')}>
            <FileText className="w-4 h-4" /> Billing
          </Button>
        </div>
      </div>

      {/* Summary Grid */}
      {loading && <DashboardSkeleton />}
      {!loading && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(
          summaryCards.map((card) => (
            <div 
              key={card.label} 
              onClick={() => navigate(card.path)}
              className="stat-card group cursor-pointer hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 p-6 flex flex-col justify-between min-h-[140px]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{card.label}</p>
                  <p className="text-2xl font-extrabold text-foreground mt-2">{card.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${card.color}`}>
                  <card.icon className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground italic flex items-center justify-between">
                  <span>{card.description}</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-primary text-[10px] font-bold uppercase tracking-wider">
                    View Details &rarr;
                  </span>
                </p>
              </div>
            </div>
          ))
        )}
      </div>}

      {/* Action Prompt */}
      {!loading && <div className="stat-card bg-secondary/5 border-dashed border-secondary/20 flex flex-col items-center justify-center py-12 text-center">
        <Activity className="w-12 h-12 text-secondary/40 mb-4" />
        <h3 className="text-lg font-semibold">Detailed Analysis Available</h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-2">
          For depth reports, growth charts, and historical trends, please visit the Reports module.
        </p>
        <Button variant="link" className="mt-4 text-secondary" onClick={() => navigate('/reports')}>
          Go to Reports &rarr;
        </Button>
      </div>}
    </div>
  );
};

const PlusIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="M12 5v14"/></svg>
);

export default Dashboard;
