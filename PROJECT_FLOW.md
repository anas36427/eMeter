# eMeter AMU — Complete Project Flow & System Architecture

Welcome to **eMeter AMU**, the unified, state-of-the-art Electricity Billing Management System developed for Aligarh Muslim University. This documentation provides a comprehensive, end-to-end guide to the system’s architecture, operational workflows, API endpoints, setup instructions, and design patterns.

---

## 1. Project Overview

eMeter AMU is a high-fidelity **full-stack monorepo** designed to digitize and automate the entire utility billing cycle on campus. It replaces legacy paper records and manual billing calculations with a secure, automated, and offline-first digital infrastructure.

The project is structured as a three-tier system:
*   **Backend & Single Source of Truth:** Django 6 API with PostgreSQL 16 database.
*   **Web Portal (Admin Control Center):** React SPA built with Vite and TypeScript (served securely by the Django server).
*   **Mobile App (Meter Reader Tool):** React Native (Expo) client designed for offline-first data capture in the field.

---

## 2. System Architecture & Component Mapping

The repository is organized as a clean monorepo containing three core sub-projects:

```
/Users/anasahmad/Documents/eMeter.web
├── electricity_system/       # Django Backend (PostgreSQL, DRF, Whitenoise, xhtml2pdf)
├── energy-hub-ui/            # React + TS Web Dashboard (Vite, TailwindCSS, Recharts)
└── eMeterApp/                # React Native Mobile App (Expo SDK 52, AsyncStorage, XLSX)
```

### Integrated Request Flow

```
   ┌─────────────────────────────────────────────────────────────┐
   │                       eMeter Database                       │
   │                        [PostgreSQL]                         │
   └──────────────────────────────▲──────────────────────────────┘
                                  │ (Django ORM)
   ┌──────────────────────────────┴──────────────────────────────┐
   │                    Django API & Web Server                  │
   │                   [electricity_system]                      │
   └──────────▲────────────────────────────────────────▲─────────┘
              │ (Token Auth over HTTPS)                │ (Session Auth / WhiteNoise)
   ┌──────────┴──────────┐                  ┌──────────┴──────────┐
   │  React Native App   │                  │  React Dashboard    │
   │    [eMeterApp]      │                  │   [energy-hub-ui]   │
   └─────────────────────┘                  └─────────────────────┘
```

1.  **Vite Web Build Serving:** The React web app is built into static assets. Django's `spa_index` catch-all view servers the React `index.html` from `energy-hub-ui/dist/` and delivers static assets directly using WhiteNoise.
2.  **API Communication:** The React Native Mobile app communicates directly with `/api/` endpoints using Django REST Framework (DRF) token-based authentication (`Authorization: Token <token>`). The Web portal interacts using session authentication combined with standard CSRF protection.

---

## 3. How to Set Up & Run the Project

### Prerequisites
Ensure the following are installed:
*   **Python 3.11+**
*   **PostgreSQL 16**
*   **Node.js 18+** & **npm**
*   **Expo Go App** (installed on your iOS/Android device for testing)

---

### Step 1: Setting up the Django Backend

Navigate to the `electricity_system` directory:
```bash
cd electricity_system
```

1.  **Virtual Environment:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```
2.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
3.  **Environment Configuration:**
    Create a `.env` file in the `electricity_system` root (or copy `.env.example`):
    ```env
    DEBUG=True
    DJANGO_SECRET_KEY=your-custom-super-secret-key
    DB_ENGINE=django.db.backends.postgresql
    DB_NAME=emeter_db
    DB_USER=emeter_user
    DB_PASSWORD=your_secure_password
    DB_HOST=localhost
    DB_PORT=5432
    ```
4.  **Database Operations:**
    Create the database `emeter_db` in PostgreSQL, then run migrations:
    ```bash
    python manage.py makemigrations
    python manage.py migrate
    ```
5.  **Create Admin User:**
    ```bash
    python manage.py runscript create_superuser
    # OR manual creation:
    python manage.py createsuperuser
    ```
6.  **Run Server:**
    ```bash
    python manage.py runserver 0.0.0.0:8000
    ```

The backend API will now be live at `http://localhost:8000/`.

---

### Step 2: Running the React Web Dashboard (Development Mode)

Navigate to the `energy-hub-ui` directory:
```bash
cd ../energy-hub-ui
```

1.  **Install Packages:**
    ```bash
    npm install
    ```
2.  **Start Development Server:**
    ```bash
    npm run dev
    ```
    The Vite server will start on `http://localhost:5173`.

3.  **Compiling for Production serving:**
    To build the SPA so that it is served directly from the Django backend:
    ```bash
    npm run build
    ```
    This outputs the built SPA into `energy-hub-ui/dist/` which is dynamically read by Django's template files and static asset handlers.

---

### Step 3: Running the React Native Mobile App

Navigate to the `eMeterApp` directory:
```bash
cd ../eMeterApp
```

1.  **Install Packages:**
    ```bash
    npm install
    ```
2.  **Configure API Base URL:**
    Create an `.env` file or verify `src/services/api.js` to ensure the API endpoint points to your computer's **Local Network IP Address** (e.g., `http://192.168.1.100:8000`), so the physical device or emulator can communicate with the backend:
    ```env
    EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_MACHINE_IP>:8000
    ```
3.  **Start Expo Packager:**
    ```bash
    npx expo start
    ```
    Scan the generated QR code using your phone's **Expo Go** application (or run inside an emulator).

---

## 4. Complete API Endpoints Reference

All backend API endpoints are prefixed with `/api/`. 

### Authentication Endpoints
*   `GET /api/csrf/`
    *   **Auth:** None
    *   **Description:** Returns the CSRF token and sets the session cookie. Must be invoked by the browser app before authentication.
*   `POST /api/login/`
    *   **Auth:** None
    *   **Description:** Authenticates user credentials. Returns the DRF token, user role, and username.
*   `GET /api/me/`
    *   **Auth:** Authenticated (Token/Session)
    *   **Description:** Fetches current user profile details, including their username, email, and role.
*   `POST /api/profile/update/`
    *   **Auth:** Authenticated
    *   **Description:** Updates current user's profile details.
*   `POST /api/logout/`
    *   **Auth:** Authenticated
    *   **Description:** Destroys user session on server and revokes the active token.

### Dashboard & Analytics (Admin-Only)
*   `GET /api/dashboard-stats/`
    *   **Auth:** Authenticated (Admin + Meter Reader roles allowed)
    *   **Description:** Returns real-time KPI counts: total consumers, total readings, total sync online, and current month's power usage.
*   `GET /api/reports-data/`
    *   **Auth:** Authenticated (Admin only)
    *   **Description:** Fetches detailed usage breakdowns: top 10 consumers by load, monthly comparison, and salary vs non-salary billing totals for graphs.

### Consumer Management
*   `GET /api/consumers/`
    *   **Auth:** Authenticated (Admin & Reader)
    *   **Description:** Lists all registered utility consumers in the database, including address, phone, and meter info.
*   `POST /api/consumers/`
    *   **Auth:** Authenticated (Admin & Reader)
    *   **Description:** Registers a new consumer with connection type (Salary / Non-Salary), meter type (1-Phase / 3-Phase), and load rating (1-5 kW).
*   `GET /api/consumers/<id>/`
    *   **Auth:** Authenticated
    *   **Description:** Retrieves full profile details of a single consumer.
*   `PUT/PATCH /api/consumers/<id>/`
    *   **Auth:** Authenticated (Admin & Reader)
    *   **Description:** Updates consumer parameters.
*   `DELETE /api/consumers/<id>/`
    *   **Auth:** Authenticated (Admin & Reader)
    *   **Description:** Deletes a consumer from the system.
*   `GET /api/consumers/search/?meter_number=<q>`
    *   **Auth:** Authenticated
    *   **Description:** Searches registered accounts dynamically by matching names, meter numbers, or consumer IDs.
*   `GET /api/consumer/<id>/readings/`
    *   **Auth:** Authenticated
    *   **Description:** Returns full historical list of meter readings for a specific consumer.

### Meter Readings Endpoints
*   `GET /api/readings/`
    *   **Auth:** Authenticated (Admin & Reader)
    *   **Description:** Lists all readings taken across the entire network.
*   `POST /api/submit-reading/`
    *   **Auth:** Authenticated (Admin & Reader)
    *   **Description:** Submits a new meter reading. Automatically validates that the reading value is not lower than the previous reading.
*   `POST /api/reading-and-bill/`
    *   **Auth:** Authenticated (Admin & Reader)
    *   **Description:** Highly optimized mobile endpoint. Accepts a reading submission, processes it, and automatically returns the calculated `DRAFT` bill details in a single atomic transaction.
*   `PUT/PATCH /api/edit-reading/<id>/`
    *   **Auth:** Authenticated (Admin & Reader)
    *   **Description:** Modifies today's submitted reading. It also automatically recalculates and updates the linked draft bill's charges to prevent inconsistencies.
*   `POST /api/readings/import-excel/`
    *   **Auth:** Authenticated (Admin only)
    *   **Description:** Bulk imports readings from a spreadsheet (Excel file). Validates consumer matching, meter number accuracy, duplicate entries, and value safety before saving.

### Billing Management
*   `GET /api/bills/`
    *   **Auth:** Authenticated (Admin & Reader)
    *   **Description:** Returns a paginated list of bills with filters: `status`, `accountType`, `startDate`, `endDate`, `sortOrder`, and text search.
*   `GET /api/bill/<id>/`
    *   **Auth:** Authenticated
    *   **Description:** Retrieves granular details of a single bill.
*   `GET /api/bill/<id>/pdf/`
    *   **Auth:** Authenticated
    *   **Description:** Renders a gorgeous PDF copy of the bill. It uses historical snapshots if the bill is finalized, or live calculations if it is in draft form.
*   `POST /api/bills/<id>/finalize/`
    *   **Auth:** Authenticated (Admin only)
    *   **Description:** Finalizes a draft bill. Freezes all parameters (charges, consumer name, load) into immutable snapshot fields and locks the bill from future edits.
*   `POST /api/bills/<id>/mark-paid/`
    *   **Auth:** Authenticated
    *   **Description:** Marks a finalized bill as paid. Generates a payment receipt transaction.
*   `POST /api/bills/<id>/mark-unpaid/`
    *   **Auth:** Authenticated (Admin only)
    *   **Description:** Reverts bill payment status back to unpaid (finalized state).
*   `POST /api/bills/manual-generate/`
    *   **Auth:** Authenticated (Admin only)
    *   **Description:** Direct creation of a bill (e.g. for special consumers) without needing an active meter reading file.

### Tariff Settings & Calculations
*   `GET /api/settings/`
    *   **Auth:** Authenticated (Admin only)
    *   **Description:** Fetches global system settings: rate per unit, fixed charge per kW, phase rents, and tax percentages.
*   `POST /api/settings/update/`
    *   **Auth:** Authenticated (Admin only)
    *   **Description:** Modifies global system rates.
*   `POST /api/calculate-estimate/`
    *   **Auth:** Authenticated
    *   **Description:** Single source of truth estimation endpoint. Calculates exact bill estimations dynamically using the active database values, without committing anything to the DB. Used by the mobile app for live, real-time typing estimates.

### Notifications
*   `POST /api/send-bill-sms/`
    *   **Auth:** Authenticated
    *   **Description:** Composes bill notification details and sends an SMS/WhatsApp alert to the consumer's registered phone number via Twilio.

---

## 5. Core Operational Workflows

### The Complete Billing Life Cycle

The lifecycle of an electricity bill consists of three main stages:

```
[ Meter Reading Taken ]
           │
           ▼
┌──────────────────────┐
│      DRAFT BILL      │  ◄── Live calculations, charges can be edited
└──────────┬───────────┘
           │ (Admin Finalization)
           ▼
┌──────────────────────┐
│    FINALIZED BILL    │  ◄── Locked & frozen. Snapshots written. PDF locked.
└──────────┬───────────┘
           │ (Payment Logged)
           ▼
┌──────────────────────┐
│      PAID BILL       │  ◄── Closed transaction, receipt generated
└──────────────────────┘
```

1.  **Draft Stage:**
    *   A meter reader takes a reading in the field.
    *   `BillingService.calculate_bill()` executes. It processes the energy charges using the tiered tariff logic:
        *   **0–100 units:** ₹5.00 / unit
        *   **101–300 units:** ₹7.00 / unit
        *   **301+ units:** ₹10.00 / unit
    *   It calculates **Fixed Charges** (`load_kw * fixed_charge_per_kw`), **Duty Charges** (`7.5%` of energy + fixed), and **Meter Rent** based on phase type (Standard ₹10, Enhanced ₹25).
2.  **Finalization Stage:**
    *   Administrators review draft bills. Once approved, `finalize_bill()` is triggered.
    *   `is_locked` is flagged as `True`.
    *   Granular snapshot fields (e.g. `consumer_name_snapshot`, `total_amount_snapshot`, `meter_number_snapshot`) are populated with the exact values at that second. Even if the consumer changes their name later or the global tariff settings update next month, **this finalized bill remains perfectly intact and mathematically accurate forever.**
3.  **Payment Stage:**
    *   Payments are received (Online or Cash). The status transitions to `paid` and a transaction ID is captured.

---

### The Offline Sync Workflow (Mobile)

Because campus meter readers often operate in basements or areas with poor cellular reception, eMeter AMU features a robust offline synchronization pipeline:

```
  Reader submits reading
          │
          ▼
┌──────────────────────────┐
│   Write to Local Queue   │ (AsyncStorage: 'offline_readings_queue')
└─────────┬────────────────┘
          │ (Attempt API Submit)
          ├───► Success?  ───► Mark Sync, delete logs older than 24h
          │
          └───► Failure?  ───► Keep in queue as 'pending' / 'failed', log error
                                  │
                                  ▼
                     [ Open Queue Inspector ]
                                  │
                       Show consumer entries & specific errors
                                  │
                                  ├─► Trash icon: Remove corrupted entry
                                  │
                                  └─► Tap Sync: Batch uploads remaining items
```

*   **Pulsing network detection:** The dashboard actively senses network availability. If the backend is unreachable, the app visually guides the reader to "Offline Mode".
*   **Queue Inspector drawer:** A high-fidelity drawer showing exact pending items, specific failure logs (e.g. duplicate month error), and single-item delete options to ensure readers have complete control.
