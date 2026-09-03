# Self-Hosted Licensing (One-Time Purchase)

Turn the platform into a MailWizz/MTA-style product: customers buy a perpetual license once, download the software, and their self-hosted install activates against a license server we run here.

## License tiers

| Tier | Price | Installations | Included |
| --- | --- | --- | --- |
| Single | $299 one-time | 1 production install | 12 months updates + support |
| Agency | $799 one-time | up to 5 production installs | 12 months updates + support |
| Enterprise | Custom (contact sales) | Multiple / unlimited | 12 months updates + support |

All licenses perpetual — the software keeps working after 12 months; only updates and support need renewal.

## Phase 1 — License core + issuing

- Public pricing page with the three tiers and a "Contact sales" flow for Enterprise.
- Stripe one-time checkout for Single and Agency (built-in Stripe payments; test mode first).
- On successful payment, a webhook issues a license key (format `LMTA-XXXX-XXXX-XXXX-XXXX`), records the purchase, and emails the customer their key + download link + install docs link.
- Customer license portal: sign in, see keys, tier, install slots used, support-expiry date, download link.

## Phase 2 — Activation / validation API

Public endpoints self-hosted installs call:

- `POST /license/activate` — key + domain + install fingerprint. Rejects if key is revoked, or if all install slots are used by other domains. Returns a signed activation token.
- `POST /license/validate` — periodic heartbeat (daily). Returns license status, tier, entitlements, and whether updates/support are still active.
- `POST /license/deactivate` — frees a slot when a customer moves servers.

Rules: one slot per unique domain; localhost / `*.test` / staging domains don't consume a slot; grace period (14 days offline) so an install never hard-fails on a network blip; revoked keys stop activating but existing installs get a clear warning first.

## Phase 3 — Admin dashboard

Admin-only section (reuses the existing `admin` role and `has_role`):

- Purchases list: customer, tier, amount, date, Stripe reference.
- License list: key, tier, status (active / revoked / expired support), slots used, last heartbeat.
- Actions: issue a manual/Enterprise license, extend the updates-and-support window, revoke or restore a key, force-release a slot.
- Simple metrics: revenue by tier, active installs, licenses expiring support in the next 30 days.

## Technical notes

- New tables (all in `public`, RLS on, GRANTs in the same migration):
  - `license_products` — tier definitions (slug, name, price, install limit, support months).
  - `licenses` — key hash, customer email, tier, status, purchased_at, support_expires_at, install_limit, stripe reference, notes.
  - `license_activations` — license_id, domain, fingerprint, ip, activated_at, last_seen_at, status.
  - `license_purchases` — Stripe session/payment id, amount, currency, email, license_id.
- Keys stored hashed (sha256) with a short display prefix; the plaintext key is shown once at purchase and in the portal via a signed reveal.
- Edge functions: `license-checkout` (create Stripe session), `stripe-license-webhook` (issue key + send email), `license-api` (activate / validate / deactivate, public, no JWT), `license-admin` (admin-guarded actions).
- Activation tokens signed with an HS256 secret so an install can verify offline during the grace period.
- Stripe: enable built-in Stripe payments first, create the two one-time products, then wire checkout. Enterprise stays a contact form until quoted, then an admin-issued key.
- Emails go through the existing send-email function.

## Out of scope for now

Update-package hosting / auto-updater delivery, renewal billing for expired support windows, and reseller accounts — natural Phase 4 once the above is live.
