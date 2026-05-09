#!/bin/bash

# This script helps complete the PostgreSQL upgrade that was started by the AI assistant.
# Due to environment restrictions, some service-level commands must be run directly by you.

echo "--- Stopping PostgreSQL 13 ---"
brew services stop postgresql@13

echo "--- Starting PostgreSQL 16 ---"

# Ensure the data directory is initialized
# We'll try the standard Homebrew path first, then fallback to the project folder if needed.
DATA_DIR="/usr/local/var/postgresql@16"
if ! mkdir -p "$DATA_DIR" 2>/dev/null; then
    DATA_DIR="$HOME/postgres16_data"
    echo "Using fallback data directory: $DATA_DIR"
    mkdir -p "$DATA_DIR"
fi

if [ ! -d "$DATA_DIR/base" ]; then
    echo "Initializing PostgreSQL 16 data directory in $DATA_DIR..."
    /usr/local/opt/postgresql@16/bin/initdb -D "$DATA_DIR" --locale=en_US.UTF-8
fi

# If using a custom data dir, we start it manually instead of via brew services
if [[ "$DATA_DIR" == "$HOME"* ]]; then
    /usr/local/opt/postgresql@16/bin/pg_ctl -D "$DATA_DIR" -l "$DATA_DIR/postgres.log" start
else
    brew services start postgresql@16
fi

# Wait for it to start
sleep 3

echo "--- Initializing Database and User (if fresh) ---"
# Create the user and database if they don't exist
# Using 5432 as default for PG 16
export PGPORT=5432
export PGHOST=localhost
psql -d postgres -c "CREATE USER emeter_user WITH PASSWORD 'emeter123';" 2>/dev/null
psql -d postgres -c "ALTER USER emeter_user WITH SUPERUSER;" 2>/dev/null
psql -d postgres -c "CREATE DATABASE emeter_db OWNER emeter_user;" 2>/dev/null

echo "--- Installing Django Dependencies ---"
python3 -m pip install -r requirements.txt

echo "--- Running Django Migrations ---"
python3 manage.py migrate

echo "--- Verification ---"
psql --version
python3 manage.py check
