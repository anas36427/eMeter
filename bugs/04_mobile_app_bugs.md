# 📱 Bug Report #4 — Mobile App (eMeterApp) Bugs

> **File scope:** `eMeterApp/src/screens/`, `eMeterApp/src/services/api.js`, `eMeterApp/src/services/offlineStorage.js`, `eMeterApp/src/navigation/AppNavigator.js`

---

## BUG-28 · `BillPreviewScreen` Calls `React.useState` After an Early Return — Violates Rules of Hooks

### Severity: 🔴 HIGH (App Crash)

### Location
`eMeterApp/src/screens/BillPreviewScreen.js` — lines 29–34.

### What's Wrong
React's Rules of Hooks state that hooks **must not be called conditionally or after an early return**. The screen returns early if `bill` is null (line 29–31), but then calls `React.useState` three times on lines 32–34 — **after** the early return.

```javascript
if (!bill) {
    return ( <View><Text>No bill data found.</Text></View> );  // ← early return
}

// ← THESE HOOKS ARE AFTER THE EARLY RETURN — INVALID!
const [whatsappSending, setWhatsappSending] = React.useState(false);
const [whatsappSent, setWhatsappSent] = React.useState(false);
const [pdfDownloading, setPdfDownloading] = React.useState(false);
```

On the first render where `bill` is defined, hooks are called in the correct order. But if `bill` becomes `null` on a re-render (or navigation back), React will skip the hooks, violating hook order invariants, causing **React to throw a runtime error and crash the screen**.

### Fix
Move all hook calls to the top of the component — before any conditional returns:

```javascript
export default function BillPreviewScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors);

    const bill = route?.params?.bill;
    const reading = route?.params?.reading;
    const consumer = route?.params?.consumer;

    // ✅ ALL HOOKS BEFORE ANY RETURN
    const [whatsappSending, setWhatsappSending] = React.useState(false);
    const [whatsappSent, setWhatsappSent] = React.useState(false);
    const [pdfDownloading, setPdfDownloading] = React.useState(false);

    if (!bill) {
        return ( <View><Text>No bill data found.</Text></View> );
    }
    // ... rest of component
}
```

---

## BUG-29 · `SubmitReadingScreen` Navigates to `BillPreview` With `data.bill` — Which May Be Undefined

### Severity: 🔴 HIGH

### Location
`eMeterApp/src/screens/SubmitReadingScreen.js` — lines 140–144.

### What's Wrong
After a successful reading submission, the screen navigates to `BillPreview` passing `data.bill` from the API response. However, `api_submit_reading_and_generate_bill` (the backend endpoint) returns `bill_id`, `bill_number`, `total_amount`, and `status` — but **does NOT return a full `bill` object** with `consumer_name`, `energy_charges`, `fixed_charges`, `duty_charge`, etc.:

**Backend response:**
```json
{
  "success": true,
  "bill_id": 42,
  "bill_number": "BILL12345678",
  "total_amount": 3171,
  "status": "draft"
}
```

**Mobile code:**
```javascript
navigation.replace('BillPreview', {
    bill: data.bill,      // ← undefined! the API returns data.bill_id, not data.bill
    reading: data.reading, // ← also undefined
    consumer,
});
```

`BillPreviewScreen` then tries to access `bill.consumer_name`, `bill.energy_charges`, etc. on an `undefined` object → **TypeError crash**.

### Fix

**Option A (preferred):** After getting the bill ID, fetch the full bill detail from `/api/bill/<id>/`:

```javascript
if (data.success) {
    const billDetail = await api.get(`/api/bill/${data.bill_id}/`);
    navigation.replace('BillPreview', {
        bill: billDetail.data,
        reading: { previous_reading: previousReading, current_reading: Number(currentReading) },
        consumer,
    });
}
```

**Option B:** Update the backend endpoint to return the full bill object in its response.

---

## BUG-30 · `BillPreviewScreen` Accesses `reading.previous_reading` Without Null Guard

### Severity: 🔴 HIGH

### Location
`eMeterApp/src/screens/BillPreviewScreen.js` — lines 128, 137, 330, 331.

### What's Wrong
`reading` is taken from `route?.params?.reading` without a fallback. If `reading` is `undefined` (due to BUG-29 or any other navigation issue), accessing `reading.previous_reading` will crash with `TypeError: Cannot read properties of undefined`.

```javascript
<Text>{reading.previous_reading}</Text>    // ← crash if reading is undefined
<Text>{reading.current_reading}</Text>     // ← crash
```

The same values appear in the inline HTML template for PDF generation (lines 330–331).

### Fix
Add a null guard early in the component:

```javascript
const reading = route?.params?.reading ?? { previous_reading: 0, current_reading: 0, id: null };
```

Or show a loading/error state if reading is missing:

```javascript
if (!bill || !reading) {
    return (
        <View style={styles.container}>
            <Text style={{ color: colors.danger, textAlign: 'center', marginTop: 40 }}>
                Bill data unavailable. Please go back and try again.
            </Text>
        </View>
    );
}
```

---

## BUG-31 · Mobile API Base URL Is Hardcoded to a Specific Machine IP

### Severity: 🟠 MEDIUM

### Location
`eMeterApp/src/services/api.js` — line 10.

### What's Wrong
The fallback API URL is hardcoded to `'http://10.215.227.32:8000'` — a specific machine's local IP address. Any developer running this on a different network (or even the same developer after their router assigns a different IP) will get immediate network errors with no explanation, since the `EXPO_PUBLIC_API_URL` env variable may not be set.

```javascript
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.215.227.32:8000';
```

### Fix
Remove the hardcoded fallback and fail loudly with a clear error:

```javascript
const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
if (!BASE_URL) {
    throw new Error(
        'EXPO_PUBLIC_API_URL is not set. Create eMeterApp/.env with:\n' +
        'EXPO_PUBLIC_API_URL=http://<YOUR_MACHINE_IP>:8000'
    );
}
```

---

## BUG-32 · `getBillPdfUrl` Returns Wrong URL — Missing `/api/` Prefix

### Severity: 🟠 MEDIUM

### Location
`eMeterApp/src/services/api.js` — line 219.

### What's Wrong
The PDF URL helper builds a URL without the `/api/` prefix:

```javascript
export const getBillPdfUrl = (billId) => {
    return `${BASE_URL}/bill/${billId}/pdf/`;   // ← missing /api/
};
```

The correct backend URL is `/api/bill/<id>/pdf/`. This function, if used to open the PDF URL directly in a browser/WebView, will return a 404 because the URL `/bill/<id>/pdf/` is not registered — it's the SPA catch-all (which returns the React `index.html`).

Note: `BillPreviewScreen` currently generates PDFs **client-side** using `expo-print` and does not call this function, so the bug has no current impact — but the exported helper will mislead any future developer who uses it.

### Fix
```javascript
export const getBillPdfUrl = (billId) => {
    return `${BASE_URL}/api/bill/${billId}/pdf/`;
};
```

---

## BUG-33 · Offline Queue `syncOfflineReadings` Calls `submitFn` Without the `reading_date` Argument Correctly

### Severity: 🟠 MEDIUM

### Location
`eMeterApp/src/services/offlineStorage.js` — line 143.

### What's Wrong
`syncOfflineReadings` calls the provided `submitFn` with three arguments:

```javascript
await submitFn(reading.consumer_id, reading.current_reading, reading.reading_date);
```

This matches the signature of `submitReadingAndBillAPI(consumerId, currentReading, readingDate)` — which is correct. However, if the `reading_date` stored in the queue was captured using a **device timezone** and the backend expects UTC dates, a reading saved at 11 PM IST would have a date one day behind UTC — causing the duplicate-check in `BillingService.validate_reading()` to potentially allow a second reading for the same billing month.

### Fix
Ensure `reading_date` is always captured and stored in UTC format on the mobile side:

```javascript
// In SubmitReadingScreen.js — already correct:
const now = new Date();
const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
                .toISOString().split('T')[0];   // ← UTC-adjusted date ✅
```

This logic is already in place in `SubmitReadingScreen` (line 88), so the stored date should be correct. However, the same UTC adjustment should be verified in `HistoryScreen` when displaying dates back to the user.

---

## BUG-34 · Profile Tab Hardcodes Role Display as "Meter Reader"

### Severity: 🟡 LOW

### Location
`eMeterApp/src/navigation/AppNavigator.js` — line 132.

### What's Wrong
The Profile tab hardcodes the role label as `"Meter Reader"` regardless of the actual user role:

```javascript
<Text style={styles.infoValue}>Meter Reader</Text>    // ← always "Meter Reader"
```

If an admin user logs into the mobile app, their profile will incorrectly display "Meter Reader".

### Fix
Use the actual role from the auth context:

```javascript
<Text style={styles.infoValue}>
    {user?.role === 'admin' ? 'Administrator' : 'Meter Reader'}
</Text>
```

---

## BUG-35 · `SubmitReadingScreen` `useEffect` Cleanup Captures Stale Timer

### Severity: 🟡 LOW

### Location
`eMeterApp/src/screens/SubmitReadingScreen.js` — lines 56–85.

### What's Wrong
The debounce `useEffect` returns a cleanup function `() => clearTimeout(debounceTimer.current)`. This is correct pattern. However, `debounceTimer` is a `useRef`, and the timer is also set inside the `setTimeout` callback. If the component unmounts during the 600ms delay and the cleanup runs, the `clearTimeout` correctly prevents the callback from firing — but the `setEstimateLoading(true)` call has already been made before the timer starts, so if the network is slow and the component unmounts between `setEstimateLoading(true)` and the fetch resolving, the `setEstimate(result)` / `setEstimateLoading(false)` calls will attempt to update state on an unmounted component.

```javascript
debounceTimer.current = setTimeout(async () => {
    try {
        setEstimateLoading(true);    // ← fires immediately when timer starts
        const result = await calculateEstimateAPI(...);
        setEstimate(result);          // ← could run after unmount
    } finally {
        setEstimateLoading(false);    // ← could run after unmount
    }
}, 600);
```

### Fix
Use an `isMounted` ref guard:

```javascript
const isMounted = useRef(true);
useEffect(() => {
    return () => { isMounted.current = false; };
}, []);

// Inside the debounce:
const result = await calculateEstimateAPI(...);
if (isMounted.current) {
    setEstimate(result);
    setEstimateLoading(false);
}
```

---

## BUG-36 · `offlineStorage.exportQueueToExcel` Filters by `savedAt` for Synced Items — But Pending Items Have No `savedAt` Guarantee

### Severity: 🟡 LOW

### Location
`eMeterApp/src/services/offlineStorage.js` — lines 239–247.

### What's Wrong
`exportQueueToExcel` uses `r.savedAt` to check if synced readings are within the last 24 hours. However, `savedAt` is only set when a **new** reading is added to the queue (line 38). When an existing reading is **updated** (found in queue for same consumer/date, lines 23–31), `savedAt` is NOT updated — `updatedAt` is set instead. If a reading was first saved more than 24 hours ago but re-submitted today, it will be incorrectly excluded from the Excel export.

```javascript
if (r.status === 'synced') {
    const savedTime = new Date(r.savedAt).getTime();   // ← uses savedAt, not updatedAt
    ...
}
```

### Fix
Check both `savedAt` and `updatedAt`, using whichever is more recent:

```javascript
if (r.status === 'synced') {
    const lastTime = Math.max(
        new Date(r.savedAt || 0).getTime(),
        new Date(r.updatedAt || 0).getTime()
    );
    const now = Date.now();
    return (now - lastTime) < 24 * 60 * 60 * 1000;
}
```

---

## Summary Table

| Bug ID | Severity | One-Line Summary |
|--------|----------|-----------------|
| BUG-28 | 🔴 HIGH | Hooks called after early return in `BillPreviewScreen` — React rules violation / crash |
| BUG-29 | 🔴 HIGH | Navigation passes `data.bill` which is `undefined` — crash in `BillPreviewScreen` |
| BUG-30 | 🔴 HIGH | `reading.previous_reading` accessed without null guard — crash on undefined |
| BUG-31 | 🟠 MEDIUM | API base URL hardcoded to a specific machine IP as fallback |
| BUG-32 | 🟠 MEDIUM | `getBillPdfUrl` missing `/api/` prefix — returns wrong URL |
| BUG-33 | 🟠 MEDIUM | Offline sync date timezone edge case — potential duplicate-month reads |
| BUG-34 | 🟡 LOW | Profile tab always shows "Meter Reader" — ignores actual user role |
| BUG-35 | 🟡 LOW | Debounce estimate fetch can set state on unmounted component |
| BUG-36 | 🟡 LOW | Excel export uses `savedAt` not `updatedAt` for synced item filtering |
