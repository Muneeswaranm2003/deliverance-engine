#!/usr/bin/env node
/**
 * Self-hosted license client.
 *
 * - activate : claims an installation slot for this domain
 * - heartbeat: daily check-in (run from cron / systemd timer)
 * - deactivate: frees the slot when you move servers
 *
 * Usage:
 *   node license-client.js activate
 *   node license-client.js heartbeat
 *   node license-client.js deactivate
 *
 * Reads config from ./mailer.config.json (see mailer.config.example.json).
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const CONFIG_PATH = process.env.MAILER_CONFIG || path.join(__dirname, "mailer.config.json");
const STATE_PATH = path.join(__dirname, ".license-state.json");
const GRACE_PERIOD_DAYS = 14;

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`Config not found at ${CONFIG_PATH}. Copy mailer.config.example.json and fill it in.`);
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  for (const field of ["license_key", "license_endpoint", "domain"]) {
    if (!cfg[field]) {
      console.error(`Missing "${field}" in ${CONFIG_PATH}`);
      process.exit(1);
    }
  }
  return cfg;
}

/** Stable machine fingerprint so a re-install on the same box reuses its slot. */
function fingerprint() {
  const seed = [os.hostname(), os.platform(), os.arch(), os.cpus().length].join("|");
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 32);
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

async function call(cfg, action) {
  const res = await fetch(cfg.license_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      license_key: cfg.license_key,
      domain: cfg.domain,
      fingerprint: fingerprint(),
      app_version: cfg.app_version || "1.0.0",
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

/** Offline tolerance: keep running for GRACE_PERIOD_DAYS after the last good check-in. */
function withinGrace() {
  const state = readState();
  if (!state?.last_success) return false;
  const age = Date.now() - new Date(state.last_success).getTime();
  return age < GRACE_PERIOD_DAYS * 86400000;
}

async function main() {
  const action = (process.argv[2] || "heartbeat").toLowerCase();
  const cfg = loadConfig();
  const remote = action === "heartbeat" ? "validate" : action;

  let result;
  try {
    result = await call(cfg, remote);
  } catch (err) {
    if (withinGrace()) {
      console.warn(`License server unreachable (${err.message}). Running on grace period.`);
      process.exit(0);
    }
    console.error(`License server unreachable and grace period expired: ${err.message}`);
    process.exit(2);
  }

  const { body, ok } = result;

  if (!ok || body.valid === false) {
    if (action === "heartbeat" && withinGrace() && result.status >= 500) {
      console.warn("License check failed server-side. Running on grace period.");
      process.exit(0);
    }
    console.error(`License ${action} failed: ${body.error || result.status}`);
    process.exit(2);
  }

  writeState({
    last_success: new Date().toISOString(),
    token: body.token || null,
    entitlements: body.entitlements || null,
  });

  const ent = body.entitlements || {};
  console.log(`License ${action} OK — tier: ${ent.tier_name || ent.tier || "n/a"}`);
  if (ent.updates_and_support_active === false) {
    console.warn("Updates & support window has expired. The software keeps running; renew for new releases.");
  }
}

main();
