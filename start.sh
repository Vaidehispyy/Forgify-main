#!/usr/bin/env bash
# Forgify · Unified Development Launcher
# Starts both the Python Forensic Worker and the Next.js Web App together.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

echo "=================================================="
echo " Starting Forgify Full-Stack Forensics Platform  "
echo "=================================================="

# Function to clean up background processes on exit
cleanup() {
    echo ""
    echo "Shutting down Forgify services..."
    if [ -n "$UVICORN_PID" ]; then
        kill "$UVICORN_PID" 2>/dev/null || true
    fi
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Start Python FastAPI Forensics Worker (Port 8000)
echo "→ Starting Python Forensics Worker on http://127.0.0.1:8000..."
PYTHONPATH="$REPO_ROOT/python" "$REPO_ROOT/python/.venv/bin/uvicorn" app.main:app --host 127.0.0.1 --port 8000 &
UVICORN_PID=$!
cd "$REPO_ROOT"

# Wait a moment for Python engine to initialize
sleep 2

# 2. Start Next.js App (Port 3000)
echo "→ Starting Next.js Web Frontend on http://localhost:3000..."
npm run dev
