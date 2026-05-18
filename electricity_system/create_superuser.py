#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricity_system.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

if not User.objects.filter(username='admin').exists():
    user = User.objects.create_superuser('admin', 'anas@example.com', 'admin123')
    user.role = 'admin'
    user.save()
    print('Superuser created with admin role!')
else:
    user = User.objects.get(username='admin')
    if user.role != 'admin':
        user.role = 'admin'
        user.save()
    print('Superuser already exists - role updated to admin!')
