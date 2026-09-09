#!/usr/bin/env bash
# Self-hosted installer.
# Usage: bash install.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

say() { printf "\033[36m==>\033[0m %s\n" "$1"; }
warn() { printf "\033[33mWarning:\033[0m %s\n" "$1"; }
die() { printf "\033[31mError:\033[0m %s\n" "$1" >&2; exit 1; }

command -v node >/dev/null 2>&1 || die "Node.js 18+ is required."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js 18+ is required (found $(node -v))."

say "Preparing configuration"
if [ ! -f mailer.config.json ]; then
  cp mailer.config.example.json mailer.config.json
  say "Created mailer.config.json — edit it with your license key, domain, and the mta routes, then re-run this script."
  exit 0
fi

say "Activating license"
node license-client.js activate || die "License activation failed. Check your key and domain in mailer.config.json."

say "Checking mail routes"
node -e '
const fs=require("fs");
const cfg=JSON.parse(fs.readFileSync("mailer.config.json","utf8"));
const routes=(cfg.mta&&cfg.mta.routes&&cfg.mta.routes.length)?cfg.mta.routes:[{name:"default",transport:cfg.smtp||{}}];
const active=routes.filter(r=>r.enabled!==false);
if(!active.length){console.error("No enabled mail routes in mailer.config.json");process.exit(1);}
for(const r of active){
  const t=r.transport||r;
  if(!t.host||!t.host.includes(".")||/\s/.test(t.host)){
    console.error(`Route "${r.name}": "${t.host}" is not a hostname. Use e.g. email-smtp.us-east-1.amazonaws.com — not your SMTP username.`);
    process.exit(1);
  }
  if(!t.username){console.warn(`Route "${r.name}": no SMTP username set — relay must allow unauthenticated sending.`);}
}
if(!(cfg.mta&&cfg.mta.api_key)||cfg.mta.api_key==="change-me-to-a-long-random-string"){
  console.warn("mta.api_key is unset or still the default — set a long random string before exposing port 8080.");
}
console.log(`${active.length} route(s) ready: ${active.map(r=>r.name).join(", ")}`);
' || die "Fix the mail route configuration and re-run."

say "Preparing queue storage"
mkdir -p .mta/queue/pending .mta/queue/sent .mta/queue/failed

say "Installing the daily heartbeat (cron)"
CRON_LINE="17 3 * * * cd $DIR && /usr/bin/env node license-client.js heartbeat >> $DIR/license.log 2>&1"
( crontab -l 2>/dev/null | grep -v "license-client.js heartbeat" ; echo "$CRON_LINE" ) | crontab -
say "Heartbeat scheduled daily at 03:17 server time."

say "Done. Start the mail server with: docker compose up -d   (or: node server.js)"
say "Then check: curl http://localhost:8080/health"
