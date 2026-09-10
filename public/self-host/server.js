#!/usr/bin/env node
"use strict";
/**
 * Self-hosted mail server: HTTP API in front of the MTA.
 *
 *   POST /api/send        { to, subject, html|text, from?, merge_data?, tag?, send_at? }
 *   POST /api/send/bulk   { messages: [ ...same shape... ] }
 *   GET  /api/messages/:id
 *   GET  /api/queue       queue + route stats
 *   POST /api/suppress    { email, reason }   DELETE /api/suppress { email }
 *   GET  /health
 *
 * Auth: send `Authorization: Bearer <mta.api_key>` (set it in mailer.config.json).
 * Sending is gated on a valid licence (14-day offline grace, same as the client).
 */
const fs = require("fs");
const http = require("http");
const path = require("path");
const { Mta } = require("./mta");
const { Store } = require("./panel/store");
const { handlePanelApi } = require("./panel/api");

const CONFIG_PATH = process.env.MAILER_CONFIG || path.join(__dirname, "mailer.config.json");
const STATE_PATH = path.join(__dirname, ".license-state.json");
const GRACE_MS = 14 * 86400000;

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const apiKey = config.mta?.api_key || process.env.MTA_API_KEY || "";
const port = Number(config.mta?.port || process.env.PORT || 8080);

const mta = new Mta(config);
const store = new Store(path.join(mta.dataDir, "panel.json"));
const PANEL_DIR = path.join(__dirname, "panel");

/** Delivery stops if the licence has been invalid for longer than the grace window. */
function licenseState() {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    const age = Date.now() - new Date(state.last_success).getTime();
    return { valid: age < GRACE_MS, last_success: state.last_success, entitlements: state.entitlements || null };
  } catch {
    return { valid: false, last_success: null, entitlements: null };
  }
}
mta.licenseOk = () => licenseState().valid;

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 5_000_000) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function authorized(req) {
  if (!apiKey) return true; // no key configured = local/trusted only
  const header = req.headers.authorization || "";
  return header === `Bearer ${apiKey}`;
}

function validate(msg) {
  if (!msg || typeof msg !== "object") return "Message must be an object";
  if (!msg.to) return "Field 'to' is required";
  if (!msg.subject) return "Field 'subject' is required";
  if (!msg.html && !msg.text) return "Provide 'html' or 'text'";
  if (msg.send_at && Number.isNaN(new Date(msg.send_at).getTime())) return "Field 'send_at' is not a valid date";
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = `${req.method} ${url.pathname}`;

  if (url.pathname === "/health") {
    const lic = licenseState();
    return json(res, lic.valid ? 200 : 503, {
      status: lic.valid ? "ok" : "license_invalid",
      license_checked_at: lic.last_success,
      ...mta.snapshot(),
    });
  }

  // Control panel (static, unauthenticated shell — the API behind it needs the key)
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/panel" || url.pathname === "/panel/")) {
    const html = fs.readFileSync(path.join(PANEL_DIR, "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": html.length });
    return res.end(html);
  }

  if (!authorized(req)) return json(res, 401, { error: "Unauthorized" });

  try {
    if (await handlePanelApi(req, res, { url, json, readBody, store, mta, config })) return;

    if (route === "POST /api/send" || route === "POST /api/send/bulk") {
      if (!licenseState().valid) {
        return json(res, 402, { error: "Licence check has not succeeded within the 14-day grace period." });
      }
      const body = await readBody(req);
      const messages = route.endsWith("/bulk") ? body.messages : [body];
      if (!Array.isArray(messages) || !messages.length) return json(res, 400, { error: "No messages supplied" });
      const errors = messages.map(validate).filter(Boolean);
      if (errors.length) return json(res, 400, { error: errors[0] });

      const queued = [];
      for (const m of messages) queued.push(...mta.enqueue(m));
      return json(res, 202, { queued: queued.length, jobs: queued });
    }

    if (route === "GET /api/queue") return json(res, 200, mta.snapshot());

    if (req.method === "GET" && url.pathname === "/api/messages") {
      const state = url.searchParams.get("status") || "pending";
      return json(res, 200, { messages: mta.queue.recent(state, Number(url.searchParams.get("limit")) || 25) });
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/messages/")) {
      const job = mta.queue.get(url.pathname.split("/").pop());
      return job ? json(res, 200, job) : json(res, 404, { error: "Message not found" });
    }

    if (route === "POST /api/suppress") {
      const body = await readBody(req);
      if (!body.email) return json(res, 400, { error: "Field 'email' is required" });
      mta.suppress(body.email, body.reason || "manual");
      return json(res, 200, { suppressed: body.email });
    }

    if (route === "DELETE /api/suppress") {
      const body = await readBody(req);
      if (!body.email) return json(res, 400, { error: "Field 'email' is required" });
      mta.unsuppress(body.email);
      return json(res, 200, { released: body.email });
    }

    return json(res, 404, { error: "Not found" });
  } catch (err) {
    return json(res, 400, { error: err.message });
  }
});

mta.start();
server.listen(port, () => {
  console.log(`MTA listening on :${port} — routes: ${mta.router.list().map((r) => r.name).join(", ") || "none"}`);
  if (!licenseState().valid) console.warn("Licence not validated yet — run: node license-client.js activate");
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log("Draining…");
    mta.stop();
    server.close(() => process.exit(0));
  });
}
