#!/usr/bin/env bash
# Self-hosted installer.
# Usage: bash install.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

say() { printf "\033[36m==>\033[0m %s\n" "$1"; }
die() { printf "\033[31mError:\033[0m %s\n" "$1" >&2; exit 1; }

command -v node >/dev/null 2>&1 || die "Node.js 18+ is required."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js 18+ is required (found $(node -v))."

say "Preparing configuration"
if [ ! -f mailer.config.json ]; then
  cp mailer.config.example.json mailer.config.json
  say "Created mailer.config.json — edit it with your license key, domain and SMTP details, then re-run this script."
  exit 0
fi

say "Activating license"
node license-client.js activate || die "License activation failed. Check your key and domain in mailer.config.json."

say "Installing the daily heartbeat (cron)"
CRON_LINE="17 3 * * * cd $DIR && /usr/bin/env node license-client.js heartbeat >> $DIR/license.log 2>&1"
( crontab -l 2>/dev/null | grep -v "license-client.js heartbeat" ; echo "$CRON_LINE" ) | crontab -
say "Heartbeat scheduled daily at 03:17 server time."

say "Done. Start the platform with: docker compose up -d"
