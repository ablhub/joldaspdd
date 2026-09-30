#!/bin/bash
# Один раз на вашем компьютере: создает ключ подписи релизов, кладет секретный ключ в секреты GitHub (если установлен gh и вы в нем вошли)
# и печатает готовую команду для сервера с публичным ключом. Запуск из папки репозитория:  bash tools/setup_release_key.sh
# Секретный ключ остается только у вас: в каталоге ~/joldas-release-key и в секрете GitHub. В репозиторий и в чаты его не отправляйте.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="${REPO:-ablhub/joldaspdd}"
DIR="${KEYDIR:-$HOME/joldas-release-key}"
command -v node >/dev/null 2>&1 || { echo "Нужен Node.js 22 или новее (https://nodejs.org), затем повторите запуск."; exit 1; }
if [ -f "$DIR/release.key" ]; then echo "Ключ уже есть в $DIR, использую его."; else node tools/release_keygen.js "$DIR" >/dev/null; echo "Ключ создан: $DIR"; fi
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh secret set RELEASE_SIGNING_KEY --repo "$REPO" < "$DIR/release.key" && echo "Секрет RELEASE_SIGNING_KEY добавлен в $REPO."
else
  echo
  echo "GitHub CLI (gh) не найден или вы в нем не вошли: добавьте секрет вручную."
  echo "  1) Скопируйте ключ в буфер:  pbcopy < \"$DIR/release.key\""
  echo "  2) Откройте https://github.com/$REPO/settings/secrets/actions/new"
  echo "  3) Name: RELEASE_SIGNING_KEY, Secret: вставьте из буфера, Add secret."
  echo "  4) Очистите буфер:  pbcopy < /dev/null"
fi
echo
echo "Теперь на сервере (консоль Servercore или SSH) выполните целиком этот блок: он записывает публичный ключ, которому сервер будет доверять:"
echo
echo "sudo joldas-set-release-key <<'KEY'"
cat "$DIR/release.pub"
echo "KEY"
