#!/bin/bash

# This script opens 3 separate terminal windows using macOS native "open" command.

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "--- Cleaning up existing processes on ports 8001, 3000, 8081 ---"
lsof -ti:8001,3000,8081 | xargs kill -9 2>/dev/null || true

echo "--- Launching Backend (Django) ---"
open "$DIR/start_backend.command"

echo "--- Launching Frontend (React) ---"
open "$DIR/start_frontend.command"

echo "--- Launching Mobile App (Expo) ---"
open "$DIR/start_mobile.command"

echo "Done! All three services are launching in separate windows."
