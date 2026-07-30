# eMeter — User Manual
### Electricity Billing & Meter Management System — AMU

**Version:** 1.0 | **Prepared for:** Field Meter Readers · Billing Administrators · Consumers  
**System:** eMeter (Django REST Framework + React 18 + React Native)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Admin Web Dashboard](#2-admin-web-dashboard)
   - 2.1 [Logging In](#21-logging-in)
   - 2.2 [Dashboard Overview](#22-dashboard-overview)
   - 2.3 [Managing Consumers](#23-managing-consumers)
   - 2.4 [Meter Readings Module](#24-meter-readings-module)
   - 2.5 [Billing Module](#25-billing-module)
   - 2.6 [Import Readings via Excel](#26-import-readings-via-excel)
   - 2.7 [Reports Module](#27-reports-module)
   - 2.8 [Settings and Billing Configuration](#28-settings-and-billing-configuration)
   - 2.9 [Mobile App Sync Offline Sync File](#29-mobile-app-sync-offline-sync-file)
3. [Consumer Self-Service Portal](#3-consumer-self-service-portal)
   - 3.1 [Consumer Login](#31-consumer-login)
   - 3.2 [Consumer Dashboard](#32-consumer-dashboard)
   - 3.3 [Viewing My Readings](#33-viewing-my-readings)
   - 3.4 [Viewing and Downloading My Bills](#34-viewing-and-downloading-my-bills)
   - 3.5 [Changing Password](#35-changing-password)
4. [Mobile App Meter Reader Guide](#4-mobile-app-meter-reader-guide)
   - 4.1 [Installation and Login](#41-installation-and-login)
   - 4.2 [Mobile Dashboard](#42-mobile-dashboard)
   - 4.3 [Pulling Consumer Registry Online Setup](#43-pulling-consumer-registry-online-setup)
   - 4.4 [Importing Data from Sync File Offline Setup](#44-importing-data-from-sync-file-offline-setup)
   - 4.5 [Searching for a Consumer](#45-searching-for-a-consumer)
   - 4.6 [Submitting a Meter Reading](#46-submitting-a-meter-reading)
   - 4.7 [Offline Reading and Auto-Sync](#47-offline-reading-and-auto-sync)
   - 4.8 [Bill Preview Screen](#48-bill-preview-screen)
   - 4.9 [Reading History](#49-reading-history)
   - 4.10 [Offline Queue Inspector](#410-offline-queue-inspector)
   - 4.11 [Exporting Queue to Excel](#411-exporting-queue-to-excel)
   - 4.12 [App Settings](#412-app-settings)
5. [Appendix](#5-appendix)
   - 5.1 [Role Permission Reference](#51-role-permission-reference)
   - 5.2 [Billing Calculation Formula](#52-billing-calculation-formula)
   - 5.3 [Excel Import Format Reference](#53-excel-import-format-reference)
   - 5.4 [Common Troubleshooting](#54-common-troubleshooting)

---

## 1. System Overview

eMeter is a three-tier, cross-platform electricity billing and meter management platform. It digitizes the complete utility billing lifecycle from field meter reading to PDF bill delivery.

```
+------------------------------------------------------------------+
|                       eMeter System                              |
|                                                                  |
|  +------------------+   +------------------+  +--------------+  |
|  |  Admin Web       |   |  Consumer Portal  |  |  Mobile App  |  |
|  |  Dashboard       |   |  (Self-Service)   |  |  (Readers)   |  |
|  |  (React 18)      |   |  (React 18)       |  |(React Native)|  |
|  +--------+---------+   +--------+----------+  +------+-------+  |
|           |                      |                     |         |
|           +----------------------+---------------------+         |
|                                  |                               |
|                    +-------------v--------------+               |
|                    |  Django REST Framework API   |               |
|                    |  (Business Logic + Auth)     |               |
|                    +-------------+--------------+               |
|                                  |                               |
|                    +-------------v--------------+               |
|                    |       PostgreSQL 16          |               |
|                    |   (Single Source of Truth)   |               |
|                    +-----------------------------+               |
+------------------------------------------------------------------+
```

### User Roles

| Role | Interface | Access |
|------|-----------|--------|
| **Administrator** | Web Dashboard | Full system control, billing config, reports |
| **Meter Reader** | Mobile App + Web | Submit readings, view history, offline sync |
| **Consumer** | Consumer Portal | View own bills, readings, download PDFs |

---

## 2. Admin Web Dashboard

The Admin Web Dashboard is accessed via a web browser. Administrators and meter readers with web access use this interface.

### 2.1 Logging In

**URL:** http://your-server-address (or the deployed domain)

**Steps:**
1. Open the web dashboard URL in your browser (Chrome, Firefox, or Safari recommended).
2. You will be taken to the Login Page.
3. Enter your Username and Password provided by the system administrator.
4. Click Sign In.

NOTE: If you see a "Session Expired" error, your token has timed out. Simply log in again.

**Login Page Layout:**

```
+-------------------------------------+
|          eMeter AMU                 |
|   Electricity Management System     |
|                                     |
|  Username: [                     ]  |
|  Password: [                     ]  |
|                                     |
|       [ Sign In ]                   |
+-------------------------------------+
```

---

### 2.2 Dashboard Overview

After login, you land on the Dashboard Overview — a real-time snapshot of the entire system.

**Summary Cards (click any to navigate):**

| Card | What it shows |
|------|--------------|
| Total Consumers | Number of registered electricity connections |
| Meter Readings | Total reading records submitted to the system |
| Revenue (Paid) | Total collections (sum of paid bills in Rs.) |
| Pending Amount | Outstanding unpaid bill total in Rs. |
| Current Consumption | kWh billed in the current month |
| Total Bills | Total number of invoices generated |

**Quick Action Buttons (top right):**
- Add Consumer opens the Add Consumer form
- New Reading (Reader role only) opens the Reading submission form
- Billing navigates to the Billing module

**Detailed Analysis:** Click "Go to Reports" at the bottom of the dashboard for graphical analytics.

---

### 2.3 Managing Consumers

**Navigate:** Sidebar → Consumers

This page lists all registered consumers with their meter numbers, status, and account type.

#### 2.3.1 Adding a New Consumer

1. Click **+ Add Consumer** (top right).
2. Fill in the form:

| Field | Required | Description |
|-------|----------|-------------|
| Consumer ID | Optional | Leave blank to auto-generate (e.g., CN001234) |
| Full Name | Yes | Full legal name of the consumer |
| Phone | No | Contact number |
| Address | No | Residential or office address |
| Post / Designation | No | e.g., Professor, Clerk |
| Department | No | e.g., Computer Science |
| Meter Number | Yes | Physical meter serial number (e.g., MTR-1234) |
| Initial Reading | No | Starting meter value in kWh |
| Load (KW) | No | Sanctioned load — select 1, 2, 3, 4, or 5 KW |
| Account Type | No | Salary (AMU staff) or Non-Salary |
| Phase | No | Single Phase or Three Phase |
| Status | No | Active or Inactive |

3. Click **Save Consumer**.

#### 2.3.2 Editing a Consumer

1. Find the consumer in the list (use the global search bar at the top of the page).
2. Click the three-dot (more) menu in the Actions column.
3. Select Edit.
4. Modify the fields and click Update Consumer.

NOTE: The Initial Reading field is hidden during editing to prevent accidental modification of historical data.

#### 2.3.3 Viewing Consumer Details

1. Click the three-dot menu → View for any consumer.
2. A detail panel slides open showing: Consumer ID, Status, Name, Meter Number, Phone, Address, Load, Phase, and Account Type.

#### 2.3.4 Deleting a Consumer

1. Click the three-dot menu → Delete.
2. Confirm the deletion in the alert.

WARNING: Deletion is permanent. Consumers with existing bills cannot be deleted (the system will block this to protect billing history).

#### 2.3.5 Resetting a Consumer's Portal Password

If a consumer forgets their self-service portal password:

1. Click the three-dot menu → Reset Portal Password.
2. Confirm the action.
3. The consumer's portal password is reset to their Consumer Number (e.g., CN001234).
4. Inform the consumer to log in with their consumer number and immediately change their password.

#### 2.3.6 Filtering Consumers

Use the filter dropdowns above the table:
- **Status Filter:** All Status / Active / Inactive / Suspended
- **Account Type Filter:** All Acc Types / Salary / Non-Salary
- **Global Search:** Type a name or meter number in the top search bar.

---

### 2.4 Meter Readings Module

**Navigate:** Sidebar → Readings

This module shows all consumers and their last recorded reading. It is the central hub for recording and tracking electricity consumption.

#### 2.4.1 Viewing Readings

The main table shows:
- Consumer # — Unique consumer identifier
- Name — Consumer's name
- Meter — Physical meter number
- Previous Reading — The last recorded kWh value

#### 2.4.2 Viewing Reading History for a Consumer

1. Find the consumer in the table.
2. Click the **History** (clock icon) button on the right.
3. A history modal opens with a complete chronological table of all readings.

History Modal features:
- **Date filter** (From / To) — Filter readings by date range.
- **Sort** — Most Recent or Oldest First.
- **Apply Filter / Clear** — Apply or reset date filters.
- **Print** — Opens a formatted, print-ready history report.
- **Excel** — Downloads reading history as a .xlsx file.
- **Total Usage** badge — Shows the cumulative kWh for the filtered period.

#### 2.4.3 Submitting a New Reading (Meter Reader Role)

This feature is visible only to users with the Reader role, not Administrators.

1. Click **+ New Reading** (top right).
2. Select the consumer from the dropdown.
3. The Previous Reading (last recorded value) auto-fills in read-only mode.
4. Enter the Current Reading in kWh.
5. The Units Consumed is calculated live (current minus previous).
6. Add optional Remarks (e.g., observations, special notes).
7. Click **Save Reading**.

```
Record Meter Reading
-----------------------------------------
Select Consumer: [ Dropdown ]

Previous Reading:  [  1250  ] (read-only)
Current Reading:   [        ] <- Enter here

Units Consumed: 0 kWh (live preview)

Remarks: [                          ]

[ Save Reading ]
-----------------------------------------
```

#### 2.4.4 Administrative Bill Entry (Admin Only)

Administrators can manually create a bill for a consumer (e.g., for paper-based readings):

1. Click **Generate Bills → Administrative Bill Entry**.
2. Select the consumer.
3. Enter the Current Reading in kWh (Previous Reading auto-fills).
4. Set the Billing Month and Due Date.
5. Add an optional Manual Override Reason (for audit trail).
6. Click **Submit Administrative Entry**.

#### 2.4.5 Import Excel (Admin Only)

Administrators can upload an Excel file with multiple readings to generate bills in bulk. See Section 2.6 for the complete guide.

---

### 2.5 Billing Module

**Navigate:** Sidebar → Billing

This is the complete billing ledger. Every generated bill is listed here.

#### 2.5.1 Bill Summary Cards

Three cards at the top show:
- **Total Billed** — Cumulative sum of all invoices
- **Collected** — Total amount of paid bills
- **Pending** — Total unpaid bill amount

#### 2.5.2 Bill Table

Each row shows: Bill # / Consumer / Meter No. / Units / Amount / Status / Billing Period / Due Date

**Status badges:**
- Paid — Bill has been settled (green)
- Unpaid — Bill is pending (yellow)
- Overdue — Bill is past its due date (red)

#### 2.5.3 Filtering Bills

Use the filter toolbar above the table:

| Filter | Options |
|--------|---------|
| Status | All / Paid / Unpaid / Overdue |
| Account Type | All / Salary / Non-Salary |
| Sort | Most Recent / Oldest First |
| From (Month) | Billing period start month filter |
| To (Month) | Billing period end month filter |
| Clear Filters | Resets all filters |
| Global Search | Search by consumer name or meter number |

#### 2.5.4 Bill Actions

Click the three-dot menu next to any bill:

| Action | Description |
|--------|-------------|
| View Details | Opens a modal with full charge breakdown |
| Mark as Paid | Updates bill status to Paid |
| Mark as Unpaid | Reverts bill status to Unpaid |
| Download PDF | Generates and downloads a formatted PDF invoice |
| Print PDF | Opens a browser print dialog with the formatted bill |

#### 2.5.5 Bill Detail Modal

The detail modal shows a full breakdown:
- Consumer name and meter number
- Billing period and status
- Charge Breakdown: Units Consumed, Rate per Unit, Energy Charges, Fixed Charges
- Total Amount
- Generated date, Due date, and Paid date

#### 2.5.6 Export Bills to Excel

Click **Download Excel** (top right of Billing page). This downloads all bills currently filtered/visible as a structured .xlsx file.

**Excel Output Format:**
```
Row 1: (empty)
Row 2: D2 = Total Sum Amount
Row 3: (empty)
Row 4: Date Range Label (merged B-D)
Row 5: (empty)
Row 6: S.NO. | ID | NAME | TOTAL AMOUNT  <- header row
Row 7+: Data rows
```

#### 2.5.7 Print Billing Report

Click **Print Report** to open the browser print dialog. The printed report format exactly matches the Excel structure.

#### 2.5.8 Pagination

Bills are paginated 50 per page. Use Previous / Next buttons at the bottom of the table.

---

### 2.6 Import Readings via Excel

**Navigate:** Sidebar → Import Readings (or from Readings page → Generate Bills → Import Excel)

This feature allows administrators to upload a batch of meter readings from an Excel file. Bills are automatically generated for each valid row.

#### Step 1: Download the Template

Click **Download Template** to get a pre-formatted .xlsx file. Use this as a starting point.

**Template columns:**

| Column A | Column B | Column C | Column D |
|----------|----------|----------|----------|
| Consumer Number | Meter Number | Current Reading | Reading Date (optional) |
| C-001 | MTR-001 | 1500 | 2026-05-01 |

#### Step 2: Fill the Template

- Row 1 is the header row — do NOT delete it (it is auto-skipped).
- Consumer Number must exactly match the registered consumer number.
- Current Reading must be >= the previous reading.
- Date format: YYYY-MM-DD or DD-MM-YYYY. If left blank, today's date is used.
- Only one reading per consumer per billing month is allowed.

#### Accepted Formats

4-Column (Recommended):
```
Consumer# | Meter# | Reading (kWh) | Date
```

3-Column (No meter number):
```
Consumer# | Reading (kWh) | Date
```

#### Step 3: Upload the File

1. Drag and drop your .xlsx file onto the upload zone, or click the zone to browse files.
2. The file name and size appear once selected.
3. Click **Import & Generate Bills**.

#### Step 4: Review Results

After processing, the result panel shows:
- Bills Generated — count of successfully processed rows
- Rows Failed — count of errors
- Generated Bills table — lists each successful bill with details
- Error Log — specific error messages for failed rows

**Processing flow diagram:**
```
Upload Excel File
       |
       v
Auto-detect format (3-col or 4-col)
       |
       v
For each data row:
  +----+---------------------+
  | Validate consumer        |
  | Validate reading >= prev  |
  | Check duplicate month    |
  +----+---------------------+
       |
  +----v----------+    +--------------------+
  |  Success      |    |  Failure           |
  |  -> Create    |    |  -> Add to Error   |
  |     Reading   |    |     Log            |
  |  -> Create    |    +--------------------+
  |     Bill      |
  +---------------+
       |
       v
Show Results Summary
```

---

### 2.7 Reports Module

**Navigate:** Sidebar → Reports

The Reports page shows live, visual analytics pulled directly from the PostgreSQL database.

#### Charts Available

**Monthly Usage Trends (Bar Chart)**
- X-axis: Month name
- Y-axis: Units (kWh)
- Shows consumption trends over the past months.

**Revenue Breakdown (Donut Chart)**
- Split between Paid and Unpaid revenue.
- Labels show category name and percentage.

**Top 10 Consumers by Total Usage (Progress Bars)**
- Lists the highest-consuming consumers.
- Progress bar shows each consumer's usage relative to the #1 consumer.
- Displays name and total kWh.

#### Export Options

- **Export CSV** — Downloads the top consumers table as a .csv file.

---

### 2.8 Settings and Billing Configuration

**Navigate:** Sidebar → Settings

ADMIN ONLY: This page is only accessible to administrators.

#### 2.8.1 Notifications

Toggle **Enable system notifications** ON/OFF. This preference is saved locally on your browser.

#### 2.8.2 Billing Configuration

This is the dynamic tariff engine. Changes here affect all future bill calculations.

| Setting | Description | Default |
|---------|-------------|---------|
| Default Unit Rate (Rs.) | Price per kWh consumed | 8.56 |
| Default Tax / Duty (%) | Electricity duty percentage applied on energy charges | 7.5 |
| Fixed Charge per kW (Rs.) | Monthly fixed connection charge per KW of load | 400 |
| 1-Phase Meter Rent (Rs.) | Monthly rent for single-phase meters | 10 |
| 3-Phase Meter Rent (Rs.) | Monthly rent for three-phase meters | 25 |

**To update rates:**
1. Modify the values in the input fields.
2. Click **Update Configuration**.
3. A confirmation toast appears.

IMPORTANT: Rate changes only affect new bills generated after the update. All past bills are locked to the rates that were active at the time they were created (Policy Snapshotting).

---

### 2.9 Mobile App Sync Offline Sync File

When meter readers operate in offline mode without internet, they can still use pre-loaded consumer data. Administrators generate this data file from Settings.

**Navigate:** Sidebar → Settings → Mobile App Sync

**Steps:**
1. Click **Export Sync File**.
2. A file named eMeter_Offline_Sync.json downloads automatically.
3. Share this file with the meter reader (via WhatsApp, email, USB, etc.).
4. The reader imports this file in the mobile app (see Section 4.4).

The sync file contains the full consumer registry and current billing settings, allowing complete offline operation.

---

## 3. Consumer Self-Service Portal

The Consumer Portal is a separate, read-only interface where individual consumers can view their own billing information without contacting the billing office.

### 3.1 Consumer Login

**URL:** http://your-server-address/consumer/login

1. Navigate to the consumer login page.
2. Enter your Consumer Number (e.g., CN001234) as the username.
3. Enter your Password (default: your Consumer Number — change this immediately after first login).
4. Click **Sign In**.

```
+-------------------------------------+
|        Consumer Portal Login        |
|                                     |
|  Consumer Number: [              ]  |
|  Password:        [              ]  |
|                                     |
|       [ Sign In ]                   |
|                                     |
|  Forgotten password? Contact the    |
|  billing office for a reset.        |
+-------------------------------------+
```

---

### 3.2 Consumer Dashboard

After login, you see your personal dashboard.

**Profile Card (top) shows:**
- Your name and first-letter avatar
- Consumer Number badge
- Meter Number badge
- Connection status (Active / Inactive / Suspended)
- Your registered address

**Statistics Grid:**

| Stat | Meaning |
|------|---------|
| Total Readings | Total meter readings recorded for your connection |
| Total Bills | Total number of bills generated for your account |
| Paid Bills | Number of bills you have cleared |
| Unpaid Bills | Number of outstanding bills |

**Quick Access Links:**
- My Readings — Full meter reading history
- My Bills — All bills, paid and unpaid
- Change Password — Securely update your login password

**Last Activity Strip (bottom):**
- Shows the date of your last meter reading
- Shows the amount of your last bill
- Download PDF button to download the most recent bill instantly

---

### 3.3 Viewing My Readings

**Navigate:** Consumer Dashboard → My Readings

This page shows a chronological table of every meter reading recorded for your connection.

**Table columns:**
- Date of reading
- Previous Reading (kWh)
- Current Reading (kWh)
- Units Consumed (kWh)

You can scroll through all historical readings to track your consumption over time.

---

### 3.4 Viewing and Downloading My Bills

**Navigate:** Consumer Dashboard → My Bills

**Bill list columns:**
- Bill Number
- Billing Period (e.g., May-26)
- Units
- Total Amount (Rs.)
- Payment Status (Paid / Unpaid)
- Due Date

**To download a bill as PDF:**
1. Find the bill you want.
2. Click the Download PDF (or Print) icon on that row.
3. A formatted electricity invoice opens in a new window and prints/saves to PDF.

**Bill PDF contents:**
- AMU eMeter header with logo
- Consumer details (name, number, meter, address)
- Billing period and due date
- Reading details (previous and current)
- Full charge breakdown
- Grand Total
- Payment status watermark

---

### 3.5 Changing Password

**Navigate:** Consumer Dashboard → Change Password

1. Enter your Current Password.
2. Enter your New Password.
3. Re-enter the new password in Confirm New Password.
4. Click **Update Password**.

TIP: Use a password at least 8 characters long with a mix of letters and numbers. Do not share your password with anyone.

---

## 4. Mobile App Meter Reader Guide

The eMeter Mobile App (React Native + Expo) is designed for field meter readers. It supports both online and offline operation.

### 4.1 Installation and Login

**Installation:**
- The app is distributed as an APK (Android) or through Expo Go / TestFlight.
- Install it on your Android (8.0+) or iOS (13+) smartphone.

**Login:**
1. Open the eMeter app on your phone.
2. Enter your assigned Username and Password.
3. Tap **Sign In**.

```
+===============================+
|        eMeter                 |
|  Electricity Management       |
|                               |
|  Username: [               ]  |
|  Password: [               ]  |
|                               |
|      [ Sign In ]              |
+===============================+
```

If you forget your credentials, contact your billing office administrator.

---

### 4.2 Mobile Dashboard

After login, the Dashboard is your main hub. It adapts based on network availability.

**Header bar:**
- Shows your username
- Online (green dot) / Offline Mode (yellow dot) badge — live connectivity status
- Bell icon — tap to view notifications
- Role badge (Administrator / Meter Reader)

**Daily Sync Tracker Card:**
- Shows a progress bar towards your daily reading target.
- Tap the card to set your daily target goal (10, 15, 20, 30, 50, or custom).

**Offline Queue Alert Banner (appears when readings are unsynced):**
- Shows count of pending local syncs.
- Tap the banner to open the Queue Inspector.
- Excel button — export the queue as a spreadsheet.
- Sync button — push all queued readings to the server.

**Statistics Cards:**

| Card | Description |
|------|-------------|
| Total Consumers | Total consumers in the system |
| Total Readings | Total readings submitted |
| Total Sync Online | Successfully synced readings |
| Unsynced Readings | Readings saved locally but not yet pushed |

**Quick Actions Grid:**

| Action | What it does |
|--------|-------------|
| Search and Submit | Search consumers and submit a reading |
| Reading History | Browse past readings |
| Queue Inspector | View and manage the offline reading queue |
| Pull Registry | Download consumer list from server (requires internet) |
| Import Data | Import consumer data from an offline sync file |
| Push Sync Queue | Manually trigger sync of offline readings |

**Recent Activity Feed:** A chronological log of the last 8 actions taken in the app (syncs, pulls, imports, etc.).

---

### 4.3 Pulling Consumer Registry Online Setup

Before going into the field (while you have internet), update your local consumer database:

1. On the Dashboard, tap **Pull Registry**.
2. The app downloads the latest consumer list from the server.
3. A success alert shows: "Local database updated with X consumers."
4. This data is now stored on your device and available even when offline.

```
Internet Required -> Pull Registry
        |
        v
Downloads all consumer records to phone
        |
        v
Stores in local SQLite database
        |
        v
Available offline for searching and reading submission
```

BEST PRACTICE: Pull the registry every morning before going into the field.

---

### 4.4 Importing Data from Sync File Offline Setup

If you cannot connect to the internet but the admin has provided a sync file:

1. Receive the eMeter_Offline_Sync.json file from your admin (via WhatsApp, email, etc.).
2. On the Dashboard, tap **Import Data**.
3. A file picker opens — select the .json file you received.
4. The app loads all consumers and settings from the file.
5. Success alert: "Setup Complete! Loaded X consumers."

This works completely without internet — ideal for areas with no coverage.

---

### 4.5 Searching for a Consumer

**Navigate:** Dashboard → Search and Submit (or tap the Search tab in the navigation bar)

1. The search screen shows a search bar at the top.
2. Type the consumer's name, consumer number, or meter number.
3. Results filter in real-time as you type (works offline using local data).
4. Each result card shows: Consumer name, Consumer #, Meter #, Previous reading, Address.
5. Tap a consumer card to proceed to the Submit Reading screen.

```
+==================================+
|  Search Consumers                |
|  [                            ]  |
|                                  |
|  +------------------------------+|
|  | Abdul Rahman                 ||
|  | #CN001  |  MTR-1234          ||
|  | Prev: 1250 kWh  |  Flat 4B   ||
|  +------------------------------+|
|  +------------------------------+|
|  | Ahmed Ali                    ||
|  | #CN002  |  MTR-5678          ||
|  | Prev: 2100 kWh  |  Block C   ||
|  +------------------------------+|
+==================================+
```

---

### 4.6 Submitting a Meter Reading

After selecting a consumer from the search screen, you arrive at the Submit Reading screen.

**Consumer Details Card (top):**
Shows the consumer's name, consumer number, meter number, load (KW), meter type (1 Phase / 3 Phase), and address for verification.

**Reading Section:**

1. Verify the Previous Reading (shown in grey, read-only).
2. The Current Reading field is auto-focused (keyboard appears immediately).
3. Enter the current reading shown on the physical meter.

NOTE: The current reading must be >= the previous reading. An error will appear if you enter a lower value.

**Live Bill Estimate:**
As you type, the app calculates a live estimate:

```
Energy (45.0 x Rs.8.56)         Rs. 385.20
Fixed (2 KW x Rs.400)           Rs. 800.00
Duty (7.5%)                     Rs.  28.89
Meter Rent                      Rs.  10.00
----------------------------------------------
Grand Total (Est.)              Rs.1,224.09
```

4. Review the estimate.
5. Tap **Submit and Generate Bill**.

**What happens next:**
- Reading is always saved locally first (offline-safe).
- If internet is available: reading is submitted to the server, a bill is generated, and you are taken to the Bill Preview screen.
- If offline: an alert confirms "Reading saved locally and will sync when online."

```
Enter Reading
      |
      +-- Save to local storage (always, offline-safe)
      |
      +-- Try submit to server
               |
          +----+----------+    +------------------------+
          | Online?  Yes  +---->  Generate Bill + PDF   |
          +----+-----------    |  Navigate to Preview   |
               | No            +------------------------+
               v
         Alert: "Saved offline, will sync later"
               |
               v
         Navigate back to Search
```

---

### 4.7 Offline Reading and Auto-Sync

The eMeter app works fully in areas with no internet.

**How it works:**
1. When no internet is detected, readings are saved to a local queue on your phone.
2. An Offline Queue Alert banner appears on the Dashboard showing the count of pending readings.
3. When your phone reconnects to the internet:
   - Tap Sync on the banner, or
   - Tap Push Sync Queue in the Quick Actions grid.
4. The app sends all queued readings to the server in sequence.
5. Bills are generated automatically on the server for each synced reading.

**Sync Result Alert:**
- "Push Successful! X readings synced."
- If any fail: "Synced: X, Failed: Y" with specific error messages per consumer.

TIP: Failed readings (shown as "conflict" in the queue) usually mean a duplicate reading was already submitted for that consumer. Check with the billing office.

---

### 4.8 Bill Preview Screen

After a successful online submission, you are automatically taken to the Bill Preview screen.

This screen shows a formatted preview of the generated bill:
- Consumer details
- Billing period and due date
- Reading details (previous and current)
- Full charge breakdown
- Grand total amount
- Bill number

**Actions available:**
- Share via WhatsApp — Opens WhatsApp with the bill details pre-filled to send to the consumer.
- Print — Opens system print/share dialog for the PDF.
- Back — Returns to the Search screen for the next reading.

---

### 4.9 Reading History

**Navigate:** Dashboard → Reading History (or History tab in navigation)

This screen shows all reading records submitted from your device or linked to consumers you have visited.

**Features:**
- Chronological list of readings
- Consumer name, date, previous reading, current reading, units consumed
- Tap any reading to see more details

---

### 4.10 Offline Queue Inspector

**Navigate:** Dashboard → Queue Inspector (or tap the orange offline banner)

The Queue Inspector is a drawer panel that shows all readings currently saved locally and not yet synced.

**Each queue item shows:**
- Consumer name and meter number
- Current reading value
- Reading date
- Status: Pending (awaiting sync) or Failed/Conflict (sync error)
- For failed items: the specific error message from the server

**Actions:**
- Synchronize Queue button (bottom) — triggers sync for all pending items.
- Delete icon (on each item) — removes a specific reading from the queue. Use this only if you need to discard an incorrect reading.

CAUTION: Deleting a queue item is permanent. Only delete if the reading was incorrect and needs to be re-submitted.

---

### 4.11 Exporting Queue to Excel

If you need to manually submit readings to the billing office (e.g., sync keeps failing):

1. On the Dashboard, tap **Excel** on the offline queue banner.
2. An .xlsx file is generated containing all pending readings.
3. An alert confirms the export and offers to share the file.
4. Share the Excel file with the billing administrator via WhatsApp, email, etc.
5. The administrator can import this file from the web dashboard (see Section 2.6).

**Exported columns:**
- Consumer Number, Meter Number, Current Reading, Reading Date, Consumer Name

---

### 4.12 App Settings

**Navigate:** Settings tab in the bottom navigation bar

**Available settings:**

| Setting | Description |
|---------|-------------|
| Dark / Light Mode | Toggle the app's color theme |
| Server URL | The backend API address (set by your administrator) |
| Logout | Signs you out of the app and clears your session |

**Account Information:**
- Shows your username and role (Administrator / Meter Reader)

---

## 5. Appendix

### 5.1 Role Permission Reference

| Feature | Administrator | Meter Reader (Web) | Meter Reader (App) | Consumer |
|---------|:---:|:---:|:---:|:---:|
| View Dashboard | Yes | Yes | Yes | Yes (own stats) |
| Add/Edit/Delete Consumers | Yes | No | No | No |
| Submit Readings (Web) | No | Yes | N/A | No |
| Submit Readings (App) | Yes | N/A | Yes | No |
| Administrative Bill Entry | Yes | No | No | No |
| Import Excel (Bulk) | Yes | No | No | No |
| View All Bills | Yes | Yes | No | No |
| View Own Bills | No | No | No | Yes |
| Mark Bill Paid/Unpaid | Yes | No | No | No |
| Download PDF Bills | Yes | Yes | Yes (after submit) | Yes |
| View Reports | Yes | No | No | No |
| Edit Billing Settings | Yes | No | No | No |
| Export Sync File | Yes | No | No | No |
| Reset Consumer Password | Yes | No | No | No |

---

### 5.2 Billing Calculation Formula

The billing calculation is automatic. Here is how the total is computed:

```
1. Units Consumed  = Current Reading - Previous Reading

2. Energy Charges  = Units Consumed x Rate per Unit (Rs./kWh)

3. Fixed Charges   = Load (KW) x Fixed Charge per KW

4. Duty Charge     = (Energy Charges + Fixed Charges) x Duty % / 100

5. Meter Rent      = Phase-1 Rent (Single Phase)
                   = Phase-3 Rent (Three Phase)

6. Regulatory Surcharge = (as configured)

7. Arrears         = Outstanding amount from previous unpaid bill

8. Late Surcharge  = Applied if payment is past due date

------------------------------------------------------------------
Grand Total = Energy Charges + Fixed Charges + Duty Charge
            + Meter Rent + Regulatory Surcharge
            + Arrears + Late Surcharge
------------------------------------------------------------------
```

**Example Calculation (1 KW load, Single Phase, 45 units consumed):**

| Component | Calculation | Amount |
|-----------|------------|--------|
| Energy Charges | 45 x Rs.8.56 | Rs.385.20 |
| Fixed Charges | 1 x Rs.400 | Rs.400.00 |
| Electricity Duty | 785.20 x 7.5% | Rs.58.89 |
| Meter Rent (1-Phase) | — | Rs.10.00 |
| **Grand Total** | | **Rs.854.09** |

---

### 5.3 Excel Import Format Reference

**File type:** .xlsx or .xls

**4-Column Format (Recommended):**

| Column A | Column B | Column C | Column D |
|----------|----------|----------|----------|
| Consumer Number | Meter Number | Current Reading (kWh) | Reading Date |
| C-001 | MTR-001 | 1500 | 2026-05-01 |

**3-Column Format (No Meter Number):**

| Column A | Column B | Column C |
|----------|----------|----------|
| Consumer Number | Current Reading (kWh) | Reading Date |
| C-001 | 1500 | 2026-05-01 |

**Rules:**
- Row 1 = header row (always skipped automatically)
- Date format: YYYY-MM-DD or DD-MM-YYYY
- Omitting date defaults to today's date
- Consumer Number must match exactly (case-sensitive)
- Only one reading per consumer per billing month

---

### 5.4 Common Troubleshooting

| Problem | Likely Cause | Solution |
|---------|-------------|----------|
| Session Expired on login | JWT token timed out | Log in again |
| Cannot delete a consumer | Consumer has existing bills | Mark consumer as Inactive instead |
| Reading rejected: Current < Previous | Entered wrong reading | Re-check the physical meter and enter the correct value |
| Import Excel: Consumer not found | Consumer number mismatch | Verify the consumer number matches exactly as registered |
| Import Excel: Duplicate reading | Reading already exists for this month | Only one reading per consumer per billing month is allowed |
| Mobile app shows Offline Mode | No internet connection | Proceed normally — readings will save locally and sync later |
| Sync fails for specific consumer | Server error or duplicate | Check the error log in Queue Inspector; contact admin if conflict persists |
| Consumer portal password not working | Password not reset yet | Admin goes to Consumers, then Reset Portal Password (sets it to Consumer Number) |
| PDF bill does not open | Pop-up blocked in browser | Allow pop-ups for this site in browser settings |
| Pull Registry fails | Server unreachable | Ensure you have internet; use Import Data from sync file instead |
| Bill shows Rs.0 or wrong amount | Billing settings were zero | Admin goes to Settings and checks/updates Billing Configuration |

---

*Document generated for eMeter AMU — Electricity Billing and Meter Management System*  
*Aligarh Muslim University, Department of Computer Science*  
*For technical issues, contact the system administrator.*
