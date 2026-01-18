#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/neoshare}"
UPLOADS_DIR="${UPLOADS_DIR:-$PROJECT_DIR/uploads}"
CONDA_DIR="${CONDA_DIR:-/opt/miniconda3}"
CONDA_ENV="${CONDA_ENV:-neoshare}"
JUPYTER_IP="${JUPYTER_IP:-127.0.0.1}"
JUPYTER_PORT="${JUPYTER_PORT:-8888}"
JUPYTER_BASE_URL="${JUPYTER_BASE_URL:-/jupyter/}"
JUPYTER_TOKEN="${JUPYTER_TOKEN:-neoshare2024}"

mkdir -p "$UPLOADS_DIR"
cd "$UPLOADS_DIR"

source "$CONDA_DIR/bin/activate" "$CONDA_ENV"

python -m jupyter notebook \
  --ip="$JUPYTER_IP" \
  --port="$JUPYTER_PORT" \
  --no-browser \
  --allow-root \
  --ServerApp.base_url="$JUPYTER_BASE_URL" \
  --ServerApp.token="$JUPYTER_TOKEN" \
  --ServerApp.password= \
  --ServerApp.allow_origin='*' \
  --ServerApp.tornado_settings='{"headers":{"Content-Security-Policy":"frame-ancestors *"}}'
