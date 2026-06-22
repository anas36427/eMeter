#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/eMeterApp"
echo "Starting Expo Mobile App (clearing cache for updated IP)..."
npx expo start -c
