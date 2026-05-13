#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Setting up Python environment..."
cd "$ROOT/backend"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt

# Copy env if not present
[ -f .env ] || cp .env.example .env

echo "==> Starting MLflow tracking server (localhost:5000)..."
mlflow server --host 0.0.0.0 --port 5000 &
MLFLOW_PID=$!

sleep 2

echo "==> Starting FastAPI backend (localhost:8000)..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
API_PID=$!

echo "==> Starting React frontend (localhost:5173)..."
cd "$ROOT/frontend"
[ -f .env ] || cp .env.example .env
npm install --silent
npm run dev &
VITE_PID=$!

echo ""
echo "  MLflow UI  → http://localhost:5000"
echo "  API        → http://localhost:8000/docs"
echo "  Frontend   → http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services."

trap "kill $MLFLOW_PID $API_PID $VITE_PID 2>/dev/null; exit 0" INT TERM
wait
