import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricity_system.settings')
django.setup()

from django.core.management import call_command
from django.db import models
from billing.models import MeterReading

def print_separator(title):
    print(f"\n{'='*70}\n  {title}\n{'='*70}")

def main():
    print_separator("STEP 1: Checking Model-to-Migration Alignment")
    try:
        call_command('makemigrations', check=True, dry_run=True)
        print("✅ Models and migrations are in perfect sync. No outstanding migrations to generate!")
    except SystemExit:
        print("❌ Model/Migration mismatch detected! Generating missing migrations...")
        call_command('makemigrations')

    print_separator("STEP 2: Checking Migration Status in Database")
    try:
        call_command('showmigrations', 'billing')
    except Exception as e:
        print(f"❌ Failed to query migration status: {e}")

    print_separator("STEP 3: Inspecting SQL DDL for Pending Migrations")
    print("📜 SQL DDL for Migration 0002:")
    try:
        call_command('sqlmigrate', 'billing', '0002')
    except Exception as e:
        print(f"Error printing 0002 SQL: {e}")

    print("\n📜 SQL DDL for Migration 0003:")
    try:
        call_command('sqlmigrate', 'billing', '0003')
    except Exception as e:
        print(f"Error printing 0003 SQL: {e}")

    print_separator("DIAGNOSTIC: Checking for Violating CheckConstraint Rows")
    try:
        violating = MeterReading.objects.filter(current_reading__lt=models.F('previous_reading'))
        count = violating.count()
        if count > 0:
            print(f"⚠️ WARNING: Found {count} invalid MeterReading records (current_reading < previous_reading).")
            print("PostgreSQL will fail to apply the check constraint migration if these exist!")
            for mr in violating:
                print(f"   - Consumer: {mr.consumer.consumer_number}, Date: {mr.reading_date}, Current: {mr.current_reading}, Previous: {mr.previous_reading}")
            
            confirm = input("\nWould you like to resolve them automatically (setting current_reading = previous_reading)? [y/N]: ").strip().lower()
            if confirm == 'y':
                for mr in violating:
                    mr.current_reading = mr.previous_reading
                    mr.save()
                print("✅ Violating records resolved.")
            else:
                print("❌ Migration aborted so you can clean the database manually.")
                sys.exit(1)
        else:
            print("✅ No database rows violate the check constraint.")
    except Exception as e:
        print(f"❌ Failed to run diagnostic check: {e}")

    print_separator("STEP 4: Database Synchronization (Migrating)")
    confirm_migrate = input("Ready to apply these migrations to your PostgreSQL database? [y/N]: ").strip().lower()
    if confirm_migrate == 'y':
        try:
            call_command('migrate')
            print("\n🎉 Database schema is now perfectly matched with your models!")
        except Exception as e:
            print(f"\n❌ Migration failed: {e}")
            print("\n💡 Tip: If you already have these columns manually created in your database, you can run:")
            print("   python manage.py migrate --fake-initial")
    else:
        print("❌ Migration cancelled.")

if __name__ == '__main__':
    main()
