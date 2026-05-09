#!/bin/bash

# Define constants
PG_BIN="/usr/local/opt/postgresql@16/bin"
DATA_DIR="/usr/local/var/postgresql@16"
FALLBACK_DIR="$HOME/postgres16_data"

echo "--- 1. Stopping Old PostgreSQL ---"
brew services stop postgresql@13 2>/dev/null || true
brew services stop postgresql@16 2>/dev/null || true

echo "--- 2. Preparing Data Directory ---"
# Check if standard directory is writable
if mkdir -p "$DATA_DIR" 2>/dev/null; then
    echo "Using standard directory: $DATA_DIR"
else
    DATA_DIR="$FALLBACK_DIR"
    echo "Using fallback directory: $DATA_DIR"
    mkdir -p "$DATA_DIR"
fi

# Initialize if not already done
if [ ! -d "$DATA_DIR/base" ]; then
    echo "Initializing database cluster..."
    "$PG_BIN/initdb" -D "$DATA_DIR" --locale=en_US.UTF-8
fi

echo "--- 3. Starting PostgreSQL 16 ---"
# Start the server
"$PG_BIN/pg_ctl" -D "$DATA_DIR" -l "$DATA_DIR/postgres.log" start

# Wait for startup
echo "Waiting for PostgreSQL to start..."
for i in {1..10}; do
    if "$PG_BIN/pg_isready" -h localhost -p 5432; then
        echo "PostgreSQL is ready!"
        break
    fi
    sleep 1
done

echo "--- 4. Setting up Django Database ---"
export PGHOST=localhost
export PGPORT=5432

# Create user and db
"$PG_BIN/psql" -d postgres -c "CREATE USER emeter_user WITH PASSWORD 'emeter123';" 2>/dev/null || true
"$PG_BIN/psql" -d postgres -c "ALTER USER emeter_user WITH SUPERUSER;" 2>/dev/null || true
"$PG_BIN/psql" -d postgres -c "CREATE DATABASE emeter_db OWNER emeter_user;" 2>/dev/null || true

echo "--- 5. Installing Dependencies & Migrating ---"
python3 -m pip install -r requirements.txt
python3 manage.py migrate

echo "--- 6. Final Check ---"
python3 manage.py check
echo "PostgreSQL version:"
"$PG_BIN/psql" --version
