/**
 * Retry an async operation with exponential backoff.
 * Designed for transient network failures from Supabase calls.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelay?: number } = {}
): Promise<T> {
  const { retries = 2, baseDelay = 400 } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = (err as Error)?.message?.toLowerCase() ?? "";
      // Only retry on network-ish errors, not auth/validation/RLS
      const transient =
        msg.includes("network") ||
        msg.includes("fetch") ||
        msg.includes("timeout") ||
        msg.includes("temporar");
      if (!transient || attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}
