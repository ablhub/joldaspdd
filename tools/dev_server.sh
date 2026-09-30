#!/bin/bash
# Локальный сервер для проверки сайта: API + статика на :3200, чистая база joldas_dev
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/server"
DB=joldas_dev
if [ -f /tmp/jdev/pid ]; then kill "$(cat /tmp/jdev/pid)" 2>/dev/null; sleep 0.8; fi
if [ "${1:-}" = "--fresh" ]; then psql -h /tmp -p 55432 -U postgres -qc "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null; rm -rf /tmp/jdev; fi
mkdir -p /tmp/jdev/var/incoming /tmp/jdev/backups
export DATABASE_URL="postgres://postgres@localhost/$DB?host=/tmp&port=55432"
export PORT=3200 JOLDAS_VAR=/tmp/jdev/var BACKUP_DIR=/tmp/jdev/backups PUBLIC_IP=203.0.113.7 SKIP_DNS_CHECK=1 NODE_ENV=development PUBLIC_DIR="$ROOT/site/public"
nohup node src/main.js > /tmp/jdev/api.log 2>&1 &
echo $! > /tmp/jdev/pid
for i in $(seq 1 30); do curl -fs http://127.0.0.1:3200/api/v1/health >/dev/null 2>&1 && break; sleep 0.3; done
curl -s http://127.0.0.1:3200/api/v1/health; echo
