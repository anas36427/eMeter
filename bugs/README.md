# 🐛 eMeter AMU — Bug Reports Index

Complete catalogue of bugs, logic issues, and code quality problems found by reading every line of the codebase. Each file covers a distinct domain.

---

## Files in this Folder

| File | Domain | Bugs Covered |
|------|--------|-------------|
| [01_authentication_security_bugs.md](./01_authentication_security_bugs.md) | Auth & Security | BUG-01 → BUG-07 |
| [02_billing_logic_bugs.md](./02_billing_logic_bugs.md) | Billing & Calculation | BUG-08 → BUG-17 |
| [03_api_views_bugs.md](./03_api_views_bugs.md) | API Views & Endpoints | BUG-18 → BUG-27 |
| [04_mobile_app_bugs.md](./04_mobile_app_bugs.md) | Mobile App (React Native) | BUG-28 → BUG-36 |
| [05_models_services_misc_bugs.md](./05_models_services_misc_bugs.md) | Models, Services & Misc | BUG-37 → BUG-45 |

---

## Quick Severity Overview — All 45 Bugs

### 🔴 HIGH — Fix Immediately (Will Crash or Corrupt Data)

| Bug ID | File | Summary |
|--------|------|---------|
| BUG-01 | settings.py | `REST_FRAMEWORK` defined twice — custom auth class silently discarded |
| BUG-02 | settings.py | DB password hardcoded as env fallback |
| BUG-08 | models.py | Bill number has no collision-retry — `IntegrityError` crash |
| BUG-09 | services.py / views.py | Tiered tariff vs flat rate mismatch — estimate ≠ actual bill |
| BUG-10 | services.py | `finalize_bill()` crashes if `meter_reading` is `None` |
| BUG-11 | views.py | Edit reading recalculates `total_amount` without duty/meter rent |
| BUG-25 | views.py | `api_bill_detail` PATCH bypasses bill lock — can reopen finalized bills |
| BUG-28 | BillPreviewScreen.js | Hooks called after early return — React rules violation / crash |
| BUG-29 | SubmitReadingScreen.js | Navigation passes `data.bill` which is `undefined` — crash |
| BUG-30 | BillPreviewScreen.js | `reading.previous_reading` accessed without null guard |
| BUG-41 | views.py | Excel import creates bills with `total_amount = 0` |
| BUG-44 | views.py | `add_consumer` references undefined `ConsumerForm` — `NameError` |

### 🟠 MEDIUM — Fix Soon (Wrong Behaviour, Silent Failures)

| Bug ID | File | Summary |
|--------|------|---------|
| BUG-03 | settings.py | `ALLOWED_HOSTS = ["*"]` applies in production |
| BUG-04 | views.py | `api_logout` has no `@require_authenticated` |
| BUG-12 | views.py | Dashboard stats filter by `'unpaid'` — invalid status, always 0 |
| BUG-13 | views.py | HTML dashboard counts `'unpaid'` and `'overdue'` — both invalid |
| BUG-14 | models.py | `BillingSettings` DB failure logged with `print()` not `logging` |
| BUG-15 | views.py | `generate_bill` HTML view creates bill with `total_amount = 0` |
| BUG-16 | views.py | `api_manual_generate_bill` creates bill with `total_amount = 0` |
| BUG-18 | urls.py | Duplicate URL patterns (`consumer/` vs `consumers/`) |
| BUG-21 | views.py | `api_readings_list` calls `@api_view`-decorated function directly |
| BUG-22 | views.py | `icontains` lookup on integer `id` field — fails on PostgreSQL |
| BUG-24 | views.py | `download_bill_pdf` (ReportLab) has no URL — unreachable dead code |
| BUG-31 | api.js | API base URL hardcoded to specific machine IP |
| BUG-32 | api.js | `getBillPdfUrl` missing `/api/` prefix |
| BUG-33 | offlineStorage.js | Offline sync date timezone edge case |
| BUG-37 | models.py | No DB-level constraint on `current_reading >= previous_reading` |
| BUG-39 | services.py / views.py | `consumer_number_snapshot` referenced but doesn't exist on model |
| BUG-40 | services.py | `BillingService.generate_bill_pdf()` stub returns dict, not PDF |
| BUG-43 | views.py | `consumer_bills` uses `.get()` without try/except |

### 🟡 LOW — Polish & Code Quality

| Bug ID | File | Summary |
|--------|------|---------|
| BUG-05 | views.py | Login error message reveals whether a username exists |
| BUG-06 | views.py / api.js | Sensitive data printed to console unconditionally |
| BUG-07 | settings.py | COOP security header permanently disabled |
| BUG-17 | views.py | Consumer number generation `while` loop has no iteration limit |
| BUG-19 | views.py | Redundant `is_authenticated` check after `@require_role` |
| BUG-20 | views.py | Dead method check inside `@api_view(['POST'])` function |
| BUG-23 | views.py | SQLite-specific error string used — breaks on PostgreSQL |
| BUG-26 | views.py | `spa_index` reads HTML file from disk on every request |
| BUG-27 | views.py | Old `api_get_bill` function is dead code |
| BUG-34 | AppNavigator.js | Profile tab always shows "Meter Reader" |
| BUG-35 | SubmitReadingScreen.js | Estimate fetch can update state on unmounted component |
| BUG-36 | offlineStorage.js | Excel export uses `savedAt` not `updatedAt` for filtering |
| BUG-38 | models.py | `import random, string` inside `Bill.save()` |
| BUG-42 | serializers.py | `BillSerializer` validation is dead code — no view uses it |
| BUG-45 | models.py | `BillingSettings.__str__` crashes if `updated_at` is `None` |

---

## Recommended Fix Priority Order

### Sprint 1 — Crash Fixes (Do Now)
1. **BUG-28**: Move hooks before early return in `BillPreviewScreen`
2. **BUG-29 + BUG-30**: Fix navigation payload and add null guards for `reading`
3. **BUG-44**: Replace undefined `ConsumerForm` with `ConsumerRegistrationForm`
4. **BUG-10**: Add null guard for `bill.meter_reading` in `finalize_bill()`
5. **BUG-25**: Add lock check in `api_bill_detail` PATCH handler
6. **BUG-39**: Add `consumer_number_snapshot` field to Bill model or fix view reference

### Sprint 2 — Data Integrity (Fix Before Any Real Billing)
7. **BUG-09**: Unify tiered vs flat tariff — pick one formula for all paths
8. **BUG-11**: Delegate edit-reading recalculation to `BillingService.calculate_bill()`
9. **BUG-15 + BUG-16 + BUG-41**: Call `calculate_bill()` after creating bills in all 3 paths
10. **BUG-12 + BUG-13**: Fix `'unpaid'` / `'overdue'` invalid status filters

### Sprint 3 — Security Hardening
11. **BUG-01**: Remove duplicate `REST_FRAMEWORK` block
12. **BUG-02**: Remove hardcoded DB password fallback
13. **BUG-03**: Scope `ALLOWED_HOSTS = ["*"]` to DEBUG only
14. **BUG-05**: Make login error message generic (no username enumeration)
15. **BUG-07**: Scope COOP header disable to DEBUG only

### Sprint 4 — Code Quality Cleanup
16. All 🟡 LOW bugs
