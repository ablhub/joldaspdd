#!/bin/bash
# Проверка настроек Caddy из server/deploy/caddy-config.sh на собранном релизе: сжатие br/gzip, кеш, типы файлов, страница 404, CSP.
# Запуск после сборки релиза:  node tools/build_release.js /tmp/out && bash tools/caddy_test.sh [каталог public]
# Нужен бинарник caddy (https://caddyserver.com/docs/install).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUB="${1:-${TMPDIR:-/tmp}/joldas-release-build/release/public}"
[ -d "$PUB" ] || { echo "нет каталога $PUB (сначала node tools/build_release.js)"; exit 2; }
command -v caddy >/dev/null || { echo "нет caddy"; exit 2; }
W=$(mktemp -d); PORT=8099
awk "/^body\(\) \{/{f=1;next} f&&/cat <<'B'/{g=1;next} g&&/^B\$/{exit} g{print}" "$ROOT/server/deploy/caddy-config.sh" | sed "s#/opt/joldas/current/public#$PUB#g" > "$W/body.txt"
{ printf '{\n\tadmin off\n\tauto_https off\n}\n\n:%s {\n' "$PORT"; cat "$W/body.txt"; printf '}\n'; } > "$W/Caddyfile"
caddy validate --config "$W/Caddyfile" --adapter caddyfile >/dev/null 2>&1 || { echo "FAIL конфигурация Caddy не проходит проверку"; caddy validate --config "$W/Caddyfile" --adapter caddyfile 2>&1 | tail -3; exit 1; }
setsid nohup caddy run --config "$W/Caddyfile" --adapter caddyfile > "$W/caddy.log" 2>&1 < /dev/null &
CP=$!
for i in $(seq 1 30); do curl -s -o /dev/null "http://127.0.0.1:$PORT/robots.txt" && break; sleep 0.2; done
FAILS=0
chk() { if [ "$2" = "$3" ]; then echo "OK   $1"; else echo "FAIL $1: ждали '$3', получили '$2'"; FAILS=$((FAILS+1)); fi; }
hdr() { curl -s -o /dev/null -D - -H "Accept-Encoding: $2" "http://127.0.0.1:$PORT$1" | tr -d '\r' | awk -F': ' -v k="$(echo "$3" | tr A-Z a-z)" 'tolower($1)==k{print $2; exit}'; }
code() { curl -s -o /dev/null -w '%{http_code}' -H "Accept-Encoding: identity" "http://127.0.0.1:$PORT$1"; }
A=$(ls "$PUB/assets" | grep -E '^app\.ru\.[0-9a-f]{8}\.js$' | head -1)
D=$(ls "$PUB/assets" | grep -E '^data\.ru\.[0-9a-f]{8}\.json$' | head -1)
chk "главная: brotli"                  "$(hdr / br Content-Encoding)" "br"
chk "главная: gzip для старых клиентов" "$(hdr / gzip Content-Encoding)" "gzip"
chk "главная: без кеша"                "$(hdr / br Cache-Control)" "no-cache"
chk "главная: CSP без внешних шрифтов" "$(hdr / br Content-Security-Policy | grep -c 'font-src .self.;')" "1"
chk "/kk/ и /en/ отдаются"             "$(code /kk/)$(code /en/)" "200200"
chk "код: кеш на год"                  "$(hdr /assets/$A br Cache-Control)" "public, max-age=31536000, immutable"
chk "код: brotli"                      "$(hdr /assets/$A br Content-Encoding)" "br"
chk "данные (json): кеш на год"        "$(hdr /assets/$D br Cache-Control)" "public, max-age=31536000, immutable"
chk "данные (json): brotli"            "$(hdr /assets/$D br Content-Encoding)" "br"
chk "шрифт: тип и кеш"                 "$(hdr /assets/fonts/golos-text-latin-wght-normal.woff2 br Content-Type) $(hdr /assets/fonts/golos-text-latin-wght-normal.woff2 br Cache-Control)" "font/woff2 public, max-age=31536000, immutable"
chk "индекс вопросов: без кеша"        "$(hdr /assets/qindex.json br Cache-Control)" "no-cache"
chk "manifest: тип"                    "$(hdr /manifest.webmanifest identity Content-Type)" "application/manifest+json"
chk "sitemap: brotli"                  "$(hdr /sitemap.xml br Content-Encoding)" "br"
chk "страница 404"                     "$(code /net-takoi-stranicy)" "404"
chk "404 без кеша"                     "$(hdr /net-takoi-stranicy br Cache-Control)" "no-cache"
chk "страницы каталога знаков"         "$(code /signs/)" "200"
kill $CP 2>/dev/null; wait $CP 2>/dev/null; rm -rf "$W"
[ $FAILS -eq 0 ] && echo "CADDY TESTS OK" || { echo "FAILS $FAILS"; exit 1; }
