# 🗃️ Bug Report #5 — Data Model, Services & Miscellaneous Issues

> **File scope:** `billing/models.py`, `billing/services.py`, `billing/serializers.py`, `billing/views.py` (Excel import, PDF)

---

## BUG-37 · `MeterReading.save()` Allows Negative `units_consumed` in Edge Cases

### Severity: 🟠 MEDIUM

### Location
`billing/models.py` — line 168.

### What's Wrong
The `save()` method clamps `units_consumed` to `max(0.0, ...)`, which prevents negative values in the stored field. However, the validation in `BillingService.validate_reading()` already rejects readings where `current_reading < previous_reading`. The disconnect is: if a `MeterReading` is created **directly** (bypassing `BillingService`), with a lower current than previous reading, the `units_consumed` will be saved as `0` — silently masking a data entry error rather than rejecting it.

For example, the `api_manual_generate_bill` view creates readings with no validation at all:
```python
reading = MeterReading.objects.create(
    consumer=consumer,
    previous_reading=previous_reading,
    current_reading=current_reading,   # validated only as >= previous upstream
    ...
)
```
But the HTML `generate_bill` view also creates readings without calling `BillingService.validate_reading()` first.

### Fix
Add a model-level constraint to enforce `current_reading >= previous_reading` at the database level:

```python
from django.db.models import CheckConstraint, F, Q

class Meta:
    constraints = [
        CheckConstraint(
            check=Q(current_reading__gte=F('previous_reading')),
            name='reading_current_gte_previous',
        )
    ]
```

This enforces the invariant at the DB level regardless of which code path creates the record.

---

## BUG-38 · `Bill.save()` Imports `random` and `string` Inside the Method on Every Call

### Severity: 🟡 LOW

### Location
`billing/models.py` — lines 251–253.

### What's Wrong
Python caches module imports, so functionally this is not a performance problem. However, placing `import` statements inside a function body is considered poor style and makes the code harder to read and audit. It also means the import is re-evaluated (albeit from cache) on every single `Bill.save()` call.

```python
def save(self, *args, **kwargs):
    if not self.bill_number:
        import random, string    # ← import inside method
        self.bill_number = 'BILL' + ''.join(random.choices(string.digits, k=8))
```

### Fix
Move imports to the top of `models.py`:

```python
import random
import string
```

---

## BUG-39 · `BillingService.finalize_bill()` Does Not Store `consumer_number_snapshot`

### Severity: 🟠 MEDIUM

### Location
`billing/services.py` — lines 91–107.

### What's Wrong
`Bill` has a field `consumer_name_snapshot` and `meter_number_snapshot` — but no `consumer_number_snapshot` field. When the PDF is generated for a locked bill, the `api_get_bill_pdf` view falls back to `bill.consumer_number_snapshot or bill.consumer.consumer_number` (line 1841 of views.py):

```python
'consumer_number': bill.consumer_number_snapshot or bill.consumer.consumer_number,
```

Since `consumer_number_snapshot` does not exist on the model, `bill.consumer_number_snapshot` will raise an `AttributeError` at runtime when generating a locked bill PDF. This is a critical crash path.

**In the model definition (models.py):** There is no `consumer_number_snapshot` field — only `consumer_name_snapshot` and `meter_number_snapshot`.

### Fix — Two options:

**Option A:** Add `consumer_number_snapshot` to the `Bill` model:
```python
consumer_number_snapshot = models.CharField(max_length=20, null=True, blank=True)
```
And populate it in `finalize_bill()`:
```python
bill.consumer_number_snapshot = bill.consumer.consumer_number
```

**Option B:** In `api_get_bill_pdf`, use `bill.consumer.consumer_number` directly (safe — consumer relationship is always available):
```python
'consumer_number': bill.consumer.consumer_number,
```

---

## BUG-40 · `BillingService.generate_bill_pdf()` Is a Stub — Returns a Dict, Not a PDF

### Severity: 🟠 MEDIUM

### Location
`billing/services.py` — lines 117–140.

### What's Wrong
The `BillingService.generate_bill_pdf()` method has a docstring saying it "generates PDF using snapshot data" but its implementation **returns a plain Python dictionary** instead of actual PDF bytes:

```python
@staticmethod
def generate_bill_pdf(bill_id):
    """Generate PDF using snapshot data"""
    ...
    snapshot_data = {
        'bill_number': bill.bill_number,
        ...
    }
    # Real PDF generation logic (e.g. using WeasyPrint or ReportLab)
    # This calls the existing generator but ensures it uses snapshots.
    return snapshot_data   # ← returns a dict, not a PDF!
```

This function is not called anywhere in the active code paths (the real PDF generation is done by `BillPDFGenerator.generate_bill_pdf()` in `pdf_generator.py`). However, it is misleading, poorly named, and any future developer who calls `BillingService.generate_bill_pdf(bill_id)` expecting PDF bytes will get a dictionary instead.

### Fix
Either complete the implementation or rename/remove the stub:

```python
@staticmethod
def generate_bill_pdf(bill_id):
    """Returns snapshot data dict for use by BillPDFGenerator."""
    bill = Bill.objects.get(id=bill_id)
    if not bill.is_locked:
        raise ValidationError("PDF can only be generated for finalized bills.")
    snapshot_data = { ... }
    # Delegate to the actual PDF generator
    from .pdf_generator import BillPDFGenerator
    return BillPDFGenerator.generate_bill_pdf(snapshot_data)
```

---

## BUG-41 · Excel Import Creates Bill With `total_amount = 0` (Missing `calculate_bill` call)

### Severity: 🔴 HIGH

### Location
`billing/views.py` — lines 2145–2152.

### What's Wrong
The Excel import creates a `Bill` object but never calls `BillingService.calculate_bill()`. Every imported bill will have `total_amount = 0`, `energy_charges = 0`, etc. This is the same issue as BUG-15 and BUG-16 but for the Excel import path.

```python
bill = Bill.objects.create(
    consumer=consumer,
    meter_reading=reading_obj,
    units=units_consumed,
    billing_period=billing_month,
    due_date=due_date,
)
# ← BillingService.calculate_bill(bill.id) is never called!
bills_created.append({
    ...
    'total_amount': float(bill.total_amount or 0),   # ← always 0
})
```

### Fix
```python
bill = Bill.objects.create(...)
BillingService.calculate_bill(bill.id)
bill.refresh_from_db()

bills_created.append({
    ...
    'total_amount': float(bill.total_amount or 0),   # ← now correct
})
```

---

## BUG-42 · `BillSerializer` Validates Locked Fields but Is Not Used by Any View

### Severity: 🟡 LOW

### Location
`billing/serializers.py` — lines 39–59.

### What's Wrong
`BillSerializer` has sophisticated validation logic that prevents modification of financial fields on locked bills. However, none of the active API views (`api_bill_detail`, `api_mark_bill_paid`, `api_finalize_bill`, etc.) actually use this serializer — they all operate directly on the `Bill` model object. The serializer validation is effectively dead code.

```python
class BillSerializer(serializers.ModelSerializer):
    def validate(self, data):
        if self.instance and self.instance.is_locked:
            # This validation logic never runs because no view uses this serializer
```

### Fix
Either wire the serializer into the relevant views (replacing raw `json.loads` + `bill.save()` patterns) or document clearly that the serializer is reserved for future use. Using the serializer properly would also fix BUG-25.

---

## BUG-43 · `consumer_dashboard` HTML View Catches Wrong Exception Type

### Severity: 🟡 LOW

### Location
`billing/views.py` — line 461.

### What's Wrong
The view catches `Consumer.DoesNotExist` when accessing `request.user.consumer`:

```python
try:
    consumer = request.user.consumer
except Consumer.DoesNotExist:
    consumer = Consumer.objects.filter(email=request.user.email).first()
```

But `request.user.consumer` uses a `OneToOneField` reverse relation. Django raises `RelatedObjectDoesNotExist` for a missing reverse OneToOne — which is a subclass of `Consumer.DoesNotExist`, so this actually works. However, the second path calls `Consumer.objects.get(email=...)` in `consumer_bills`:

```python
# billing/views.py line 511:
consumer = Consumer.objects.get(email=request.user.email)
```

If no consumer has that email, this raises `Consumer.DoesNotExist` which is **not caught**, causing a 500 error. The `consumer_dashboard` view uses `.first()` (safe), but `consumer_bills` uses `.get()` (unsafe).

### Fix in `consumer_bills`:
```python
try:
    consumer = request.user.consumer_profile  # correct related_name from model
except Consumer.DoesNotExist:
    consumer = Consumer.objects.filter(email=request.user.email).first()
    if not consumer:
        return redirect('login')
```

---

## BUG-44 · `add_consumer` HTML View References `ConsumerForm` Which Is Not Imported

### Severity: 🔴 HIGH (Runtime Error)

### Location
`billing/views.py` — lines 308–315.

### What's Wrong
The `add_consumer` view uses `ConsumerForm`:

```python
@login_required
def add_consumer(request):
    if request.method == 'POST':
        form = ConsumerForm(request.POST)   # ← ConsumerForm is not imported!
```

Looking at the imports at the top of `views.py` — only `ConsumerRegistrationForm` is imported from `billing/forms.py` (line 31). `ConsumerForm` is **never defined or imported** anywhere. Any request to this view will raise a `NameError: name 'ConsumerForm' is not defined`.

### Fix
Replace `ConsumerForm` with the correct import:
```python
from .forms import ConsumerRegistrationForm

# In the view:
form = ConsumerRegistrationForm(request.POST)
```
Or add a `ConsumerForm` class to `forms.py` if it's meant to be a different form.

---

## BUG-45 · `BillingSettings` `updated_at` Format Crashes If `updated_at` Is `None`

### Severity: 🟡 LOW

### Location
`billing/models.py` — line 348.

### What's Wrong
The `__str__` method formats `self.updated_at` using a strftime-style format code:

```python
def __str__(self):
    return f"Billing Settings (updated {self.updated_at:%Y-%m-%d})"
```

But the `_Defaults` fallback object returned by `get_settings()` on DB failure sets `updated_at = None`. If Django admin or any code that calls `str(settings_obj)` receives the fallback object, this will crash with `TypeError: 'NoneType' object cannot be interpreted as a date`.

### Fix
```python
def __str__(self):
    date_str = self.updated_at.strftime('%Y-%m-%d') if self.updated_at else 'N/A'
    return f"Billing Settings (updated {date_str})"
```

---

## Summary Table

| Bug ID | Severity | One-Line Summary |
|--------|----------|-----------------|
| BUG-37 | 🟠 MEDIUM | No DB-level constraint on `current_reading >= previous_reading` |
| BUG-38 | 🟡 LOW | `import random, string` inside `Bill.save()` — should be at module level |
| BUG-39 | 🟠 MEDIUM | `consumer_number_snapshot` referenced in view but does not exist on model → `AttributeError` |
| BUG-40 | 🟠 MEDIUM | `BillingService.generate_bill_pdf()` is a stub returning a dict, not PDF bytes |
| BUG-41 | 🔴 HIGH | Excel import creates bills without calling `calculate_bill` — `total_amount = 0` |
| BUG-42 | 🟡 LOW | `BillSerializer` validation is dead code — no active view uses it |
| BUG-43 | 🟡 LOW | `consumer_bills` uses `.get()` without try/except — 500 on missing consumer |
| BUG-44 | 🔴 HIGH | `add_consumer` view references undefined `ConsumerForm` — `NameError` crash |
| BUG-45 | 🟡 LOW | `BillingSettings.__str__` crashes if `updated_at` is `None` |
