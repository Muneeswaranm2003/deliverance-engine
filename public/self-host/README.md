# Self-hosted installation

Perpetual license. The software keeps working forever; updates and support run for 12 months.

## Requirements

- Linux server, 2 vCPU / 4 GB RAM minimum
- Node.js 18+ and Docker (with the compose plugin)
- PostgreSQL 14+ (bundled in `docker-compose.yml` if you don't have one)
- A domain pointed at the server

## Steps

1. Unpack the package on your server.
2. `bash install.sh` — this creates `mailer.config.json` from the example.
3. Edit `mailer.config.json`: your license key, the license endpoint, your production domain, database URL and SMTP credentials.
4. Run `bash install.sh` again — it activates the license and installs the daily heartbeat cron job.
5. `docker compose up -d` to start the platform, then open `https://your-domain`.

## License commands

```
node license-client.js activate     # claim an installation slot
node license-client.js heartbeat    # daily check-in (installed as cron)
node license-client.js deactivate   # free the slot before moving servers
```

## Rules

- One production domain per installation slot.
- `localhost`, `*.test`, `*.local`, and `staging.` / `dev.` / `test.` hosts are free and never consume a slot.
- If the license server is unreachable, the install keeps running for 14 days (grace period) before it stops validating.
