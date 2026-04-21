# Django Migration Fix - PostgreSQL Setup

## Issue Summary:
- PG 13.22 on 5433 (Django 6.0 needs 14+)
- Port 5432 auth failed
- Django==6.0.2, psycopg2-binary in requirements.txt

## Updated Plan:
1. [x] Role/DB created on 5433
2. Switch to SQLite for development (quick fix, no version issue)
3. Run migrations
4. Create superuser
5. Later: upgrade Postgres or downgrade Django to 5.1 (supports PG13)

**Current: Switching to SQLite DB_ENGINE=django.db.backends.sqlite3 in .env (confirm?). Or approve Django downgrade?**
