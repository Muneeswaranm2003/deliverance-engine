"use strict";
/**
 * The MTA: queue + router + SMTP delivery + suppression + event hooks.
 */
const fs = require("fs");
const path = require("path");
const { Queue } = require("./queue");
const { Router } = require("./router");
const { buildMessage } = require("./mime");
const { sendMail, SmtpError } = require("./smtp-client");

class Mta {
  constructor(config, options = {}) {
    this.config = config;
    const mta = config.mta || {};
    this.dataDir = options.dataDir || path.join(__dirname, "..", ".mta");
    fs.mkdirSync(this.dataDir, { recursive: true });

    this.queue = new Queue(path.join(this.dataDir, "queue"), {
      max_attempts: mta.max_attempts || 5,
      backoff_ms: mta.retry_backoff_ms || 30000,
    });

    // Fall back to the single top-level smtp block if no routes are configured.
    const routes =
      mta.routes && mta.routes.length
        ? mta.routes
        : [{ name: "default", transport: config.smtp || {}, from_email: config.app?.from_email, from_name: config.app?.from_name }];
    this.router = new Router({ routes, rules: mta.rules || [] });

    this.concurrency = mta.concurrency || 5;
    this.pollMs = mta.poll_interval_ms || 1000;
    this.webhookUrl = mta.webhook_url || null;
    this.suppressionFile = path.join(this.dataDir, "suppressed.json");
    this.suppressed = new Set(this._readSuppression());
    this.running = false;
    this.inFlight = 0;
    this.stats = { accepted: 0, delivered: 0, failed: 0, suppressed: 0 };
    this.licenseOk = () => true;
  }

  _readSuppression() {
    try {
      return JSON.parse(fs.readFileSync(this.suppressionFile, "utf8"));
    } catch {
      return [];
    }
  }

  suppress(email, reason) {
    this.suppressed.add(String(email).toLowerCase());
    fs.writeFileSync(this.suppressionFile, JSON.stringify([...this.suppressed]));
    this.emit("suppressed", { email, reason });
  }

  unsuppress(email) {
    this.suppressed.delete(String(email).toLowerCase());
    fs.writeFileSync(this.suppressionFile, JSON.stringify([...this.suppressed]));
  }

  isSuppressed(email) {
    return this.suppressed.has(String(email).toLowerCase());
  }

  /** Accept one message (or fan out an array of recipients) into the queue. */
  enqueue(message) {
    const recipients = Array.isArray(message.to) ? message.to : [message.to];
    const jobs = [];
    for (const to of recipients) {
      if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
        throw new Error(`Invalid recipient address: ${to}`);
      }
      if (this.isSuppressed(to)) {
        this.stats.suppressed += 1;
        this.emit("skipped", { to, reason: "suppressed" });
        continue;
      }
      const job = this.queue.add({ ...message, to });
      this.stats.accepted += 1;
      jobs.push({ id: job.id, to });
    }
    return jobs;
  }

  async emit(event, payload) {
    const record = { event, at: new Date().toISOString(), ...payload };
    fs.appendFileSync(path.join(this.dataDir, "events.log"), JSON.stringify(record) + "\n");
    if (!this.webhookUrl) return;
    try {
      await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
    } catch {
      /* webhook failures never block delivery */
    }
  }

  async deliver(job) {
    const msg = job.message;
    const tried = job.tried_routes || [];
    const route = this.router.pick(msg, tried);
    if (!route) {
      throw Object.assign(new Error("No delivery route available (all disabled, rate-limited or already tried)"), {
        permanent: false,
      });
    }
    job.route = route.name;

    const from = msg.from || route.from_email || this.config.app?.from_email;
    const fromName = msg.from_name || route.from_name || this.config.app?.from_name;
    if (!from) throw Object.assign(new Error("No from address configured"), { permanent: true });

    const built = buildMessage(
      {
        ...msg,
        from,
        fromName,
        messageId: msg.messageId,
        mergeData: msg.merge_data || msg.mergeData,
        listUnsubscribe: msg.list_unsubscribe,
      },
      { domain: this.config.domain, dkim: route.dkim || this.config.mta?.dkim },
    );

    try {
      const result = await sendMail(
        { ...route.transport, helo: this.config.domain },
        { from, to: [msg.to], raw: built.raw, heloDomain: this.config.domain },
      );
      this.router.reportSuccess(route);
      return { ...result, message_id: built.messageId, route: route.name };
    } catch (err) {
      const permanent = err instanceof SmtpError ? err.permanent : false;
      this.router.reportFailure(route, permanent);
      job.tried_routes = [...tried, route.name];
      err.permanent = permanent;
      // 5.1.1 style rejections mean the address is dead — stop mailing it.
      if (permanent && /5\.1\.[01]|user unknown|no such user|mailbox unavailable/i.test(err.message)) {
        this.suppress(msg.to, "hard_bounce");
      }
      throw err;
    }
  }

  async tick() {
    if (!this.licenseOk()) return;
    const capacity = this.concurrency - this.inFlight;
    if (capacity <= 0) return;
    const jobs = this.queue.claim(capacity);
    for (const job of jobs) {
      this.inFlight += 1;
      this.deliver(job)
        .then((result) => {
          this.queue.complete(job, result);
          this.stats.delivered += 1;
          this.emit("delivered", { id: job.id, to: job.message.to, route: job.route, response: result.response });
        })
        .catch((err) => {
          const retried = this.queue.retryOrFail(job, err, err.permanent === true);
          if (!retried) {
            this.stats.failed += 1;
            this.emit(err.permanent ? "bounced" : "failed", {
              id: job.id,
              to: job.message.to,
              route: job.route,
              error: err.message,
            });
          } else {
            this.emit("deferred", { id: job.id, to: job.message.to, attempts: job.attempts, error: err.message });
          }
        })
        .finally(() => {
          this.inFlight -= 1;
        });
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => this.tick().catch(() => {}), this.pollMs);
  }

  stop() {
    this.running = false;
    clearInterval(this.timer);
  }

  snapshot() {
    return {
      running: this.running,
      in_flight: this.inFlight,
      counters: this.stats,
      queue: this.queue.stats(),
      routes: this.router.list(),
      suppressed: this.suppressed.size,
    };
  }
}

module.exports = { Mta };
