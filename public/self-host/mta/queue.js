"use strict";
/**
 * Crash-safe file-backed queue. No Redis required; every job is a JSON file
 * so an unexpected restart resumes exactly where it stopped.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const STATES = ["pending", "sent", "failed"];

class Queue {
  constructor(dir, opts = {}) {
    this.dir = dir;
    this.maxAttempts = opts.max_attempts || 5;
    this.baseBackoffMs = opts.backoff_ms || 30000;
    for (const s of STATES) fs.mkdirSync(path.join(dir, s), { recursive: true });
  }

  _file(state, id) {
    return path.join(this.dir, state, `${id}.json`);
  }

  add(message) {
    const job = {
      id: message.id || crypto.randomUUID(),
      created_at: new Date().toISOString(),
      attempts: 0,
      next_attempt_at: message.send_at || new Date().toISOString(),
      status: "pending",
      last_error: null,
      route: null,
      tried_routes: [],
      message,
    };
    fs.writeFileSync(this._file("pending", job.id), JSON.stringify(job));
    return job;
  }

  /** Oldest due jobs, up to `limit`. */
  claim(limit) {
    const now = Date.now();
    const files = fs.readdirSync(path.join(this.dir, "pending")).sort();
    const claimed = [];
    for (const f of files) {
      if (claimed.length >= limit) break;
      const p = path.join(this.dir, "pending", f);
      let job;
      try {
        job = JSON.parse(fs.readFileSync(p, "utf8"));
      } catch {
        continue;
      }
      if (new Date(job.next_attempt_at).getTime() > now) continue;
      if (job.locked_until && new Date(job.locked_until).getTime() > now) continue;
      job.locked_until = new Date(now + 120000).toISOString();
      fs.writeFileSync(p, JSON.stringify(job));
      claimed.push(job);
    }
    return claimed;
  }

  complete(job, result) {
    job.status = "sent";
    job.locked_until = null;
    job.sent_at = new Date().toISOString();
    job.result = result;
    fs.writeFileSync(this._file("sent", job.id), JSON.stringify(job));
    this._remove("pending", job.id);
  }

  retryOrFail(job, error, permanent) {
    job.attempts += 1;
    job.last_error = String(error && error.message ? error.message : error);
    job.locked_until = null;
    if (permanent || job.attempts >= this.maxAttempts) {
      job.status = "failed";
      job.failed_at = new Date().toISOString();
      fs.writeFileSync(this._file("failed", job.id), JSON.stringify(job));
      this._remove("pending", job.id);
      return false;
    }
    const delay = this.baseBackoffMs * Math.pow(2, job.attempts - 1);
    job.next_attempt_at = new Date(Date.now() + delay).toISOString();
    fs.writeFileSync(this._file("pending", job.id), JSON.stringify(job));
    return true;
  }

  _remove(state, id) {
    try {
      fs.unlinkSync(this._file(state, id));
    } catch {
      /* already gone */
    }
  }

  get(id) {
    for (const s of STATES) {
      try {
        return JSON.parse(fs.readFileSync(this._file(s, id), "utf8"));
      } catch {
        /* keep looking */
      }
    }
    return null;
  }

  stats() {
    const out = {};
    for (const s of STATES) out[s] = fs.readdirSync(path.join(this.dir, s)).length;
    return out;
  }

  recent(state, limit = 25) {
    const dir = path.join(this.dir, state);
    return fs
      .readdirSync(dir)
      .slice(-limit)
      .map((f) => {
        try {
          const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
          return {
            id: j.id,
            to: j.message.to,
            subject: j.message.subject,
            status: j.status,
            attempts: j.attempts,
            route: j.route,
            last_error: j.last_error,
            created_at: j.created_at,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse();
  }
}

module.exports = { Queue };
