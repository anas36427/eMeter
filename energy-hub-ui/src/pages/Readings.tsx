import { useState, useEffect, useRef } from "react";
import { Search, Plus, Upload, Clock, X, Calendar, Filter, RotateCcw, FileSpreadsheet, CheckCircle2, AlertCircle, Printer, Download } from "lucide-react";
import * as XLSX from 'xlsx';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getConsumers, submitReading, getConsumerReadings, bulkGenerateBills, manualGenerateBill, importReadingsExcel } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSearch } from "@/contexts/SearchContext";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Zap, Users, Calculator, Send, Loader2 } from "lucide-react";

interface Consumer {
  id: number;
  name: string;
  meter_number: string;
  consumer_number: string;
  previous_reading?: number;
}

interface ReadingHistory {
  id: number;
  date: string;
  reading: number;
  prev: number;
  usage: number;
  recorded_by: string;
  remarks: string;
}

const HistoryModal = ({ consumer, onClose }: { consumer: Consumer; onClose: () => void }) => {
  const [history, setHistory] = useState<ReadingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filteredHistory, setFilteredHistory] = useState<ReadingHistory[]>([]);

  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  useEffect(() => {
    getConsumerReadings(consumer.id)
      .then((data) => {
        // Sort from most recent to oldest initially
        const sortedData = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setHistory(sortedData);
        setFilteredHistory(sortedData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [consumer.id]);

  const applyFilter = () => {
    let filtered = [...history];
    if (fromDate) {
      filtered = filtered.filter(r => r.date >= fromDate);
    }
    if (toDate) {
      filtered = filtered.filter(r => r.date <= toDate);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      if (sortOrder === "desc") {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
    });

    setFilteredHistory(filtered);
  };

  useEffect(() => {
    // Re-apply filter when sort order changes
    applyFilter();
  }, [sortOrder]);

  const clearFilter = () => {
    setFromDate("");
    setToDate("");
    setSortOrder("desc");
    
    // Sort default history descending
    const sortedData = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setFilteredHistory(sortedData);
  };

  const totalUsage = filteredHistory.reduce((sum, r) => sum + (r.usage || 0), 0);

  const handleExportExcel = () => {
    const ws_data = [
      ["Date", "Reading (kWh)", "Previous (kWh)", "Usage (kWh)", "Recorded By", "Remarks"],
      ...filteredHistory.map(r => [
        r.date, r.reading, r.prev, r.usage, r.recorded_by, r.remarks || ""
      ])
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, "History");
    XLSX.writeFile(wb, `${consumer.consumer_number}_history.xlsx`);
  };

  const handlePrint = () => {
    const printContent = `
      <html>
        <head>
          <title>Reading History - ${consumer.name}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; }
          </style>
        </head>
        <body>
          <h2>Reading History — ${consumer.name}</h2>
          <p><strong>Consumer Number:</strong> ${consumer.consumer_number}</p>
          <p><strong>Meter Number:</strong> ${consumer.meter_number}</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reading (kWh)</th>
                <th>Previous (kWh)</th>
                <th>Usage (kWh)</th>
                <th>Recorded by</th>
              </tr>
            </thead>
            <tbody>
              ${filteredHistory.map(r => `
                <tr>
                  <td>${r.date}</td>
                  <td>${r.reading}</td>
                  <td>${r.prev}</td>
                  <td>${r.usage}</td>
                  <td>${r.recorded_by}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  return (
    <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
      <DialogHeader className="p-6 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <DialogTitle className="text-xl">Reading history — {consumer.name}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {consumer.consumer_number} · {consumer.meter_number}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 text-muted-foreground" onClick={handlePrint} disabled={filteredHistory.length === 0}>
              <Printer className="w-4 h-4" /> Print
            </Button>
            <Button size="sm" className="gap-2 bg-secondary hover:bg-secondary/90 text-white" onClick={handleExportExcel} disabled={filteredHistory.length === 0}>
              <Download className="w-4 h-4" /> Excel
            </Button>
          </div>
        </div>
      </DialogHeader>


      <div className="px-6 py-4 border-y bg-muted/20">
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
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={clearFilter}>
              <RotateCcw className="w-3.5 h-3.5" /> Clear
            </Button>
            <Button size="sm" className="h-9 gap-2" onClick={applyFilter}>
              <Filter className="w-3.5 h-3.5" /> Apply Filter
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No readings found for selected date range.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b border-border/50">
                <th className="text-left font-medium py-2 px-1">Date</th>
                <th className="text-left font-medium py-2 px-1">Reading (kWh)</th>
                <th className="text-left font-medium py-2 px-1">Previous (kWh)</th>
                <th className="text-left font-medium py-2 px-1">Usage</th>
                <th className="text-left font-medium py-2 px-1">Recorded by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredHistory.map((r) => (
                <tr key={r.id} className="hover:bg-muted/10">
                  <td className="py-3 px-1 font-medium">{r.date}</td>
                  <td className="py-3 px-1">{r.reading}</td>
                  <td className="py-3 px-1 text-muted-foreground">{r.prev}</td>
                  <td className="py-3 px-1">
                    <Badge 
                      variant="secondary" 
                      className={`font-mono text-[10px] uppercase ${
                        r.usage > 0 ? 'bg-green-500/10 text-green-600 border-green-500/20' : 
                        r.usage < 0 ? 'bg-red-500/10 text-red-600 border-red-500/20' : 
                        'bg-gray-500/10 text-gray-600 border-gray-500/20'
                      }`}
                    >
                      {r.usage > 0 ? `+${r.usage}` : r.usage} kWh
                    </Badge>
                  </td>
                  <td className="py-3 px-1 text-muted-foreground text-xs">{r.recorded_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ScrollArea>

      <div className="p-4 px-6 border-t bg-muted/10 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{filteredHistory.length} records</span>
        <Badge className="bg-[#1d9e75] hover:bg-[#1d9e75]/90 text-white rounded-full px-4 py-1">
          Total usage: {totalUsage} kWh
        </Badge>
      </div>
    </DialogContent>
  );
};

const Readings = () => {
  const { searchQuery, setSearchQuery } = useSearch();
  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConsumer, setSelectedConsumer] = useState<string>("");
  const [currReading, setCurrReading] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Generation States
  const [manualOpen, setManualOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Import Excel State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Form State
  const [manualData, setManualData] = useState({
    consumer_id: "",
    current_reading: "",
    billing_period: new Date().toISOString().substring(0, 7),
    due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
    created_source: "admin_manual",
    manual_override_reason: ""
  });

  // Bulk Form State
  const [bulkData, setBulkData] = useState({
    billing_period: new Date().toISOString().substring(0, 7),
    due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
  });

  const { role } = useAuth();

  useEffect(() => {
    getConsumers()
      .then((res) => setConsumers(res.data || []))
      .catch(() => { })
      .finally(() => setLoading(false));
    
    return () => setSearchQuery("");
  }, []);

  const selected = consumers.find(c => String(c.id) === selectedConsumer);
  const prevReading = selected?.previous_reading || 0;
  const unitsConsumed = currReading ? Math.max(0, Number(currReading) - prevReading) : 0;

  const selectedManualConsumer = consumers.find(c => String(c.id) === manualData.consumer_id);
  const manualPrevReading = selectedManualConsumer?.previous_reading || 0;

  const handleSubmitReading = async () => {
    if (!selectedConsumer || !currReading) return;
    setSubmitting(true);
    try {
      await submitReading({
        consumer_id: Number(selectedConsumer),
        current_reading: Number(currReading),
        reading_date: new Date().toISOString().split('T')[0],
      });
      toast({ title: "Reading submitted successfully" });
      setCurrReading("");
      setSelectedConsumer("");
    } catch (err: any) {
      toast({ title: "Failed to submit reading", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualGenerate = async () => {
    if (!manualData.consumer_id || !manualData.current_reading) {
      toast({ title: "Error", description: "Please select consumer and enter current reading", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      await manualGenerateBill(manualData);
      toast({ title: "Success", description: "Administrative entry submitted successfully" });
      setManualOpen(false);
      // Optional: Refresh list or redirect
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkGenerate = async () => {
    setGenerating(true);
    try {
      const res = await bulkGenerateBills(bulkData);
      toast({ title: "Bulk generation complete", description: `Generated ${res.data.count} bills.` });
      setBulkOpen(false);
    } catch (err: any) {
      toast({ title: "Bulk generation failed", description: err.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleImportExcel = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await importReadingsExcel(importFile);
      const data = res.data ?? res;            // handle both axios and raw responses
      setImportResult(data);
      if (data.success_count > 0) {
        toast({ title: `✅ ${data.success_count} bill(s) generated`, description: data.message });
      }
      if (data.error_count > 0) {
        toast({ title: `⚠️ ${data.error_count} row(s) failed`, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Import failed", description: err.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meter Readings</h1>
          <p className="text-sm text-muted-foreground">Record and track meter readings</p>
        </div>
        
        <div className="flex items-center gap-2">
          {role === "admin" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-white">
                  <Zap className="w-4 h-4" /> Generate Bills
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="gap-2" onClick={() => setManualOpen(true)}>
                  <Calculator className="w-4 h-4" /> Administrative Bill Entry
                </DropdownMenuItem>

                <DropdownMenuItem className="gap-2" onClick={() => { setImportOpen(true); setImportResult(null); setImportFile(null); }}>
                  <FileSpreadsheet className="w-4 h-4" /> Import Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {role !== "admin" && (
            <Dialog>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" /> New Reading</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Record Meter Reading</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Consumer</label>
                    <Select value={selectedConsumer} onValueChange={setSelectedConsumer}>
                      <SelectTrigger><SelectValue placeholder="Search consumer..." /></SelectTrigger>
                      <SelectContent>
                        {consumers.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name} ({c.meter_number})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Previous Reading</label>
                      <Input value={prevReading} readOnly className="bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Current Reading</label>
                      <Input type="number" placeholder="Enter current" value={currReading} onChange={(e) => setCurrReading(e.target.value)} />
                    </div>
                  </div>
                  {currReading && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-sm text-muted-foreground">Units Consumed</p>
                      <p className="text-2xl font-bold text-primary">{unitsConsumed} kWh</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Remarks</label>
                    <Textarea placeholder="Any observations..." rows={2} />
                  </div>
                  <Button className="w-full" onClick={handleSubmitReading} disabled={submitting || !selectedConsumer || !currReading}>
                    {submitting ? "Submitting..." : "Save Reading"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="stat-card">
        <h3 className="text-sm font-semibold text-foreground mb-4">Consumers</h3>
        {/* Local search bar removed in favor of global TopNavbar search */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Consumer #</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Name</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Meter</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Previous Reading</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {consumers
                .filter(c => String(c.name || '').toLowerCase().includes(String(searchQuery || '').toLowerCase()) || String(c.meter_number || '').toLowerCase().includes(String(searchQuery || '').toLowerCase()))
                .map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-medium">{c.consumer_number}</td>
                    <td className="py-3 px-4">{c.name}</td>
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{c.meter_number}</td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary" className="font-mono bg-[#1d9e75]/10 text-[#1d9e75] border-[#1d9e75]/20">{c.previous_reading || 0} kWh</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 gap-2 rounded-full border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700">
                            <Clock className="w-3.5 h-3.5" /> History
                          </Button>
                        </DialogTrigger>
                        <HistoryModal consumer={c} onClose={() => {}} />
                      </Dialog>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Manual Generation Dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Administrative Bill Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="consumer">Select Consumer</Label>
              <Select value={manualData.consumer_id} onValueChange={(v) => setManualData({...manualData, consumer_id: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose consumer..." />
                </SelectTrigger>
                <SelectContent>
                  {consumers.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.consumer_number})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Previous Reading</Label>
                <Input value={manualPrevReading} readOnly className="bg-muted/50 font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reading">Current Reading (kWh)</Label>
                <Input 
                  id="reading" 
                  type="number" 
                  placeholder="Enter current..." 
                  value={manualData.current_reading}
                  onChange={(e) => setManualData({...manualData, current_reading: e.target.value})}
                />
              </div>
            </div>

            {manualData.current_reading && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground">Units Consumed</p>
                <p className="text-2xl font-bold text-primary">
                  {Math.max(0, Number(manualData.current_reading) - manualPrevReading)} kWh
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="period">Billing Month</Label>
                <Input 
                  id="period" 
                  type="month" 
                  value={manualData.billing_period}
                  onChange={(e) => setManualData({...manualData, billing_period: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due">Due Date</Label>
                <Input 
                  id="due" 
                  type="date" 
                  value={manualData.due_date}
                  onChange={(e) => setManualData({...manualData, due_date: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="override_reason">Manual Override Reason (Optional)</Label>
              <Textarea 
                id="override_reason" 
                placeholder="Specify reason (e.g. Reader device failure, extension shifted residency...)" 
                value={manualData.manual_override_reason}
                onChange={(e) => setManualData({...manualData, manual_override_reason: e.target.value})}
                rows={3}
              />
            </div>

            <Button className="w-full gap-2" onClick={handleManualGenerate} disabled={generating}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
              Submit Administrative Entry
            </Button>
          </div>
        </DialogContent>
      </Dialog>



      {/* ───────────── Import Excel Dialog ───────────── */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) { setImportResult(null); setImportFile(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Import Readings &amp; Generate Bills
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {/* Instructions */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-300 space-y-2">
              <p className="font-semibold">Accepted Excel formats (auto-detected):</p>
              <div className="text-xs space-y-1">
                <p className="font-medium">✅ 4-Column (recommended):</p>
                <p className="font-mono bg-blue-100 dark:bg-blue-900/40 rounded px-2 py-1">A: Consumer# &nbsp;| B: Meter# &nbsp;| C: Reading (kWh) &nbsp;| D: Date (optional)</p>
                <p className="font-medium mt-1">✅ 3-Column (no meter number):</p>
                <p className="font-mono bg-blue-100 dark:bg-blue-900/40 rounded px-2 py-1">A: Consumer# &nbsp;| B: Reading (kWh) &nbsp;| C: Date (optional)</p>
                <p className="mt-1 text-blue-700 dark:text-blue-400">Row 1 = headers (skipped). Date format: YYYY-MM-DD or DD-MM-YYYY.</p>
              </div>
            </div>

            {/* File Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                importFile
                  ? 'border-green-400 bg-green-50 dark:bg-green-950/20'
                  : 'border-border hover:border-primary/60 hover:bg-muted/30'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }}
              />
              {importFile ? (
                <>
                  <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <p className="font-semibold text-green-700 dark:text-green-400">{importFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(importFile.size / 1024).toFixed(1)} KB — click to change</p>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium">Click to select an Excel file</p>
                  <p className="text-xs text-muted-foreground mt-1">.xlsx or .xls</p>
                </>
              )}
            </div>

            {/* Import Button */}
            <Button
              className="w-full gap-2"
              onClick={handleImportExcel}
              disabled={!importFile || importing}
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'Importing & Generating Bills…' : 'Import & Generate Bills'}
            </Button>

            {/* Results */}
            {importResult && (
              <div className="space-y-3">
                {/* Summary badges */}
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs font-semibold px-3 py-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {importResult.success_count} generated
                  </span>
                  {importResult.error_count > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-xs font-semibold px-3 py-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {importResult.error_count} failed
                    </span>
                  )}
                </div>

                {/* Bills Table */}
                {importResult.bills?.length > 0 && (
                  <div className="rounded-lg border overflow-hidden">
                    <div className="px-3 py-2 bg-muted/40 border-b flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Newly Generated Bills</p>
                      {importResult.layout_detected && (
                        <span className="text-[10px] text-muted-foreground">Layout: {importResult.layout_detected}</span>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/20 text-muted-foreground">
                            <th className="text-left py-2 px-3 font-medium">Consumer #</th>
                            <th className="text-left py-2 px-3 font-medium">Name</th>
                            <th className="text-left py-2 px-3 font-medium">Bill #</th>
                            <th className="text-right py-2 px-3 font-medium">Prev</th>
                            <th className="text-right py-2 px-3 font-medium">Current</th>
                            <th className="text-right py-2 px-3 font-medium">Units</th>
                            <th className="text-right py-2 px-3 font-medium">Amount</th>
                            <th className="text-left py-2 px-3 font-medium">Due</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {importResult.bills.map((b: any, i: number) => (
                            <tr key={i} className="hover:bg-muted/10">
                              <td className="py-2 px-3 font-mono">{b.consumer_number}</td>
                              <td className="py-2 px-3 truncate max-w-[120px]">{b.consumer_name}</td>
                              <td className="py-2 px-3 font-mono text-primary">{b.bill_number}</td>
                              <td className="py-2 px-3 text-right text-muted-foreground">{Number(b.previous_reading ?? 0).toFixed(0)}</td>
                              <td className="py-2 px-3 text-right font-semibold">{Number(b.current_reading ?? 0).toFixed(0)}</td>
                              <td className="py-2 px-3 text-right">
                                <span className="text-green-600 font-semibold">{Number(b.units).toFixed(1)} kWh</span>
                              </td>
                              <td className="py-2 px-3 text-right font-semibold">₹{Number(b.total_amount).toLocaleString('en-IN')}</td>
                              <td className="py-2 px-3 text-muted-foreground">{b.due_date}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Error Log */}
                {importResult.errors?.length > 0 && (
                  <div className="rounded-lg border border-red-200 dark:border-red-800 overflow-hidden">
                    <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">Error Log</p>
                    </div>
                    <div className="p-3 space-y-1">
                      {importResult.errors.map((err: string, i: number) => (
                        <p key={i} className="text-xs text-red-600 dark:text-red-400 font-mono">{err}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Readings;
