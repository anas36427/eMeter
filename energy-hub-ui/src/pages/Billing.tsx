import { useState, useEffect } from "react";
import { FileText, Download, Search, IndianRupee, MoreHorizontal, Eye, CheckCircle, XCircle, Printer, FileSpreadsheet, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getBills, getBill, markPaid, markUnpaid } from "@/lib/api";
import { generateBillHtml } from "@/lib/billHtml";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { useSearch } from "@/contexts/SearchContext";

interface Bill {
  id: number;
  units: number;
  total_amount: number;
  status: string;
  billing_period: string;
  due_date: string;
  created_at?: string;
  consumer_name?: string;
  meter_number?: string;
  connection_type?: string;
  billing_type?: string;
}

const formatPeriod = (periodStr: string) => {
  if (!periodStr) return "—";
  try {
    const [year, month] = periodStr.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[parseInt(month) - 1]}-${year.substring(2)}`;
  } catch (e) {
    return periodStr;
  }
};

const Billing = () => {
  const { searchQuery, setSearchQuery } = useSearch();
  const [statusFilter, setStatusFilter] = useState("all");
  const [accountTypeFilter, setAccountTypeFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 50;

  const [bills, setBills] = useState<Bill[]>([]);
  const [summary, setSummary] = useState({ total_billed: 0, total_paid: 0, total_pending: 0 });
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState("");
  const { toast } = useToast();

  // Bill Details Dialog
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailBill, setDetailBill] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfPrinting, setPdfPrinting] = useState(false);

  const fetchBills = () => {
    setLoading(true);
    getBills({
      page,
      limit,
      search: searchQuery,
      status: statusFilter,
      accountType: accountTypeFilter,
      startDate,
      endDate,
      sortOrder
    })
      .then((res: any) => {
        const data = res.bills || res.data?.bills || res.data || [];
        setBills(Array.isArray(data) ? data : []);
        setTotalPages(res.total_pages || res.data?.total_pages || 1);
        setTotalItems(res.total_items || res.data?.total_items || 0);
        
        const sumData = res.summary || res.data?.summary;
        if (sumData) {
          setSummary(sumData);
        }
      })
      .catch((err) => {
        console.error("Fetch Bills Error:", err);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
        setInitialLoad(false);
      });
  };

  useEffect(() => {
    fetchBills();
  }, [page, searchQuery, statusFilter, accountTypeFilter, startDate, endDate, sortOrder]);

  useEffect(() => {
    return () => setSearchQuery("");
  }, []);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, accountTypeFilter, startDate, endDate, sortOrder]);

  const handleMarkPaid = async (billId: number) => {
    try {
      await markPaid(billId);
      toast({ title: "Bill marked as paid" });
      fetchBills();
    } catch (err: any) {
      toast({ title: "Failed to update bill", description: err.message, variant: "destructive" });
    }
  };

  const handleMarkUnpaid = async (billId: number) => {
    try {
      await markUnpaid(billId);
      toast({ title: "Bill marked as unpaid" });
      fetchBills();
    } catch (err: any) {
      toast({ title: "Failed to update bill", description: err.message, variant: "destructive" });
    }
  };

  const handleViewDetails = async (billId: number) => {
    setDetailLoading(true);
    setDetailsOpen(true);
    try {
      const data = await getBill(billId);
      setDetailBill(data);
    } catch (err: any) {
      toast({ title: "Failed to load bill details", description: err.message, variant: "destructive" });
      setDetailsOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // Fetch the full bill detail then generate HTML bill using the shared template
  const getBillDetail = async (billId: number) => {
    const res = await getBill(billId);
    return res?.data?.bill || res?.data || res || null;
  };

  const handleDownloadPdf = async (billId: number, consumerName: string) => {
    setPdfLoading(true);
    try {
      const b = await getBillDetail(billId);
      if (!b) throw new Error('Bill not found');
      const html = generateBillHtml({
        bill_number: b.bill_number,
        bill_date: b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
        due_date: b.due_date,
        billing_period: b.billing_period,
        connection_type: b.connection_type,
        billing_type: b.billing_type,
        load_kw: b.load_kw,
        meter_type: b.meter_type,
        consumer_name: b.consumer_name,
        consumer_number: b.consumer_number,
        meter_number: b.meter_number,
        address: b.address,
        previous_reading: b.previous_reading,
        current_reading: b.current_reading,
        units: b.units,
        rate_per_unit: b.rate_per_unit,
        energy_charges: b.energy_charges,
        fixed_charges: b.fixed_charges,
        duty_charge: b.duty_charge,
        meter_rent: b.meter_rent,
        regulatory_surcharge: b.regulatory_surcharge,
        arrears: b.arrears,
        late_payment_surcharge: b.late_payment_surcharge,
        grand_total: b.total_amount,
        status: b.status,
      });
      // Use print-to-PDF via a hidden iframe
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      iframe.contentDocument!.write(html);
      iframe.contentDocument!.close();
      iframe.contentWindow!.focus();
      
      // Wait for rendering before printing so the loading state blocks spam clicks
      await new Promise(resolve => setTimeout(resolve, 500));
      iframe.contentWindow!.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    } catch (err: any) {
      toast({ title: 'Download failed', description: err.message, variant: 'destructive' });
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePrintPdf = async (billId: number) => {
    setPdfPrinting(true);
    try {
      const b = await getBillDetail(billId);
      if (!b) throw new Error('Bill not found');
      const html = generateBillHtml({
        bill_number: b.bill_number,
        bill_date: b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
        due_date: b.due_date,
        billing_period: b.billing_period,
        connection_type: b.connection_type,
        billing_type: b.billing_type,
        load_kw: b.load_kw,
        meter_type: b.meter_type,
        consumer_name: b.consumer_name,
        consumer_number: b.consumer_number,
        meter_number: b.meter_number,
        address: b.address,
        previous_reading: b.previous_reading,
        current_reading: b.current_reading,
        units: b.units,
        rate_per_unit: b.rate_per_unit,
        energy_charges: b.energy_charges,
        fixed_charges: b.fixed_charges,
        duty_charge: b.duty_charge,
        meter_rent: b.meter_rent,
        regulatory_surcharge: b.regulatory_surcharge,
        arrears: b.arrears,
        late_payment_surcharge: b.late_payment_surcharge,
        grand_total: b.total_amount,
        status: b.status,
      });
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        
        // Wait for rendering
        await new Promise(resolve => setTimeout(resolve, 400));
        printWindow.print();
      } else {
        throw new Error('Pop-up blocked. Please allow pop-ups for this site.');
      }
    } catch (err: any) {
      toast({ title: 'Print failed', description: err.message, variant: 'destructive' });
    } finally {
      setPdfPrinting(false);
    }
  };



  const handleExportExcel = () => {
    const totalSum = bills.reduce((s, b) => s + (Number(b.total_amount) || 0), 0);
    
    const dateRangeLabel = startDate && endDate 
      ? `${startDate} TO ${endDate}` 
      : startDate ? `FROM ${startDate}`
      : endDate ? `UNTIL ${endDate}`
      : "ALL PERIODS";

    // Exact sheet structure as requested
    const ws_data = [
      [], // Row 1: empty
      ["", "", "", totalSum], // Row 2: D2 = total sum
      [], // Row 3: empty
      ["", "", dateRangeLabel], // Row 4: C4 = dynamic range
      [], // Row 5: empty
      ["S.NO.", "ID", "NAME", "TOTAL AMOUNT"], // Row 6: Bold headers
      ...bills.map((b, i) => [
        i + 1, 
        b.id, 
        b.consumer_name || "N/A", 
        Math.round(Number(b.total_amount))
      ]) // Row 7+: data
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // Merged B4:D4 (0-indexed: B=1, D=3, row 4=3)
    ws['!merges'] = [
      { s: { r: 3, c: 1 }, e: { r: 3, c: 3 } }
    ];

    // Column widths
    ws['!cols'] = [
      { wch: 8 },  // A
      { wch: 10 }, // B
      { wch: 25 }, // C
      { wch: 15 }  // D
    ];

    // Bold formatting is not supported by standard xlsx library without styling extension,
    // but the structure and data are precisely as requested.

    XLSX.utils.book_append_sheet(wb, ws, "Bills");
    XLSX.writeFile(wb, "amu_emeter_bills.xlsx");
  };

  const handlePrintReport = () => {
    window.print();
  };

  const totalBilled = summary.total_billed;
  const collected = summary.total_paid;
  const pending = summary.total_pending;

  if (initialLoad) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive font-medium">Failed to load bills</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchBills}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Dashboard View - Hidden during print */}
      <div className="print:hidden space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AMU eMeter Service</h1>
            <p className="text-sm text-muted-foreground">
              {totalItems > 0 ? `Showing ${bills.length} of ${totalItems} bills` : "Manage and generate electricity bills for AMU"}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 text-muted-foreground"
              onClick={handlePrintReport}
            >
              <Printer className="w-4 h-4" /> Print Report
            </Button>
            <Button 
              size="sm" 
              className="gap-2 bg-secondary hover:bg-secondary/90 text-white"
              onClick={handleExportExcel}
            >
              <FileSpreadsheet className="w-4 h-4" /> Download Excel
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Total Billed</p>
            <p className="text-2xl font-bold text-foreground mt-1">₹{totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground mt-1">{bills.length} bills</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Collected</p>
            <p className="text-2xl font-bold text-secondary mt-1">₹{collected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground mt-1">{bills.filter(b => b.status === "paid").length} paid</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-warning mt-1">₹{pending.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground mt-1">{bills.filter(b => b.status !== "paid").length} unpaid</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          {/* Local search bar removed in favor of global TopNavbar search */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 gap-2">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>

          <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
            <SelectTrigger className="w-36 gap-2">
              <SelectValue placeholder="All Acc Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Acc Types</SelectItem>
              <SelectItem value="salary">Salary</SelectItem>
              <SelectItem value="non-salary">Non-Salary</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortOrder} onValueChange={(val: "desc" | "asc") => setSortOrder(val)}>
            <SelectTrigger className="w-36 gap-2">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Most Recent</SelectItem>
              <SelectItem value="asc">Oldest First</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 bg-card border border-border/50 rounded-md px-3 h-10">
            <span className="text-xs text-muted-foreground font-medium uppercase">From:</span>
            <input 
              type="month" 
              className="bg-transparent border-none text-sm focus:outline-none"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 bg-card border border-border/50 rounded-md px-3 h-10">
            <span className="text-xs text-muted-foreground font-medium uppercase">To:</span>
            <input 
              type="month" 
              className="bg-transparent border-none text-sm focus:outline-none"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {(startDate || endDate || statusFilter !== "all" || accountTypeFilter !== "all" || sortOrder !== "desc") && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs text-muted-foreground h-10 px-3 hover:text-foreground"
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setStatusFilter("all");
                setAccountTypeFilter("all");
                setSortOrder("desc");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Bills Table */}
        <div className="stat-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Bill #</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Consumer</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden md:table-cell">Meter No.</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Units</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Amount</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden lg:table-cell">Billing Period</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium hidden lg:table-cell">Due Date</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-medium">{b.id}</td>
                    <td className="py-3 px-4 text-foreground">
                      <div className="flex flex-col gap-1 items-start">
                        <span>{b.consumer_name || "—"}</span>
                        {b.billing_type === "salary" ? (
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
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground hidden md:table-cell">{b.meter_number || "—"}</td>
                    <td className="py-3 px-4">{b.units}</td>
                    <td className="py-3 px-4 font-medium">₹{Number(b.total_amount).toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={b.status === "paid" ? "default" : b.status === "overdue" ? "destructive" : "secondary"}
                        className="text-xs capitalize"
                      >
                        {b.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">{formatPeriod(b.billing_period)}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">{b.due_date}</td>
                    <td className="py-3 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="gap-2" onClick={() => handleViewDetails(b.id)}>
                            <Eye className="w-4 h-4" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {b.status !== "paid" ? (
                            <DropdownMenuItem className="gap-2" onClick={() => handleMarkPaid(b.id)}>
                              <CheckCircle className="w-4 h-4" /> Mark as Paid
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="gap-2" onClick={() => handleMarkUnpaid(b.id)}>
                              <XCircle className="w-4 h-4" /> Mark as Unpaid
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="gap-2" onClick={() => handleDownloadPdf(b.id, b.consumer_name || 'bill')}>
                            <Download className="w-4 h-4" /> Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2" onClick={() => handlePrintPdf(b.id)}>
                            <Printer className="w-4 h-4" /> Print PDF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {bills.length === 0 && !loading && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">No bills found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-muted/10">
              <div className="text-sm text-muted-foreground">
                Page <span className="font-medium text-foreground">{page}</span> of <span className="font-medium text-foreground">{totalPages}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print-only Report View (Matches Excel Structure) */}
      <div className="hidden print:block bg-white text-black font-sans">
        {/* Row 2 equivalent: Total Sum top-right */}
        <div className="flex justify-end mb-6">
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest font-bold text-gray-500">Total Sum (This Page)</p>
            <p className="text-2xl font-bold">{bills.reduce((s, b) => s + (Number(b.total_amount) || 0), 0)}</p>
          </div>
        </div>

        {/* Row 4 equivalent: Merged Period Title */}
        <div className="text-center mb-10 border-y border-black py-4">
          <h2 className="text-2xl font-bold tracking-widest uppercase">
            {startDate && endDate 
              ? `${startDate} / ${endDate}` 
              : startDate ? `FROM ${startDate}`
              : endDate ? `UNTIL ${endDate}`
              : "ALL BILLING PERIODS"}
          </h2>
        </div>

        {/* Row 6 & 7+ equivalent: Table */}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-3 px-2 font-bold uppercase text-sm">S.NO.</th>
              <th className="py-3 px-2 font-bold uppercase text-sm">ID</th>
              <th className="py-3 px-2 font-bold uppercase text-sm">NAME</th>
              <th className="py-3 px-2 font-bold uppercase text-sm">TOTAL AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b, i) => (
              <tr key={b.id} className="border-b border-gray-200">
                <td className="py-3 px-2 text-sm">{i + 1}</td>
                <td className="py-3 px-2 text-sm">{b.id}</td>
                <td className="py-3 px-2 text-sm font-medium">{b.consumer_name || "N/A"}</td>
                <td className="py-3 px-2 text-sm font-bold">{Math.round(Number(b.total_amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-12 pt-4 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400 uppercase tracking-widest">
          <span>AMU eMeter Service Billing System</span>
          <span>Generated: {new Date().toLocaleString()}</span>
        </div>
      </div>

      {/* Bill Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bill Details</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ) : detailBill ? (
            <div className="space-y-4 py-4">
              {/* Consumer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Consumer</p>
                  <p className="font-medium">{detailBill.consumer_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Meter Number</p>
                  <p className="font-mono text-sm">{detailBill.meter_number}</p>
                </div>
              </div>

              {/* Status & Period */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Billing Period</p>
                  <p className="text-sm">{formatPeriod(detailBill.billing_period)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Status</p>
                  <Badge variant={detailBill.status === "paid" ? "default" : "secondary"} className="capitalize">
                    {detailBill.status}
                  </Badge>
                </div>
              </div>

              {/* Charge Breakdown */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Charge Breakdown</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Units Consumed</span>
                  <span className="font-medium">{detailBill.units} kWh</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rate per Unit</span>
                  <span className="font-medium">₹{Number(detailBill.rate_per_unit || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Energy Charges</span>
                  <span className="font-medium">₹{Number(detailBill.energy_charges || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fixed Charges</span>
                  <span className="font-medium">₹{Number(detailBill.fixed_charges || 0).toFixed(2)}</span>
                </div>
                <hr className="border-border" />
                <div className="flex justify-between text-base font-bold">
                  <span>Total Amount</span>
                  <span className="text-primary">₹{Number(detailBill.total_amount || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Due, Paid & Created Dates */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Generated</p>
                  <p className="text-xs font-medium">{detailBill.created_at ? new Date(detailBill.created_at).toLocaleString() : "N/A"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Due Date</p>
                  <p className="text-xs font-medium">{detailBill.due_date || "N/A"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Paid Date</p>
                  <p className="text-xs font-medium">{detailBill.paid_date || "Not yet paid"}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => { handleDownloadPdf(detailBill.id, detailBill.consumer_name); }}
                  disabled={pdfLoading}
                >
                  {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => { handlePrintPdf(detailBill.id); }}
                  disabled={pdfPrinting}
                >
                  {pdfPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  Print PDF
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Billing;
