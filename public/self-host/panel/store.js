"use strict";
/**
 * Tiny JSON-file store for the control panel (domains, senders, lists, campaigns).
 * Single writer process, so a whole-file atomic write is enough — no DB required.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const EMPTY = { domains: [], senders: [], lists: [], campaigns: [] };

class Store {
  constructor(file) {
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.data = this._read();
  }

  _read() {
    try {
      return { ...EMPTY, ...JSON.parse(fs.readFileSync(this.file, "utf8")) };
    } catch {
      return JSON.parse(JSON.stringify(EMPTY));
    }
  }

  _write() {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  all(collection) {
    return this.data[collection] || [];
  }

  find(collection, id) {
    return this.all(collection).find((r) => r.id === id) || null;
  }

  insert(collection, record) {
    const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...record };
    this.data[collection] = [...this.all(collection), row];
    this._write();
    return row;
  }

  update(collection, id, patch) {
    let updated = null;
    this.data[collection] = this.all(collection).map((r) => {
      if (r.id !== id) return r;
      updated = { ...r, ...patch, id: r.id, updated_at: new Date().toISOString() };
      return updated;
    });
    if (updated) this._write();
    return updated;
  }

  remove(collection, id) {
    const before = this.all(collection).length;
    this.data[collection] = this.all(collection).filter((r) => r.id !== id);
    if (this.data[collection].length !== before) {
      this._write();
      return true;
    }
    return false;
  }
}

module.exports = { Store };
