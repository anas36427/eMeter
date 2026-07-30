import { useState, useEffect } from "react";
import { Search, Plus, MoreHorizontal, Edit, Trash2, Eye, Filter, KeyRound, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getConsumers, createConsumer, updateConsumer, getConsumer, deleteConsumer, resetConsumerPassword } from "@/lib/api";
import type { Consumer } from "@emeter/models";
import { TableSkeleton } from "@/components/ui/page-skeletons";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useSearch } from "@/contexts/SearchContext";

// CSRF cookie helper for portal admin API calls
const getCookie = (name: string): string => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : '';
};

interface Consumer {
  id: number;
  name: string;
  meter_number: string;
  consumer_number: string;
  address?: string;
  status?: string;
  connection_type?: string;
}

interface NewConsumerForm {
  consumer_number: string;
  name: string;
  phone: string;
  address: string;
  post: string;
  department: string;
  meter_number: string;
  initial_reading: string;
  load_kw: string;
  billing_type: string;
  connection_type: string;
  status: string;
}

const EMPTY_FORM: NewConsumerForm = {
  consumer_number: "",
  name: "",
  phone: "",
  address: "",
  post: "",
  department: "",
  meter_number: "",
  initial_reading: "",
  load_kw: "1.0",
  billing_type: "salary",
  connection_type: "single_phase",
  status: "active",
};

const Consumers = () => {
  const { searchQuery, setSearchQuery } = useSearch();
  const [statusFilter, setStatusFilter] = useState("all");
  const [accountTypeFilter, setAccountTypeFilter] = useState("all");
  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [form, setForm] = useState<NewConsumerForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingConsumer, setViewingConsumer] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchConsumers = () => {
    setLoading(true);
    getConsumers()
      .then((res) => setConsumers(res.data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchConsumers();
    // Clear search when leaving the page or on mount
    return () => setSearchQuery("");
  }, []);

  const handleFormChange = (field: keyof NewConsumerForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveConsumer = async () => {
    if (!form.name.trim() || !form.meter_number.trim()) {
      toast({ title: "Name and Meter Number are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (payload.initial_reading) {
        payload.initial_reading = parseFloat(payload.initial_reading);
      } else {
        delete payload.initial_reading;
      }
      payload.load_kw = parseFloat(payload.load_kw);

      if (editingId) {
        await updateConsumer(editingId, payload);
        toast({ title: "Consumer updated successfully" });
      } else {
        await createConsumer(payload);
        toast({ title: "Consumer added successfully" });
      }

      setForm(EMPTY_FORM);
      setEditingId(null);
      setDialogOpen(false);
      fetchConsumers(); // refresh list
    } catch (err: any) {
      toast({
        title: editingId ? "Failed to update consumer" : "Failed to add consumer",
        description: err.response?.data?.error || err.response?.data?.detail || err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (consumer: Consumer) => {
    setEditingId(consumer.id);
    // Find full consumer data from the list or fetch if needed
    // Since our list has most fields, we map what we have
    const c = consumers.find(item => item.id === consumer.id) as any;
    setForm({
      consumer_number: c.consumer_number || "",
      name: c.name || "",
      phone: c.phone || "",
      address: c.address || "",
      post: c.post || "",
      department: c.department || "",
      meter_number: c.meter_number || "",
      initial_reading: "", // Hide or disable in Edit mode
      load_kw: String(c.load_kw || "1.0"),
      billing_type: c.billing_type || "salary",
      connection_type: c.connection_type || "single_phase",
      status: c.status || "active",
    });
    setDialogOpen(true);
  };

  const handleViewClick = async (id: number) => {
    try {
      const res = await getConsumer(id);
      setViewingConsumer(res);
      setDetailsDialogOpen(true);
    } catch (err: any) {
      toast({ title: "Failed to load details", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteClick = async (id: number) => {
    if (!confirm("Are you sure you want to delete this consumer?")) return;
    try {
      await deleteConsumer(id);
      toast({ title: "Consumer deleted successfully" });
      fetchConsumers();
    } catch (err: any) {
      toast({ title: "Deletion failed", description: err.message, variant: "destructive" });
    }
  };

  const handleResetPortalPassword = async (consumer: Consumer) => {
    if (!confirm(`Reset portal password for "${consumer.name}"?\n\nNew password will be: ${consumer.consumer_number}`)) return;
    try {
      const data = await resetConsumerPassword(consumer.id);
      toast({ title: 'Password reset', description: data.message || `Password for ${consumer.name} has been reset.` });
    } catch (err: any) {
      toast({ title: 'Reset failed', description: err.message || 'An error occurred while resetting the password.', variant: 'destructive' });
    }
  };

  const filtered = consumers.filter((c) => {
    const matchesSearch =
      String(c.name || '').toLowerCase().includes(String(searchQuery || '').toLowerCase()) ||
      String(c.meter_number || '').toLowerCase().includes(String(searchQuery || '').toLowerCase());
    const matchesStatus =
      statusFilter === "all" || String(c.status || "active").toLowerCase() === statusFilter;
    const matchesAccountType =
      accountTypeFilter === "all" || 
      (accountTypeFilter === "salary" && String(c.billing_type || "").toLowerCase() === "salary") ||
      (accountTypeFilter === "non-salary" && String(c.billing_type || "").toLowerCase() !== "salary");
    return matchesSearch && matchesStatus && matchesAccountType;
  });

  if (loading) {
    return (
      <TableSkeleton
        columns={6}
        rows={8}
        showFilterBar
        pageTitle
      />
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive font-medium">Failed to load consumers</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchConsumers}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Manage all registered consumers</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { 
          setDialogOpen(open); 
          if (!open) {
            setForm(EMPTY_FORM);
            setEditingId(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Add Consumer</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Consumer" : "Add New Consumer"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {/* Consumer ID */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Consumer ID (leave blank to auto-generate)</label>
                <Input
                  placeholder="e.g. CN001234"
                  value={form.consumer_number}
                  onChange={(e) => handleFormChange("consumer_number", e.target.value)}
                />
              </div>
              {/* Name & Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name *</label>
                  <Input
                    placeholder="Enter name"
                    value={form.name}
                    onChange={(e) => handleFormChange("name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    placeholder="Enter phone"
                    value={form.phone}
                    onChange={(e) => handleFormChange("phone", e.target.value)}
                  />
                </div>
              </div>
              {/* Address */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Address</label>
                <Input
                  placeholder="Enter address"
                  value={form.address}
                  onChange={(e) => handleFormChange("address", e.target.value)}
                />
              </div>
              {/* Post & Department */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Post / Designation</label>
                  <Input
                    placeholder="e.g. Professor"
                    value={form.post}
                    onChange={(e) => handleFormChange("post", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Department</label>
                  <Input
                    placeholder="e.g. Computer Science"
                    value={form.department}
                    onChange={(e) => handleFormChange("department", e.target.value)}
                  />
                </div>
              </div>
              {/* Meter Number & Initial Reading */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Meter Number *</label>
                  <Input
                    placeholder="MTR-XXXX"
                    value={form.meter_number}
                    onChange={(e) => handleFormChange("meter_number", e.target.value)}
                  />
                </div>
                {!editingId && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Initial Reading</label>
                    <Input
                      type="number"
                      placeholder="e.g. 1250"
                      value={form.initial_reading}
                      onChange={(e) => handleFormChange("initial_reading", e.target.value)}
                    />
                  </div>
                )}
              </div>
              {/* Load KW, Meter Type, Connection Type */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Load (KW)</label>
                  <Select
                    value={form.load_kw}
                    onValueChange={(val) => handleFormChange("load_kw", val)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.0">1 KW</SelectItem>
                      <SelectItem value="2.0">2 KW</SelectItem>
                      <SelectItem value="3.0">3 KW</SelectItem>
                      <SelectItem value="4.0">4 KW</SelectItem>
                      <SelectItem value="5.0">5 KW</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Account Type</label>
                  <Select
                    value={form.billing_type}
                    onValueChange={(val) => handleFormChange("billing_type", val)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salary">Salary</SelectItem>
                      <SelectItem value="non_salary">Non-Salary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phase</label>
                  <Select
                    value={form.connection_type}
                    onValueChange={(val) => handleFormChange("connection_type", val)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_phase">Single Phase</SelectItem>
                      <SelectItem value="three_phase">Three Phase</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={form.status}
                  onValueChange={(val) => handleFormChange("status", val)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={handleSaveConsumer}
                disabled={saving}
              >
                {saving ? <><Spinner size={14} className="mr-2" />{editingId ? "Updating..." : "Saving..."}</> : editingId ? "Update Consumer" : "Save Consumer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Consumer Details</DialogTitle>
            </DialogHeader>
            {viewingConsumer && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Consumer ID</p>
                    <p className="font-medium">{viewingConsumer.consumer_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Status</p>
                    <Badge variant={viewingConsumer.status === "active" ? "default" : "secondary"}>
                      {viewingConsumer.status || "Active"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Name</p>
                  <p className="font-medium text-lg">{viewingConsumer.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Meter Number</p>
                    <p className="font-mono">{viewingConsumer.meter_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Phone</p>
                    <p>{viewingConsumer.phone || "N/A"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Address</p>
                  <p className="text-sm">{viewingConsumer.address || "No address provided"}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Load</p>
                    <p className="text-sm font-semibold">{viewingConsumer.load_kw} KW</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Phase</p>
                    <p className="text-sm font-semibold capitalize">{viewingConsumer.connection_type === "three_phase" ? "3 Phase" : "1 Phase"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Type</p>
                    <p className="text-sm font-semibold capitalize">{viewingConsumer.billing_type === "non_salary" ? "Non-Salary" : "Salary"}</p>
                  </div>
                </div>
                {viewingConsumer.post && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Department & Post</p>
                    <p className="text-sm">{viewingConsumer.post} — {viewingConsumer.department}</p>
                  </div>
                )}
              </div>
            )}
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>Close</Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {/* Local search bar removed in favor of global TopNavbar search */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 gap-2">
            <Filter className="w-4 h-4" />
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>

        <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
          <SelectTrigger className="w-40 gap-2">
            <Filter className="w-4 h-4" />
            <SelectValue placeholder="All Acc Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Acc Types</SelectItem>
            <SelectItem value="salary">Salary</SelectItem>
            <SelectItem value="non-salary">Non-Salary</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="stat-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Consumer #</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Name</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden md:table-cell">Address</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Meter No.</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 font-medium text-foreground">{c.consumer_number}</td>
                  <td className="py-3 px-4 text-foreground">
                    <div className="flex flex-col gap-1 items-start">
                      <span>{c.name}</span>
                      {c.billing_type === "salary" ? (
                        <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300 font-bold tracking-wider px-1.5 py-0">
                          SALARY
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0">
                          NON-SALARY
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{c.address || "—"}</td>
                  <td className="py-3 px-4 font-mono text-muted-foreground text-xs">{c.meter_number}</td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        (c.status || "active") === "active"
                          ? "default"
                          : (c.status || "") === "suspended"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      {c.status || "Active"}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="gap-2" onClick={() => handleViewClick(c.id)}>
                          <Eye className="w-4 h-4" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2" onClick={() => handleEditClick(c)}>
                          <Edit className="w-4 h-4" /> Edit
                        </DropdownMenuItem>

                        <DropdownMenuItem className="gap-2 text-amber-500" onClick={() => handleResetPortalPassword(c)}>
                          <KeyRound className="w-4 h-4" /> Reset Portal Password
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-destructive" onClick={() => handleDeleteClick(c.id)}>
                          <Trash2 className="w-4 h-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">No consumers found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Consumers;