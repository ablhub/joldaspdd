#!/bin/bash
# После первой установки: выключает страницу загрузки и запускает веб-сервер Caddy на портах 80 и 443.
sleep 1
systemctl disable --now joldas-bootstrap.service || true
systemctl restart caddy
