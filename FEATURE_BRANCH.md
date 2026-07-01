# Feature Branch: `feature/consumer-portal`

> **Branch created from:** `main`
> **Last Updated:** June 29, 2026
> **Status:** In Development (uncommitted changes)

---

## Overview

This branch introduces a complete **Consumer Self-Service Portal**, a comprehensive **Offline Data Sync System** for meter readers, and multiple bug fixes and improvements across the Django backend, React web admin, and React Native mobile app.

---

## ✅ Features Added

### 1. Consumer Self-Service Portal (Web)
**Why:** Previously, consumers had no way to view their own bills, readings, or account details. They had to call or visit the office to get any information. This portal gives every consumer a private, secure login to view their own data 24/7.

**What was built:**
- **Consumer Login Page** (`/consumer-login`) — A dedicated login page for consumers, completely separate from the Admin login. Consumers log in using their Consumer Number and a password set by the Admin.
- **Consumer Dashboard** (`/consumer/dashboard`) — Shows the consumer's account summary, current balance, and latest meter reading at a glance.
- **Consumer Bills Page** (`/consumer/bills`) — Full billing history with downloadable bill details for every month.
- **Consumer Readings Page** (`/consumer/readings`) — Complete meter reading history showing previous readings, current readings, and units consumed.
- **Consumer Change Password Page** (`/consumer/change-password`) — Allows consumers to securely update their own password without needing Admin intervention.
- **Consumer Auth Context** (`ConsumerAuthContext.tsx`) — A React context that manages consumer session state, login/logout, and token storage separately from the Admin session.

**Files Added:**
- `energy-hub-ui/src/pages/ConsumerLogin.tsx`
- `energy-hub-ui/src/pages/ConsumerDashboard.tsx`
- `energy-hub-ui/src/pages/ConsumerBills.tsx`
- `energy-hub-ui/src/pages/ConsumerReadings.tsx`
- `energy-hub-ui/src/pages/ConsumerChangePassword.tsx`
- `energy-hub-ui/src/contexts/ConsumerAuthContext.tsx`

**Files Modified:**
- `energy-hub-ui/src/App.tsx` — New routes added for all Consumer Portal pages.

---

### 2. Offline Consumer Data Sync (Mobile App + Web Admin + Backend)
**Why:** Meter readers often work in areas with zero mobile signal. Without internet, the app could not load consumer data for search or meter reading submission. The Offline Sync system solves this by letting the Admin export a snapshot of all consumer data into a single JSON file, which meter readers import into their phones. The app then works fully offline using this locally cached data.

**How it works:**
1. Admin logs into the Web Portal → Settings → clicks **"Export Sync File"**.
2. A `eMeter_Offline_Sync.json` file is downloaded.
3. Meter Reader receives the file (via WhatsApp, Bluetooth, etc.).
4. Meter Reader logs into the mobile app → Dashboard → taps **"Import Data"**.
5. The app reads the JSON file and caches all consumer data into its local SQLite database.
6. The app can now search consumers and record readings without any internet.

**What the JSON file contains:**
- All consumer records (Consumer Number, Name, Address, Meter Number, Connection Type, Load KW, Previous Reading, Status)
- Billing Settings (Rate per unit, Fixed charge, Duty percentage, Phase rent)
- Export timestamp and version number

**Files Modified:**
- `electricity_system/billing/views.py` — Added `export_mobile_sync` API endpoint that generates the JSON file.
- `electricity_system/billing/urls.py` — Registered the new export URL.
- `energy-hub-ui/src/pages/Settings.tsx` — Added "Mobile App Sync" section with the Export Sync File button.
- `eMeterApp/src/services/offlineStorage.js` — Added `importSyncFile()` function to parse the JSON and write consumers + billing settings into local SQLite.
- `eMeterApp/src/screens/DashboardScreen.js` — Added "Import Data" Quick Action button that opens a document picker.

---

### 3. SQLite Local Database (Mobile App)
**Why:** The mobile app previously had no local storage. If a meter reader lost internet mid-shift, all unsaved readings would be lost. SQLite provides a persistent, offline-capable local database on the phone itself.

**What was built:**
- Local SQLite database initialized on app startup.
- `consumers` table — caches all imported consumers for offline search.
- `offline_queue` table — stores meter readings that couldn't be submitted online, to be synced later.
- `billing_settings` table — stores the latest billing configuration for offline bill estimation.
- `activity_logs` table — stores recent app activity for the Activity Feed on the Dashboard.

**Files Modified:**
- `eMeterApp/src/services/sqliteDb.js` — Full SQLite schema, initialization, and query helper functions.

---

### 4. Offline Reading Queue & Push Sync (Mobile App)
**Why:** When a meter reader records a reading without internet, it should not be lost. The Offline Queue automatically saves the reading locally and lets the reader push all saved readings to the server the moment internet is available again.

**What was built:**
- Every reading submission first checks for internet connectivity.
- If offline → reading is saved to local SQLite `offline_queue` table.
- **"Push Sync Queue"** Quick Action button on Dashboard → pushes all queued readings to the server in one tap.
- **Queue Inspector** — lets the reader see every pending reading in the queue before pushing.
- Activity log entry created for every successful sync.

---

### 5. Consumer Role in Database (Backend)
**Why:** To support the Consumer Portal, consumers needed their own login credentials and role in the system. Previously, only Admin and Meter Reader roles existed.

**Files Modified:**
- `electricity_system/billing/models.py` — Added `consumer` role to the User model.
- `electricity_system/billing/migrations/0004_consumer_role.py` — Database migration for the new role.

---

## ❌ Features Removed

### 1. Offline Login (Login Without Internet)
**What it was:** Previously, the Login Screen had an "Offline Setup / Import Data" button. When tapped, it let users import a JSON file containing hashed reader passwords. The app would then verify the password locally using PBKDF2-SHA256 hashing, allowing the reader to log in with zero internet.

**Why it was removed:**
- **Security Risk:** Storing hashed passwords (even PBKDF2 hashes) in a JSON file sent over WhatsApp or Bluetooth is a security vulnerability. If the file is intercepted, attackers have offline time to brute-force the password.
- **Unnecessary Complexity:** Since readers always need internet to eventually push readings to the server, requiring internet at login is a reasonable and much simpler constraint.
- **Simplified UX:** Removing offline login eliminates user confusion about when to use the button and why login failed.

**What was changed:**
- Removed the `Offline Setup / Import Data` button from `LoginScreen.js`.
- Removed the `handleOfflineSetup` function from `LoginScreen.js`.
- Removed the offline password verification fallback in the `handleLogin` catch block.
- Removed `verifyDjangoPassword()` PBKDF2 function from `LoginScreen.js`.
- Removed `CryptoJS`, `expo-document-picker`, and `sqliteDb` imports from `LoginScreen.js`.

---

### 2. Reader Passwords in JSON Export File
**What it was:** The `eMeter_Offline_Sync.json` export file previously contained a `readers` array with each meter reader's `id`, `username`, `name`, and `password_hash` (Django PBKDF2 hash).

**Why it was removed:**
- **Security:** Exporting password hashes into a file distributed over WhatsApp/Bluetooth is a serious security flaw, regardless of how strong the hashing algorithm is.
- **No longer needed:** Since offline login was removed, there is no reason to include reader credentials in the sync file at all.

**What the file now contains (only):**
```json
{
  "version": 1,
  "exported_at": "2026-06-29T...",
  "consumers": [...],
  "settings": {...}
}
```

**What was changed:**
- `electricity_system/billing/views.py` — Removed the readers query and `readers_data` array from `export_mobile_sync`.
- `eMeterApp/src/services/offlineStorage.js` — Removed the loop that inserted reader records into the local `users` SQLite table.
- `eMeterApp/src/screens/DashboardScreen.js` — Updated the success alert to show only consumer count (not reader count).

---

## 🔧 Bug Fixes & Improvements

| Fix | Where | Why |
|-----|-------|-----|
| Forced Offline Mode removed from `api.js` | Mobile App | Was temporarily injected for testing purposes only. Left in by accident. |
| Login error message improved | `LoginScreen.js` | Changed from "Offline login also failed" to "Please check your internet connection" — cleaner UX. |
| Export Sync File description updated | `Settings.tsx` | Old description mentioned reader data. Updated to accurately describe what the file now contains. |
| Django server DB connection timeout handling | Backend | Neon cloud database sleeps after inactivity. Django server now restarts cleanly when this happens instead of crashing permanently. |

---

## 🗂️ File Change Summary

### New Files
| File | Purpose |
|------|---------|
| `energy-hub-ui/src/pages/ConsumerLogin.tsx` | Consumer login page |
| `energy-hub-ui/src/pages/ConsumerDashboard.tsx` | Consumer dashboard |
| `energy-hub-ui/src/pages/ConsumerBills.tsx` | Consumer billing history |
| `energy-hub-ui/src/pages/ConsumerReadings.tsx` | Consumer reading history |
| `energy-hub-ui/src/pages/ConsumerChangePassword.tsx` | Consumer password change |
| `energy-hub-ui/src/contexts/ConsumerAuthContext.tsx` | Consumer session management |
| `electricity_system/billing/migrations/0004_consumer_role.py` | DB migration for consumer role |
| `electricity_system/generate_test_data.py` | Script to seed test consumers |

### Modified Files
| File | Summary of Changes |
|------|--------------------|
| `energy-hub-ui/src/App.tsx` | Added consumer portal routes |
| `energy-hub-ui/src/pages/Settings.tsx` | Added Export Sync File button, updated description |
| `energy-hub-ui/src/pages/Consumers.tsx` | Consumer portal improvements |
| `electricity_system/billing/views.py` | Added export_mobile_sync endpoint, removed reader passwords from export |
| `electricity_system/billing/urls.py` | Registered export sync URL |
| `electricity_system/billing/models.py` | Added consumer role |
| `electricity_system/electricity_system/settings.py` | Config updates |
| `eMeterApp/src/screens/LoginScreen.js` | Removed offline login button and logic |
| `eMeterApp/src/screens/DashboardScreen.js` | Added Import Data button, updated sync alerts |
| `eMeterApp/src/screens/SettingsScreen.js` | Theme and settings updates |
| `eMeterApp/src/services/offlineStorage.js` | Added importSyncFile(), removed reader password handling |
| `eMeterApp/src/services/sqliteDb.js` | Full SQLite schema and initialization |
| `eMeterApp/src/services/api.js` | Removed forced offline testing code |

---

## 🔒 Main Branch Safety

The `main` branch is **100% safe and untouched**. Since none of the changes in this branch have been committed yet, `main` remains identical to the last stable release. You can switch back to `main` at any time with:

```bash
git stash
git checkout main
```

To commit all current changes to this feature branch:
```bash
git add .
git commit -m "feat: consumer portal, offline sync, remove offline login"
```
