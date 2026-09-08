"use strict";
/**
 * Minimal, dependency-free SMTP client (ESMTP + STARTTLS + AUTH LOGIN/PLAIN).
 * Enough to deliver real mail through any relay (SES, Elastic Email, Postfix...).
 */
const net = require("net");
const tls = require("tls");

const CRLF = "\r\n";

class SmtpError extends Error {
  constructor(message, code, permanent) {
    super(message);
    this.name = "SmtpError";
    this.code = code || 0;
    // 5xx = permanent (do not retry), 4xx / network = transient
    this.permanent = permanent === undefined ? code >= 500 && code < 600 : permanent;
  }
}

function createSession(socket, timeout) {
  let buffer = "";
  let pending = null;

  const flush = () => {
    if (!pending) return;
    // A full reply ends with "NNN <space>...CRLF"
    const match = buffer.match(/^(?:\d{3}-[^\r\n]*\r\n)*(\d{3}) ([^\r\n]*)\r\n/);
    if (!match) return;
    const raw = buffer.slice(0, match[0].length);
    buffer = buffer.slice(match[0].length);
    const code = Number(match[1]);
    const { resolve, reject, expect } = pending;
    pending = null;
    if (expect && !expect.includes(Math.floor(code / 100))) {
      reject(new SmtpError(raw.trim(), code));
    } else {
      resolve({ code, text: raw.trim() });
    }
  };

  socket.setEncoding("utf8");
  socket.setTimeout(timeout);
  socket.on("data", (chunk) => {
    buffer += chunk;
    flush();
  });
  const fail = (err) => {
    if (pending) {
      pending.reject(err instanceof Error ? err : new SmtpError(String(err), 0, false));
      pending = null;
    }
  };
  socket.on("error", fail);
  socket.on("timeout", () => {
    socket.destroy();
    fail(new SmtpError("SMTP timeout", 0, false));
  });
  socket.on("close", () => fail(new SmtpError("SMTP connection closed", 0, false)));

  return {
    read(expect) {
      return new Promise((resolve, reject) => {
        pending = { resolve, reject, expect };
        flush();
      });
    },
    send(line, expect) {
      const p = this.read(expect);
      socket.write(line + CRLF);
      return p;
    },
    write(data) {
      socket.write(data);
    },
  };
}

function connect(options) {
  const { host, port, secure, timeout } = options;
  return new Promise((resolve, reject) => {
    const onError = (err) => reject(new SmtpError(`Cannot reach ${host}:${port} — ${err.message}`, 0, false));
    const socket =
      secure === "ssl" || secure === "tls" || port === 465
        ? tls.connect({ host, port, servername: host, rejectUnauthorized: options.rejectUnauthorized !== false }, () => resolve(socket))
        : net.connect({ host, port }, () => resolve(socket));
    socket.setTimeout(timeout, () => {
      socket.destroy();
      reject(new SmtpError(`Timed out connecting to ${host}:${port}`, 0, false));
    });
    socket.once("error", onError);
  });
}

function parseExtensions(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\d{3}[ -]/, "").trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Deliver one message.
 * @returns {Promise<{code:number, response:string, host:string}>}
 */
async function sendMail(transport, envelope) {
  const host = transport.host;
  const port = Number(transport.port) || 587;
  const secure = (transport.secure || (port === 465 ? "ssl" : "starttls")).toLowerCase();
  const timeout = transport.timeout_ms || 30000;
  const helo = transport.helo || envelope.heloDomain || "localhost";

  if (!host || /\s/.test(host) || !host.includes(".")) {
    throw new SmtpError(
      `Invalid SMTP host "${host}". Use the server hostname (e.g. email-smtp.us-east-1.amazonaws.com), not a username.`,
      0,
      true,
    );
  }

  const socket = await connect({ host, port, secure, timeout, rejectUnauthorized: transport.reject_unauthorized });
  let session = createSession(socket, timeout);

  try {
    await session.read([2]);
    let hello = await session.send(`EHLO ${helo}`, [2]);
    let ext = parseExtensions(hello.text);

    if (secure === "starttls" && ext.some((l) => l.startsWith("STARTTLS"))) {
      await session.send("STARTTLS", [2]);
      const upgraded = await new Promise((resolve, reject) => {
        const s = tls.connect(
          {
            socket,
            servername: host,
            rejectUnauthorized: transport.reject_unauthorized !== false,
          },
          () => resolve(s),
        );
        s.once("error", reject);
      });
      session = createSession(upgraded, timeout);
      hello = await session.send(`EHLO ${helo}`, [2]);
      ext = parseExtensions(hello.text);
    }

    if (transport.username) {
      const authLine = ext.find((l) => l.startsWith("AUTH")) || "AUTH LOGIN PLAIN";
      const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
      if (authLine.includes("PLAIN")) {
        await session.send(`AUTH PLAIN ${b64(`\0${transport.username}\0${transport.password || ""}`)}`, [2]);
      } else {
        await session.send("AUTH LOGIN", [3]);
        await session.send(b64(transport.username), [3]);
        await session.send(b64(transport.password || ""), [2]);
      }
    }

    await session.send(`MAIL FROM:<${envelope.from}>`, [2]);
    for (const rcpt of envelope.to) {
      await session.send(`RCPT TO:<${rcpt}>`, [2]);
    }
    await session.send("DATA", [3]);
    // dot-stuffing
    const body = envelope.raw.replace(/\r?\n/g, CRLF).replace(/^\./gm, "..");
    session.write(body + CRLF + "." + CRLF);
    const result = await session.read([2]);
    try {
      await session.send("QUIT", [2]);
    } catch {
      /* server may drop the connection first */
    }
    return { code: result.code, response: result.text, host };
  } finally {
    socket.destroy();
  }
}

module.exports = { sendMail, SmtpError };
