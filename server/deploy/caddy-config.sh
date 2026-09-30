#!/bin/bash
# Собирает /etc/caddy/Caddyfile: адреса по IP (sslip.io, nip.io), свой домен из админки.
# http://IP перенаправляет на основной HTTPS-адрес, чтобы прогресс не передавался без шифрования.
set -euo pipefail
set -a; . /etc/joldas/env; set +a
IP="$PUBLIC_IP"
D="${IP//./-}"
DOMAIN=""
if [ -f /var/lib/joldas/domain ]; then DOMAIN=$(tr -cd 'a-z0-9.-' < /var/lib/joldas/domain); fi
CANON="${DOMAIN:-$D.sslip.io}"
body() {
  cat <<'B'
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
		Permissions-Policy "camera=(), microphone=(), geolocation=()"
		-Server
	}
	@app path /api/* /admin /admin/*
	handle @app {
		header X-Robots-Tag "noindex, nofollow"
		reverse_proxy 127.0.0.1:3000 {
			header_up X-Real-IP {remote_host}
		}
	}
	handle {
		root * /opt/joldas/current/public
		# HTML-страницы (главная на трех языках и статические SEO-страницы): без кеша, CSP
		@html path */ *.html
		header @html Cache-Control "no-cache"
		header @html Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'"
		# код, схемы и данные страницы лежат в файлах с отпечатком в имени (app.ru.1a2b3c4d.js): кешируем на год, при новом релизе имя меняется.
		# шрифты и seo.css (адрес с ?v=отпечаток) тоже не меняются под тем же адресом
		@hashed path_regexp hashed ^/assets/(app|scene|data)\.[a-z]+\.[0-9a-f]{8}\.(js|json)$
		header @hashed Cache-Control "public, max-age=31536000, immutable"
		@static path /assets/fonts/* /assets/seo.css
		header @static Cache-Control "public, max-age=31536000, immutable"
		# картинки и значки меняются редко; индекс вопросов для админки всегда свежий
		@assets path /assets/signs/* /assets/icons/* /assets/og/* /favicon.svg /favicon.ico /apple-touch-icon.png
		header @assets Cache-Control "public, max-age=86400"
		@qindex path /assets/qindex.json
		header @qindex Cache-Control "no-cache"
		# служебные файлы для поисковиков и ИИ обновляются с релизом
		@meta path /robots.txt /sitemap.xml /llms.txt /llms-full.txt /llms-full-ru.txt /llms-full-kk.txt /manifest.webmanifest
		header @meta Cache-Control "public, max-age=3600"
		@manifest path /manifest.webmanifest
		header @manifest Content-Type "application/manifest+json"
		# сжатые копии (.br, .gz) готовит сборка релиза: отдаем их без сжатия на лету
		file_server {
			precompressed br gzip
		}
	}
	handle_errors {
		@e404 expression {http.error.status_code} == 404
		handle @e404 {
			root * /opt/joldas/current/public
			rewrite * /404.html
			header Cache-Control "no-cache"
			file_server
		}
	}
B
}
OUT=/etc/caddy/Caddyfile.new
{
  printf '{\n\tadmin localhost:2019\n}\n\n'
  if [ -n "$DOMAIN" ]; then
    printf '%s {\n' "$DOMAIN"; body; printf '}\n\n'
    printf '%s.sslip.io, %s.nip.io {\n\tredir https://%s{uri} 301\n}\n\n' "$D" "$D" "$DOMAIN"
  else
    printf '%s.sslip.io, %s.nip.io {\n' "$D" "$D"; body; printf '}\n\n'
  fi
  printf 'http://%s {\n\tredir https://%s{uri} 301\n}\n' "$IP" "$CANON"
} > "$OUT"
if ! caddy validate --config "$OUT" --adapter caddyfile >/tmp/caddy-validate.log 2>&1; then cat /tmp/caddy-validate.log; exit 1; fi
mv "$OUT" /etc/caddy/Caddyfile
echo "[caddy] config ok: ${DOMAIN:-no domain}, $D.sslip.io, $D.nip.io, http://$IP -> https://$CANON"
