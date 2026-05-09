#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/eMeterApp"
echo "Starting Expo Mobile App..."
npx expo start
