import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Settings as SettingsIcon } from "lucide-react";
import { FormSkeleton } from "@/components/ui/page-skeletons";
import { api, getBillingSettings, updateBillingSettings } from "@/lib/api";

const Settings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);


  // Notifications State (persisted via localStorage)
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem("notifications_enabled") !== "false";
  });

  // Billing Config State
  const [ratePerUnit, setRatePerUnit] = useState("8.56");
  const [dutyPercentage, setDutyPercentage] = useState("7.5");
  const [fixedCharge, setFixedCharge] = useState("400");
  const [phase1Rent, setPhase1Rent] = useState("10");
  const [phase3Rent, setPhase3Rent] = useState("25");
  const [updatingBilling, setUpdatingBilling] = useState(false);

  useEffect(() => {
    const loadSettingsData = async () => {
      try {
        setLoading(true);


        // Load billing configurations
        const billingRes = await getBillingSettings();
        const billingData = billingRes.data || billingRes;
        if (billingData) {
          setRatePerUnit(String(billingData.rate_per_unit ?? "8.56"));
          setDutyPercentage(String(billingData.duty_percentage ?? "7.5"));
          setFixedCharge(String(billingData.fixed_charge_per_kw ?? "400"));
          setPhase1Rent(String(billingData.phase_1_rent ?? "10"));
          setPhase3Rent(String(billingData.phase_3_rent ?? "25"));
        }
      } catch (err: any) {
        console.error("Failed to load settings data:", err);
        toast({
          title: "Failed to load settings",
          description: err.message || "An error occurred while loading settings data.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadSettingsData();
  }, [toast]);


  const handleNotificationChange = (key: string, value: boolean) => {
    localStorage.setItem(key, String(value));
    toast({
      title: "Notification preferences updated",
      description: "Changes will be applied to future notifications.",
    });
  };

  const handleUpdateBilling = async () => {
    try {
      setUpdatingBilling(true);
      const payload = {
        rate_per_unit: parseFloat(ratePerUnit),
        duty_percentage: parseFloat(dutyPercentage),
        fixed_charge_per_kw: parseFloat(fixedCharge),
        phase_1_rent: parseFloat(phase1Rent),
        phase_3_rent: parseFloat(phase3Rent),
      };

      await updateBillingSettings(payload);
      toast({
        title: "Configuration updated",
        description: "Tariff rates and global charges updated successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Failed to update configuration",
        description: err.message || "An error occurred while updating the configuration.",
        variant: "destructive",
      });
    } finally {
      setUpdatingBilling(false);
    }
  };

  if (loading) {
    return <FormSkeleton />;
  }

  return (
    <div className="max-w-2xl space-y-8 animate-fade-in pb-12">
      {/* Notifications */}
      <div className="stat-card space-y-4">
        <h3 className="text-base font-semibold">Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Enable system notifications</span>
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={(checked) => {
                setNotificationsEnabled(checked);
                handleNotificationChange("notifications_enabled", checked);
              }}
            />
          </div>
        </div>
      </div>

      {/* Billing Config */}
      <div className="stat-card space-y-4">
        <h3 className="text-base font-semibold">Billing Configuration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Default Unit Rate (₹)</label>
            <Input type="number" step="0.01" value={ratePerUnit} onChange={(e) => setRatePerUnit(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Default Tax / Duty (%)</label>
            <Input type="number" step="0.1" value={dutyPercentage} onChange={(e) => setDutyPercentage(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Fixed Charge per kW (₹)</label>
            <Input type="number" step="1" value={fixedCharge} onChange={(e) => setFixedCharge(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">1-Phase Meter Rent (₹)</label>
            <Input type="number" step="1" value={phase1Rent} onChange={(e) => setPhase1Rent(e.target.value)} />
          </div>
          <div className="space-y-2 text-sm">
            <label className="text-sm font-medium">3-Phase Meter Rent (₹)</label>
            <Input type="number" step="1" value={phase3Rent} onChange={(e) => setPhase3Rent(e.target.value)} />
          </div>
        </div>
        <Button onClick={handleUpdateBilling} disabled={updatingBilling} className="gap-2 bg-secondary hover:bg-secondary/90 text-white">
          {updatingBilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Update Configuration
        </Button>
      </div>

      {/* Mobile App Sync */}
      <div className="stat-card space-y-4">
        <h3 className="text-base font-semibold text-blue-400">Mobile App Sync</h3>
        <p className="text-sm text-muted-foreground">
          Generate an offline setup file for the mobile app. This file contains the complete consumer registry and billing settings.
          Send this file to your meter readers so they can import their consumer data offline.
        </p>
        <Button 
          onClick={async () => {
            try {
              const res = await api.get('/api/admin/export-mobile-sync/', { responseType: 'blob' });
              const url = window.URL.createObjectURL(new Blob([res.data]));
              const link = document.createElement('a');
              link.href = url;
              link.setAttribute('download', 'eMeter_Offline_Sync.json');
              document.body.appendChild(link);
              link.click();
              link.parentNode?.removeChild(link);
            } catch (err: any) {
              toast({ title: 'Export Failed', description: err.message, variant: 'destructive' });
            }
          }} 
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Save className="w-4 h-4" />
          Export Sync File
        </Button>
      </div>
    </div>
  );
};

export default Settings;
