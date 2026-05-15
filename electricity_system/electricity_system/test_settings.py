"""
Test settings – overrides production settings to use SQLite in memory.
This lets `manage.py test` run without a running PostgreSQL server.

Usage:
    python manage.py test billing --settings=electricity_system.test_settings --verbosity=2
"""
from .settings import *   # noqa: F401, F403 – import all production settings

# Override the database: use fast in-memory SQLite for all tests
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Speed up password hashing in tests
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# Suppress debug output during tests
DEBUG = False
LOGGING = {}
