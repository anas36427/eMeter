#!/bin/bash
echo "--- Cleaning up ports 8000, 8001, 3000, 8080, 8081, 8083 ---"
lsof -ti:8000,8001,3000,8080,8081,8083 | xargs kill -9 2>/dev/null || echo "No processes found on these ports."
echo "Done."
