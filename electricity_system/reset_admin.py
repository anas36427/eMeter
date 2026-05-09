import os
import django
import sys

# Setup Django
sys.path.append('/Users/anasahmad/Documents/eMeter.web/electricity_system')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricity_system.settings')
django.setup()

from django.contrib.auth.models import User

def reset_admin():
    username = 'admin'
    password = 'admin123'
    
    # Check if user exists
    user = User.objects.filter(username=username).first()
    if user:
        user.set_password(password)
        user.is_superuser = True
        user.is_staff = True
        user.save()
        print(f"User '{username}' password has been reset to '{password}'.")
    else:
        User.objects.create_superuser(username, 'admin@example.com', password)
        print(f"Superuser '{username}' created with password '{password}'.")

if __name__ == "__main__":
    try:
        reset_admin()
    except Exception as e:
        print(f"Error: {e}")
