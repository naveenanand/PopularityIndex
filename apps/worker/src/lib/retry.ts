import pRetry from 'p-retry';

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; label?: string } = {},
): Promise<T> {
  return pRetry(fn, {
    retries: options.retries ?? 3,
    minTimeout: 1000,
    maxTimeout: 10000,
    factor: 2,
    onFailedAttempt: (error) => {
      const label = options.label ?? 'operation';
      console.warn(
        `  [retry] ${label} attempt ${error.attemptNumber} failed: ${error.message}. Retrying...`,
      );
    },
    shouldRetry: (error) => {
      // Don't retry on 404 (no data is valid) or 400 (bad request)
      const msg = error.message ?? '';
      if (msg.includes('HTTP 404') || msg.includes('HTTP 400')) return false;
      return true;
    },
  });
}
