"use strict";
/** MIME builder with merge tags, List-Unsubscribe and optional DKIM signing. */
const crypto = require("crypto");

const CRLF = "\r\n";

function encodeHeader(value) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function foldBase64(str) {
  return (str.match(/.{1,76}/g) || []).join(CRLF);
}

function applyMergeTags(text, data) {
  if (!text) return text;
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
    const value = key.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), data);
    return value == null ? "" : String(value);
  });
}

function htmlToText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function messageId(domain) {
  return `<${crypto.randomUUID()}@${domain}>`;
}

/**
 * @param {object} msg { from, fromName, to, subject, html, text, replyTo, headers, mergeData, listUnsubscribe }
 * @param {object} opts { domain, dkim }
 */
function buildMessage(msg, opts = {}) {
  const domain = opts.domain || (msg.from || "localhost").split("@")[1] || "localhost";
  const data = msg.mergeData || {};
  const subject = applyMergeTags(msg.subject || "", data);
  const html = msg.html ? applyMergeTags(msg.html, data) : null;
  const text = applyMergeTags(msg.text || (html ? htmlToText(html) : ""), data);
  const id = msg.messageId || messageId(domain);
  const boundary = `--=_${crypto.randomBytes(12).toString("hex")}`;

  const headers = [
    ["From", msg.fromName ? `${encodeHeader(msg.fromName)} <${msg.from}>` : msg.from],
    ["To", Array.isArray(msg.to) ? msg.to.join(", ") : msg.to],
    ["Subject", encodeHeader(subject)],
    ["Date", new Date().toUTCString()],
    ["Message-ID", id],
    ["MIME-Version", "1.0"],
  ];
  if (msg.replyTo) headers.push(["Reply-To", msg.replyTo]);
  if (msg.listUnsubscribe) {
    headers.push(["List-Unsubscribe", msg.listUnsubscribe]);
    headers.push(["List-Unsubscribe-Post", "List-Unsubscribe=One-Click"]);
  }
  for (const [k, v] of Object.entries(msg.headers || {})) headers.push([k, String(v)]);

  let body;
  if (html) {
    headers.push(["Content-Type", `multipart/alternative; boundary="${boundary}"`]);
    body =
      `--${boundary}${CRLF}` +
      `Content-Type: text/plain; charset=UTF-8${CRLF}Content-Transfer-Encoding: base64${CRLF}${CRLF}` +
      foldBase64(Buffer.from(text, "utf8").toString("base64")) +
      `${CRLF}--${boundary}${CRLF}` +
      `Content-Type: text/html; charset=UTF-8${CRLF}Content-Transfer-Encoding: base64${CRLF}${CRLF}` +
      foldBase64(Buffer.from(html, "utf8").toString("base64")) +
      `${CRLF}--${boundary}--`;
  } else {
    headers.push(["Content-Type", "text/plain; charset=UTF-8"]);
    headers.push(["Content-Transfer-Encoding", "base64"]);
    body = foldBase64(Buffer.from(text, "utf8").toString("base64"));
  }

  let raw = headers.map(([k, v]) => `${k}: ${v}`).join(CRLF) + CRLF + CRLF + body;

  const dkim = opts.dkim;
  if (dkim && dkim.private_key && dkim.selector) {
    raw = signDkim(raw, headers, body, { ...dkim, domain: dkim.domain || domain });
  }

  return { raw, messageId: id, subject, text, html };
}

function canonicalizeHeader(name, value) {
  return `${name.toLowerCase()}:${value.replace(/\s+/g, " ").trim()}`;
}

function signDkim(raw, headers, body, dkim) {
  const signedNames = ["from", "to", "subject", "date", "message-id", "mime-version", "content-type"];
  const present = headers.filter(([k]) => signedNames.includes(k.toLowerCase()));
  const bodyCanon = body.replace(/\r?\n/g, CRLF).replace(/(\r\n)*$/, CRLF);
  const bodyHash = crypto.createHash("sha256").update(bodyCanon, "utf8").digest("base64");

  const tags =
    `v=1; a=rsa-sha256; c=relaxed/simple; d=${dkim.domain}; s=${dkim.selector}; ` +
    `t=${Math.floor(Date.now() / 1000)}; h=${present.map(([k]) => k.toLowerCase()).join(":")}; ` +
    `bh=${bodyHash}; b=`;

  const toSign =
    present.map(([k, v]) => canonicalizeHeader(k, v)).join(CRLF) +
    CRLF +
    canonicalizeHeader("dkim-signature", tags);

  const signature = crypto.createSign("RSA-SHA256").update(toSign, "utf8").sign(dkim.private_key, "base64");
  return `DKIM-Signature: ${tags}${signature}${CRLF}${raw}`;
}

module.exports = { buildMessage, applyMergeTags, htmlToText, messageId };
