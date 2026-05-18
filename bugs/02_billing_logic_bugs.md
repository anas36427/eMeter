# 💰 Bug Report #2 — Billing Logic & Calculation

> **File scope:** `billing/services.py`, `billing/models.py`, `billing/views.py`

---

## BUG-08 · Bill Number Generated with `random.choices` — Collision Risk

### Severity: 🔴 HIGH

### Location
`billing/models.py` — lines 251–253.

### What's Wrong
The bill number is generated using 8 random decimal digits (`10^8 = 100 million` possibilities). While that sounds large, with thousands of bills per year the probability of collision is real (birthday problem). More critically, **there is no retry loop** — if the random number collides with an existing `bill_number`, the `save()` call will raise an `IntegrityError` (because `bill_number` has `unique=True`) and crash the request, losing the transaction.

```python
def save(self, *args, **kwargs):
    if not self.bill_number:
        import random, string
        self.bill_number = 'BILL' + ''.join(random.choices(string.digits, k=8))
    super().save(*args, **kwargs)  # ← can IntegrityError with no retry
```

### Fix
Add a retry loop with collision detection, and import at the top of the file:

```python
import random, string
from django.db import IntegrityError

def save(self, *args, **kwargs):
    if not self.bill_number:
        for _ in range(10):   # max 10 attempts
            candidate = 'BILL' + ''.join(random.choices(string.digits, k=10))  # 10 digits = 10^10
            if not Bill.objects.filter(bill_number=candidate).exists():
                self.bill_number = candidate
                break
        else:
            raise RuntimeError("Could not generate a unique bill number after 10 attempts.")
    super().save(*args, **kwargs)
```

---

## BUG-09 · Tiered Tariff in `BillingService` Does NOT Match Flat Rate in `api_calculate_estimate`

### Severity: 🔴 HIGH

### Location
- `billing/services.py` — lines 52–59 (tiered)
- `billing/views.py` — lines 1601 (`api_calculate_estimate`, flat rate)

### What's Wrong
The two billing calculation paths use **completely different formulas**:

**`BillingService.calculate_bill()` — tiered tariff:**
```python
# 0-100 units: ₹5, 101-300 units: ₹7, 301+: ₹10
if units <= 100:
    energy_charges = units * 5
elif units <= 300:
    energy_charges = (100 * 5) + ((units - 100) * 7)
else:
    energy_charges = (100 * 5) + (200 * 7) + ((units - 300) * 10)
```

**`api_calculate_estimate()` — flat rate from BillingSettings:**
```python
# Uses live BillingSettings.rate_per_unit (default 8.56) × all units
energy_charges = round(units_consumed * rate_per_unit, 2)
```

This means:
- The **draft bill** shown on the mobile's `BillPreviewScreen` (from `/api/reading-and-bill/` → `BillingService`) uses tiered pricing.
- The **live estimate** shown while the reader is typing (from `/api/calculate-estimate/`) uses a flat rate.
- A consumer with 250 units would see **₹1,650** in the estimate but their **actual bill** would be **₹1,550** — a ₹100 discrepancy.

### Fix
Unify the calculation. Pick **one** approach (tiered is more realistic for electricity billing) and use it everywhere. Extract it into a shared static method:

```python
# In BillingSettings or a utility module
@staticmethod
def calculate_energy_charges(units):
    if units <= 100:
        return units * 5
    elif units <= 300:
        return (100 * 5) + ((units - 100) * 7)
    else:
        return (100 * 5) + (200 * 7) + ((units - 300) * 10)
```

Then call this same function in both `BillingService.calculate_bill()` and `api_calculate_estimate()`.

---

## BUG-10 · `finalize_bill()` Crashes if `bill.meter_reading` is `None`

### Severity: 🔴 HIGH

### Location
`billing/services.py` — lines 91–93.

### What's Wrong
`Bill.meter_reading` is defined as nullable (`null=True, blank=True`). However, `finalize_bill()` reads from it unconditionally without a null check:

```python
reading = bill.meter_reading          # could be None
bill.previous_reading_snapshot = reading.previous_reading   # ← AttributeError: 'NoneType' has no attribute 'previous_reading'
bill.current_reading_snapshot = reading.current_reading     # ← crash
```

Any bill created without a linked `MeterReading` (e.g., via `api_manual_generate_bill`, which does link a reading, but older data or edge cases might not) will crash finalization with an `AttributeError`.

### Fix
Add a null guard:

```python
reading = bill.meter_reading
bill.previous_reading_snapshot = reading.previous_reading if reading else 0
bill.current_reading_snapshot  = reading.current_reading  if reading else 0
bill.units_consumed_snapshot   = bill.units
```

---

## BUG-11 · `api_edit_today_reading` Recalculates `total_amount` Without Duty/Meter Rent

### Severity: 🔴 HIGH

### Location
`billing/views.py` — lines 1779–1789.

### What's Wrong
When a reading is edited and its linked bill is recalculated, the code only adds `energy_charges + fixed_charges + arrears` — it completely **omits duty charge, meter rent, regulatory surcharge, and late payment surcharge**:

```python
linked_bill.energy_charges = units * linked_bill.rate_per_unit
linked_bill.total_amount = linked_bill.energy_charges + linked_bill.fixed_charges + arrears
# ← duty_charge, meter_rent, regulatory_surcharge, late_payment_surcharge all ignored!
linked_bill.save()
```

A bill with 200 units would be **under-charged by the full duty amount (~₹165)** after an edit.

Also, `linked_bill.duty_charge` is not updated to reflect the new `energy_charges` value, so the stored `duty_charge` field is stale even though `total_amount` was recalculated without it.

### Fix
Delegate to `BillingService.calculate_bill()` instead of doing manual arithmetic:

```python
if linked_bill and not linked_bill.is_locked:
    linked_bill.units = reading.units_consumed
    linked_bill.save(update_fields=['units'])
    BillingService.calculate_bill(linked_bill.id)   # recalculates everything correctly
    linked_bill.refresh_from_db()
```

---

## BUG-12 · `api_dashboard_stats` Filters by Status `'unpaid'` — Which Doesn't Exist

### Severity: 🟠 MEDIUM

### Location
`billing/views.py` — line 158.

### What's Wrong
The `Bill.Status` model has four valid choices: `draft`, `finalized`, `paid`, `cancelled`. There is **no `'unpaid'` status**. The pending amount query will always return `None` (→ 0) because it filters on a status value that never exists in the database.

```python
pending_amount = Bill.objects.filter(status='unpaid').aggregate(...)['total'] or 0
# ← always 0, 'unpaid' is not a valid status choice
```

### Fix
Pending bills are those that are `finalized` (locked but not yet paid):

```python
pending_amount = Bill.objects.filter(status='finalized').aggregate(
    total=Sum('total_amount')
)['total'] or 0
```

---

## BUG-13 · `admin_dashboard` HTML View Queries for `'unpaid'` and `'overdue'` Statuses

### Severity: 🟠 MEDIUM

### Location
`billing/views.py` — lines 241–242.

### What's Wrong
The template-rendered admin dashboard counts bills with `status='unpaid'` and `status='overdue'` — neither of which is a valid status in the `Bill.Status` model. These counts will always be `0`, making the dashboard misleading.

```python
unpaid_bills = Bill.objects.filter(status='unpaid').count()   # always 0
overdue_bills = Bill.objects.filter(status='overdue').count() # always 0
```

### Fix
Map to the actual status values:

```python
unpaid_bills  = Bill.objects.filter(status='finalized').count()  # finalized = billed but unpaid
overdue_bills = Bill.objects.filter(
    status='finalized',
    due_date__lt=datetime.now().date()
).count()
```

---

## BUG-14 · `BillingSettings.get_settings()` Silently Returns Default Object on DB Failure

### Severity: 🟠 MEDIUM

### Location
`billing/models.py` — lines 353–369.

### What's Wrong
If the database is unavailable, `get_settings()` catches **all exceptions** (including `OperationalError`, `ProgrammingError`) and returns a `_Defaults` dummy object. The `print()` call is the only signal of failure — there is no logging, no alerting, no metrics increment. Bills calculated during a DB outage will silently use hardcoded defaults (e.g. `rate_per_unit = 8.56`) instead of the configured rates, potentially billing consumers incorrectly without anyone noticing.

```python
except Exception as exc:
    print(f"ERROR: BillingSettings unavailable — using defaults. ({exc})")
    # ... returns _Defaults with hardcoded values silently
```

### Fix
Use `logging` (not `print`) and raise the exception in contexts where silent fallback is unacceptable (e.g., bill finalization):

```python
import logging
logger = logging.getLogger(__name__)

except Exception as exc:
    logger.error("BillingSettings unavailable — using defaults.", exc_info=True)
    # If called during finalization, re-raise; otherwise, fallback is acceptable for estimates
    return _Defaults()
```

---

## BUG-15 · `generate_bill` HTML View Creates a Bill Without Calculating Charges

### Severity: 🟠 MEDIUM

### Location
`billing/views.py` — lines 366–374.

### What's Wrong
The legacy template-based `generate_bill` view creates a `Bill` object with only `units`, `rate_per_unit`, `fixed_charges`, `billing_period`, and `due_date` set. Fields like `energy_charges`, `duty_charge`, `meter_rent`, `regulatory_surcharge`, and `total_amount` are left at their model defaults of `0`. The bill is then immediately offered as a PDF download with a `total_amount` of **₹0**.

```python
bill = Bill.objects.create(
    consumer=consumer,
    meter_reading=meter_reading,
    units=units,
    rate_per_unit=rate,
    fixed_charges=fixed_charges,
    billing_period=billing_period,
    due_date=due_date
    # ← energy_charges=0, duty_charge=0, total_amount=0 by default
)
```

### Fix
Call `BillingService.calculate_bill(bill.id)` immediately after creation:

```python
bill = Bill.objects.create(...)
BillingService.calculate_bill(bill.id)
bill.refresh_from_db()
# now bill.total_amount is correct
```

---

## BUG-16 · `api_manual_generate_bill` Also Creates Bill Without Calculating Charges

### Severity: 🟠 MEDIUM

### Location
`billing/views.py` — lines 1945–1951.

### What's Wrong
Same issue as BUG-15 — the manual bill generation API endpoint creates a `Bill` record but never calls `BillingService.calculate_bill()`. The created bill will have `total_amount = 0` until someone manually triggers finalization or recalculation.

```python
bill = Bill.objects.create(
    consumer=consumer,
    meter_reading=reading,
    units=reading.units_consumed,
    billing_period=billing_period,
    due_date=due_date
)
# total_amount is 0 — bill is essentially empty
```

### Fix
```python
bill = Bill.objects.create(...)
BillingService.calculate_bill(bill.id)
bill.refresh_from_db()
```

---

## BUG-17 · Consumer Number Auto-Generation Has Infinite Loop Risk

### Severity: 🟡 LOW

### Location
`billing/views.py` — lines 769–770.

### What's Wrong
The consumer number auto-generation uses a `while` loop with no iteration limit:

```python
consumer_number = 'CN' + ''.join(random.choices(string.digits, k=6))
while Consumer.objects.filter(consumer_number=consumer_number).exists():
    consumer_number = 'CN' + ''.join(random.choices(string.digits, k=6))
```

With 6 digits (`10^6 = 1,000,000` possibilities) and a database of under 10,000 consumers the probability is negligible — but the code has no escape hatch if something goes wrong (e.g. all numbers exhausted).

### Fix
```python
for attempt in range(100):
    consumer_number = 'CN' + ''.join(random.choices(string.digits, k=8))  # 8 digits
    if not Consumer.objects.filter(consumer_number=consumer_number).exists():
        break
else:
    raise ValueError("Could not generate a unique consumer number.")
```

---

## Summary Table

| Bug ID | Severity | One-Line Summary |
|--------|----------|-----------------|
| BUG-08 | 🔴 HIGH | Bill number collision — no retry loop on `IntegrityError` |
| BUG-09 | 🔴 HIGH | Tiered tariff vs flat rate mismatch between estimate and actual bill |
| BUG-10 | 🔴 HIGH | `finalize_bill()` crashes if `meter_reading` is `None` |
| BUG-11 | 🔴 HIGH | Edit reading recalculates `total_amount` without duty/meter rent |
| BUG-12 | 🟠 MEDIUM | Dashboard stats filter by `'unpaid'` — invalid status, always 0 |
| BUG-13 | 🟠 MEDIUM | HTML dashboard counts `'unpaid'` and `'overdue'` — both invalid statuses |
| BUG-14 | 🟠 MEDIUM | `BillingSettings` failure logged with `print()` not `logging` |
| BUG-15 | 🟠 MEDIUM | `generate_bill` HTML view creates bill with `total_amount = 0` |
| BUG-16 | 🟠 MEDIUM | `api_manual_generate_bill` creates bill with `total_amount = 0` |
| BUG-17 | 🟡 LOW | Consumer number generation `while` loop has no iteration limit |
