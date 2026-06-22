# 🚀 eMeter AMU — Deployment & Operations Guide

> **Aligarh Muslim University — Electricity Billing Management System**  
> This document covers every question about how eMeter AMU is deployed, how data flows through the system, how the mobile app connects, where data lives, and how backups work.

---

## 📋 Table of Contents

1. [System Overview](#1-system-overview)
2. [How the Web Application Deploys on a Local Department Server](#2-how-the-web-application-deploys-on-a-local-department-server)
3. [How the Mobile App Connects to the System](#3-how-the-mobile-app-connects-to-the-system)
4. [How New Meter Readings Enter the System](#4-how-new-meter-readings-enter-the-system)
5. [How Data Updates in the Mobile App](#5-how-data-updates-in-the-mobile-app)
6. [Where the Data is Stored](#6-where-the-data-is-stored)
7. [Where Data Backups are Stored](#7-where-data-backups-are-stored)
8. [Network & Connectivity Architecture](#8-network--connectivity-architecture)
9. [User Account Management](#9-user-account-management)
10. [System Startup & Shutdown Procedures](#10-system-startup--shutdown-procedures)
11. [Environment Configuration Reference](#11-environment-configuration-reference)
12. [Troubleshooting Common Issues](#12-troubleshooting-common-issues)
13. [Security Considerations](#13-security-considerations)
14. [Frequently Asked Questions](#14-frequently-asked-questions)

---

## 1. System Overview

eMeter AMU is a **three-tier system** running entirely within the department's local network:

```
┌─────────────────────────────────────────────────────────────────┐
│                     DEPARTMENT LAN (Wi-Fi)                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │          SERVER COMPUTER (e.g. IP: 192.168.1.100)       │    │
│  │                                                         │    │
│  │  ┌─────────────────┐    ┌───────────────────────────┐   │    │
│  │  │  Django Server  │◄──►│  PostgreSQL 16 Database   │   │    │
│  │  │  (Port 8000)    │    │  (Port 5432 / localhost)  │   │    │
│  │  └────────┬────────┘    └───────────────────────────┘   │    │
│  │           │  also serves the Web Dashboard (React SPA)  │    │
│  └───────────┼─────────────────────────────────────────────┘    │
│              │                                                   │
│     ┌────────┴────────────────────────────────┐                 │
│     │              Network Traffic             │                 │
│     └───────────┬─────────────────┬───────────┘                 │
│                 ▼                 ▼                              │
│  ┌──────────────────┐   ┌─────────────────────────┐             │
│  │  Admin PC        │   │  Meter Reader Phones     │             │
│  │  (Web Browser)   │   │  (React Native App)      │             │
│  │  http://192...   │   │  Connected via Wi-Fi     │             │
│  └──────────────────┘   └─────────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

**The system is highly flexible: it can run completely offline using the department's local Wi-Fi or wired LAN, or it can be securely exposed to the open internet. No active internet connection is strictly required for day-to-day operation.**

---

## 2. Production Deployment on Ubuntu (Nginx + Gunicorn)

### 2.1 — Architecture Overview

The eMeter AMU system deploys on a dedicated server provided by the AMU Computer Science Department. It uses a robust, enterprise-grade architecture:

1. **Nginx (Reverse Proxy):** Handles all incoming HTTP requests on port 80. It serves the compiled React frontend directly for maximum speed and proxies API requests to the backend.
2. **Gunicorn (WSGI Server):** Runs the Python/Django backend application securely and concurrently.
3. **Systemd:** Manages the Gunicorn process as a background service, ensuring it auto-restarts on server reboots or crashes.
4. **PostgreSQL 16:** The primary production relational database.

> **Flexible Connectivity:** The system can run with or without an active internet or Wi-Fi connection. It can operate entirely offline within the university's local wired Intranet, over a local Wi-Fi router, or it can be exposed to the external internet via a public IP address or domain.

---

### 2.2 — Server Machine Requirements

| Requirement | Recommended for Production |
|-------------|----------------------------|
| **OS** | Ubuntu 22.04 LTS |
| **RAM** | 8 GB+ |
| **Storage** | 200 GB SSD |
| **CPU** | Quad-core 2.5 GHz+ |
| **Network** | Static IP assigned by University IT |

---

### 2.3 — Step-by-Step Implementation Guide

These steps assume you are logged into the Ubuntu server via SSH or physical terminal as a non-root user with `sudo` privileges.

#### Step 1: Install System Prerequisites

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.12 python3.12-venv python3-pip postgresql-16 postgresql-contrib nginx curl git
```

#### Step 2: Install Node.js (for Frontend Build)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

#### Step 3: Setup PostgreSQL Database

Secure the database and create a dedicated user for the app.

```bash
# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE DATABASE emeter_db;
CREATE USER emeter_user WITH PASSWORD 'secure_amu_password_here';
ALTER ROLE emeter_user SET client_encoding TO 'utf8';
ALTER ROLE emeter_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE emeter_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE emeter_db TO emeter_user;
ALTER DATABASE emeter_db OWNER TO emeter_user;
EOF
```

#### Step 4: Clone the Project Repository

Move the application code into `/var/www/` for proper Nginx serving.

```bash
sudo mkdir -p /var/www/eMeter.web
sudo chown -R $USER:$USER /var/www/eMeter.web
# Either clone via git or transfer files into /var/www/eMeter.web
git clone <repository-url> /var/www/eMeter.web
```

#### Step 5: Backend Setup (Django & Gunicorn)

```bash
cd /var/www/eMeter.web/electricity_system

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies, including Gunicorn and psycopg2
pip install -r requirements.txt
pip install gunicorn psycopg2-binary
```

Create the production `.env` file:
```bash
nano /var/www/eMeter.web/electricity_system/.env
```

```env
# /var/www/eMeter.web/electricity_system/.env
DJANGO_SECRET_KEY=generate_a_very_long_random_string_here
DEBUG=False

# Replace 192.168.x.x with the actual server IP or Domain
ALLOWED_HOSTS=127.0.0.1,localhost,192.168.x.x

DB_ENGINE=django.db.backends.postgresql
DB_NAME=emeter_db
DB_USER=emeter_user
DB_PASSWORD=secure_amu_password_here
DB_HOST=localhost
DB_PORT=5432
```

Run database migrations and collect static files:
```bash
python manage.py migrate
python manage.py collectstatic --noinput
python create_admin.py  # Run once to create the default admin account
```

#### Step 6: Create Systemd Services for Gunicorn

To keep Django running in the background, we create a systemd socket and service.

**1. Create the Gunicorn Socket:**
```bash
sudo nano /etc/systemd/system/gunicorn.socket
```
```ini
[Unit]
Description=gunicorn socket

[Socket]
ListenStream=/run/gunicorn.sock

[Install]
WantedBy=sockets.target
```

**2. Create the Gunicorn Service:**
*(Replace `your_ubuntu_user` with the actual username, e.g., `ubuntu` or `amu_admin`)*
```bash
sudo nano /etc/systemd/system/gunicorn.service
```
```ini
[Unit]
Description=gunicorn daemon
Requires=gunicorn.socket
After=network.target

[Service]
User=your_ubuntu_user
Group=www-data
WorkingDirectory=/var/www/eMeter.web/electricity_system
ExecStart=/var/www/eMeter.web/electricity_system/venv/bin/gunicorn \
          --access-logfile - \
          --workers 3 \
          --bind unix:/run/gunicorn.sock \
          electricity_system.wsgi:application

[Install]
WantedBy=multi-user.target
```

**3. Start and Enable Gunicorn:**
```bash
sudo systemctl start gunicorn.socket
sudo systemctl enable gunicorn.socket
```

#### Step 7: Build the Frontend (React/Vite)

```bash
cd /var/www/eMeter.web/energy-hub-ui

# Install Node dependencies
npm install

# Build the production bundle
npm run build
```
The compiled frontend files are now inside `/var/www/eMeter.web/energy-hub-ui/dist`.

#### Step 8: Configure Nginx

Create an Nginx Server Block to route traffic correctly.

```bash
sudo nano /etc/nginx/sites-available/emeter
```

```nginx
server {
    listen 80;
    server_name 192.168.x.x; # Replace with Server IP or Domain

    # 1. Serve the React Frontend directly
    location / {
        root /var/www/eMeter.web/energy-hub-ui/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 2. Serve Django Static Files (Admin panel CSS/JS)
    location /static/ {
        alias /var/www/eMeter.web/electricity_system/staticfiles/;
    }

    # 3. Serve User Media Files (if applicable)
    location /media/ {
        alias /var/www/eMeter.web/electricity_system/media/;
    }

    # 4. Proxy API requests to Gunicorn (Django)
    location /api/ {
        include proxy_params;
        proxy_pass http://unix:/run/gunicorn.sock;
    }

    # 5. Proxy Django Admin Panel to Gunicorn
    location /admin/ {
        include proxy_params;
        proxy_pass http://unix:/run/gunicorn.sock;
    }
}
```

Enable the Nginx site and restart:
```bash
sudo ln -s /etc/nginx/sites-available/emeter /etc/nginx/sites-enabled
sudo rm /etc/nginx/sites-enabled/default  # Remove default Nginx site
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 9: Configure Firewall (UFW)

Lock down the server to only allow essential traffic.

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

### 2.4 — Verification & Access

The production deployment is now complete! 
- Access the **Web Dashboard** from any browser on the university network by entering the server's IP address: `http://192.168.x.x/`
- Configure the Mobile App's `.env` to point to this new IP: `EXPO_PUBLIC_API_URL=http://192.168.x.x`

---

## 3. How the Mobile App Connects to the System

### 3.1 — Connection Method

The mobile app (React Native / Expo) does **not** connect to the internet. It connects to the **Django server running on the department's local computer** over the **same Wi-Fi network**.

```
[Meter Reader's Phone]
         │
         │  Wi-Fi  (Same Department Network)
         │
[Django Server on Department PC]
    192.168.1.100:8000
```

### 3.2 — Configuring the App's Server Address

Before running the mobile app, you must tell it the IP address of the server computer. This is set in `eMeterApp/.env`:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:8000
```

> ⚠️ **Important:** The IP address must be the **server computer's local network IP** — not `localhost`. `localhost` on the phone refers to the phone itself, not the server.

The `START_PROJECT.sh` script updates this file **automatically** each time it is run, so the IP is always current.

### 3.3 — How Authentication Works on Mobile

1. The meter reader opens the app and enters their username and password.
2. The app sends `POST /api/login/` to the Django server.
3. The server returns a **DRF Token** (a unique alphanumeric key).
4. This token is stored on the phone in `AsyncStorage` and attached to every subsequent API request as:
   ```
   Authorization: Token abc123def456...
   ```
5. The server validates this token on every request before returning any data.
6. Tokens are invalidated on logout — `POST /api/logout/` deletes the token from the server.

### 3.4 — What Happens When Wi-Fi is Lost

The mobile app is **offline-first**. When the network is unavailable:
- Readings are saved locally to the phone's `AsyncStorage` under the key `offline_readings_queue`.
- The app displays an "Offline Mode" indicator.
- When Wi-Fi is restored, the reader can tap "Sync Now" in the History tab to upload all pending readings.
- If a reading fails to sync, the error message is shown and the item remains in the queue for retry.

---

## 4. How New Meter Readings Enter the System

### 4.1 — Mobile App Flow (Primary Method)

```
Meter Reader in the Field
         │
         ▼
  [SearchScreen] — Finds the consumer by name, meter number, or consumer ID
         │
         ▼
  [SubmitReadingScreen] — Types the current meter dial value
         │  (Live estimate appears as they type, fetched from the server)
         │
         ▼
  App saves to LocalQueue (AsyncStorage) FIRST — even before network call
         │
         ├── Network Available? ──YES──► POST /api/reading-and-bill/
         │                                        │
         │                               Server validates reading:
         │                               - Not lower than previous
         │                               - Not duplicate for this month
         │                               - Consumer exists and is active
         │                                        │
         │                               Creates MeterReading in DB
         │                               Creates Draft Bill in DB
         │                               Returns bill breakdown to app
         │                                        │
         │                               [BillPreviewScreen]
         │                               Reader sees: units consumed,
         │                               energy charges, total amount
         │
         └── Network Unavailable? ─NO──► Item stays in queue as 'pending'
                                         Synced automatically when online
```

### 4.2 — Excel Bulk Import (Admin Method)

An administrator can import readings for many consumers at once using an Excel spreadsheet:

1. Prepare an `.xlsx` file with columns: **Consumer Number, Meter Number, Current Reading, Date**
2. Log into the Web Dashboard (`http://192.168.1.100:8000`)
3. Navigate to **Import Readings** page
4. Drag and drop the Excel file
5. The system validates each row:
   - Consumer number must match a registered consumer
   - Meter number must match the consumer's registered meter
   - Reading must not be lower than the previous reading
   - No duplicate reading for the same billing month
6. Valid rows are saved; invalid rows are reported with specific error messages

### 4.3 — Direct Web Entry (Manual Method)

An admin or meter reader can also submit readings directly from the web dashboard:

1. Go to **Readings** page → **Submit Reading**
2. Search for the consumer
3. Enter the current reading value and date
4. Click Submit — the system validates and saves the reading

---

## 5. How Data Updates in the Mobile App

### 5.1 — What Data is Pulled from the Server

Every time the meter reader opens a screen, the app fetches fresh data from the server:

| Screen | Data Fetched | API Endpoint |
|--------|-------------|--------------|
| Dashboard | Stats: pending count, total readings, sync queue length | `/api/dashboard-stats/` |
| Search | Consumer list | `/api/consumers/` |
| Submit Reading | Consumer profile + previous reading | `/api/consumers/search/` |
| Live Estimate | Real-time bill breakdown as reader types | `/api/calculate-estimate/` |
| Bill Preview | Final bill charges | Returned in POST response |
| History | Reading history | `/api/consumer/<id>/readings/` |
| Settings | Current tariff rates | `/api/settings/` |

### 5.2 — Tariff Rate Updates

If an administrator changes the tariff rates (price per unit, fixed charges, duty %) in the web dashboard:
- The new rates are saved to the `BillingSettings` table in the database.
- **The mobile app fetches tariff rates live from the server** every time an estimate is calculated.
- There is **no hardcoded rate in the mobile app** — it always uses the server's current rates.
- The app shows a live estimate as the reader types the reading, ensuring it always reflects the latest pricing.

### 5.3 — Consumer Data Updates

If a consumer's address, load (kW), or meter type is updated in the admin panel:
- Changes are saved immediately in the PostgreSQL database.
- The mobile app fetches the updated consumer profile fresh each time the reader searches for that consumer.
- **No manual refresh or reinstall is needed** — the app always reflects live database state.

---

## 6. Where the Data is Stored

### 6.1 — Primary Database (PostgreSQL)

All billing data is stored in a **PostgreSQL 16 database** running on the server computer.

| What | Where |
|------|-------|
| **Database engine** | PostgreSQL 16 |
| **Database name** | `emeter_db` |
| **Database user** | `emeter_user` |
| **Physical location** | PostgreSQL data directory on the server machine |
| **Typical path (Linux)** | `/var/lib/postgresql/16/main/` |
| **Typical path (macOS)** | `/usr/local/var/postgresql@16/` |

**Tables stored in the database:**

| Table | Contents |
|-------|----------|
| `billing_consumer` | All registered consumers (name, meter number, address, load, etc.) |
| `billing_meterreading` | Every meter reading ever submitted (date, previous, current, units) |
| `billing_bill` | Every bill generated (charges, status, snapshots) |
| `billing_payment` | Payment records linked to paid bills |
| `billing_billingsettings` | Singleton tariff configuration (rate/unit, fixed charge, duty %) |
| `billing_auditlog` | Immutable record of every financial action performed |
| `billing_user` | All system user accounts (admin, meter readers) |
| `authtoken_token` | Active login tokens for each user |

### 6.2 — File Storage on the Server

| File Type | Location on Server |
|-----------|--------------------|
| Django source code | `~/eMeter.web/electricity_system/` |
| Web dashboard (built) | `~/eMeter.web/energy-hub-ui/dist/` |
| Uploaded meter images | `~/eMeter.web/electricity_system/media/meter_images/` |
| Application error logs | `~/eMeter.web/electricity_system/logs/emeter.log` |
| Django static files | `~/eMeter.web/electricity_system/staticfiles/` |

### 6.3 — Data Stored on the Phone (Temporary)

The mobile app stores a small amount of data locally on the meter reader's phone:

| What | Storage | Purpose |
|------|---------|---------|
| Login token | `AsyncStorage` key: `authToken` | Keeps the reader logged in between sessions |
| Offline readings queue | `AsyncStorage` key: `offline_readings_queue` | Holds pending readings when no network is available |
| Last-fetched readings | `AsyncStorage` | Cache for the History screen |

> **This is temporary data only.** The authoritative record is always the server's PostgreSQL database. Once a reading is synced, it is confirmed in the database and the local copy is marked as synced and eventually cleaned up (after 24 hours).

---

## 7. Where Data Backups are Stored

### 7.1 — Recommended Backup Strategy

> **Critical:** The PostgreSQL database is the single most important thing to protect. If the server machine fails without a backup, **all billing history, consumer records, and payment records are lost**.

The recommended backup strategy is:

| Backup Type | Frequency | Destination |
|-------------|-----------|-------------|
| **PostgreSQL full dump** | Daily (automated) | External USB drive + department server share |
| **File backup** (media, logs) | Weekly | Same destinations |
| **Full system image** | Monthly | External USB drive |

---

### 7.2 — How to Create a PostgreSQL Backup (Manual)

Run this command on the server machine:

```bash
# Create a timestamped backup
pg_dump -U emeter_user -d emeter_db -F c -f "/backups/emeter_$(date +%Y-%m-%d).dump"
```

To restore from a backup:

```bash
pg_restore -U emeter_user -d emeter_db -c "/backups/emeter_2026-06-01.dump"
```

---

### 7.3 — Automated Daily Backup Script

Create this script at `/home/ubuntu/backup_emeter.sh`:

```bash
#!/bin/bash
# eMeter AMU — Automated Daily PostgreSQL Backup
# Add to cron: 0 2 * * * /home/ubuntu/backup_emeter.sh

BACKUP_DIR="/backups/emeter"
DATE=$(date +%Y-%m-%d)
DB_NAME="emeter_db"
DB_USER="emeter_user"
KEEP_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create database dump
pg_dump -U "$DB_USER" -d "$DB_NAME" -F c -f "$BACKUP_DIR/emeter_$DATE.dump"

# Delete backups older than 30 days
find "$BACKUP_DIR" -name "*.dump" -mtime +$KEEP_DAYS -delete

echo "✅ Backup completed: $BACKUP_DIR/emeter_$DATE.dump"
```

Set it to run automatically every night at 2:00 AM:

```bash
chmod +x /home/ubuntu/backup_emeter.sh

# Add to crontab
crontab -e
# Add this line:
0 2 * * * /home/ubuntu/backup_emeter.sh >> /home/ubuntu/backup.log 2>&1
```

---

### 7.4 — Backup Storage Locations (Recommended)

```
┌──────────────────────────────────────────────────────────────┐
│                     BACKUP DESTINATIONS                       │
├──────────────────────────────────────────────────────────────┤
│  Primary:   /backups/emeter/          (On server hard drive) │
│                                                              │
│  Secondary: /mnt/backup-usb/emeter/   (External USB drive   │
│                                        plugged into server)  │
│                                                              │
│  Tertiary:  \\DEPT-NAS\emeter-backup\ (Shared folder on      │
│                                        department network)   │
└──────────────────────────────────────────────────────────────┘
```

> **Always keep at least one backup off the server machine itself.** If the server hard drive fails, backups stored only on the same drive are also lost.

---

## 8. Network & Connectivity Architecture

### 8.1 — IP Addresses

| Component | Address |
|-----------|---------|
| **Server (Django + DB)** | `192.168.1.100:8000` *(your server's actual LAN IP)* |
| **Web Dashboard** | `http://192.168.1.100:8000` |
| **API Base** | `http://192.168.1.100:8000/api/` |
| **Mobile App Base URL** | Configured in `eMeterApp/.env` |

> **The server's IP address must be static (fixed).** If the router assigns a new IP to the server each time it restarts, the mobile apps will stop connecting. Configure a **static IP** or a **DHCP reservation** for the server computer in the router settings.

### 8.2 — Setting a Static IP on the Server (Linux)

Edit `/etc/netplan/01-network-manager-all.yaml`:

```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: no
      addresses:
        - 192.168.1.100/24
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
```

```bash
sudo netplan apply
```

### 8.3 — Ports Used

| Port | Service | Notes |
|------|---------|-------|
| `8000` | Django web server | Must be open on the server's firewall |
| `5432` | PostgreSQL | Only needed on `localhost` — do NOT expose externally |

---

## 9. User Account Management

### 9.1 — Roles

| Role | What They Can Do |
|------|----------------|
| **admin** | Full system access: consumers, readings, billing, reports, settings, finalize bills, mark paid/unpaid, export PDFs |
| **meter_reader** | Submit readings, view consumers, view bills, mark bills as paid, send SMS notifications |

### 9.2 — Creating a New User

**From the command line on the server:**

```bash
cd ~/eMeter.web/electricity_system
source venv/bin/activate

python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
u = User.objects.create_user(username='reader2', password='secure_password')
u.role = 'meter_reader'
u.save()
print('User created:', u.username)
"
```

**From the Django Admin Panel:**

Navigate to `http://192.168.1.100:8000/admin/` and log in with the superuser account.

### 9.3 — Resetting a Password

```bash
python manage.py changepassword <username>
```

---

## 10. System Startup & Shutdown Procedures

### 10.1 — Starting the System

**Full system start (macOS):**
```bash
cd ~/eMeter.web
./START_PROJECT.sh
```

**Manual start (any OS):**

```bash
# Step 1: Start PostgreSQL (if not already running)
sudo systemctl start postgresql    # Linux
# OR
brew services start postgresql@16  # macOS

# Step 2: Start the Django backend
cd ~/eMeter.web/electricity_system
source venv/bin/activate
python manage.py runserver 0.0.0.0:8000
```

### 10.2 — Stopping the System

```bash
# Stop Django (press Ctrl+C in the terminal where it is running)

# Stop PostgreSQL
sudo systemctl stop postgresql     # Linux
# OR
brew services stop postgresql@16   # macOS
```

### 10.3 — Checking if the Server is Running

Open a browser on any computer on the LAN and visit:
```
http://192.168.1.100:8000/api/
```
If you see a JSON response, the server is running correctly.

---

## 11. Environment Configuration Reference

### 11.1 — Backend Environment (`.env`)

File location: `electricity_system/.env`

```env
# ── Django Core ────────────────────────────────────────────────
DJANGO_SECRET_KEY=replace-with-a-long-random-string
DEBUG=False

# ── Database ───────────────────────────────────────────────────
DB_ENGINE=django.db.backends.postgresql
DB_NAME=emeter_db
DB_USER=emeter_user
DB_PASSWORD=your_secure_db_password
DB_HOST=localhost
DB_PORT=5432

# ── Allowed Hosts (server's IP address) ────────────────────────
ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.100

# ── CORS for mobile app and LAN clients ────────────────────────
CORS_ALLOWED_ORIGINS_EXTRA=http://192.168.1.100:8000

# ── Twilio SMS (optional) ──────────────────────────────────────
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_WHATSAPP_FROM=
```

### 11.2 — Mobile App Environment (`eMeterApp/.env`)

File location: `eMeterApp/.env`

```env
# The local IP address of the server computer running Django
EXPO_PUBLIC_API_URL=http://192.168.1.100:8000
```

---

## 12. Troubleshooting Common Issues

### ❌ "Mobile app cannot connect to the server"

**Cause:** Wrong IP address configured in `eMeterApp/.env`, or phone is on a different Wi-Fi network.

**Fix:**
1. Check the server's current IP: `ifconfig | grep "inet "` (macOS/Linux) or `ipconfig` (Windows)
2. Update `eMeterApp/.env` with the correct IP
3. Make sure the phone is connected to the **same Wi-Fi network** as the server
4. Ensure port `8000` is not blocked by a firewall

```bash
# Test from the phone (or any machine on the LAN):
curl http://192.168.1.100:8000/api/
# Should return: {"status": "ok", ...}
```

---

### ❌ "The web dashboard shows a blank page"

**Cause:** The React app was not built before starting the server.

**Fix:**
```bash
cd ~/eMeter.web/energy-hub-ui
npm run build
cd ../electricity_system
python manage.py collectstatic --noinput
```

---

### ❌ "Database connection refused"

**Cause:** PostgreSQL is not running.

**Fix:**
```bash
sudo systemctl start postgresql   # Linux
brew services start postgresql@16  # macOS
```

---

### ❌ "Offline readings not syncing"

**Cause:** Network connection restored but app needs a manual sync trigger.

**Fix:**
1. Open the **History** tab in the mobile app.
2. Tap **"Sync Now"** button.
3. If a specific reading fails, check the error message shown next to it (e.g., "duplicate for this month").

---

### ❌ "Password forgotten for admin account"

**Fix:**
```bash
cd ~/eMeter.web/electricity_system
source venv/bin/activate
python manage.py changepassword admin
```

---

## 13. Security Considerations

### 13.1 — Key Security Rules

| Rule | Why |
|------|-----|
| **Never set `DEBUG=True` in production** | It exposes stack traces and internal settings to anyone who visits the site |
| **Never share the `.env` file** | It contains the database password and secret key |
| **Use a strong `DJANGO_SECRET_KEY`** | Used for session signing — if exposed, sessions can be forged |
| **Set a strong database password** | Default `emeter123` is for development only |
| **Do NOT expose port 5432** | PostgreSQL should only be accessible from `localhost` on the server |
| **Change default passwords before going live** | `admin123` and `reader123` are for initial setup only |

### 13.2 — Generating a Strong Secret Key

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

Paste the output into the `DJANGO_SECRET_KEY` field in `.env`.

---

## 14. Frequently Asked Questions

---

**Q: Do I need an internet connection to use eMeter AMU?**

> **No.** The entire system runs on the department's local Wi-Fi. The only features that require internet are Twilio SMS notifications (optional) and any software updates/package installation. Day-to-day billing, readings, and reporting all work fully offline within the LAN.

---

**Q: What happens if the server computer is turned off?**

> The system will be unavailable. Neither the web dashboard nor the mobile app will be able to fetch or submit data. Meter readers can still **capture readings offline** using the mobile app's local queue — these will be synced automatically once the server is back online.

---

**Q: Can multiple meter readers use the app at the same time?**

> **Yes.** Each meter reader has their own user account. All readers can submit readings simultaneously — the server handles multiple connections concurrently. Each reading submission is validated and written to the database atomically.

---

**Q: What if a meter reader submits the wrong reading?**

> A reading can be edited **only on the same day it was submitted** using the `PATCH /api/edit-reading/<id>/` endpoint (accessible from the web dashboard's Readings page). Editing a reading automatically recalculates and updates the linked draft bill. Once a bill is **finalized** by an admin, the reading cannot be changed.

---

**Q: How are bill amounts calculated? Can they change?**

> Bill charges are calculated using the **BillingSettings** tariff table in the database (rate per unit, fixed charges, duty %, meter rent). Once a bill is **finalized**, all amounts are frozen into immutable snapshot fields (`total_amount_snapshot`, `energy_charges_snapshot`, etc.). Even if tariff rates change next month, the finalized bill will always show the historically correct amounts.

---

**Q: Where are PDFs of bills generated?**

> PDFs are generated by the Django server on demand when the admin or reader clicks "Download PDF". They are not stored permanently on disk — they are rendered fresh each time from the bill data (using snapshot data for finalized bills). This saves storage space.

---

**Q: Can I access the system from outside the department (from home)?**

> Not by default, since the server only listens on the local network. To enable remote access, you would need to either:
> 1. Use a **VPN** that connects to the department LAN, or
> 2. Set up a **reverse tunnel** (e.g., using Localtunnel or Cloudflare Tunnel) — the system already has infrastructure for this in `settings.py`.
> For security reasons, direct internet exposure is not recommended without HTTPS.

---

**Q: How do I update the tariff rates (price per unit)?**

> 1. Log into the **Web Dashboard** (`http://192.168.1.100:8000`) as an **admin**.
> 2. Navigate to **Settings** in the sidebar.
> 3. Edit the rate fields (Rate per Unit, Fixed Charge per kW, Duty %, Meter Rent).
> 4. Click **Save**. The new rates take effect immediately for all future bills.
> 5. The mobile app will use the new rates automatically on the next estimate calculation — no app update needed.

---

**Q: How do I know the system is working correctly?**

> Visit `http://192.168.1.100:8000/api/` from any browser on the LAN. You should see a JSON response confirming the API is live. The Django admin panel is at `http://192.168.1.100:8000/admin/` for deeper inspection of the database.

---

**Q: How long is data retained in the system?**

> Data is retained indefinitely. No automatic deletion occurs for consumer records, readings, bills, or audit logs. Backups should be made regularly to protect against hardware failure. The audit log specifically is immutable — no action taken in the system can be erased from it.

---

*Document generated for eMeter AMU — Electricity Billing Management System*  
*Aligarh Muslim University Department Deployment*  
*Last Updated: June 2026*
