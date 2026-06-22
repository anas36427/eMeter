#!/bin/bash
# Run this ONCE in your native terminal to set up the SQLite database
# Usage: cd electricity_system && ./setup_db.sh

set -e
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

PYTHON="./venv/bin/python3"
export DB_ENGINE=django.db.backends.sqlite3
export DB_NAME=db.sqlite3

echo "🗑️  Removing old db.sqlite3 to start fresh..."
rm -f db.sqlite3

echo "⚙️  Running migrations..."
$PYTHON manage.py migrate

echo "👤 Creating admin and reader accounts..."
$PYTHON manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()

# Admin
if not User.objects.filter(username='admin').exists():
    u = User.objects.create_superuser(username='admin', password='admin123', email='admin@amu.ac.in')
    u.role = 'admin'
    u.save()
    print('  ✅ admin / admin123')
else:
    print('  ℹ️  admin already exists')

# Meter Reader
if not User.objects.filter(username='reader').exists():
    r = User.objects.create_user(username='reader', password='reader123', email='reader@amu.ac.in')
    r.role = 'meter_reader'
    r.save()
    print('  ✅ reader / reader123')
else:
    print('  ℹ️  reader already exists')

# Ensure BillingSettings row exists
from billing.models import BillingSettings
s = BillingSettings.get_settings()
print(f'  ✅ BillingSettings: rate=₹{s.rate_per_unit}/unit, duty={s.duty_percentage}%')

print()
print('--- All users ---')
for u in User.objects.all():
    print(f'  {u.username:15} role={getattr(u, \"role\", \"?\")}')
"

echo ""
echo "✅ Database setup complete!"
echo ""
echo "📋 Login credentials:"
echo "   Admin:  admin / admin123"
echo "   Reader: reader / reader123"
echo ""
echo "🚀 Now restart the backend: ./start_backend.command"
