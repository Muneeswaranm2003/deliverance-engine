"use strict";
/**
 * Delivery routing: picks which relay (route) sends a message.
 *
 * Route selection order:
 *  1. rules that match (recipient domain, tag, sender domain)
 *  2. weighted round-robin across the remaining enabled routes
 *  3. per-route hourly rate limits and failover on transient errors
 */

class Router {
  constructor(config = {}) {
    this.routes = (config.routes || []).map((r, i) => ({
      name: r.name || `route-${i + 1}`,
      enabled: r.enabled !== false,
      weight: Math.max(1, Number(r.weight) || 1),
      max_per_hour: Number(r.max_per_hour) || 0, // 0 = unlimited
      from_email: r.from_email || null,
      from_name: r.from_name || null,
      dkim: r.dkim || null,
      transport: r.transport || r, // { host, port, username, password, secure }
      _cursor: 0,
      _window: { start: Date.now(), count: 0 },
      _failures: 0,
      _cooldownUntil: 0,
    }));
    this.rules = config.rules || []; // [{ match: { recipient_domain|tag|sender_domain }, route }]
    this._rr = 0;
  }

  list() {
    return this.routes.map((r) => ({
      name: r.name,
      enabled: r.enabled,
      weight: r.weight,
      host: r.transport.host,
      sent_this_hour: this._windowCount(r),
      max_per_hour: r.max_per_hour,
      failures: r._failures,
      cooling_down: r._cooldownUntil > Date.now(),
    }));
  }

  _windowCount(route) {
    if (Date.now() - route._window.start > 3600000) route._window = { start: Date.now(), count: 0 };
    return route._window.count;
  }

  _available(route) {
    if (!route.enabled) return false;
    if (route._cooldownUntil > Date.now()) return false;
    if (route.max_per_hour && this._windowCount(route) >= route.max_per_hour) return false;
    return true;
  }

  _matchRules(message) {
    const rcptDomain = String(message.to || "").split("@")[1]?.toLowerCase();
    const senderDomain = String(message.from || "").split("@")[1]?.toLowerCase();
    for (const rule of this.rules) {
      const m = rule.match || {};
      if (m.recipient_domain && m.recipient_domain.toLowerCase() !== rcptDomain) continue;
      if (m.sender_domain && m.sender_domain.toLowerCase() !== senderDomain) continue;
      if (m.tag && m.tag !== message.tag) continue;
      const route = this.routes.find((r) => r.name === rule.route);
      if (route && this._available(route)) return route;
    }
    return null;
  }

  /** @param {string[]} exclude route names already tried for this message */
  pick(message, exclude = []) {
    const ruled = this._matchRules(message);
    if (ruled && !exclude.includes(ruled.name)) return ruled;

    const pool = this.routes.filter((r) => this._available(r) && !exclude.includes(r.name));
    if (!pool.length) return null;

    // weighted round-robin
    const expanded = [];
    for (const r of pool) for (let i = 0; i < r.weight; i++) expanded.push(r);
    const route = expanded[this._rr % expanded.length];
    this._rr = (this._rr + 1) % Number.MAX_SAFE_INTEGER;
    return route;
  }

  reportSuccess(route) {
    this._windowCount(route);
    route._window.count += 1;
    route._failures = 0;
  }

  reportFailure(route, permanent) {
    if (permanent) return; // a bad address is not the route's fault
    route._failures += 1;
    if (route._failures >= 5) {
      route._cooldownUntil = Date.now() + 5 * 60000; // rest 5 minutes, then retry
      route._failures = 0;
    }
  }
}

module.exports = { Router };
