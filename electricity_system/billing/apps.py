from django.apps import AppConfig
import sys


class BillingConfig(AppConfig):
    name = 'billing'

    def ready(self):
        # Only auto-migrate when runserver is starting (not during manage.py commands
        # like migrate/shell/test that need to control the DB state themselves).
        if 'runserver' not in sys.argv:
            return

        try:
            from django.db import connection
            # Check the migrations table exists — if not, we're on a brand-new DB.
            # In that case skip auto-migrate (the user should run manage.py migrate first).
            tables = connection.introspection.table_names()
            if 'django_migrations' not in tables:
                print("⚠️  New database detected — run: manage.py migrate && create_admin.py")
                return

            from django.core.management import call_command
            call_command('migrate', interactive=False, verbosity=0)
            print("✅ Auto-migration check complete.")
        except Exception as e:
            print(f"⚠️  Auto-migration skipped: {e}")

