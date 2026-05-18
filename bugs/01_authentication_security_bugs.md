# 🔐 Bug Report #1 — Authentication & Security

> **File scope:** `electricity_system/electricity_system/settings.py`, `billing/views.py`, `electricity_system/authentication.py`

---

## BUG-01 · `REST_FRAMEWORK` Settings Block Defined Twice

### Severity: 🔴 HIGH

### Location
`electricity_system/settings.py` — lines 80–85 and lines 181–186.

### What's Wrong
The `REST_FRAMEWORK` dictionary is declared **twice** in the same settings file. Python silently overwrites the first definition with the second one. The first block uses `CsrfExemptSessionAuthentication` (the custom class needed for the mobile login flow), but the **second block completely replaces it** with standard `SessionAuthentication`. This means the custom CSRF-exempt class is never actually active, even though it looks like it is.

```python
# ── First block (lines 80-85) — OVERWRITTEN, never used ──
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'electricity_system.authentication.CsrfExemptSessionAuthentication',  # ← lost
    ],
}

# ── Second block (lines 181-186) — this is the one Python uses ──
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',  # ← standard, not custom
    ],
}
```

### Impact
The custom `CsrfExemptSessionAuthentication` class (which skips CSRF for token-authenticated mobile clients) is never registered. The system still works because `/api/login/` has `@csrf_exempt` on it and mobile clients use Token auth (which DRF skips CSRF for by design). However, having dead configuration code is misleading and a maintenance hazard.

### Fix
**Delete the first block entirely.** Keep only the second block and add `CsrfExemptSessionAuthentication` there if it is still needed:

```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'electricity_system.authentication.CsrfExemptSessionAuthentication',
    ],
}
```

---

## BUG-02 · Hardcoded Database Password in `settings.py`

### Severity: 🔴 HIGH

### Location
`electricity_system/settings.py` — line 121.

### What's Wrong
The fallback database password `'anas167'` is hardcoded directly in the settings file as the default value of `os.environ.get()`. Even though the production value should come from the environment, any developer who forgets to set the env variable will silently connect with the real password — and if this file is ever committed to a public repo, the credential is exposed.

```python
'PASSWORD': os.environ.get('DB_PASSWORD', 'anas167'),  # ← hardcoded fallback
```

### Fix
Use an empty string as the fallback and raise an explicit error on startup if the variable is missing:

```python
import os

DB_PASSWORD = os.environ.get('DB_PASSWORD')
if not DB_PASSWORD:
    raise ValueError("DB_PASSWORD environment variable is not set. Check your .env file.")

DATABASES = {
    'default': {
        ...
        'PASSWORD': DB_PASSWORD,
        ...
    }
}
```

Or at minimum, change the default to an empty string so it fails loudly:
```python
'PASSWORD': os.environ.get('DB_PASSWORD', ''),
```

---

## BUG-03 · `ALLOWED_HOSTS = ["*"]` — Wildcard in All Environments

### Severity: 🟠 MEDIUM

### Location
`electricity_system/settings.py` — line 34.

### What's Wrong
`ALLOWED_HOSTS = ["*"]` is unconditionally set, meaning it applies in **production** as well as development. Django's `ALLOWED_HOSTS` is a Host-header injection defence. A wildcard disables this protection entirely.

```python
ALLOWED_HOSTS = ["*"]   # ← no host validation, ever
```

### Fix
Scope the wildcard to `DEBUG=True` only, and enumerate real hosts for production:

```python
if DEBUG:
    ALLOWED_HOSTS = ["*"]
else:
    ALLOWED_HOSTS = [
        "yourdomain.com",
        "www.yourdomain.com",
        "10.11.53.13",
    ]
```

---

## BUG-04 · `api_logout` Does Not Require POST — Accessible via GET

### Severity: 🟠 MEDIUM

### Location
`billing/views.py` — line 929–934.

### What's Wrong
The logout view correctly checks `request.method != 'POST'` and returns a 405, but it has **no authentication decorator at all**. More critically, a CSRF-GET request to `/api/logout/` from a malicious page (CSRF attack via `<img src="/api/logout/">`) would hit the method check and be blocked — but only because of the method guard. If that guard were ever removed or bypassed, an unauthenticated actor could trigger logouts.

The deeper issue: the function is missing `@require_authenticated`, so calling it while unauthenticated will run `logout(request)` on an already-anonymous session — harmless but sloppy.

```python
def api_logout(request):   # ← no auth decorator
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed'}, status=405)
    logout(request)
    return JsonResponse({'success': True, 'message': 'Logged out successfully'})
```

### Fix
Add `@require_authenticated` and consider adding `@csrf_exempt` deliberately (with a note) since mobile clients also call this endpoint:

```python
@require_authenticated
def api_logout(request):
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed'}, status=405)
    logout(request)
    return JsonResponse({'success': True, 'message': 'Logged out successfully'})
```

---

## BUG-05 · `api_login` Leaks Information About Non-Existent Users

### Severity: 🟡 LOW

### Location
`billing/views.py` — line 117.

### What's Wrong
When authentication fails, the error message says `"Invalid credentials. User not found"`. The phrase **"User not found"** tells an attacker whether the username exists in the system — a classic username enumeration vulnerability.

```python
return JsonResponse({'detail': 'Invalid credentials. User not found'}, status=401)
```

### Fix
Use a generic, non-revealing message for all failed login attempts:

```python
return JsonResponse({'detail': 'Invalid username or password.'}, status=401)
```

---

## BUG-06 · `DEBUG = True` Prints Auth Token to Console

### Severity: 🟡 LOW

### Location
`billing/views.py` — line 108 and `eMeterApp/src/services/api.js` — line 34.

### What's Wrong
Both the backend and the mobile app log sensitive data to the console in what appears to be permanent debug code (not guarded by any debug flag).

**Backend:**
```python
print(f"DEBUG: Attempting login for {username}")   # logs all login usernames
print(f"DEBUG: Login successful for {user.username}. Role: {user.role}")
```

**Mobile (api.js):**
```python
console.log('DEBUG: Sending request with Token:', currentToken.substring(0, 5) + '...');
```

While the token is truncated in the mobile log, the backend prints full usernames and roles on every login. In a production environment with log aggregation, this becomes a privacy issue.

### Fix
Guard all debug prints behind `settings.DEBUG` (backend) or `__DEV__` (React Native):

**Backend:**
```python
if settings.DEBUG:
    print(f"DEBUG: Login attempt for {username}")
```

**Mobile:**
```javascript
if (__DEV__) {
    console.log('DEBUG: Token attached to request');
}
```

---

## BUG-07 · `SECURE_CROSS_ORIGIN_OPENER_POLICY = None` Disables Browser Security Header

### Severity: 🟡 LOW

### Location
`electricity_system/settings.py` — line 78.

### What's Wrong
Setting `SECURE_CROSS_ORIGIN_OPENER_POLICY = None` completely disables the `Cross-Origin-Opener-Policy` HTTP response header. This header prevents cross-origin windows from accessing the browser context of your app, protecting against Spectre-type side-channel attacks. The comment in the code says it was disabled to avoid "browser warnings" when accessing via IP over HTTP — this is a dev-time workaround that should not remain in production.

### Fix
Remove this line for production, or explicitly set it only in DEBUG mode:

```python
if DEBUG:
    SECURE_CROSS_ORIGIN_OPENER_POLICY = None   # allow IP access in dev
# In production, Django's default ('same-origin') is used automatically
```

---

## Summary Table

| Bug ID | File | Severity | One-Line Summary |
|--------|------|----------|-----------------|
| BUG-01 | settings.py | 🔴 HIGH | `REST_FRAMEWORK` defined twice — custom auth class silently discarded |
| BUG-02 | settings.py | 🔴 HIGH | DB password hardcoded as env fallback |
| BUG-03 | settings.py | 🟠 MEDIUM | `ALLOWED_HOSTS = ["*"]` applies in production |
| BUG-04 | views.py | 🟠 MEDIUM | `api_logout` has no `@require_authenticated` decorator |
| BUG-05 | views.py | 🟡 LOW | Login error message reveals whether a username exists |
| BUG-06 | views.py / api.js | 🟡 LOW | Sensitive data printed to console unconditionally |
| BUG-07 | settings.py | 🟡 LOW | COOP security header permanently disabled |
