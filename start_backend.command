#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/electricity_system"

echo "Starting Django Backend..."

# Try venv Python inside electricity_system
if [ -f "$SCRIPT_DIR/electricity_system/venv/bin/python3" ]; then
    PYTHON="$SCRIPT_DIR/electricity_system/venv/bin/python3"
    echo "Using backend venv Python: $PYTHON"
else
    PYTHON="$(which python3)"
    echo "Using system Python: $PYTHON"
fi

"$PYTHON" manage.py runserver 0.0.0.0:8001
