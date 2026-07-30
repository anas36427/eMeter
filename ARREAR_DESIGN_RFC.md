# RFC: Late Payment Arrear / Surcharge System
**Project:** eMeter — AMU Electricity Management System  
**Status:** 🟡 Proposed  
**Date:** 2026-07-28  
**Author:** Engineering Team

---

## 1. Problem Statement

Currently, when a consumer does not pay an electricity bill by its due date, there is **no automated financial consequence**. The system needs a mechanism to:

1. Detect unpaid or overdue bills.
2. Apply a configurable Late Payment Surcharge (LPS) — currently fixed at **1.5% per billing cycle**.
3. Carry forward this penalty into future billing in a way that is **auditable**, **immutable**, and **resistant to manual tampering**.

---

## 2. Existing System State

The `Bill` model **already has** the following relevant fields:

| Field | Type | Current Use |
|---|---|---|
| `arrears` | `DecimalField` | Manually set at time of bill creation |
| `late_payment_surcharge` | `DecimalField` | Computed as `arrears × 1.5%` during calculation |
| `due_date` | `DateField` | Bill due date |
| `status` | `CharField` | `draft / issued / paid / overdue / cancelled` |
| `total_amount_snapshot` | `FloatField` | Immutable total at time of finalization |

The `BillingSettings` model has:

| Field | Type | Current Value |
|---|---|---|
| `phase_1_rent` | `DecimalField` | 10.0 |
| `phase_3_rent` | `DecimalField` | 25.0 |
| *(missing)* | — | **No `lps_rate` field yet** |

> **Gap:** LPS rate is hardcoded as `0.015` in `services.py`. It must be moved to `BillingSettings` to be admin-configurable.

---

## 3. Option Analysis

### Option 1 — Carry Arrear Forward in the Next Bill (Recommended Baseline)

**How it works:**  
When a new reading is submitted for a consumer, the system checks for any unpaid prior bills. The outstanding principal is brought forward as `arrears` in the new bill. An additional `late_payment_surcharge = arrears × lps_rate%` is computed and added on top.

```
New Bill Total = Current Month Charges + Unpaid Principal + (Unpaid Principal × LPS%)
```

**Compounding scenario:**  
If the consumer still doesn't pay, next month:

```
New Bill Total = Current Month Charges
              + (Prev Month Charges + LPS₁)          ← full previous outstanding
              + (Prev Month Charges + LPS₁) × LPS%   ← compounded LPS
```

**Advantages:**
- ✅ Perfectly aligned with WAPDA/UPPCL utility billing conventions in Pakistan/India.
- ✅ Each bill remains immutable. Arrear is a **new field in the new bill**, not a mutation of the old one.
- ✅ New bill PDF clearly shows both the current charges and the forwarded arrear as separate line items.
- ✅ No retroactive modification of finalized bills.
- ✅ Fully auditable: you can trace arrear lineage bill-by-bill.
- ✅ Works with the existing `arrears` and `late_payment_surcharge` fields already on the `Bill` model.

**Disadvantages:**
- ⚠️ Requires a "resolve unpaid bills" step during `generate_final_bill` to compute forwarded arrear amount before saving.

---

### Option 2 — Add Surcharge Within the Same Bill (Avoid)

**How it works:**  
Modify the original locked bill in-place once the due date is crossed: recalculate `late_payment_surcharge` and update `total_amount`.

**Why this is wrong:**
- ❌ Directly violates the **Immutable Bill Architecture** already in place.
- ❌ The `Bill.save()` model protection will **throw `ValidationError`** if any protected field is mutated on a locked bill.
- ❌ A printed/downloaded bill from before the due date will differ from the actual amount owed, creating disputes.
- ❌ Audit trails would be poisoned since historical PDF and DB amount would diverge.

**Verdict: 🔴 Not feasible without gutting the snapshot architecture.**

---

### Option 3 — Manual Arrear Entry at Payment Time

**How it works:**  
When an admin processes a payment, they see an input field to manually type a late fee. This overrides the computed amount.

**Advantages:**
- ✅ Flexible for one-off negotiated settlements.
- ✅ Simple to implement.

**Disadvantages:**
- ❌ Error-prone: different admins may apply different rates.
- ❌ Not auditable enough unless each manual entry is logged.
- ❌ Can be abused (waving fees without authorization).
- ❌ Does not scale as consumer base grows.

**Verdict: 🟡 Acceptable only as a supplementary override, not the primary mechanism.**

---

### Option 4 — Automatic LPS Applied at Payment Scan Time (Event-Driven)

**How it works:**  
When an admin opens the bill to process payment:
1. System checks `date.today() > bill.due_date`.
2. Computes months overdue: `Δt = floor((today - due_date).days / 30)`.
3. Applies compounded LPS: `lps_total = principal × ((1 + lps_rate)^Δt - 1)`.
4. Presents the adjusted total to the admin on the payment screen **without modifying the bill record**.
5. On payment confirmation, logs `paid_amount = original_total + lps_total` against the bill.

**Advantages:**
- ✅ Does not mutate locked bills.
- ✅ Real-time, accurate compounding.
- ✅ Configurable via `BillingSettings.lps_rate`.

**Disadvantages:**
- ⚠️ LPS is computed ephemerally at payment time — consumer cannot see the growing amount between billing cycles unless a dedicated "overdue summary" view is built.
- ⚠️ If payment is split or partial, tracking becomes complex.

**Verdict: 🟢 Excellent for the payment gateway UI. Should complement Option 1, not replace it.**

---

### Option 5 — Recommended Optimal Hybrid Approach

#### Architecture: **Carry-Forward Arrear (Option 1) + Payment-Time LPS Display (Option 4)**

This is the approach used by WAPDA, APEPDCL, UPPCL, and most South Asian electricity utilities.

```
┌─────────────────────────────────────────────────────────────────┐
│                      BILLING LIFECYCLE                          │
│                                                                 │
│  [Reading Taken]                                                │
│       │                                                         │
│       ▼                                                         │
│  [generate_final_bill()]                                        │
│       │ Check for unpaid prior bills for this consumer          │
│       │ unpaid_total = sum(bill.total_amount for unpaid bills)  │
│       │ lps = unpaid_total × (lps_rate / 100)                  │
│       │ new_bill.arrears = unpaid_total                         │
│       │ new_bill.late_payment_surcharge = lps                   │
│       │ new_bill.total_amount = current_charges + arrears + lps │
│       ▼                                                         │
│  [New Bill Issued & Locked]  ──────────────────────────────┐   │
│       │                                                     │   │
│       ▼                                                     │   │
│  [Consumer Pays on Time] → Mark as PAID                    │   │
│       OR                                                    │   │
│  [Consumer Doesn't Pay] → Bill stays ISSUED/OVERDUE        │   │
│       │                                                     │   │
│       └───────── Forwarded as arrear in NEXT billing ──────┘   │
│                                                                 │
│  [Payment UI — Optional Option 4 overlay]                       │
│       │ If today > due_date:                                    │
│       │   Show: "Live LPS accruing: ₹XX.XX"                    │
│       │   Admin sees exact amount to collect today              │
│       │   Logs paid_amount with the calculated surcharge        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Implementation Plan

### Phase A — Settings Enhancement

**File:** `billing/models.py` → `BillingSettings`

Add:
```python
lps_rate = models.DecimalField(
    max_digits=5, decimal_places=2, default=Decimal('1.50'),
    help_text="Late Payment Surcharge rate in % applied per billing cycle on outstanding principal."
)
```

**File:** `billing/views.py` → `/api/settings/` and `/api/settings/update/`

Expose `lps_rate` in GET and PATCH handlers.

---

### Phase B — Carry-Forward Logic in `generate_final_bill`

**File:** `billing/services.py`

```python
# Inside generate_final_bill(), BEFORE bill.save():

unpaid_bills = Bill.objects.filter(
    consumer=consumer,
    status__in=['issued', 'overdue'],
    is_locked=True
).exclude(id=bill.id)

unpaid_principal = sum(
    float(b.total_amount_snapshot or b.total_amount) - float(b.paid_amount or 0)
    for b in unpaid_bills
)

lps_rate = Decimal(str(BillingSettings.get_settings().lps_rate)) / Decimal('100')
lps_amount = round(Decimal(str(unpaid_principal)) * lps_rate, 2)

bill.arrears              = Decimal(str(unpaid_principal))
bill.late_payment_surcharge = lps_amount
```

The `calculate_bill()` call that follows will pick up these fields and include them in `total_amount`.

---

### Phase C — Status Automation (Cron / Management Command)

Mark bills as `overdue` automatically after `due_date` passes.

**File:** `billing/management/commands/mark_overdue_bills.py`

```python
from django.core.management.base import BaseCommand
from django.utils import timezone
from billing.models import Bill

class Command(BaseCommand):
    help = 'Mark issued bills as overdue when past their due date'

    def handle(self, *args, **options):
        overdue = Bill.objects.filter(
            status='issued',
            due_date__lt=timezone.now().date()
        )
        count = overdue.update(status='overdue')
        self.stdout.write(f'Marked {count} bills as overdue.')
```

Deploy via cron or Django-Q scheduled task.

---

### Phase D — Payment UI LPS Overlay (Option 4 supplement)

**File:** `energy-hub-ui/src/pages/Billing.tsx`

When `bill.status === 'overdue'` and `today > due_date`:

```typescript
const daysLate = differenceInDays(new Date(), new Date(bill.due_date));
const monthsLate = Math.floor(daysLate / 30);
const liveCompoundedLPS = bill.total_amount * (Math.pow(1 + lpsRate / 100, monthsLate) - 1);
```

Display this as a live-updating warning on the payment screen so the admin can see the exact amount to collect on the day of payment.

---

## 5. Summary Comparison Table

| Option | Mutates Locked Bills? | Auditable? | Scalable? | Recommended? |
|---|---|---|---|---|
| 1. Carry Forward in Next Bill | ❌ No | ✅ Yes | ✅ Yes | ✅ **Primary** |
| 2. Modify Same Bill | ✅ Yes (illegal) | ❌ No | ❌ No | 🔴 Avoid |
| 3. Manual at Payment | ❌ No | ⚠️ Partial | ❌ No | 🟡 Supplementary Override |
| 4. Auto LPS at Payment Scan | ❌ No | ✅ Yes | ✅ Yes | ✅ **Complementary** |
| **5. Hybrid (1 + 4)** | ❌ No | ✅ Yes | ✅ Yes | ✅ **Optimal — Implement This** |

---

## 6. Open Questions for Stakeholder Review

> [!IMPORTANT]
> The following need a decision before implementation begins:

1. **Compounding:** Should LPS be **simple** (1.5% of original unpaid principal only) or **compound** (1.5% on the growing outstanding balance each month)? Most utility companies use **simple** for transparency.
2. **Grace Period:** Should there be a grace period (e.g., 7 days after due date) before LPS starts accruing?
3. **Waiver Authority:** Can an admin waive LPS for a consumer? If yes, should it require a reason/log entry?
4. **Partial Payment:** If a consumer pays ₹500 on a ₹1200 bill, how is the remaining ₹700 carried forward — with or without compounding on the partial balance?
5. **Consumer Notification:** Should the consumer portal display a live "You will owe ₹X if you pay after [date]" warning?
6. **Historical Bills:** Existing unpaid bills in the system have no `lps_rate` snapshot. Should they use the current `BillingSettings.lps_rate` or default to `1.5%`?

---

## 7. Migration Path

No breaking database migrations are required. Adding `lps_rate` to `BillingSettings` requires:

```bash
python3 manage.py makemigrations billing
python3 manage.py migrate
```

The `arrears` and `late_payment_surcharge` fields on `Bill` are already present. No changes to the bill schema are needed.

---

*This document should be reviewed and approved before any code changes are committed.*
