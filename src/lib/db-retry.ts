const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRetryable =
        error?.code === "ECONNREFUSED" ||
        error?.code === "ETIMEDOUT" ||
        error?.code === "57P01" || // admin_shutdown (db waking up)
        error?.code === "57P03" || // cannot_connect_now
        error?.code === "08000" || // connection_exception
        error?.code === "08006" || // connection_failure
        error?.message?.includes("Connection terminated") ||
        error?.message?.includes("connection refused") ||
        error?.message?.includes("timeout");

      if (!isRetryable || attempt === MAX_RETRIES - 1) throw error;
      await new Promise((r) =>
        setTimeout(r, INITIAL_DELAY_MS * Math.pow(2, attempt)),
      );
    }
  }
  throw lastError;
}

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, {
    ...init,
    headers: {
      ...NO_CACHE_HEADERS,
      ...init?.headers,
    },
  });
}

export function errorResponse(
  message: string,
  status: number,
): Response {
  return jsonResponse({ error: message }, { status });
}
