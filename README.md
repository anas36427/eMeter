# eMeter AMU — Electricity Billing Management System

> **Aligarh Muslim University** · Internal electricity billing platform for campus consumers.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Data Models](#5-data-models)
6. [How to Run](#6-how-to-run)
7. [API Endpoints Reference](#7-api-endpoints-reference)
8. [Web Dashboard (energy-hub-ui)](#8-web-dashboard-energy-hub-ui)
9. [Mobile App (eMeterApp)](#9-mobile-app-emeterapp)
10. [Authentication & Roles](#10-authentication--roles)
11. [Billing Workflow](#11-billing-workflow)
12. [Offline Sync (Mobile)](#12-offline-sync-mobile)
13. [PDF Generation](#13-pdf-generation)
14. [SMS / WhatsApp Notifications](#14-sms--whatsapp-notifications)
15. [Excel Import](#15-excel-import)
16. [Environment Variables](#16-environment-variables)

---

## 1. Project Overview

eMeter AMU is a **full-stack monorepo** that digitises the electricity billing workflow of Aligarh Muslim University. It replaces paper-based meter reading and manual billing with a three-tier platform:

| Tier | Technology | Users |
|------|-----------|-------|
| **Backend API** | Django 6 + PostgreSQL 16 | All |
| **Web Dashboard** | React (Vite + TypeScript) | Administrators |
| **Mobile App** | React Native (Expo) | Meter Readers |

### Core Capabilities
- Consumer registration and management (salary / non-salary accounts)
- Meter reading submission (online via app + offline queue sync)
- Automatic tiered tariff bill calculation
- Bill lifecycle management: `DRAFT → FINALIZED → PAID`
- Immutable financial snapshots locked at finalization time
- PDF bill generation (xhtml2pdf + ReportLab)
- SMS / WhatsApp notification via Twilio
- Excel bulk import of readings
- Audit log trail for every financial action
- Admin dashboard with reporting charts

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Monorepo Root                      │
│  /eMeter.web                                         │
│  ├── electricity_system/   ← Django Backend + API    │
│  ├── energy-hub-ui/        ← React Web Dashboard     │
│  └── eMeterApp/            ← React Native Mobile App │
└──────────────────────────────────────────────────────┘
```

**Request flow:**
```
Mobile App  ──Token Auth──►  Django REST API  ──ORM──►  PostgreSQL
Web SPA     ──Session Auth──►  Django REST API  ──────►  PostgreSQL
                                     │
                            xhtml2pdf / ReportLab
                                     │
                                  PDF Bills
```

- The **Web SPA** is served by Django's `spa_index` view (catch-all) from the pre-built Vite `dist/` folder.
- **Static assets** from Vite's `dist/` are also served by Django / WhiteNoise.
- The **mobile app** connects to the same Django backend using Token authentication (no CSRF required).

---

## 3. Tech Stack

### Backend (`electricity_system/`)
| Package | Version | Purpose |
|---------|---------|---------|
| Django | 6.0.5 | Core framework |
| Django REST Framework | 3.17.1 | API views + Token auth |
| psycopg2-binary | 2.9.12 | PostgreSQL driver |
| django-cors-headers | 4.9.0 | CORS for SPA |
| whitenoise | 6.12.0 | Static file serving |
| xhtml2pdf | 0.2.17 | HTML → PDF |
| reportlab | 4.5.0 | Low-level PDF building |
| openpyxl | 3.1.5 | Excel import |
| twilio | ≥9.0.0 | SMS / WhatsApp |
| python-dotenv | 1.2.2 | Env variable loading |

### Web Dashboard (`energy-hub-ui/`)
- React 18 + TypeScript, Vite bundler
- TailwindCSS for styling
- Recharts for reports
- Axios for API calls

### Mobile App (`eMeterApp/`)
- React Native 0.76 (Expo SDK 52)
- React Navigation (Stack + Bottom Tabs)
- Axios + AsyncStorage for API + token storage
- expo-print + expo-sharing for PDF generation
- XLSX for offline Excel export

---

## 4. Project Structure

```
eMeter.web/
│
├── electricity_system/              Django backend
│   ├── manage.py
│   ├── requirements.txt
│   ├── electricity_system/          Django project config
│   │   ├── settings.py
│   │   ├── urls.py                  Root URL config
│   │   ├── authentication.py       Custom auth decorators
│   │   ├── wsgi.py / asgi.py
│   └── billing/                    Single Django app
│       ├── models.py               All DB models
│       ├── views.py                All API + HTML views (2189 lines)
│       ├── services.py             BillingService (calculate, finalize)
│       ├── serializers.py          DRF serializers
│       ├── permissions.py          DRF permission classes
│       ├── pdf_generator.py        BillPDFGenerator (xhtml2pdf)
│       ├── forms.py                ConsumerRegistrationForm
│       ├── urls.py                 All API URL patterns
│       └── tests.py                Unit + integration tests
│
├── energy-hub-ui/                  React web dashboard
│   └── src/
│       ├── pages/
│       │   ├── Login.tsx           Login page
│       │   ├── Dashboard.tsx       Stats overview
│       │   ├── Consumers.tsx       Consumer CRUD
│       │   ├── Billing.tsx         Bill management
│       │   ├── Readings.tsx        Meter readings
│       │   ├── ImportReadings.tsx  Excel bulk import
│       │   ├── Reports.tsx         Charts & analytics
│       │   └── Settings.tsx        Tariff settings
│       ├── api/                    Axios API client modules
│       ├── components/             Reusable UI components
│       └── contexts/               React contexts (auth, etc.)
│
└── eMeterApp/                      React Native mobile app
    ├── App.js                      Root component
    └── src/
        ├── screens/
        │   ├── LoginScreen.js
        │   ├── DashboardScreen.js
        │   ├── SearchScreen.js       Search consumers
        │   ├── SubmitReadingScreen.js Submit reading + generate bill
        │   ├── BillPreviewScreen.js  View bill, PDF, WhatsApp
        │   ├── HistoryScreen.js      Reading history + offline sync
        │   ├── AddConsumerScreen.js  Register new consumer
        │   └── SettingsScreen.js     Tariff rates view
        ├── services/
        │   ├── api.js               Axios client + all API functions
        │   └── offlineStorage.js    AsyncStorage queue management
        ├── navigation/
        │   └── AppNavigator.js      Stack + Tab navigator setup
        └── context/
            ├── AuthContext.js
            └── ThemeContext.js
```

---

## 5. Data Models

### `User` (Custom — extends AbstractUser)
| Field | Type | Notes |
|-------|------|-------|
| username | CharField | Inherited |
| password | CharField | Inherited |
| role | CharField | `admin` or `meter_reader` |

### `Consumer`
| Field | Type | Notes |
|-------|------|-------|
| consumer_number | CharField (unique) | Auto-generated `CN######` if blank |
| name | CharField | |
| email | EmailField (unique, nullable) | |
| phone | CharField | |
| address | TextField | |
| meter_number | CharField (unique) | |
| connection_type | CharField | `salary` / `non-salary` |
| load_kw | FloatField | 1–5 KW |
| meter_type | CharField | `10` = 1-phase, `25` = 3-phase |
| status | CharField | `active` / `inactive` / `disconnected` |

### `MeterReading`
| Field | Type | Notes |
|-------|------|-------|
| consumer | FK → Consumer | |
| previous_reading | FloatField | |
| current_reading | FloatField | |
| units_consumed | FloatField | Auto-calculated on save |
| reading_date | DateField | |
| created_by | FK → User | Who submitted the reading |

### `Bill`
| Field | Type | Notes |
|-------|------|-------|
| consumer | FK → Consumer | |
| meter_reading | FK → MeterReading (nullable) | |
| bill_number | CharField (unique) | Auto-generated `BILL########` |
| units, rate_per_unit, energy_charges, fixed_charges, duty_charge, meter_rent, regulatory_surcharge, arrears, late_payment_surcharge, total_amount | FloatField | Live editable fields |
| status | CharField | `draft` / `finalized` / `paid` / `cancelled` |
| is_locked | BooleanField | True after finalization |
| `*_snapshot` fields | FloatField / CharField | Immutable copy written at finalization |

### `BillingSettings` (Singleton)
| Field | Default |
|-------|---------|
| rate_per_unit | 8.56 |
| fixed_charge_per_kw | 400.0 |
| phase_1_rent | 10.0 |
| phase_3_rent | 25.0 |
| duty_percentage | 7.5 |

### `AuditLog`
Immutable trail of every significant action: `reading_submit`, `bill_calculate`, `bill_finalize`, `payment_update`, `failed_mod`, `pdf_gen`.

### `Payment`
Records a payment transaction linked to a finalized bill.

---

## 6. How to Run

### Prerequisites
- Python 3.11+
- PostgreSQL 16
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)

### Step 1 — Backend

```bash
cd electricity_system

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate       # macOS / Linux
# venv\Scripts\activate        # Windows

# Install dependencies
pip install -r requirements.txt

# Set up environment variables (see Section 16)
cp .env.example .env           # edit with your DB credentials

# Apply database migrations
python manage.py migrate

# Create a superuser / admin
python manage.py runscript create_superuser
# OR
python create_superuser.py

# Start the development server
python manage.py runserver 0.0.0.0:8000
```

The backend is now at `http://localhost:8000`.  
The web dashboard (production build) will be served from `/`.  
All API endpoints are under `/api/`.

### Step 2 — Web Dashboard (Development)

```bash
cd energy-hub-ui
npm install
npm run dev          # starts Vite dev server at http://localhost:5173
```

> **Production build** (served by Django):
> ```bash
> npm run build        # outputs to dist/
> ```
> Django's `settings.py` is pre-configured to serve `dist/` via WhiteNoise.

### Step 3 — Mobile App

```bash
cd eMeterApp
npm install

# Edit the API base URL:
# File: src/services/api.js  →  const BASE_URL = 'http://<YOUR_MACHINE_IP>:8000'

npx expo start       # starts Expo dev server (scan QR with Expo Go)
```

> Use your machine's **local IP address** (not `localhost`), so the physical device/emulator can reach the Django server.

### Quick-Start Scripts (macOS)
The root contains helper scripts:
```bash
./START_PROJECT.sh          # starts all three services
./CLEAN_PORTS.sh            # kills processes on ports 8000, 5173, 8081
./start_backend.command     # starts Django only
./start_frontend.command    # starts Vite only
./start_mobile.command      # starts Expo only
```

---

## 7. API Endpoints Reference

All endpoints are prefixed with `/api/`.  
**Auth methods:** Token (`Authorization: Token <token>`) for mobile; Session + CSRF for web SPA.

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/` | None | Health check |
| `GET` | `/api/csrf/` | None | Returns CSRF token (sets cookie) |
| `POST` | `/api/login/` | None | Log in — returns `token`, `role`, `csrftoken` |
| `GET` | `/api/me/` | Any | Returns current user info |
| `POST` | `/api/logout/` | Any | Ends session and clears server-side session |

**Login request body:**
```json
{ "username": "admin", "password": "secret" }
```
**Login response:**
```json
{
  "success": true,
  "username": "admin",
  "role": "admin",
  "token": "abc123...",
  "csrftoken": "xyz..."
}
```

---

### Dashboard & Reports

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/dashboard-stats/` | Admin | Total consumers, bills, readings, revenue, pending amount, current month units |
| `GET` | `/api/reports-data/` | Admin | Top-10 consumers by usage, monthly usage (last 6 months), revenue breakdown (salary vs non-salary) |

---

### Consumer Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/consumers/` | Admin/Reader | List all consumers with last reading |
| `POST` | `/api/consumers/` | Admin/Reader | Create a new consumer |
| `GET` | `/api/consumers/<id>/` | Admin/Reader | Get consumer details |
| `PUT/PATCH` | `/api/consumers/<id>/` | Admin/Reader | Update consumer fields |
| `DELETE` | `/api/consumers/<id>/` | Admin/Reader | Delete consumer |
| `GET` | `/api/consumers/search/?meter_number=<q>` | Any Auth | Search by meter number, name, or consumer number |
| `GET` | `/api/consumer/<id>/readings/` | Any Auth | Full reading history for a consumer |

**Create consumer body:**
```json
{
  "name": "Ahmed Ali",
  "meter_number": "M001",
  "phone": "9999999999",
  "email": "ahmed@example.com",
  "address": "Block A, AMU",
  "post": "Professor",
  "department": "Computer Science",
  "load_kw": 2.0,
  "meter_type": "10",
  "connection_type": "salary",
  "initial_reading": 1500
}
```

---

### Meter Readings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/readings/` | Admin/Reader | List all readings |
| `POST` | `/api/submit-reading/` | Admin/Reader | Submit a single reading (validates duplicate month + regression) |
| `POST` | `/api/reading-and-bill/` | Admin/Reader | Submit reading AND auto-generate draft bill in one call |
| `PUT/PATCH` | `/api/edit-reading/<id>/` | Admin/Reader | Edit today's reading only (updates linked bill too) |
| `POST` | `/api/readings/import-excel/` | Admin | Bulk import via Excel file (multipart/form-data) |

**Submit reading body:**
```json
{
  "consumer_id": 5,
  "current_reading": 3450,
  "reading_date": "2025-05-01"
}
```

---

### Bill Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/bills/` | Admin/Reader | Paginated list with search, status, account type, date range filters |
| `GET` | `/api/bill/<id>/` | Admin/Reader | Full bill detail (all charge fields) |
| `PATCH` | `/api/bill/<id>/` | Admin/Reader | Update bill status |
| `GET` | `/api/bill/<id>/pdf/` | Any Auth | Download PDF bill (uses snapshots if finalized) |
| `POST` | `/api/bills/<id>/finalize/` | Admin only | Lock bill, write immutable snapshots |
| `POST` | `/api/bills/<id>/mark-paid/` | Admin/Reader | Mark finalized bill as paid |
| `POST` | `/api/bills/<id>/mark-unpaid/` | Admin only | Revert paid → finalized |
| `POST` | `/api/bills/manual-generate/` | Admin only | Manually create a bill for a consumer |

**Bills list query params:**
| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page number (default: 1) |
| `limit` | int | Items per page (default: 50) |
| `search` | string | Search by bill#, consumer name/number, meter# |
| `status` | string | `draft`, `finalized`, `paid`, `cancelled` |
| `accountType` | string | `salary`, `non-salary` |
| `startDate` | `YYYY-MM` | Billing period from |
| `endDate` | `YYYY-MM` | Billing period to |
| `sortOrder` | `asc`/`desc` | Sort by created_at |

---

### Calculation & Estimates

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/calculate-bill/?units=<n>&rate=<r>&fixed_charges=<f>` | Any Auth | Simple inline calculation (no DB) |
| `POST` | `/api/calculate-estimate/` | Admin/Reader | Server-side estimate using live BillingSettings — **single source of truth for mobile** |

**Estimate request body:**
```json
{
  "consumer_id": 5,
  "current_reading": 3450,
  "previous_reading": 3200
}
```
**Estimate response:**
```json
{
  "success": true,
  "units_consumed": 250,
  "breakdown": {
    "rate_per_unit": 8.56,
    "energy_charges": 2140.0,
    "fixed_charge_per_kw": 400.0,
    "fixed_charges": 800.0,
    "duty_percentage": 7.5,
    "duty_charge": 220.5,
    "meter_rent": 10.0,
    "regulatory_surcharge": 0.0,
    "arrears": 0.0,
    "late_payment_surcharge": 0.0
  },
  "total_amount": 3171
}
```

---

### Settings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/settings/` | Admin | Get current global tariff rates |
| `POST` | `/api/settings/update/` | Admin | Update tariff rates |

---

### Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/send-bill-sms/` | Admin/Reader | Send SMS or WhatsApp notification for a bill via Twilio |

**Body:** `{ "bill_id": 42 }`

---

## 8. Web Dashboard (energy-hub-ui)

### Pages

| Page | Route | Features |
|------|-------|---------|
| **Login** | `/login` | Username/password form, redirects based on role |
| **Dashboard** | `/` | KPI cards (consumers, revenue, pending), quick stats |
| **Consumers** | `/consumers` | Full CRUD with search + status filters, paginated table |
| **Billing** | `/billing` | Bill list with status/account type/date filters, mark paid/unpaid, finalize, PDF download |
| **Readings** | `/readings` | Readings list with manual read submission form |
| **Import Readings** | `/import-readings` | Drag-and-drop Excel upload, 3-col or 4-col auto-detected |
| **Reports** | `/reports` | Bar charts (top consumers, monthly usage), pie chart (revenue breakdown) |
| **Settings** | `/settings` | Edit tariff rates (rate/unit, fixed charge, duty %, meter rent) |

---

## 9. Mobile App (eMeterApp)

### Screens & Navigation

```
LoginScreen
    └──► (authenticated)
         AppNavigator (Bottom Tab)
         ├── Dashboard Tab → DashboardScreen
         │       Live stats, pending count, sync button
         ├── Search Tab → SearchScreen
         │       ├── SubmitReadingScreen
         │       │       Live estimate preview while typing
         │       │       Offline-first: saves locally before network call
         │       ├── BillPreviewScreen
         │       │       Charge breakdown, PDF download, WhatsApp notification
         │       └── AddConsumerScreen
         │               Register new consumer from mobile
         ├── History Tab → HistoryScreen
         │       Reading history, offline queue view, sync now, export Excel
         └── Profile Tab (inline)
                 User info, logout, navigate to SettingsScreen
```

### Key Mobile Features
- **Offline-first reading submission**: Reading is always saved to `AsyncStorage` before attempting network submission.
- **Live bill estimate**: Debounced API call to `/api/calculate-estimate/` as the reader types — single source of truth, no client-side billing math.
- **Sync queue**: `HistoryScreen` shows pending/failed offline readings and allows manual sync.
- **Excel export**: Offline readings can be exported as `.xlsx` and shared for manual admin import.
- **PDF bills**: Generated client-side from HTML template using `expo-print`.

---

## 10. Authentication & Roles

### Roles
| Role | Capabilities |
|------|-------------|
| `admin` | Full access: consumers, readings, billing, reports, settings, finalize, mark paid/unpaid |
| `meter_reader` | Submit readings, view consumers, view bills, mark paid, send SMS |

### How Auth Works
1. Client `POST /api/login/` with credentials.
2. Server returns a **DRF Token** in the JSON response body.
3. Client stores token in `AsyncStorage` (mobile) or session cookie (web).
4. All subsequent requests include `Authorization: Token <token>` header.
5. Web SPA additionally uses Django sessions + CSRF (via `CsrfExemptSessionAuthentication`).

### Decorators (Backend)
- `@require_authenticated` — Rejects unauthenticated requests with 401.
- `@require_role('admin')` — Restricts to admin only; also enforces authentication.
- `@require_role('admin', 'meter_reader')` — Allows either role.

---

## 11. Billing Workflow

```
[Meter Reader]                    [Admin]
      │                               │
      ▼                               │
Submit Reading ──────────────────────►│
(POST /api/reading-and-bill/)         │
      │                               │
      ▼                               │
  DRAFT Bill created                  │
  BillingService.calculate_bill()     │
  (tiered tariff applied)             │
      │                               │
      └──────────────────────────────►│
                               Finalize Bill
                        (POST /api/bills/<id>/finalize/)
                               Snapshots locked
                               status = 'finalized'
                                       │
                               Mark as Paid
                        (POST /api/bills/<id>/mark-paid/)
                               status = 'paid'
```

### Tiered Tariff Calculation (in `BillingService.calculate_bill`)
| Units | Rate per unit |
|-------|--------------|
| 0–100 | ₹5.00 |
| 101–300 | ₹7.00 |
| 301+ | ₹10.00 |

**Other charges:**
- Fixed charges = `load_kw × fixed_charge_per_kw` (from `BillingSettings`)
- Duty charge = `(energy + fixed) × duty_percentage / 100`
- Meter rent = `phase_1_rent` (1-phase meter) or `phase_3_rent` (3-phase meter)

**Total amount** = energy + fixed + duty + regulatory_surcharge + meter_rent + arrears + late_payment_surcharge

### Bill Lock (Immutable Snapshots)
Once `finalize_bill()` is called:
- `is_locked = True`
- Snapshot fields are written once and never recalculated from live data
- Any attempt to modify financial fields on a locked bill raises `ValidationError`
- PDF generation for locked bills uses snapshot data — ensuring the PDF matches what was billed

---

## 12. Offline Sync (Mobile)

### Flow
1. Reader enters a reading value.
2. `saveOfflineReading()` stores it in `AsyncStorage` under key `offline_readings_queue`.
3. `submitReadingAndBillAPI()` is called. If it succeeds, the item is marked `synced`.
4. If the network fails, the item stays as `pending` and an alert informs the reader.
5. On `HistoryScreen`, the reader can tap "Sync Now" → `syncOfflineReadings()` iterates the queue and submits each pending reading.
6. Failed items are marked `failed` with the error message, allowing retry.
7. Synced items older than 24 hours are automatically cleaned from the queue.

### Offline Queue Item Structure
```json
{
  "id": "offline_1715000000_1234",
  "consumer_id": 5,
  "consumer_name": "Ahmed Ali",
  "consumer_number": "CN001234",
  "meter_number": "M001",
  "current_reading": 3450,
  "previous_reading": 3200,
  "reading_date": "2025-05-01",
  "status": "pending",
  "savedAt": "2025-05-01T10:30:00.000Z"
}
```

---

## 13. PDF Generation

Two PDF paths exist:

### Path 1 — Backend PDF (`BillPDFGenerator`)
- Uses `xhtml2pdf` (pisa) to render `billing/bill_pdf.html` template.
- Triggered by `GET /api/bill/<id>/pdf/`.
- Uses snapshot data for finalized bills; live data for draft previews.
- Logs a `pdf_gen` audit entry.

### Path 2 — Mobile PDF (Client-Side)
- `BillPreviewScreen` builds an HTML string from bill data.
- Uses `expo-print` to convert HTML → PDF.
- Uses `expo-sharing` to present the OS share sheet.
- Entirely client-side; does not require backend involvement.

---

## 14. SMS / WhatsApp Notifications

Endpoint: `POST /api/send-bill-sms/`

1. Fetches bill and consumer from DB.
2. Composes a message with bill number, units, amount, due date.
3. If Twilio credentials are configured (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`):
   - Sends via SMS or WhatsApp (auto-detects from `TWILIO_WHATSAPP_FROM` prefix).
   - If phone number lacks `+` prefix, prepends `+91` (India).
4. If Twilio is not configured, returns `success: true, sms_sent: false` with message preview — allowing the UI to show what would have been sent without crashing.

---

## 15. Excel Import

Endpoint: `POST /api/readings/import-excel/` (multipart/form-data, field: `file`)

### Supported Layouts (Auto-Detected)
| Column | 4-Column Layout (recommended) | 3-Column Layout (legacy) |
|--------|-------------------------------|--------------------------|
| A | Consumer Number | Consumer Number |
| B | Meter Number | Current Reading |
| C | Current Reading | Reading Date (optional) |
| D | Reading Date (optional) | — |

### Validation Steps (per row)
1. **Consumer Number lookup** — must exist in DB.
2. **Meter number cross-check** — if provided, must match the registered meter for that consumer.
3. **Duplicate check** — no existing reading for the same consumer in the same billing month.
4. **Reading value validation** — must be ≥ previous reading; must be a valid number.
5. **Save + bill creation** — wrapped in `transaction.atomic()`.

### Response
```json
{
  "success": true,
  "layout_detected": "4-column",
  "message": "Import complete — 15 bill(s) generated, 2 failed.",
  "success_count": 15,
  "error_count": 2,
  "bills": [...],
  "errors": ["Row 3 (CN001): Reading 100 < previous 200. Rejected.", ...]
}
```

---

## 16. Environment Variables

Create a `.env` file inside `electricity_system/`:

```env
# Django
DJANGO_SECRET_KEY=your-secret-key-here
DEBUG=True

# Database (PostgreSQL)
DB_ENGINE=django.db.backends.postgresql
DB_NAME=emeter_db
DB_USER=emeter_user
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

# Twilio (optional — for SMS/WhatsApp)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

For the mobile app, create `eMeterApp/.env`:
```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:8000
```

---

## Running Tests

```bash
# Backend unit + integration tests
cd electricity_system
python manage.py test billing --settings=electricity_system.test_settings

# Mobile Jest tests
cd eMeterApp
npm test
```
