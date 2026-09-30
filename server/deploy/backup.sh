#!/bin/bash
# Ночная резервная копия базы (запускается от пользователя postgres). Хранятся копии за 14 дней.
set -euo pipefail
umask 027
DIR=/var/backups/joldas
F="$DIR/joldas-$(date +%Y%m%d-%H%M).dump"
pg_dump -Fc -d joldas -f "$F.part"
mv "$F.part" "$F"
find "$DIR" -name 'joldas-*.dump' -mtime +14 -delete
