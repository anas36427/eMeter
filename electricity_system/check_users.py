import os
import django
import sys

# Setup Django
sys.path.append('/Users/anasahmad/Documents/eMeter.web/electricity_system')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricity_system.settings')
django.setup()

from django.contrib.auth.models import User

def list_users():
    users = User.objects.all()
    if not users:
        print("No users found in database.")
    for user in users:
        print(f"Username: {user.username}, Is Superuser: {user.is_superuser}, Is Staff: {user.is_staff}")

if __name__ == "__main__":
    list_users()
