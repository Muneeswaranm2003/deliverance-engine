import { format } from "date-fns";

/** Parse an unknown timestamp value into a valid Date, or null. */
export const toValidDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  const d =
    value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Format a timestamp safely; returns `fallback` when the value is invalid/missing. */
export const safeFormat = (
  value: unknown,
  pattern: string,
  fallback = "—",
): string => {
  const d = toValidDate(value);
  return d ? format(d, pattern) : fallback;
};

/** ISO string for a valid timestamp, otherwise null (safe for DB writes). */
export const safeIso = (value: unknown): string | null =>
  toValidDate(value)?.toISOString() ?? null;

/**
 * Combine a picked date + "HH:mm" time into an ISO timestamp.
 * Returns null when either part is missing or invalid.
 */
export const buildScheduledAt = (
  date: Date | null | undefined,
  time: string | null | undefined,
): string | null => {
  const base = toValidDate(date);
  if (!base) return null;
  const t = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? "");
  if (!t) return null;
  const combined = new Date(base);
  combined.setHours(Number(t[1]), Number(t[2]), 0, 0);
  return Number.isNaN(combined.getTime()) ? null : combined.toISOString();
};
