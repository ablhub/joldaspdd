#!/bin/bash
# Поднимает чистую тестовую базу и сервер API на :3100 и прогоняет test/run.js
set -u
cd "$(dirname "$0")/../server"
DB=joldas_apitest
psql -h /tmp -p 55432 -U postgres -qc "drop database if exists $DB" -c "create database $DB" >/dev/null
rm -rf /tmp/jtest && mkdir -p /tmp/jtest/var/incoming /tmp/jtest/backups /tmp/jtest/public/kk /tmp/jtest/public/en
# заглушки страниц ru, kk, en: проверка раздачи /kk и /en в режиме разработки (PUBLIC_DIR)
for l in ru kk en; do d=/tmp/jtest/public; [ $l = ru ] || d=$d/$l; printf '<!doctype html>\n<html lang="%s"><title>%s</title></html>\n' $l $l > $d/index.html; done
export DATABASE_URL="postgres://postgres@localhost/$DB?host=/tmp&port=55432"
export GITHUB_BASE=http://127.0.0.1:3199 GITHUB_PORT=3199
export JOLDAS_VERSION=2026.09.30-1807-67b52af AUTO_UPDATE=0   # версия для проверки автообновления; фоновая проверка выключена, проверяем кнопкой
export PORT=3100 JOLDAS_VAR=/tmp/jtest/var BACKUP_DIR=/tmp/jtest/backups PUBLIC_IP=203.0.113.7 SKIP_DNS_CHECK=1 NODE_ENV=development PUBLIC_DIR=/tmp/jtest/public
node src/main.js > /tmp/jtest/api.log 2>&1 &
PID=$!
for i in $(seq 1 30); do curl -fs http://127.0.0.1:3100/api/v1/health >/dev/null 2>&1 && break; sleep 0.3; done
BASE=http://127.0.0.1:3100 VAR=/tmp/jtest/var node test/run.js
RC=$?
kill $PID 2>/dev/null
wait $PID 2>/dev/null
if [ $RC -ne 0 ]; then echo '--- api.log'; tail -30 /tmp/jtest/api.log; fi
exit $RC
