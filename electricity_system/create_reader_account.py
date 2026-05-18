import os
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricity_system.settings')
django.setup()

from django.contrib.auth import get_user_model

def create_reader():
    username = 'reader1'
    password = 'reader123'
    role = 'meter_reader'
    
    print(f"Processing user: {username}...")
    
    User = get_user_model()
    # Get or create user
    user, created = User.objects.get_or_create(username=username)
    user.role = role
    user.set_password(password)
    user.save()
    if created:
        print(f"  - User '{username}' created with password '{password}' and role '{role}'.")
    else:
        print(f"  - User '{username}' already exists. Updated role to '{role}'.")

    print("\nAccount setup complete!")

if __name__ == '__main__':
    create_reader()
