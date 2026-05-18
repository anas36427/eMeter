# 🌐 Bug Report #3 — API Views & Endpoint Issues

> **File scope:** `billing/views.py`, `billing/urls.py`, `electricity_system/urls.py`

---

## BUG-18 · Two Duplicate URL Patterns for Consumer Detail

### Severity: 🟠 MEDIUM

### Location
`billing/urls.py` — lines 20 and 22.

### What's Wrong
The same view (`api_consumer_detail`) is registered under **two different URL patterns**:

```python
path('consumers/<int:consumer_id>/', views.api_consumer_detail, name='api_consumer_detail'),
path('consumer/<int:consumer_id>/',  views.api_consumer_detail, name='api_get_consumer'),
```

- `/api/consumers/<id>/` (plural)
- `/api/consumer/<id>/` (singular)

Both resolve to the same view. This is confusing for API consumers, increases maintenance burden, and wastes URL namespace. The `api_get_consumer` name in `billing/views.py` also shadows `api_consumer_detail` in Django's URL resolver, making `reverse('api_get_consumer')` and `reverse('api_consumer_detail')` both work for the same resource.

### Fix
Pick one canonical URL (the plural `consumers/<id>/` is REST-standard) and remove the other. Update the mobile `api.js` to use the canonical URL:

```python
# Keep only:
path('consumers/<int:consumer_id>/', views.api_consumer_detail, name='api_consumer_detail'),
```

In `eMeterApp/src/services/api.js`:
```javascript
// Change:
const response = await api.get(`/api/consumer/${consumerId}/`);
// To:
const response = await api.get(`/api/consumers/${consumerId}/`);
```

---

## BUG-19 · `api_dashboard_stats` Has a Redundant Auth Check After Role Decorator

### Severity: 🟡 LOW

### Location
`billing/views.py` — lines 143–148.

### What's Wrong
The view has `@require_role('admin')` which already guarantees the user is authenticated and has the correct role. However, the first line of the function body re-checks `if not request.user.is_authenticated` — a condition that can never be true at that point.

```python
@api_view(['GET'])
@require_role('admin')
def api_dashboard_stats(request):
    if not request.user.is_authenticated:   # ← dead code — @require_role already ensures this
        return JsonResponse({'detail': 'Authentication required'}, status=401)
```

### Fix
Remove the redundant check:

```python
@api_view(['GET'])
@require_role('admin')
def api_dashboard_stats(request):
    now = timezone.now()
    # ... rest of the function
```

---

## BUG-20 · `api_send_bill_sms` Has a Dead Method Check (View is Already Restricted to POST by DRF)

### Severity: 🟡 LOW

### Location
`billing/views.py` — lines 1641–1645.

### What's Wrong
The view is decorated with `@api_view(['POST'])`, which means DRF already returns a `405 Method Not Allowed` for non-POST requests. The manual check inside the function is therefore dead code that will never execute:

```python
@api_view(['POST'])
@require_role('admin', 'meter_reader')
def api_send_bill_sms(request):
    if request.method != 'POST':              # ← can never be true; @api_view(['POST']) already blocks this
        return JsonResponse({'detail': 'Method not allowed'}, status=405)
```

### Fix
Remove the dead check:

```python
@api_view(['POST'])
@require_role('admin', 'meter_reader')
def api_send_bill_sms(request):
    try:
        data = json.loads(request.body)
        ...
```

---

## BUG-21 · `api_submit_reading` (POST Handler in `api_readings_list`) Is Called Incorrectly

### Severity: 🟠 MEDIUM

### Location
`billing/views.py` — lines 1087–1088.

### What's Wrong
`api_readings_list` handles `POST` by calling `api_submit_reading(request)` as a regular Python function. However, `api_submit_reading` is itself decorated with `@api_view(['POST'])`. Calling a DRF `@api_view`-decorated function directly from another view **does not reinitialise the DRF request wrapper** — the inner view receives the DRF `Request` object but may process it incorrectly because `@api_view` sets up its own request parsing and response handling that doesn't compose with nested calls.

```python
@api_view(['GET', 'POST'])
@require_role('admin', 'meter_reader')
def api_readings_list(request):
    if request.method == 'GET':
        ...
    if request.method == 'POST':
        return api_submit_reading(request)   # ← calling @api_view decorated function directly
```

### Fix
Either duplicate the POST logic inline (which avoids the decorator collision), or extract the shared logic into a plain helper function:

```python
def _do_submit_reading(request):
    """Shared logic, no decorators."""
    ...

@api_view(['GET', 'POST'])
@require_role('admin', 'meter_reader')
def api_readings_list(request):
    if request.method == 'GET':
        ...
    if request.method == 'POST':
        return _do_submit_reading(request)

@api_view(['POST'])
@require_role('admin', 'meter_reader')
def api_submit_reading(request):
    return _do_submit_reading(request)
```

---

## BUG-22 · `api_consumer_search` Uses `Q(id__icontains=...)` — Invalid Lookup for Integer Field

### Severity: 🟠 MEDIUM

### Location
`billing/views.py` — line 1036.

### What's Wrong
`icontains` is a text (case-insensitive substring) lookup. Django's `id` field is an integer. Using `icontains` on an integer field will raise a `django.core.exceptions.FieldError` or `DataError` on **PostgreSQL** (it requires an explicit cast). The fallback `'0'` when `query.isdigit()` is `False` means non-numeric queries quietly skip the ID filter — but numeric queries will likely fail on PostgreSQL.

```python
Q(id__icontains=query if query.isdigit() else '0')
```

### Fix
Use an exact integer lookup when the query is a digit:

```python
q_filter = Q(meter_number__icontains=query) | Q(name__icontains=query) | Q(consumer_number__icontains=query)
if query.isdigit():
    q_filter |= Q(id=int(query))
consumers = Consumer.objects.filter(q_filter)
```

---

## BUG-23 · `api_consumer_search` Has a Fragile Exception Handler for Missing Columns

### Severity: 🟡 LOW

### Location
`billing/views.py` — lines 1039–1044.

### What's Wrong
The code tries to catch a missing-column database error by checking if the string `'no such column'` appears in the exception message — a string that is **SQLite-specific**. On PostgreSQL (the production database), the error message for a missing column is `"column ... does not exist"`. This catch block will silently miss the error on PostgreSQL, causing an unhandled exception.

```python
except Exception as e:
    if 'no such column' in str(e):           # ← SQLite only!
        consumers = consumers.defer('load_kw', 'meter_type')
    else:
        raise e
```

### Fix
Either remove this workaround (the columns should always exist after migrations run) or handle both databases:

```python
except Exception as e:
    err = str(e).lower()
    if 'no such column' in err or 'does not exist' in err:
        consumers = consumers.defer('load_kw', 'meter_type')
    else:
        raise
```

---

## BUG-24 · `download_bill_pdf` (ReportLab) Is Unreachable — No URL Pattern Points to It

### Severity: 🟠 MEDIUM

### Location
`billing/views.py` — line 1229, `billing/urls.py`.

### What's Wrong
There is a full ReportLab-based PDF generator function `download_bill_pdf(request, bill_id)` defined at line 1229 of `views.py`. However, there is **no URL pattern** in `billing/urls.py` that maps to this function. The endpoint is effectively dead code — it can never be called by any client.

The registered PDF endpoint is `/api/bill/<id>/pdf/` which maps to `api_get_bill_pdf` (line 1825), a completely different function using `xhtml2pdf`.

### Fix
Either:
1. Register a URL for `download_bill_pdf` if both PDF styles are intentionally available:
   ```python
   path('bill/<int:bill_id>/pdf/reportlab/', views.download_bill_pdf, name='download_bill_pdf_reportlab'),
   ```
2. Or delete `download_bill_pdf` entirely since `api_get_bill_pdf` already handles PDF download.

---

## BUG-25 · `api_bill_detail` PATCH Does Not Validate Locked Bill

### Severity: 🔴 HIGH

### Location
`billing/views.py` — lines 1129–1136.

### What's Wrong
The `PATCH` handler on `api_bill_detail` allows updating `bill.status` directly **without checking if the bill is locked**. A finalized (`is_locked=True`) bill can have its status changed (e.g., back to `draft`) by sending a PATCH request, bypassing the immutability guarantees that `BillingService.finalize_bill()` is designed to enforce.

```python
if request.method == 'PATCH':
    data = json.loads(request.body)
    if 'status' in data:
        bill.status = data['status']        # ← no lock check!
        if data['status'] == 'paid':
            bill.paid_date = datetime.now().date()
        bill.save()                         # ← saves on a locked bill
```

### Fix
Add a lock check before allowing status changes:

```python
if request.method == 'PATCH':
    data = json.loads(request.body)
    if 'status' in data:
        new_status = data['status']
        if bill.is_locked and new_status not in ['paid', 'cancelled']:
            return JsonResponse(
                {'error': 'Locked bills can only be marked as paid or cancelled.'},
                status=400
            )
        bill.status = new_status
        if new_status == 'paid':
            bill.paid_date = datetime.now().date()
        bill.save()
    return JsonResponse({'success': True})
```

---

## BUG-26 · `spa_index` Reads the Entire `index.html` File Into Memory for Every Request

### Severity: 🟡 LOW

### Location
`billing/views.py` — lines 1387–1401.

### What's Wrong
The SPA catch-all view opens and reads the entire `index.html` file from disk on **every single request** — including every API polling interval. For a high-traffic system this is wasteful. There is no caching at all.

```python
def spa_index(request, path=None):
    with open(index_path, 'r', encoding='utf-8') as f:
        content = f.read()          # ← disk read on every request
        return HttpResponse(content)
```

### Fix
Cache the file content in a module-level variable after the first read (simple in-memory cache):

```python
_SPA_INDEX_CACHE = None

def spa_index(request, path=None):
    global _SPA_INDEX_CACHE
    if _SPA_INDEX_CACHE is None:
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                _SPA_INDEX_CACHE = f.read()
        except FileNotFoundError:
            return HttpResponse("Vite build not found. Run 'npm run build'.", status=404)
    return HttpResponse(_SPA_INDEX_CACHE, content_type='text/html')
```

Or better: use Django's built-in template serving (`TemplateResponse`) or let WhiteNoise serve static files with proper cache headers.

---

## BUG-27 · `api_get_bill` (Old Function) Is Defined But Masked by URL

### Severity: 🟡 LOW

### Location
`billing/views.py` — lines 685–702 (old `api_get_bill`), `billing/urls.py` — line 34.

### What's Wrong
There is an old function `api_get_bill(request, bill_id)` at line 685 that is decorated with `@require_authenticated` and returns a simplified bill dictionary. However, the URL `bill/<int:bill_id>/` is mapped to `api_bill_detail` (a richer, more complete view at line 1093). The old `api_get_bill` function is never called from any URL — it is dead code.

### Fix
Delete the old `api_get_bill` function at lines 685–702. If needed, its fields can be added to `api_bill_detail`.

---

## Summary Table

| Bug ID | Severity | One-Line Summary |
|--------|----------|-----------------|
| BUG-18 | 🟠 MEDIUM | Duplicate URL patterns (`consumer/` vs `consumers/`) for same view |
| BUG-19 | 🟡 LOW | Redundant `is_authenticated` check after `@require_role` decorator |
| BUG-20 | 🟡 LOW | Dead method check inside `@api_view(['POST'])` decorated function |
| BUG-21 | 🟠 MEDIUM | `api_readings_list` calls `@api_view`-decorated function directly — decorator collision |
| BUG-22 | 🟠 MEDIUM | `icontains` lookup used on integer `id` field — fails on PostgreSQL |
| BUG-23 | 🟡 LOW | SQLite-specific error string used in exception handler — breaks on PostgreSQL |
| BUG-24 | 🟠 MEDIUM | `download_bill_pdf` (ReportLab) has no URL — unreachable dead code |
| BUG-25 | 🔴 HIGH | `api_bill_detail` PATCH bypasses bill lock — can reopen finalized bills |
| BUG-26 | 🟡 LOW | `spa_index` reads HTML file from disk on every request — no caching |
| BUG-27 | 🟡 LOW | Old `api_get_bill` function is dead code — never called via any URL |
