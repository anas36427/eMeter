
import os
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricity_system.settings')
django.setup()

from django.contrib.auth.models import User
from billing.models import UserProfile

def create_reader():
    username = 'reader1'
    password = 'reader123'
    role = 'meter_reader'
    
    print(f"Processing user: {username}...")
    
    # Get or create user
    user, created = User.objects.get_or_create(username=username)
    if created:
        user.set_password(password)
        user.save()
        print(f"  - User '{username}' created with password '{password}'.")
    else:
        print(f"  - User '{username}' already exists. Updating password...")
        user.set_password(password)
        user.save()
        
    # Get or create profile
    profile, p_created = UserProfile.objects.get_or_create(user=user)
    profile.role = role
    profile.save()
    
    if p_created:
        print(f"  - UserProfile created with role: {role}")
    else:
        print(f"  - UserProfile updated with role: {role}")

    print("\nAccount setup complete!")

if __name__ == '__main__':
    create_reader()
