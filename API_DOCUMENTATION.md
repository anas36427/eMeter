# eMeter API Endpoints Documentation

This document provides a comprehensive list of all RESTful API endpoints exposed by the eMeter backend (Django REST Framework). It outlines the purpose of each endpoint to facilitate integration, debugging, and future development.

All API routes are prefixed with `/api/` in the Django project configuration.

---

## 1. System Health
| Endpoint | Method | Description |
|---|---|---|
| `/api/health/` | `GET` | Health check endpoint used for uptime monitoring (e.g., Render). Returns a simple JSON status. |

---

## 2. Authentication & Session
These endpoints manage user sessions for Administrators and Meter Readers.

| Endpoint | Method | Description |
|---|---|---|
| `/api/login/` | `POST` | Authenticates a user (Admin/Reader) and issues a JWT token. |
| `/api/me/` | `GET` | Retrieves the profile details of the currently authenticated user. |
| `/api/profile/update/` | `PUT` | Updates the profile information of the authenticated user. |
| `/api/logout/` | `POST` | Logs out the current user and invalidates the session token. |
| `/api/csrf/` | `GET` | Retrieves a CSRF token for securing subsequent state-changing requests. |

---

## 3. Dashboard Statistics & Reports
Endpoints serving aggregated data for the administrative dashboard.

| Endpoint | Method | Description |
|---|---|---|
| `/api/dashboard-stats/` | `GET` | Fetches high-level KPIs (Total Revenue, Pending Dues, Total Consumers, etc.) for dashboard display. |
| `/api/reports-data/` | `GET` | Retrieves detailed aggregated data used to render charts and financial reports. |
| `/api/settings/` | `GET` | Retrieves the global `BillingSettings` (unit rates, duty %, fixed charges, meter rents). |
| `/api/settings/update/` | `POST`/`PUT` | Updates the global billing tariff policies. |

---

## 4. Consumer Management
Endpoints for managing the lifecycle of consumer records.

| Endpoint | Method | Description |
|---|---|---|
| `/api/consumers/` | `GET`, `POST` | Lists all consumers (GET) or registers a new consumer (POST). |
| `/api/consumers/<id>/` <br> `/api/consumer/<id>/` | `GET`, `PUT`, `DELETE` | Retrieves, updates, or soft-deletes a specific consumer by ID. |
| `/api/consumers/search/` | `GET` | Searches for consumers by name, consumer number, or meter number. |
| `/api/consumer/<id>/readings/` | `GET` | Fetches the historical meter readings for a specific consumer. |

---

## 5. Meter Reading & Billing Core
The primary data ingestion endpoints for field operations and bulk uploads.

| Endpoint | Method | Description |
|---|---|---|
| `/api/readings/` | `GET` | Lists all recorded meter readings in the system. |
| `/api/readings/import-excel/` | `POST` | Processes a bulk upload of `.xlsx` files, generating bills for multiple readings in batch. |
| `/api/submit-reading/` | `POST` | Submits a single meter reading into the system without automatically generating a bill. |
| `/api/reading-and-bill/` | `POST` | Submits a reading and atomically triggers the billing calculation engine to generate a bill. Used heavily by the mobile app sync. |
| `/api/edit-reading/<id>/` | `PATCH`/`PUT` | Edits an existing meter reading (restricted to readings submitted on the current day). |
| `/api/calculate-estimate/` | `POST` | Returns a live billing calculation estimate without saving to DB. Used for mobile app previews. |

---

## 6. Bill Management
Endpoints for managing generated invoices and their payment lifecycles.

| Endpoint | Method | Description |
|---|---|---|
| `/api/bills/` | `GET` | Lists all generated bills with pagination and filtering options. |
| `/api/bill/<id>/` | `GET` | Retrieves comprehensive details for a specific generated bill. |
| `/api/bill/<id>/pdf/` | `GET` | Downloads the specified bill rendered as a print-ready PDF document. |
| `/api/bills/<id>/mark-paid/` | `POST` | Updates the status of a specific bill to "Paid". |
| `/api/bills/<id>/mark-unpaid/` | `POST` | Reverts the status of a specific bill to "Unpaid". |
| `/api/bills/manual-generate/` | `POST` | Manually forces the generation of a bill for a consumer based on existing data. |
| `/api/send-bill-sms/` | `POST` | Triggers a notification (SMS/WhatsApp) to send a bill link to the consumer. |

---

## 7. Administrative Workflows
Specialized operational endpoints for department administrators.

| Endpoint | Method | Description |
|---|---|---|
| `/api/notifications/` | `GET` | Retrieves system alerts and notifications for administrators. |
| `/api/notifications/mark-read/` | `POST` | Marks pending notifications as read. |
| `/api/start-reading-cycle/` | `POST` | Initializes a new monthly reading cycle (resets flags, prepares queues). |
| `/api/admin/export-mobile-sync/` | `GET` | Exports the consumer registry as `eMeter_Offline_Sync.json` to initialize mobile devices for offline operations. |

---

## 8. Consumer Portal (Self-Service)
Endpoints accessible **only** to end-consumers using scoped token authentication. 

| Endpoint | Method | Description |
|---|---|---|
| `/api/consumer/portal/me/` | `GET` | Retrieves the authenticated consumer's profile information. |
| `/api/consumer/portal/readings/` | `GET` | Retrieves the authenticated consumer's own reading history (Strict data isolation). |
| `/api/consumer/portal/bills/` | `GET` | Retrieves the authenticated consumer's own billing history. |
| `/api/consumer/portal/change-password/` | `POST` | Allows the consumer to securely change their portal password. |

---

## 9. Consumer Portal Administration
Endpoints for administrators to manage consumer portal access.

| Endpoint | Method | Description |
|---|---|---|
| `/api/admin/consumer/<id>/create-portal-account/`| `POST` | Generates initial portal credentials for a consumer. |
| `/api/admin/consumer/<id>/reset-password/` | `POST` | Forces a password reset for a consumer's portal account. |
