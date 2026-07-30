# eMeter - Developer Handoff & Technical Guide

Welcome to the eMeter project. This document is designed to act as your primary technical reference. Whether you are onboarding to fix a bug, update a billing policy, or add a new feature, this guide contains the architectural context, setup instructions, and core logic explanations you need to work effectively.

---

## 1. Project Overview & Architecture

The eMeter system is a monorepo consisting of three distinct applications that communicate via a RESTful API.

### Technology Stack
*   **Backend (API & Billing Engine):** Python 3.10+, Django 4.2, Django REST Framework (DRF)
*   **Database:** PostgreSQL 16
*   **Admin & Consumer Web Portals:** React 18, TypeScript, Vite, TailwindCSS
*   **Mobile App (Field Operations):** React Native, Expo SDK, AsyncStorage

### The 3-Tier Architecture
1.  **Data Layer:** PostgreSQL acts as the single source of truth. All transactional boundaries (like creating a reading and generating a bill) are enforced here using ACID properties.
2.  **Logic Layer (Django):** Handles JWT authentication, Role-Based Access Control (RBAC), Excel parsing (`openpyxl`), PDF generation (`xhtml2pdf`), and the core billing algorithms.
3.  **Presentation Layer:** 
    *   `energy-hub-ui/`: The React web app containing both the Admin Dashboard and the Consumer Self-Service Portal.
    *   `eMeterApp/`: The Expo React Native mobile application for meter readers.

---

## 2. Core Business Logic & Workflows

To avoid introducing critical bugs, you must understand how these three core systems operate:

### A. The Billing Engine & Policy Snapshotting
Bills are not calculated using hardcoded math. Instead, the backend relies on the `BillingSettings` model (a single-row table containing unit rates, duty percentages, and meter rents).

> [!WARNING]
> **CRITICAL ARCHITECTURE RULE:** When a bill is generated, the backend copies (snapshots) the exact rates from `BillingSettings` into the `Bill` record. 
> 
> *Why?* If utility rates change next year, historical bills must not change. Never modify a past bill's total based on current settings. If you update the billing math in `views.py`, ensure you are reading from the snapshot fields for historical calculations, not the global settings.

### B. The Offline-First Mobile Sync
Meter readers operate in areas with poor internet (basements, rural areas). The React Native app is designed to be "Offline-First".
1.  **Capture:** The reader enters data.
2.  **Queue:** If `NetInfo` detects no connection, the reading is appended to a JSON array stored in local `AsyncStorage`.
3.  **Sync:** When the network returns, a background service iterates over the `AsyncStorage` queue, dispatching POST requests to the backend, and clears the local queue upon receiving a `201 Created` response.
*If you change the Reading payload structure, you must update both the API serializer and the React Native offline queue logic.*

### C. Consumer Portal Security Isolation
The Admin Dashboard and the Consumer Portal live in the same React codebase but are strictly isolated.
*   Admin/Reader tokens and Consumer tokens have different scopes. 
*   A consumer cannot access admin endpoints (`/api/bills/`), and must use consumer-specific endpoints (`/api/consumer/portal/bills/`).
*   **Bug Fixing Tip:** If a consumer reports missing data, check `consumer_portal_views.py` to ensure the queryset is strictly filtered by `request.user.consumer_profile`.

---

## 3. Local Environment Setup

Follow these steps to run the entire stack locally.

### Prerequisites
*   Node.js (v18+)
*   Python (3.10+)
*   PostgreSQL (16)
*   Expo Go app on your phone (or iOS/Android simulator)

### 1. Database Setup
```sql
CREATE DATABASE emeter;
CREATE USER emeter_admin WITH PASSWORD 'securepassword';
GRANT ALL PRIVILEGES ON DATABASE emeter TO emeter_admin;
ALTER DATABASE emeter OWNER TO emeter_admin;
```

### 2. Backend (Django) Setup
Navigate to the backend directory (`electricity_system/`):
```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # Or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Setup environment variables (create a .env file)
# Example .env:
# DB_NAME=emeter
# DB_USER=emeter_admin
# DB_PASSWORD=securepassword
# DB_HOST=localhost
# SECRET_KEY=your_secret_key

# Run migrations and start server
python manage.py migrate
python manage.py runserver
```

### 3. Frontend (React) Setup
Navigate to the frontend directory (`energy-hub-ui/`):
```bash
npm install

# Set up .env
# VITE_API_BASE_URL=http://localhost:8000/api

npm run dev
```

### 4. Mobile App (Expo) Setup
Navigate to the mobile directory (`eMeterApp/`):
```bash
npm install

# Set up .env
# EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:8000

npx expo start
```
*Note: The mobile app requires your local IP address (not localhost) if you are testing on a physical device on the same Wi-Fi network.*

---

## 4. Helpful Scripts & Developer Tools

The repository contains several scripts to help you test and debug without manual data entry. You can find these in the `electricity_system/` directory:

*   `create_sample_data.py`: Populates the database with dummy consumers, readings, and bills. Run this after a fresh migration.
*   `wipe_db.py`: Safely clears all transactional data (bills/readings) without deleting user accounts. Useful for resetting test environments.
*   `test_modules.py`: Contains the unit tests for the core billing mathematics. 

**Running Tests:**
```bash
python manage.py test
```

---

## 5. Known Limitations & Technical Debt

If you are tasked with scaling the system, pay attention to these areas:

1.  **PDF Generation Bottleneck:** The backend currently uses `xhtml2pdf` synchronously in the request-response cycle. If hundreds of users request PDFs simultaneously, the server will block. **Future Fix:** Offload PDF generation to an asynchronous Celery task queue using Redis.
2.  **Offline Sync Collisions:** If two different offline devices submit a reading for the exact same consumer for the same billing cycle, the backend currently accepts both. **Future Fix:** Implement a strict unique constraint on `(consumer_id, billing_period)` and handle the resulting 409 Conflict gracefully in the mobile app.
3.  **Hardcoded Mobile Styling:** Some styling in the Expo app uses hardcoded inline styles. Migrating the mobile app to use a centralized theme or NativeWind (Tailwind for React Native) will significantly improve maintainability.

---

## 6. Where to look when...

*   **A user reports a calculation error in a bill:** Check `electricity_system/billing/views.py` (specifically the `api_submit_reading_and_generate_bill` function) and the unit tests in `test_modules.py`.
*   **The mobile app won't sync:** Check `pushOfflineQueueToServer` in the mobile app's API service, and monitor the Django console for `401 Unauthorized` or `400 Bad Request` errors.
*   **Excel Import is failing:** The parsing happens on the backend in `api_import_readings`. Ensure the uploaded Excel file exactly matches the expected 3 or 4 column structure.
