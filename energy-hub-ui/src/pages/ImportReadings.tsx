import { useState, useRef } from 'react';
import { importReadingsExcel } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  FileSpreadsheet, Upload, CheckCircle2, AlertCircle,
  Info, Download, Loader2, RotateCcw, ArrowRight, Table2
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ImportReadings() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      toast({ title: 'Invalid file type', description: 'Please upload an .xlsx or .xls file', variant: 'destructive' });
      return;
    }
    setFile(selectedFile);
    setResult(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await importReadingsExcel(file);
      const data = res.data ?? res;
      setResult(data);
      if (data.success_count > 0) {
        toast({ title: `✅ ${data.success_count} bill(s) generated successfully` });
      }
      if (data.error_count > 0) {
        toast({ title: `⚠️ ${data.error_count} row(s) had errors`, variant: 'destructive' });
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Import failed';
      toast({ title: 'Import Failed', description: msg, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Generate a template Excel file for the user to download
  const handleDownloadTemplate = () => {
    const ws_data = [
      ['Consumer Number', 'Meter Number', 'Current Reading', 'Reading Date'],
      ['C-001', 'MTR-001', 1500, '2026-05-01'],
      ['C-002', 'MTR-002', 2300, '2026-05-01'],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    ws['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Readings');
    XLSX.writeFile(wb, 'readings_import_template.xlsx');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-primary" />
            Import Readings via Excel
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bulk import meter readings from Excel — bills are generated automatically
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadTemplate}>
          <Download className="w-4 h-4" /> Download Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Upload Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Column Format Docs */}
          <div className="stat-card space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Info className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-sm">Required Excel Column Format</span>
              <Badge className="ml-auto bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">Auto-detected</Badge>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <div className="px-3 py-2 bg-muted/30 border-b">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Recommended — 4-Column Format
                </p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/10 text-muted-foreground">
                    <th className="py-2 px-3 text-left font-medium">Column A</th>
                    <th className="py-2 px-3 text-left font-medium">Column B</th>
                    <th className="py-2 px-3 text-left font-medium">Column C</th>
                    <th className="py-2 px-3 text-left font-medium">Column D</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-primary">Consumer Number</td>
                    <td className="py-2 px-3 font-semibold text-primary">Meter Number</td>
                    <td className="py-2 px-3 font-semibold text-primary">Current Reading</td>
                    <td className="py-2 px-3 text-muted-foreground">Reading Date <span className="text-xs">(optional)</span></td>
                  </tr>
                  <tr className="border-t bg-muted/5 text-muted-foreground">
                    <td className="py-2 px-3 font-mono">C-001</td>
                    <td className="py-2 px-3 font-mono">MTR-001</td>
                    <td className="py-2 px-3 font-mono">1500</td>
                    <td className="py-2 px-3 font-mono">2026-05-01</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <div className="px-3 py-2 bg-muted/30 border-b">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Also Accepted — 3-Column Format (no Meter Number)
                </p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/10 text-muted-foreground">
                    <th className="py-2 px-3 text-left font-medium">Column A</th>
                    <th className="py-2 px-3 text-left font-medium">Column B</th>
                    <th className="py-2 px-3 text-left font-medium">Column C</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-primary">Consumer Number</td>
                    <td className="py-2 px-3 font-semibold text-primary">Current Reading</td>
                    <td className="py-2 px-3 text-muted-foreground">Reading Date <span className="text-xs">(optional)</span></td>
                  </tr>
                  <tr className="border-t bg-muted/5 text-muted-foreground">
                    <td className="py-2 px-3 font-mono">C-001</td>
                    <td className="py-2 px-3 font-mono">1500</td>
                    <td className="py-2 px-3 font-mono">2026-05-01</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3 text-green-500" /> Row 1 = headers (auto-skipped)</span>
              <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3 text-green-500" /> Date format: YYYY-MM-DD or DD-MM-YYYY</span>
              <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3 text-green-500" /> Missing date defaults to today</span>
            </div>
          </div>

          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : file
                ? 'border-green-400 bg-green-500/5'
                : 'border-border hover:border-primary/60 hover:bg-muted/30'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0] || null); }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            />
            {file ? (
              <>
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="font-semibold text-green-600 dark:text-green-400 text-lg">{file.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(1)} KB — click to change</p>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="font-semibold text-base">Drop your Excel file here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse — .xlsx or .xls</p>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              className="flex-1 gap-2 h-12 text-base"
              onClick={handleImport}
              disabled={!file || importing}
            >
              {importing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Processing…</>
              ) : (
                <><Upload className="w-5 h-5" /> Import & Generate Bills</>
              )}
            </Button>
            {(file || result) && (
              <Button variant="outline" size="icon" className="h-12 w-12" onClick={handleReset} title="Reset">
                <RotateCcw className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Right: Tips Panel */}
        <div className="space-y-4">
          <div className="stat-card space-y-3">
            <div className="flex items-center gap-2">
              <Table2 className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Quick Tips</span>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                'Row 1 must be the header row',
                'Consumer Number must match exactly what is registered',
                'Only one reading per consumer per billing month is allowed',
                'Current reading must be ≥ previous reading',
                'Bills are auto-generated for each successful row',
                'Use the template for guaranteed compatibility',
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={handleDownloadTemplate}>
            <Download className="w-4 h-4" /> Download Sample Template
          </Button>
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <div className="space-y-4 animate-fade-in">
          {/* Summary Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="stat-card flex items-center gap-3 py-3 px-5">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-600">{result.success_count}</p>
                <p className="text-xs text-muted-foreground">Bills Generated</p>
              </div>
            </div>
            {result.error_count > 0 && (
              <div className="stat-card flex items-center gap-3 py-3 px-5">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{result.error_count}</p>
                  <p className="text-xs text-muted-foreground">Rows Failed</p>
                </div>
              </div>
            )}
            {result.layout_detected && (
              <Badge variant="secondary" className="h-8 px-4 text-xs">
                Layout: {result.layout_detected}
              </Badge>
            )}
          </div>

          {/* Bills Table */}
          {result.bills?.length > 0 && (
            <div className="stat-card overflow-hidden p-0">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <p className="text-sm font-semibold">Generated Bills</p>
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">{result.bills.length} bills</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-muted-foreground">
                      <th className="text-left py-2.5 px-4 font-medium">Consumer #</th>
                      <th className="text-left py-2.5 px-4 font-medium">Name</th>
                      <th className="text-left py-2.5 px-4 font-medium hidden md:table-cell">Meter #</th>
                      <th className="text-left py-2.5 px-4 font-medium">Bill #</th>
                      <th className="text-right py-2.5 px-4 font-medium">Prev</th>
                      <th className="text-right py-2.5 px-4 font-medium">Current</th>
                      <th className="text-right py-2.5 px-4 font-medium">Units</th>
                      <th className="text-right py-2.5 px-4 font-medium">Amount</th>
                      <th className="text-left py-2.5 px-4 font-medium hidden lg:table-cell">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {result.bills.map((b: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/10 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-xs">{b.consumer_number}</td>
                        <td className="py-2.5 px-4 font-medium truncate max-w-[120px]">{b.consumer_name}</td>
                        <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground hidden md:table-cell">{b.meter_number}</td>
                        <td className="py-2.5 px-4 font-mono text-primary text-xs">{b.bill_number}</td>
                        <td className="py-2.5 px-4 text-right text-muted-foreground">{Number(b.previous_reading ?? 0).toFixed(0)}</td>
                        <td className="py-2.5 px-4 text-right font-semibold">{Number(b.current_reading ?? 0).toFixed(0)}</td>
                        <td className="py-2.5 px-4 text-right">
                          <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20 font-mono">
                            {Number(b.units).toFixed(1)} kWh
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold">₹{Number(b.total_amount).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs hidden lg:table-cell">{b.due_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Error Log */}
          {result.errors?.length > 0 && (
            <div className="stat-card overflow-hidden p-0 border-red-200 dark:border-red-800">
              <div className="px-4 py-3 border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 flex items-center justify-between">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Error Log
                </p>
                <Badge variant="destructive" className="text-xs">{result.errors.length} errors</Badge>
              </div>
              <div className="p-4 space-y-1.5 max-h-60 overflow-y-auto">
                {result.errors.map((err: string, i: number) => (
                  <p key={i} className="text-xs text-red-600 dark:text-red-400 font-mono bg-red-500/5 px-3 py-1.5 rounded">
                    {err}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
