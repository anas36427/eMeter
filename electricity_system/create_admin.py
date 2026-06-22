#!/usr/bin/env python3
"""
One-time setup: migrates the SQLite database and creates admin/reader accounts.

Usage (run from the electricity_system directory):
    ./venv/bin/python3 create_admin.py
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricity_system.settings')
os.environ['DB_ENGINE'] = 'django.db.backends.sqlite3'
os.environ['DB_NAME'] = 'db.sqlite3'

django.setup()

from django.db import connection
from django.core.management import call_command

# ── Step 1: Check if migrations table exists ──────────────────────
tables = connection.introspection.table_names()
print(f"📋 Tables found in db.sqlite3: {len(tables)}")

if 'django_migrations' in tables:
    # Check if billing_user exists — if not, migrations were fake-recorded
    if 'billing_user' not in tables:
        print("⚠️  Stale migration records detected. Resetting billing migrations...")
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM django_migrations WHERE app='billing';")
        print("   ✅ Cleared billing migration records. Re-running...")

# ── Step 2: Apply all migrations ─────────────────────────────────
print("\n⚙️  Running migrations...")
try:
    call_command('migrate', verbosity=1)
    print("✅ Migrations complete!\n")
except Exception as e:
    print(f"❌ Migration error: {e}")
    sys.exit(1)

# ── Step 3: Verify billing_user table exists ──────────────────────
tables = connection.introspection.table_names()
if 'billing_user' not in tables:
    print("❌ billing_user table still missing after migration. Check your billing/migrations/")
    sys.exit(1)

# ── Step 4: Create user accounts ─────────────────────────────────
from django.contrib.auth import get_user_model
User = get_user_model()

def upsert_user(username, password, email, role, is_superuser=False, is_staff=False):
    if User.objects.filter(username=username).exists():
        u = User.objects.get(username=username)
        u.set_password(password)
        u.role = role
        u.is_active = True
        u.is_superuser = is_superuser
        u.is_staff = is_staff
        u.save()
        print(f"  🔄 Reset  →  {username} / {password}  (role={role})")
    else:
        if is_superuser:
            u = User.objects.create_superuser(username=username, password=password, email=email)
        else:
            u = User.objects.create_user(username=username, password=password, email=email)
        u.role = role
        u.is_staff = is_staff
        u.save()
        print(f"  ✅ Created → {username} / {password}  (role={role})")

upsert_user('admin',  'admin123',  'admin@amu.ac.in',  'admin',        is_superuser=True, is_staff=True)
upsert_user('reader', 'reader123', 'reader@amu.ac.in', 'meter_reader')

# ── Step 5: Seed BillingSettings ─────────────────────────────────
try:
    from billing.models import BillingSettings
    s = BillingSettings.get_settings()
    print(f"\n  ✅ BillingSettings → ₹{s.rate_per_unit}/unit | duty {s.duty_percentage}% | phase1 ₹{s.phase_1_rent}")
except Exception as e:
    print(f"\n  ⚠️  BillingSettings: {e}")

# ── Done ──────────────────────────────────────────────────────────
print()
print("=" * 50)
print("  🎉  Database ready!")
print("=" * 50)
print("  Admin  (web):    admin   / admin123")
print("  Reader (mobile): reader  / reader123")
print()
print("  🌐  Web: http://localhost:3000")
print(f"  📱  Mobile API: check eMeterApp/.env for IP")
print("=" * 50)
print()
print("Next step → restart Django:")
print("  ./venv/bin/python3 manage.py runserver 0.0.0.0:8000")
