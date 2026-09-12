const TRANSIENT_DATABASE_ERROR = /gateway timeout|bad gateway|service unavailable|fetch failed|econnreset|etimedout|\b50[234]\b/i;

export function isTransientDatabaseError(error: unknown): boolean {
  return TRANSIENT_DATABASE_ERROR.test(error instanceof Error ? error.message : String(error));
}

/** Retry only operations whose database contract is explicitly idempotent. */
export async function retryIdempotentDatabase<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; delayMs?: number; onRetry?: (attempt: number) => void } = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 150;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isTransientDatabaseError(error)) throw error;
      options.onRetry?.(attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw lastError;
}
