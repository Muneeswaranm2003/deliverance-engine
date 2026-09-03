// Shared helpers for the self-hosted licensing system.

export const LICENSE_PREFIX = "LMTA";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

export function generateLicenseKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  const groups: string[] = [];
  for (let i = 0; i < 4; i++) groups.push(chars.slice(i * 4, i * 4 + 4).join(""));
  return `${LICENSE_PREFIX}-${groups.join("-")}`;
}

export function normalizeKey(key: string): string {
  return (key || "").trim().toUpperCase().replace(/\s+/g, "");
}

export async function hashKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeKey(key));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function keyParts(key: string) {
  const k = normalizeKey(key);
  return { prefix: k.slice(0, 9), last4: k.slice(-4) };
}

/** Domains that never consume a paid installation slot. */
export function isNonProductionDomain(domain: string): boolean {
  const d = (domain || "").trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  if (!d) return true;
  return (
    d === "localhost" ||
    d === "127.0.0.1" ||
    d === "::1" ||
    d.endsWith(".localhost") ||
    d.endsWith(".test") ||
    d.endsWith(".local") ||
    d.endsWith(".invalid") ||
    d.endsWith(".example") ||
    /^staging\./.test(d) ||
    /^dev\./.test(d) ||
    /^test\./.test(d)
  );

}

export function cleanDomain(domain: string): string {
  return (domain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];
}

/** Days an install may run offline before it must re-check in. */
export const GRACE_PERIOD_DAYS = 14;

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** HS256-signed activation token the install can verify offline. */
export async function signActivationToken(
  payload: Record<string, unknown>,
  secret: string,
  ttlDays = GRACE_PERIOD_DAYS,
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlDays * 86400 };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(sig)}`;
}

export function supportActive(supportExpiresAt: string | null): boolean {
  if (!supportExpiresAt) return false;
  return new Date(supportExpiresAt).getTime() > Date.now();
}
