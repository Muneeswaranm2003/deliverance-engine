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
3. Edit `mailer.config.json`: your license key, the license endpoint, your production domain, database URL and the `mta` block (API key + relay routes).
4. Run `bash install.sh` again — it activates the license, installs the daily heartbeat cron job and smoke-tests the mail routes.
5. `docker compose up -d` to start the platform, then check `http://your-server:8080/health`.

## License commands

```
node license-client.js activate     # claim an installation slot
node license-client.js heartbeat    # daily check-in (installed as cron)
node license-client.js deactivate   # free the slot before moving servers
```

## The MTA module

`server.js` runs the mail transfer agent: an HTTP API, a crash-safe on-disk queue, a routing
engine and a dependency-free SMTP client (ESMTP, STARTTLS/SSL, AUTH LOGIN/PLAIN, DKIM signing).
No npm install, no Redis required.

```
mta/smtp-client.js   SMTP conversation and error classification (4xx retry / 5xx drop)
mta/mime.js          MIME builder, merge tags, List-Unsubscribe, DKIM signature
mta/router.js        route selection: rules, weighted round-robin, rate limits, failover
mta/queue.js         durable queue with attempts and exponential backoff
mta/index.js         wiring, suppression list, event hooks
server.js            HTTP API + license gate
```

### API

Send `Authorization: Bearer <mta.api_key>` with every request.

```bash
# one message
curl -X POST http://localhost:8080/api/send \
  -H "Authorization: Bearer $MTA_API_KEY" -H "Content-Type: application/json" \
  -d '{"to":"user@example.com","subject":"Hello {{first_name}}","html":"<p>Hi {{first_name}}</p>",
       "merge_data":{"first_name":"Ada"},"tag":"transactional"}'

# batch
curl -X POST http://localhost:8080/api/send/bulk -H "Authorization: Bearer $MTA_API_KEY" \
  -H "Content-Type: application/json" -d '{"messages":[{...},{...}]}'

curl http://localhost:8080/api/queue                 # queue + route counters
curl http://localhost:8080/api/messages?status=failed
curl http://localhost:8080/api/messages/<job-id>
curl -X POST http://localhost:8080/api/suppress -d '{"email":"bad@example.com"}'
curl http://localhost:8080/health                    # 200 healthy, 503 licence expired
```

`send_at` (ISO date) schedules a message for later. Hard bounces are added to the suppression
list automatically and future sends to that address are skipped.

### Routing

Each entry in `mta.routes` is a relay. Messages pick a route in this order:

1. the first matching entry in `mta.rules` (`recipient_domain`, `sender_domain` or `tag`)
2. weighted round-robin across enabled routes that are under their `max_per_hour` limit
3. on a transient failure the message is retried on a *different* route; a route that fails five
   times in a row cools down for five minutes

Set `weight` to bias volume between relays, `max_per_hour` to protect a warming IP, and
`enabled: false` to park a relay without deleting it.

### Delivery events

Every `delivered`, `deferred`, `bounced`, `failed` and `suppressed` event is appended to
`.mta/events.log`. Set `mta.webhook_url` to also POST them to your analytics endpoint.

### DKIM

Put your private key (PEM) in `mta.dkim.private_key` (or per route) with the `selector` and
`domain`, then publish `selector._domainkey.yourdomain` in DNS. Messages are signed automatically.

## Rules

- One production domain per installation slot.
- `localhost`, `*.test`, `*.local`, and `staging.` / `dev.` / `test.` hosts are free and never consume a slot.
- If the license server is unreachable, the install keeps running for 14 days (grace period); after that the API returns `402` and the queue pauses.
