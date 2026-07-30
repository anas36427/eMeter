import { Skeleton } from "@/components/ui/skeleton";

// ─── Dashboard Skeleton ─────────────────────────────────────
// Mirrors: 6 stat cards (140px height, icon+title+value+divider+desc)
// + action bar at top
export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page header + buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>

      {/* 6 stat cards — same grid as real cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className="stat-card p-6 flex flex-col justify-between min-h-[140px]">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-7 w-24" />
              </div>
              {/* Icon circle */}
              <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
            </div>
            <div className="mt-4 pt-4 border-t border-border/50">
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>

      {/* "Go to Reports" action card */}
      <div className="stat-card flex flex-col items-center justify-center py-12">
        <Skeleton className="w-12 h-12 rounded-full mb-4" />
        <Skeleton className="h-5 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-4 w-24 mt-4" />
      </div>
    </div>
  );
}

// ─── Table Skeleton ─────────────────────────────────────────
// Mirrors a real table with a header + configurable data rows.
// columns: number of column cells per row
// rows: number of skeleton rows (default 8)
// showFilterBar: whether to render filter-bar skeletons above the table
// showSummaryCards: for Billing — render 3 summary cards above
interface TableSkeletonProps {
  columns?: number;
  rows?: number;
  showFilterBar?: boolean;
  showSummaryCards?: boolean;
  pageTitle?: boolean;
}

export function TableSkeleton({
  columns = 5,
  rows = 8,
  showFilterBar = true,
  showSummaryCards = false,
  pageTitle = true,
}: TableSkeletonProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page title + action button */}
      {pageTitle && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      )}

      {/* Optional 3 summary cards (Billing) */}
      {showSummaryCards && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="stat-card p-6 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      {showFilterBar && (
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-10 w-36 rounded-md" />
          <Skeleton className="h-10 w-36 rounded-md" />
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
      )}

      {/* Table card */}
      <div className="stat-card overflow-hidden p-0">
        {/* Table header row */}
        <div className="border-b border-border bg-muted/30 px-4 py-3 flex gap-4">
          {Array(columns).fill(0).map((_, i) => (
            <Skeleton
              key={i}
              className="h-4 rounded"
              style={{ flex: i === 1 ? 2 : 1 }}
            />
          ))}
        </div>

        {/* Data rows */}
        {Array(rows).fill(0).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="border-b border-border/50 px-4 py-3.5 flex gap-4 items-center"
          >
            {Array(columns).fill(0).map((_, colIdx) => (
              <Skeleton
                key={colIdx}
                className={`h-4 rounded ${colIdx === columns - 1 ? "ml-auto w-8" : ""}`}
                style={{
                  flex: colIdx === 1 ? 2 : 1,
                  // last col is always the actions "..." button
                  maxWidth: colIdx === columns - 1 ? 32 : undefined,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chart Skeleton ─────────────────────────────────────────
// Mirrors the Reports page layout:
// 2 chart cards side-by-side (bar + donut) + 1 full-width leaderboard
export function ChartSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart card */}
        <div className="stat-card p-6 space-y-4">
          <Skeleton className="h-4 w-44" />
          {/* Fake bar chart: ground line + 6 bars */}
          <div className="h-[260px] flex items-end gap-3 pt-4">
            {Array(6).fill(0).map((_, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-t"
                style={{ height: `${40 + Math.sin(i) * 30 + ((i * 37) % 50)}%` }}
              />
            ))}
          </div>
          {/* X axis labels */}
          <div className="flex gap-3">
            {Array(6).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-3 flex-1" />
            ))}
          </div>
        </div>

        {/* Donut chart card */}
        <div className="stat-card p-6 space-y-4 flex flex-col items-center justify-center">
          <Skeleton className="h-4 w-40 self-start" />
          <Skeleton className="w-48 h-48 rounded-full" />
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Skeleton className="w-3 h-3 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="w-3 h-3 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </div>

        {/* Top consumers leaderboard — spans 2 cols */}
        <div className="stat-card p-6 lg:col-span-2 space-y-4">
          <Skeleton className="h-4 w-60" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            {Array(10).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-8 h-6 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Form Skeleton ──────────────────────────────────────────
// Mirrors Settings page: notifications toggle card + billing config grid
export function FormSkeleton() {
  return (
    <div className="max-w-2xl space-y-8 animate-fade-in pb-12">
      {/* Notifications card */}
      <div className="stat-card space-y-4 p-6">
        <Skeleton className="h-5 w-28" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-52" />
          {/* Toggle pill */}
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
      </div>

      {/* Billing config card */}
      <div className="stat-card space-y-4 p-6">
        <Skeleton className="h-5 w-44" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-44 rounded-md mt-2" />
      </div>

      {/* Mobile sync card */}
      <div className="stat-card space-y-4 p-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>
    </div>
  );
}
