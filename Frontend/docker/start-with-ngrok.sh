#!/bin/sh
set -eu

APP_PORT="${NGROK_PORT:-9002}"
APP_URL="http://localhost:${APP_PORT}"

if [ -n "${NGROK_AUTHTOKEN:-}" ]; then
  echo "[ngrok] Configuring auth token..."
  ngrok config add-authtoken "${NGROK_AUTHTOKEN}" >/dev/null

  if [ -n "${NGROK_DOMAIN:-}" ]; then
    echo "[ngrok] Starting tunnel on reserved domain ${NGROK_DOMAIN} -> ${APP_URL}"
    ngrok http --domain="${NGROK_DOMAIN}" "${APP_URL}" &
  else
    echo "[ngrok] Starting tunnel -> ${APP_URL}"
    ngrok http "${APP_URL}" &
  fi
else
  echo "[ngrok] NGROK_AUTHTOKEN is not set; tunnel will not start."
fi

echo "[frontend] Starting Next.js dev server on port ${APP_PORT}..."
exec npm run dev

