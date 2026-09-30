#!/bin/bash
# Первичная настройка сервера Жолдас. Запускается cloud-init один раз при создании сервера.
# Ставит Node.js, PostgreSQL, Caddy, создает базу с паролем, сгенерированным здесь же, закрывает все порты, кроме 80 и 443.
set -euo pipefail
exec > >(tee -a /var/log/joldas-provision.log) 2>&1
echo "== provision start $(date -Is)"
export DEBIAN_FRONTEND=noninteractive
retry() { local n=0; until "$@"; do n=$((n + 1)); [ "$n" -ge 5 ] && return 1; echo "retry $n: $*"; sleep $((n * 5)); done; }

install -d -m 0755 /var/lib/joldas
retry apt-get update
retry apt-get install -y curl ca-certificates gnupg

# 1. Node.js 22 (NodeSource), запасной вариант - nodejs из Ubuntu
if ! command -v node >/dev/null 2>&1; then
  if curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh && bash /tmp/nodesource_setup.sh && apt-get install -y nodejs; then
    echo "node from nodesource"
  else
    retry apt-get install -y nodejs
  fi
fi
node --version

# 2. Страница установки доступна сразу: показывает ход настройки
systemctl daemon-reload
systemctl enable --now joldas-bootstrap.service

# 3. Остальные пакеты
retry apt-get install -y ufw postgresql openssl tar gzip
if ! command -v caddy >/dev/null 2>&1; then
  if curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
    && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' -o /etc/apt/sources.list.d/caddy-stable.list \
    && apt-get update && apt-get install -y caddy; then
    echo "caddy from official repo"
  else
    rm -f /etc/apt/sources.list.d/caddy-stable.list
    retry apt-get update
    retry apt-get install -y caddy
  fi
fi
systemctl disable --now caddy || true
timedatectl set-timezone Asia/Almaty || true

# файл подкачки 1 ГБ: страховка при пиковой нагрузке
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab || true
fi

# 4. Пользователь и каталоги
id joldas >/dev/null 2>&1 || useradd --system --home-dir /var/lib/joldas --shell /usr/sbin/nologin joldas
install -d -o joldas -g joldas -m 0750 /var/lib/joldas /var/lib/joldas/incoming
install -d -o postgres -g joldas -m 2750 /var/backups/joldas
install -d -m 0755 /opt/joldas /opt/joldas/releases
install -d -o root -g joldas -m 0750 /etc/joldas

# 5. База данных: пароль генерируется на сервере и никуда не передается
if [ ! -f /etc/joldas/env ]; then
  PW=$(openssl rand -hex 24)
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -q -c "CREATE ROLE joldas LOGIN PASSWORD '$PW'"
  runuser -u postgres -- createdb -O joldas joldas
  PUBLIC_IP=$(curl -4fsS --max-time 10 https://api.ipify.org || curl -4fsS --max-time 10 https://ifconfig.me || hostname -I | awk '{print $1}')
  umask 027
  cat > /etc/joldas/env <<EOF
DATABASE_URL=postgres://joldas:$PW@127.0.0.1:5432/joldas
PUBLIC_IP=$PUBLIC_IP
JOLDAS_VAR=/var/lib/joldas
BACKUP_DIR=/var/backups/joldas
PORT=3000
NODE_ENV=production
EOF
  chown root:joldas /etc/joldas/env
  chmod 0640 /etc/joldas/env
  umask 022
fi

# 6. Файрвол: наружу открыты только 80 и 443
ufw default deny incoming
ufw default allow outgoing
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

touch /var/lib/joldas/.provisioned
echo "== provision done $(date -Is)"
