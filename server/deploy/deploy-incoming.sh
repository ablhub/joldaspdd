#!/bin/bash
# Устанавливает релизы, загруженные через админку (/var/lib/joldas/incoming/*.signed). Запускается systemd от root.
# Ставит только архивы с подписью ключа релизов (Ed25519, публичный ключ /opt/joldas-bootstrap/release.pub принадлежит root).
set -uo pipefail
VAR=/var/lib/joldas
SD=/var/lib/joldas-deploy
PUB=/opt/joldas-bootstrap/release.pub
install -d -m 0755 -o root -g root "$SD"
status() {
  node -e 'const fs=require("fs"); const [f,state,version,error,log]=process.argv.slice(1); fs.writeFileSync(f+".tmp", JSON.stringify({state, version:version||"", error:error||"", log:log||"", at:Date.now()})); fs.renameSync(f+".tmp", f);' "$SD/status.json" "$@"
  chmod 0644 "$SD/status.json"
}
shopt -s nullglob
for f in "$VAR"/incoming/*.signed; do
  if [ -L "$f" ] || [ ! -f "$f" ]; then rm -f -- "$f"; continue; fi
  work=$(mktemp -d /root/joldas-release.XXXXXX)
  cp -- "$f" "$work/in" && rm -f -- "$f"
  status running
  if node -e '
    const fs=require("fs"), crypto=require("crypto");
    const [pub, inp, out]=process.argv.slice(1);
    const b=fs.readFileSync(inp);
    if (b.length<200 || b.slice(0,4).toString("latin1")!=="JSIG") process.exit(2);
    const sig=b.slice(4,68), tgz=b.slice(68);
    if (!crypto.verify(null, tgz, fs.readFileSync(pub,"utf8"), sig)) process.exit(3);
    fs.writeFileSync(out, tgz, {mode:0o600});' "$PUB" "$work/in" "$work/release.tgz"; then
    mkdir -p "$work/x"
    if tar -xzf "$work/release.tgz" -C "$work/x" --no-same-owner 2>/dev/null && [ -f "$work/x/release/deploy/install.sh" ]; then
      if out=$(bash "$work/x/release/deploy/install.sh" "$work/release.tgz" 2>&1); then
        status ok "$(cat /opt/joldas/current/VERSION 2>/dev/null)" "" "$(echo "$out" | tail -n 5)"
      else
        status error "" "установка прервалась" "$(echo "$out" | tail -n 25)"
      fi
    else
      status error "" "архив поврежден или не является релизом Жолдас" ""
    fi
  else
    status error "" "подпись архива не совпала: устанавливаются только релизы, подписанные ключом Жолдас" ""
  fi
  rm -rf -- "$work"
done
