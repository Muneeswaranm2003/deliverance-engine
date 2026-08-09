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
