# DEPLOYMENT READINESS REPORT
## eMeter AMU — Phase 1: Audit & Preparation

**Generated:** 2026-06-22  
**Architecture:** Frontend (Vite/React) → Vercel | Backend (Django) → Render | Database (PostgreSQL) → Neon  
**Auditor:** Antigravity DevOps Audit  

---

## Project Overview

| Component | Technology | Target Platform |
|-----------|-----------|-----------------|
| Frontend  | React 19 + Vite 5 + TypeScript | Vercel (Free Tier) |
| Backend   | Django 6.0.5 + Django REST Framework | Render (Free Tier) |
| Database  | PostgreSQL | Neon (Free Tier) |
| Auth      | Token + Session Auth (DRF) | — |
| Static Files | WhiteNoise 6.12 | Served via Django on Render |
| Media Files | Local filesystem | ⚠️ Not cloud-ready (see below) |

**Project Layout:**
```
eMeter.web/
├── electricity_system/     ← Django Backend (to deploy on Render)
│   ├── electricity_system/ ← Django project settings
│   ├── billing/            ← Core Django app
│   ├── requirements.txt
│   └── manage.py
├── energy-hub-ui/          ← React/Vite Frontend (to deploy on Vercel)
│   ├── src/
│   └── vite.config.ts
└── packages/               ← Shared monorepo packages
    ├── api-client/
    ├── models/
    ├── tokens/
    └── ui/
```

> [!IMPORTANT]
> The frontend is currently a **Vite/React SPA**, NOT a Next.js application. Vercel fully supports Vite/React SPAs — no framework change is needed. This report treats it accordingly.

---

## Frontend Readiness

### ✅ What's Good
- `VITE_API_URL` environment variable is already wired in `src/lib/api.ts` (line 18)
- API calls use relative URLs that fall back to proxy in dev (`baseURL: apiBaseUrl || ''`)
- `BrowserRouter` properly configured with SPA routing
- No `localhost:8000` hardcoded in source files — all proxied via Vite
- Build script (`vite build`) present in `package.json`
- TypeScript configured (`tsconfig.app.json`, `tsconfig.json`)

### ⚠️ Issues Found

#### ISSUE F-01 — BLOCKER: Hardcoded fallback port in Login.tsx
**File:** `energy-hub-ui/src/pages/Login.tsx` **Line 127**
```tsx
// CURRENT (problematic):
href={import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/admin/`
  : `http://${window.location.hostname}:8001/admin/`}  // ← hardcoded :8001
```
In production, `VITE_API_URL` MUST be set. If it's missing, this falls back to `:8001` which will be wrong on Vercel.
**Fix:** Use `VITE_API_URL` with a safe fallback pointing to the same host:
```tsx
href={`${import.meta.env.VITE_API_URL || ''}/admin/`}
```

#### ISSUE F-02 — WARNING: Monorepo local packages need workspace resolution on Vercel
**File:** `energy-hub-ui/package.json` lines 17-20
```json
"@emeter/api-client": "*",
"@emeter/models": "*",
"@emeter/tokens": "*",
"@emeter/ui": "*"
```
These are local workspace packages. Vercel must be able to resolve `packages/*` from the repo root. The Vercel build command must run from the correct subdirectory.

#### ISSUE F-03 — WARNING: No `.env` file for Vercel configuration
No `energy-hub-ui/.env.production` exists. `VITE_API_URL` must be set as a Vercel environment variable OR via `.env.production` (not committed).

#### ISSUE F-04 — INFO: `lovable-tagger` dev dependency should be stripped in prod
`vite.config.ts` line 23: `componentTagger()` is only loaded when `mode === "development"` — this is correctly guarded.

#### ISSUE F-05 — WARNING: Logo asset path
`src/pages/Login.tsx` line 53: `src="/assets/logo.png"` — This file must exist in `energy-hub-ui/public/assets/logo.png`. Verify this asset exists before deploying.

---

## Backend Readiness

### ✅ What's Good
- `SECRET_KEY` read from `DJANGO_SECRET_KEY` env var (settings.py line 28)
- `DEBUG` toggled via env var (settings.py line 36)
- `ALLOWED_HOSTS` loaded from env var in production (settings.py line 41)
- Database config fully driven by env vars (lines 128-136)
- WhiteNoise is installed and configured for static file serving
- `CORS_ALLOW_ALL_ORIGINS = False` — explicit whitelist only
- `CORS_ALLOWED_ORIGINS_EXTRA` env var support for dynamic runtime additions (line 254)
- `psycopg2-binary` in requirements.txt — correct for PostgreSQL
- `python-dotenv` installed
- Rotating file handler for logs configured

### ⚠️ Issues Found

#### ISSUE B-01 — BLOCKER: `DEBUG` check before `SECRET_KEY` assignment causes NameError
**File:** `electricity_system/electricity_system/settings.py` **Lines 29-33**
```python
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    if not DEBUG:   # ← NameError! DEBUG is defined at line 36, AFTER this block
        raise ValueError("DJANGO_SECRET_KEY environment variable is not set in production!")
```
`DEBUG` is referenced on line 30 but not defined until line 36. This is a **NameError** that will crash Django startup.

**Fix:** Move the `DEBUG` definition above `SECRET_KEY`:
```python
# settings.py — Move this BEFORE the SECRET_KEY block:
DEBUG = os.environ.get('DEBUG', 'True') == 'True'

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    if not DEBUG:
        raise ValueError("DJANGO_SECRET_KEY environment variable is not set in production!")
    SECRET_KEY = 'django-insecure-local-dev-key-change-me'
```

#### ISSUE B-02 — BLOCKER: `gunicorn` not in requirements.txt
Render (and all production WSGI servers) requires `gunicorn` to serve Django. It's completely missing from `requirements.txt`.

**Fix:** Add to `requirements.txt`:
```
gunicorn==22.0.0
```

#### ISSUE B-03 — BLOCKER: `SECURE_SSL_REDIRECT = False` hardcoded for production
**File:** `settings.py` **Line 219**
```python
SECURE_SSL_REDIRECT = False  # Temporarily False for local HTTP testing
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
```
These are set even in the `if not DEBUG:` block. Render provides HTTPS, and these MUST be `True` in production. 

**Fix:** Change the production security block:
```python
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = False  # Render handles SSL termination; keep False (Render redirects at edge)
    SESSION_COOKIE_SECURE = True   # ← Must be True with HTTPS
    CSRF_COOKIE_SECURE = True      # ← Must be True with HTTPS
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
```

#### ISSUE B-04 — BLOCKER: Production CORS not configured for Vercel
**File:** `settings.py` lines 239-260
`CORS_ALLOWED_ORIGINS` only includes localhost variants. The Vercel frontend URL is not included. While `CORS_ALLOWED_ORIGINS_EXTRA` can be set at runtime, the production Vercel URL MUST be in this env var.

**Fix:** Set env var on Render:
```
CORS_ALLOWED_ORIGINS_EXTRA=https://your-app.vercel.app
```

#### ISSUE B-05 — BLOCKER: `STATICFILES_STORAGE` deprecated in Django 6.x
**File:** `settings.py` line 193
```python
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```
In Django 4.2+, `STATICFILES_STORAGE` was deprecated in favor of `STORAGES`. In Django 6.0, it may be removed entirely.

**Fix:** Replace with:
```python
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
```

#### ISSUE B-06 — BLOCKER: SPA serving assumes relative path `../energy-hub-ui/dist`
**File:** `settings.py` lines 97-98, 191-192; `urls.py` line 34
```python
BASE_DIR.parent / 'energy-hub-ui' / 'dist'
```
On Render, the Django app is deployed from `electricity_system/` subdirectory. The relative path `../energy-hub-ui/dist` won't exist on Render (and shouldn't — frontend is on Vercel).

**Fix (for Render):** These paths should be conditional on production:
```python
# settings.py
if DEBUG:
    TEMPLATES[0]['DIRS'].append(BASE_DIR.parent / 'energy-hub-ui' / 'dist')
    STATICFILES_DIRS.append(BASE_DIR.parent / 'energy-hub-ui' / 'dist')
```
And in `urls.py`, the `/assets/<path>` route and SPA catch-all are for local unified serving. In production, the SPA is on Vercel. The SPA routes should be guarded or removed for Render deployment.

#### ISSUE B-07 — WARNING: No `Procfile` for Render
Render needs either a `Procfile` or `render.yaml` to know how to start Django.

**Fix:** Create `electricity_system/Procfile`:
```
web: gunicorn electricity_system.wsgi:application
```

#### ISSUE B-08 — WARNING: `AuditLog.Action` has no `bill_generated_final` choice
**File:** `billing/models.py` line 552-558; `billing/services.py` line 186

`services.py` logs `action='bill_generated_final'` but `AuditLog.Action` choices are:
```python
READING_SUBMIT  = 'reading_submit'
BILL_CALCULATE  = 'bill_calculate'
BILL_FINALIZE   = 'bill_finalize'  # ← closest match
PAYMENT_UPDATE  = 'payment_update'
FAILED_MOD      = 'failed_mod'
PDF_GENERATED   = 'pdf_gen'
```
`'bill_generated_final'` is not in the choices — this will cause DB validation errors on PostgreSQL. On SQLite it passes silently.

**Fix:** In `billing/services.py` line 186, change:
```python
action='bill_generated_final',
# to:
action='bill_finalize',
```

#### ISSUE B-09 — WARNING: File-based logging will fail on Render ephemeral filesystem
**File:** `settings.py` lines 324-326
```python
'filename': BASE_DIR / 'logs' / 'emeter.log',
```
Render's free tier uses an ephemeral filesystem. Log files won't persist between restarts.

**Fix:** For production, disable file handler and use console only:
```python
'handlers': {
    'console': {'class': 'logging.StreamHandler', 'formatter': 'verbose'},
} if not DEBUG else {
    'console': {...},
    'file': {...},  # only in dev
}
```

#### ISSUE B-10 — WARNING: `media` files stored locally
`MEDIA_ROOT` points to local filesystem. Images uploaded (meter images) won't persist on Render's ephemeral filesystem.

**Fix (Phase 2):** Use Cloudinary or an S3-compatible bucket for media. For now, ensure no critical workflows depend on uploaded meter images in production.

#### ISSUE B-11 — INFO: `TWILIO_WHATSAPP_FROM` has a hardcoded default
**File:** `settings.py` line 301
```python
TWILIO_WHATSAPP_FROM = os.environ.get('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886')
```
The sandbox number `+14155238886` is a test number. This is acceptable for initial deployment but note it for production activation.

#### ISSUE B-12 — INFO: `django-insecure-` key prefix in dev fallback
**File:** `.env` line 7
```
DJANGO_SECRET_KEY="django-insecure-s(++$8^mg#8qqq%oua0yv#h+h3$7ftz1(i=mhi#md)k*d4b4y4"
```
This is in the local `.env` (correctly git-ignored). On Render, a **new, strong** secret key must be generated.

#### ISSUE B-13 — ✅ FIXED: VM private IP addresses in CORS and ALLOWED_HOSTS
**Files:**
- `settings.py` lines 282-300 — `CORS_ALLOWED_ORIGIN_REGEXES` contained `10.x/192.168.x/172.x` private LAN ranges and a socket-based auto-detection block that injected the machine's current LAN IP. These were added for local VM/WiFi testing.
- `.env` line 11 — `ALLOWED_HOSTS=*,10.139.212.32` contained a hardcoded VM private IP.

**Risk in production:** On Render, the socket trick detects Render's internal overlay network IP, which could accidentally add unexpected IPs to `CORS_ALLOWED_ORIGINS`. The `10.x` CORS regex would allow any client on those private ranges — irrelevant and potentially confusing in cloud.

**Fixed by:**
1. Wrapped all `CORS_ALLOWED_ORIGIN_REGEXES` (including the `10.x`, `192.168.x`, `172.x` ranges) in `if DEBUG:` guard — completely disabled in production.
2. Also wrapped the socket-based LAN IP auto-detection in `if DEBUG:`.
3. Added `else: CORS_ALLOWED_ORIGIN_REGEXES = []` so production has an explicit empty list.
4. Removed `10.139.212.32` from local `.env` `ALLOWED_HOSTS`.

---

## Database Readiness

### ✅ What's Good
- All 3 migrations are linear with no conflicts:
  - `0001_initial.py` — creates all core tables
  - `0002_custom_ddl.py` — PostgreSQL-only DDL (indexes, triggers), SQLite-safe guarded
  - `0003_consumer_billing_type_and_more.py` — adds `billing_type` field + constraint
- Migration chain is clean: `0001 → 0002 → 0003`
- `CONN_MAX_AGE = 600` set for PostgreSQL (connection pooling)
- `connect_timeout: 5` set on PostgreSQL OPTIONS
- All models use `BigAutoField` as primary key
- Test suite correctly overrides to SQLite in-memory DB (settings.py line 146)
- `psycopg2-binary` present
- PostgreSQL-specific `CheckConstraint` and custom DDL are properly guarded with `if schema_editor.connection.vendor == 'postgresql'`

### ⚠️ Issues Found

#### ISSUE D-01 — BLOCKER: Neon PostgreSQL requires SSL
Neon requires SSL connections. The `DATABASES` config has no `sslmode` set.

**Fix:** Add to `settings.py` database OPTIONS for production:
```python
if not DEBUG and DATABASES['default']['ENGINE'] == 'django.db.backends.postgresql':
    DATABASES['default']['OPTIONS']['sslmode'] = 'require'
```
OR set it via `DATABASE_URL` with `?sslmode=require`.

#### ISSUE D-02 — WARNING: `0002_custom_ddl.py` uses raw PostgreSQL triggers
The triggers `update_consumer_updated_at` and `update_bill_updated_at` duplicate Django's `auto_now=True` on `updated_at`. This is redundant (not wrong) but may cause unexpected dual-update behavior.

#### ISSUE D-03 — INFO: No `DATABASE_URL` support
Neon provides a single `DATABASE_URL` connection string. The current settings use individual `DB_*` variables. Both patterns work — just note that Neon's dashboard shows a `DATABASE_URL` which you'll need to parse into components OR use `dj-database-url`.

**Recommendation:** Add `dj-database-url` to requirements and add parsing in settings:
```python
import dj_database_url
if DATABASE_URL := os.environ.get('DATABASE_URL'):
    DATABASES['default'] = dj_database_url.parse(DATABASE_URL, conn_max_age=600)
    DATABASES['default']['OPTIONS'] = {'sslmode': 'require'}
```

#### ISSUE D-04 — INFO: `db.sqlite3` is in the backend directory
`db.sqlite3` is git-ignored (in `.gitignore` line 15). ✅ Good — won't be committed.

#### ISSUE D-05 — INFO: Migration consistency check needed before deploy
Run locally before deploying:
```bash
cd electricity_system
python manage.py migrate --check
python manage.py showmigrations
```

---

## Security Issues

| ID | Severity | Description | File | Line |
|----|----------|-------------|------|------|
| S-01 | 🔴 CRITICAL | `DJANGO_SECRET_KEY` in `.env` is insecure default | `.env` | 7 |
| S-02 | 🔴 CRITICAL | `DB_PASSWORD=emeter123` hardcoded in local `.env` | `.env` | 4 |
| S-03 | 🔴 CRITICAL | `DEBUG=True` in `.env` (will carry to production if `.env` is deployed) | `.env` | 10 |
| S-04 | 🟠 HIGH | ~~`SESSION_COOKIE_SECURE = False` in production block~~ | `settings.py` | 222 | **FIXED** |
| S-05 | 🟠 HIGH | ~~`CSRF_COOKIE_SECURE = False` in production block~~ | `settings.py` | 223 | **FIXED** |
| S-06 | 🟠 HIGH | ~~`SECURE_HSTS_SECONDS = 0` disables HSTS in production~~ | `settings.py` | 227 | **FIXED** |
| S-07 | 🟡 MEDIUM | `.env` file may be accidentally committed to git (check `.gitignore`) | `.gitignore` | 9 |
| S-08 | 🟡 MEDIUM | `ALLOWED_HOSTS=*` in local `.env` — must be restricted in production | `.env` | 11 |
| S-09 | 🟡 MEDIUM | ~~`AuditLog` action `'bill_generated_final'` not in model choices~~ | `services.py` | 186 | **FIXED** |
| S-10 | 🟢 LOW | `SECURE_CROSS_ORIGIN_OPENER_POLICY = None` in DEBUG mode | `settings.py` | 86 |
| S-11 | 🟡 MEDIUM | ~~VM private IPs (`10.139.212.32`, LAN CORS ranges) exposed in production CORS~~ | `settings.py` / `.env` | 282-300 | **FIXED** |

> [!CAUTION]
> The `.env` file is correctly git-ignored (line 9 of root `.gitignore`). Verify this is working with `git status` before pushing. NEVER commit `.env` with real credentials.

---

## Required Fixes

These must be resolved before deployment will succeed:

### FIX 1 — `settings.py`: Move DEBUG above SECRET_KEY (prevents NameError crash)

**File:** `electricity_system/electricity_system/settings.py`

```python
# CORRECT ORDER — place at line ~28:
DEBUG = os.environ.get('DEBUG', 'True') == 'True'

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    if not DEBUG:
        raise ValueError("DJANGO_SECRET_KEY environment variable is not set in production!")
    SECRET_KEY = 'django-insecure-local-dev-key-change-me'
```

### FIX 2 — `requirements.txt`: Add `gunicorn` and `dj-database-url`

```
gunicorn==22.0.0
dj-database-url==2.3.0
```

### FIX 3 — `settings.py`: Production security cookies

In the `if not DEBUG:` block (around line 216), change:
```python
SESSION_COOKIE_SECURE = True    # was: False
CSRF_COOKIE_SECURE = True       # was: False
SECURE_HSTS_SECONDS = 31536000  # was: 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = True  # was: False
```

### FIX 4 — `settings.py`: Fix deprecated `STATICFILES_STORAGE`

Replace line 193:
```python
# OLD:
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# NEW:
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
```

### FIX 5 — `settings.py`: Add Neon SSL + DATABASE_URL support

After the DATABASES block, add:
```python
# Neon PostgreSQL requires SSL in production
import dj_database_url as _dj_db_url
if _db_url := os.environ.get('DATABASE_URL'):
    DATABASES['default'] = _dj_db_url.parse(_db_url, conn_max_age=600)
    DATABASES['default']['OPTIONS'] = {'sslmode': 'require', 'connect_timeout': 5}
elif not DEBUG and DATABASES['default']['ENGINE'] == 'django.db.backends.postgresql':
    DATABASES['default']['OPTIONS']['sslmode'] = 'require'
```

### FIX 6 — `services.py`: Fix invalid AuditLog action

**File:** `electricity_system/billing/services.py` line 186:
```python
# OLD:
action='bill_generated_final',
# NEW:
action='bill_finalize',
```

### FIX 7 — `Login.tsx`: Fix hardcoded port fallback

**File:** `energy-hub-ui/src/pages/Login.tsx` line 127:
```tsx
// OLD:
href={import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/admin/`
  : `http://${window.location.hostname}:8001/admin/`}

// NEW:
href={`${import.meta.env.VITE_API_URL || window.location.origin}/admin/`}
```

### FIX 8 — Create `Procfile` for Render

Create `electricity_system/Procfile`:
```
web: gunicorn electricity_system.wsgi:application
```

---

## Recommended Fixes

These improve stability and production-readiness but are not hard blockers:

### REC 1 — Add production-specific settings for SPA path isolation
In production (Render), Django shouldn't try to serve Vite's `dist/` since it won't exist there. Guard those paths:
```python
# In settings.py TEMPLATES and STATICFILES_DIRS:
if DEBUG or os.environ.get('SERVE_SPA', 'false').lower() == 'true':
    extra_spa_dir = BASE_DIR.parent / 'energy-hub-ui' / 'dist'
    if extra_spa_dir.exists():
        TEMPLATES[0]['DIRS'].append(extra_spa_dir)
        STATICFILES_DIRS.append(extra_spa_dir)
```

### REC 2 — Console-only logging in production
```python
# settings.py — modify LOGGING handlers for production:
if not DEBUG:
    LOGGING['handlers'] = {'console': LOGGING['handlers']['console']}
    LOGGING['root']['handlers'] = ['console']
    LOGGING['loggers']['django']['handlers'] = ['console']
    LOGGING['loggers']['billing']['handlers'] = ['console']
```

### REC 3 — Add `RENDER_EXTERNAL_URL` to ALLOWED_HOSTS
Render injects `RENDER_EXTERNAL_URL`. Use it:
```python
if render_url := os.environ.get('RENDER_EXTERNAL_URL', ''):
    from urllib.parse import urlparse
    ALLOWED_HOSTS.append(urlparse(render_url).hostname)
```

### REC 4 — Pin Python version
Create `electricity_system/runtime.txt`:
```
python-3.12.3
```

### REC 5 — Set `CSRF_TRUSTED_ORIGINS` for Vercel domain
In production settings or via env var, add:
```
CORS_ALLOWED_ORIGINS_EXTRA=https://your-app.vercel.app
```
And in settings.py ensure `CSRF_TRUSTED_ORIGINS` also includes it:
```python
CSRF_TRUSTED_ORIGINS = _BASE_CORS + _EXTRA_CORS
```
*(Already done — just ensure the env var is set on Render)*

### REC 6 — Add `health check` endpoint on Django
Render's free tier pings a URL to keep the service alive. Add:
```python
# In billing/urls.py:
path('health/', lambda r: JsonResponse({'status': 'ok'}), name='health'),
```

---

## Deployment Blockers

| # | Component | Blocker | Fix ID |
|---|-----------|---------|--------|
| 1 | Backend | `NameError: DEBUG not defined` when Django starts (settings.py order bug) | FIX 1 |
| 2 | Backend | No `gunicorn` — Render cannot start the Django server | FIX 2 |
| 3 | Backend | PostgreSQL (Neon) requires SSL — no `sslmode=require` configured | FIX 5 |
| 4 | Backend | `STATICFILES_STORAGE` deprecated in Django 6.x — may fail `collectstatic` | FIX 4 |
| 5 | Backend | `AuditLog` invalid action value crashes on PostgreSQL strict mode | FIX 6 |
| 6 | Frontend | Admin link falls back to hardcoded `:8001` if `VITE_API_URL` not set | FIX 7 |
| 7 | Both | CORS not configured for Vercel production domain | REC 5 |

---

## Environment Variables Required

### Backend (Set on Render)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `DJANGO_SECRET_KEY` | ✅ REQUIRED | `your-50-char-random-key` | Generate with `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DEBUG` | ✅ REQUIRED | `False` | Must be `False` in production |
| `ALLOWED_HOSTS` | ✅ REQUIRED | `your-service.onrender.com` | Comma-separated |
| `DATABASE_URL` | ✅ REQUIRED | `postgresql://user:pass@host/db?sslmode=require` | From Neon dashboard |
| `CORS_ALLOWED_ORIGINS_EXTRA` | ✅ REQUIRED | `https://your-app.vercel.app` | Vercel frontend URL |
| `DB_ENGINE` | Optional | `django.db.backends.postgresql` | Overridden by `DATABASE_URL` |
| `DB_NAME` | Optional | `emeter_db` | Overridden by `DATABASE_URL` |
| `DB_USER` | Optional | `emeter_user` | Overridden by `DATABASE_URL` |
| `DB_PASSWORD` | Optional | — | Overridden by `DATABASE_URL` |
| `DB_HOST` | Optional | — | Overridden by `DATABASE_URL` |
| `DB_PORT` | Optional | `5432` | Overridden by `DATABASE_URL` |
| `TWILIO_ACCOUNT_SID` | Optional | — | Only if SMS is enabled |
| `TWILIO_AUTH_TOKEN` | Optional | — | Only if SMS is enabled |
| `TWILIO_PHONE_NUMBER` | Optional | — | Only if SMS is enabled |

### Frontend (Set on Vercel)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `VITE_API_URL` | ✅ REQUIRED | `https://your-service.onrender.com` | Full backend URL, no trailing slash |

---

## Render Deployment Checklist

- [ ] **FIX 1**: Fix `settings.py` — Move `DEBUG` definition before `SECRET_KEY` block
- [ ] **FIX 2**: Add `gunicorn==22.0.0` and `dj-database-url==2.3.0` to `requirements.txt`
- [ ] **FIX 3**: Set `SESSION_COOKIE_SECURE=True`, `CSRF_COOKIE_SECURE=True`, `SECURE_HSTS_SECONDS=31536000`
- [ ] **FIX 4**: Replace `STATICFILES_STORAGE` with `STORAGES` dict
- [ ] **FIX 5**: Add `DATABASE_URL` parsing + `sslmode=require` for Neon
- [ ] **FIX 6**: Fix invalid `AuditLog.action='bill_generated_final'` → `'bill_finalize'`
- [ ] **FIX 8**: Create `electricity_system/Procfile` with `web: gunicorn electricity_system.wsgi:application`
- [ ] **REC 3**: Add `RENDER_EXTERNAL_URL` → `ALLOWED_HOSTS` parsing
- [ ] **REC 4**: Create `electricity_system/runtime.txt` with `python-3.12.3`
- [ ] Set all required backend env vars on Render dashboard
- [ ] On Render: Set **Root Directory** to `electricity_system`
- [ ] On Render: Set **Build Command** to `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
- [ ] On Render: Set **Start Command** to `gunicorn electricity_system.wsgi:application`
- [ ] After deploy: Create superuser via Render shell: `python manage.py createsuperuser`
- [ ] Verify `/api/` health endpoint returns `{"status": "ok"}`
- [ ] Verify `/admin/` Django admin is accessible

---

## Vercel Deployment Checklist

- [ ] **FIX 7**: Fix Login.tsx admin link fallback
- [ ] Confirm `packages/api-client`, `packages/models`, `packages/tokens`, `packages/ui` are accessible from Vercel root
- [ ] On Vercel: Set **Root Directory** to `energy-hub-ui`
- [ ] On Vercel: Set **Framework Preset** to `Vite`
- [ ] On Vercel: Set **Build Command** to `npm install && npm run build`
- [ ] On Vercel: Set **Output Directory** to `dist`
- [ ] Set env var `VITE_API_URL=https://your-service.onrender.com` on Vercel
- [ ] Add `vercel.json` for SPA routing (catch-all to `index.html`):
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```
- [ ] Confirm `public/assets/logo.png` exists
- [ ] After deploy: Test login → dashboard flow
- [ ] Test API calls reach Render backend (check CORS headers in browser DevTools)

---

## Final Readiness Score

| Area | Score | Status |
|------|-------|--------|
| Frontend Code | 8/10 | ✅ Mostly ready — 1 URL fix needed |
| Frontend Build | 7/10 | ⚠️ Vercel config + `vercel.json` needed |
| Backend Code | 6/10 | ⚠️ 2 blockers (NameError, gunicorn) |
| Backend Settings | 5/10 | ⚠️ 4 production settings issues |
| Database | 7/10 | ⚠️ SSL config missing |
| Security | 5/10 | ⚠️ Cookie security disabled in prod |
| Migrations | 9/10 | ✅ Clean linear chain |
| Requirements | 7/10 | ⚠️ Missing gunicorn, dj-database-url |
| **Overall** | **6.5/10** | **⚠️ NOT READY — 8 required fixes** |

> [!WARNING]
> **Do not deploy until all 8 Required Fixes are applied.** The most critical are FIX 1 (NameError crash), FIX 2 (missing gunicorn), and FIX 5 (Neon SSL). These will cause 100% deployment failure if not addressed.

---

*Report generated by Antigravity DevOps Audit | Phase 1 Complete*
