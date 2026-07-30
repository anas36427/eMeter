# eMeter AMU — Project Structure Documentation

This document provides a comprehensive overview of the eMeter repository structure. The project is designed as a three-tier, cross-platform monorepo containing the Django REST backend, the React web dashboard, and the React Native mobile application.

## High-Level Architecture

The root directory contains three main applications, some shared packages (optional), and project-level scripts and documentation.

```text
eMeter.web/
├── electricity_system/      # 1. Django REST Framework Backend
├── energy-hub-ui/           # 2. React (Vite) Web SPA for Admins and Consumers
├── eMeterApp/               # 3. React Native (Expo) Mobile App for Meter Readers
├── packages/                # Shared utilities (UI, models, API client)
├── start_tunnel.command     # Helper script to expose local server to mobile
├── START_PROJECT.sh         # Convenience script to start all 3 services locally
└── [Documentation Files]    # .tex, .md files (User Manuals, APIs, etc.)
```

---

## 1. Backend (`electricity_system/`)
This is the core business logic, database management, and API layer built with Django.

```text
electricity_system/
├── manage.py                   # Django's command-line utility
├── db.sqlite3                  # Local development database (PostgreSQL in prod)
├── requirements.txt            # Python dependencies
├── Procfile / render.yaml      # Deployment configurations for Render
├── electricity_system/         # Core Django settings folder
│   ├── settings.py             # Global configurations, DB connection, DRF settings
│   ├── urls.py                 # Root URL routing (points to billing.urls)
│   └── authentication.py       # Custom JWT and Session auth logic
│
└── billing/                    # The main Django Application
    ├── models.py               # Database schema (Consumer, MeterReading, Bill, etc.)
    ├── views.py                # API Endpoint controllers
    ├── urls.py                 # API route definitions (/api/...)
    ├── services.py             # Billing Calculation Engine (BillingService)
    ├── serializers.py          # Data validation and JSON serialization
    ├── permissions.py          # Role-based access control (Admin vs Reader)
    ├── pdf_generator.py        # ReportLab logic for generating PDF bills
    ├── admin.py                # Django admin panel registrations
    └── migrations/             # Database migration tracking files
```

---

## 2. Admin Web Dashboard (`energy-hub-ui/`)
This is the web-based administrative panel and consumer self-service portal, built with React, Vite, and Tailwind CSS.

```text
energy-hub-ui/
├── package.json                # Node dependencies
├── vite.config.ts              # Vite bundler configuration
├── tailwind.config.ts          # Tailwind CSS styling configuration
├── index.html                  # Main HTML entry point
│
└── src/
    ├── main.tsx                # React application mount point
    ├── App.tsx                 # Root component and Router definitions
    ├── lib/                    
    │   ├── api.ts              # Axios client configured to talk to the Django backend
    │   └── utils.ts            # Formatting helpers
    │
    ├── contexts/               # React Context Providers
    │   ├── AuthContext.tsx     # Manages Admin/Reader JWT sessions
    │   └── ConsumerAuthContext.tsx # Manages Consumer portal sessions
    │
    ├── components/             
    │   ├── layout/             # Reusable shell (Sidebar, TopNav)
    │   └── ui/                 # Shadcn-UI component library (buttons, tables, dialogs)
    │
    └── pages/                  # Route-level Page Components
        ├── Dashboard.tsx       # Admin Dashboard view
        ├── Consumers.tsx       # Consumer management table
        ├── Readings.tsx        # Meter reading input and history
        ├── Billing.tsx         # Ledger and PDF downloads
        ├── ImportReadings.tsx  # Bulk Excel upload handler
        ├── Reports.tsx         # Data visualization and charts
        ├── Settings.tsx        # Billing tariff configuration
        └── Consumer*.tsx       # Consumer Portal specific pages
```

---

## 3. Mobile App (`eMeterApp/`)
The mobile application used by field meter readers to submit readings online and offline. Built with React Native and Expo.

```text
eMeterApp/
├── package.json                # Node/Expo dependencies
├── app.json / eas.json         # Expo configuration and build profiles
├── App.js                      # Root component, Context Providers, and Navigation Container
│
└── src/
    ├── navigation/
    │   └── AppNavigator.js     # React Navigation stack (Screens routing)
    │
    ├── screens/                # Mobile Views
    │   ├── LoginScreen.js      # Reader authentication
    │   ├── DashboardScreen.js  # Main hub, sync status, and offline queue alert
    │   ├── SearchScreen.js     # Fast consumer search (works offline)
    │   ├── SubmitReadingScreen.js # Reading input and live bill estimation
    │   ├── BillPreviewScreen.js # Post-submission bill review
    │   └── HistoryScreen.js    # Log of submitted readings
    │
    ├── services/               # Core Logic & Network layer
    │   ├── api.js              # Online Axios calls to Django backend
    │   ├── sqliteDb.js         # Offline SQLite database management
    │   ├── offlineStorage.js   # Reading queue manager and Auto-Sync logic
    │   └── offlineAuth.js      # Local login persistence
    │
    ├── context/                # State management
    │   └── AuthContext.js      # Manages user token and login state
    │
    └── components/             # Reusable UI parts
        └── OfflineBanner.js    # Displays un-synced readings alert
```

---

## Key Integration Points

- **Authentication:** Both `energy-hub-ui` and `eMeterApp` authenticate against `electricity_system/billing/views.py` (`/api/login/`). The backend issues a JWT token which the frontends attach to the `Authorization` header of subsequent requests.
- **Billing Engine:** The mobile app's `SubmitReadingScreen.js` hits the `/api/calculate-estimate/` endpoint for a live preview. Upon final submission, it hits `/api/reading-and-bill/`, which securely calls `BillingService.generate_final_bill()` in the backend to ensure data integrity.
- **Offline Sync:** The Admin Web dashboard can export an `eMeter_Offline_Sync.json` file. The Mobile App can ingest this file to populate its internal SQLite database (managed by `sqliteDb.js`), allowing readers to search and save readings completely offline. Once internet is restored, `offlineStorage.js` pushes the queued readings back to the Django API.
