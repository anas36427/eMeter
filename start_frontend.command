#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/energy-hub-ui"
echo "Starting React Frontend..."
npm run dev -- --force
