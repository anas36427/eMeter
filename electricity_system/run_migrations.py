import os
import sys
import django
from django.core.management import call_command

# Set up Django environment
sys.path.append('/Users/anasahmad/Documents/eMeter.web/electricity_system')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricity_system.settings')
django.setup()

try:
    print("Starting migration for billing...")
    call_command('migrate', 'billing', interactive=False)
    print("Migration successful!")
except Exception as e:
    print(f"Migration failed: {e}")
    sys.exit(1)
