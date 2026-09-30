#!/bin/bash
# Установка релиза Жолдас из архива. Использование: install.sh <release.tgz> [--first]
# База данных и прогресс пользователей не трогаются: только новые файлы сайта и API, миграции и перезапуск.
set -euo pipefail
TGZ="$1"
MODE="${2:-}"
ROOT=/opt/joldas
VAR=/var/lib/joldas
DEST="$ROOT/releases/$(date +%Y%m%d-%H%M%S)"
echo "[install] $TGZ -> $DEST"
mkdir -p "$DEST"
tar -xzf "$TGZ" -C "$DEST" --strip-components=1 --no-same-owner
if [ ! -f "$DEST/public/index.html" ] || [ ! -f "$DEST/server/src/main.js" ]; then
  echo "[install] archive has no public/index.html or server/src/main.js"
  rm -rf "$DEST"
  exit 2
fi
chown -R root:root "$DEST"
chmod -R u=rwX,go=rX "$DEST"

echo "[install] migrations"
runuser -u joldas -- bash -c "set -a; . /etc/joldas/env; set +a; cd '$DEST/server' && node src/migrate.js"

ln -sfn "$DEST" "$ROOT/current.tmp"
mv -Tf "$ROOT/current.tmp" "$ROOT/current"

install -m 0755 "$DEST/deploy/joldas-admin-reset" /usr/local/sbin/joldas-admin-reset
install -m 0755 "$DEST/deploy/joldas-set-release-key" /usr/local/sbin/joldas-set-release-key
install -d -m 0755 -o root -g root /var/lib/joldas-deploy
install -m 0644 "$DEST"/deploy/systemd/* /etc/systemd/system/
systemctl daemon-reload
systemctl enable joldas-api.service joldas-backup.timer joldas-deploy.path joldas-domain.path >/dev/null 2>&1
systemctl restart joldas-api.service
systemctl start joldas-backup.timer joldas-domain.path
systemctl restart joldas-deploy.path

echo "[install] waiting for API"
ok=0
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/v1/health >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
if [ "$ok" != 1 ]; then
  echo "[install] API did not start"
  journalctl -u joldas-api -n 40 --no-pager || true
  exit 3
fi

bash "$DEST/deploy/caddy-config.sh"
systemctl enable caddy >/dev/null 2>&1
if [ "$MODE" = "--first" ]; then
  [ -f "$VAR/setup-code" ] || openssl rand -hex 16 > "$VAR/setup-code"
  chown joldas:joldas "$VAR/setup-code"
  chmod 0600 "$VAR/setup-code"
else
  systemctl reload caddy || systemctl restart caddy
fi

# храним 5 последних релизов
ls -1dt "$ROOT"/releases/* 2>/dev/null | tail -n +6 | xargs -r rm -rf
echo "[install] ok version $(cat "$DEST/VERSION" 2>/dev/null || echo '?')"
