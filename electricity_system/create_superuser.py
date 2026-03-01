#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricity_system.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

if not User.objects.filter(username='admin').exists():
    user = User.objects.create_superuser('admin', 'anas@example.com', 'admin123')
    from billing.models import UserProfile
    UserProfile.objects.create(user=user, role='admin')
    print('Superuser created with admin role!')
else:
    user = User.objects.get(username='admin')
    from billing.models import UserProfile
    profile, created = UserProfile.objects.get_or_create(user=user, defaults={'role': 'admin'})
    if not created and profile.role != 'admin':
        profile.role = 'admin'
        profile.save()
    print('Superuser already exists - role updated to admin!')

