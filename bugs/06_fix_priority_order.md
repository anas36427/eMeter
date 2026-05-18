# 🔧 Bug Fix Priority Order
> Ordered for all smoke tests to pass. Fix top-to-bottom.

---

## P0 — App Won't Start / Immediate Crash

- [x] **BUG-44** — `ConsumerForm` undefined → `NameError` on `add_consumer` view ✅
- [x] **BUG-28** — Hooks called after early return in `BillPreviewScreen` → React crash ✅
- [x] **BUG-29** — `data.bill` is `undefined` when navigating to `BillPreviewScreen` → crash ✅
- [x] **BUG-30** — `reading.previous_reading` accessed without null guard → crash ✅
- [x] **BUG-01** — `REST_FRAMEWORK` defined twice → custom auth class silently dropped ✅

---

## P1 — Core Billing Flow Broken (Bills Generate With Wrong or Zero Amounts)

- [x] **BUG-09** — Tiered tariff vs flat rate mismatch → estimate ≠ actual bill amount ✅
- [x] **BUG-15** — `generate_bill` HTML view → `total_amount = 0` on every bill ✅
- [x] **BUG-16** — `api_manual_generate_bill` → `total_amount = 0` on every bill ✅
- [x] **BUG-41** — Excel import → `total_amount = 0` on every imported bill ✅
- [x] **BUG-11** — Edit reading recalculates total without duty/rent → wrong amount ✅
- [x] **BUG-10** — `finalize_bill()` crashes if `meter_reading` is `None` ✅

---

## P2 — Data Integrity & Dashboard Faults

- [x] **BUG-12** — Dashboard stats pending_amount filter unpaid → always 0 ✅
- [x] **BUG-13** — HTML dashboard unpaid/overdue counts use invalid status string ✅
- [x] **BUG-25** — PATCH bypasses bill lock → finalized bills can be modified ✅
- [x] **BUG-39** — Missing `consumer_number_snapshot` field on Bill model ✅
- [x] **BUG-08** — Bill number has no collision-retry → IntegrityError crash ✅
- [x] **BUG-22** — Search consumers `icontains` on int ID field → PostgreSQL crash ✅
- [x] **BUG-40** — `BillingService.generate_bill_pdf()` is a stub returning a dict ✅ not PDF bytes

---

## P3 — Features Broken / Wrong Behaviour

- [x] **BUG-21** — `api_readings_list` calls `@api_view`-decorated fn directly → decorator conflict ✅
- [x] **BUG-18** — Duplicate URL patterns (`consumer/` vs `consumers/`) → ambiguous routing ✅
- [x] **BUG-31** — Mobile API base URL hardcoded to one machine's IP → fails everywhere else ✅
- [x] **BUG-32** — `getBillPdfUrl` missing `/api/` prefix → returns 404 ✅
- [x] **BUG-33** — Offline sync date timezone edge case → duplicate-month readings possible ✅
- [x] **BUG-02** — Hardcoded DB password as env fallback → silent wrong credentials ✅
- [x] **BUG-43** — `consumer_bills` uses `.get()` not `.filter().first()` → 500 on missing consumer ✅

---

## P4 — Security Issues

- [x] **BUG-03** — `ALLOWED_HOSTS = ["*"]` in production → host header injection risk ✅
- [x] **BUG-05** — Login error reveals if username exists → enumeration attack ✅
- [x] **BUG-04** — `api_logout` missing `@require_authenticated` ✅
- [x] **BUG-07** — COOP security header permanently disabled (not scoped to DEBUG) ✅

---

## P5 — Code Quality / Reliability

- [x] **BUG-37** — No DB-level constraint on `current_reading >= previous_reading` ✅
- [x] **BUG-45** — `BillingSettings.__str__` crashes if `updated_at` is `None` ✅
- [x] **BUG-35** — Debounce estimate sets state on unmounted component ✅
- [x] **BUG-36** — Excel export uses `savedAt` not `updatedAt` for 24h filter ✅
- [x] **BUG-14** — `BillingSettings` DB failure logged with `print()` not `logging` ✅
- [x] **BUG-23** — SQLite-specific error string used in exception handler (fails on PostgreSQL) ✅
- [x] **BUG-17** — Consumer number `while` loop has no iteration limit ✅

---

## P6 — Dead Code / Low-Impact Polish

- [x] **BUG-06** — Debug logs print sensitive data (usernames, tokens) unconditionally ✅
- [x] **BUG-19** — Redundant `is_authenticated` check after `@require_role` ✅
- [x] **BUG-20** — Dead method check inside `@api_view(['POST'])` function ✅
- [x] **BUG-24** — `download_bill_pdf` (ReportLab) has no URL → unreachable ✅
- [x] **BUG-26** — `spa_index` reads HTML file from disk on every request (no cache) ✅
- [x] **BUG-27** — Old `api_get_bill` function is dead code — never called ✅
- [x] **BUG-34** — Profile tab always shows "Meter Reader" regardless of actual role ✅
- [x] **BUG-38** — `import random, string` inside `Bill.save()` method body ✅
- [x] **BUG-42** — `BillSerializer` validation is dead code — no active view uses it ✅
