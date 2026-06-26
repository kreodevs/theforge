/** Minimal Express-like response for SSE (avoids importing express types). */
export interface SseWritable {
  write(chunk: string, encoding?: unknown): void;
  flushHeaders?(): void;
  flush?(): void;
}

const DEFAULT_HEARTBEAT_MS = 15_000;

function flushSse(res: SseWritable): void {
  if (typeof res.flush === "function") {
    res.flush();
  }
}

/**
 * Consumes an async generator of SSE events and emits comment keepalives while waiting.
 * Prevents nginx/Traefik/QUIC idle timeouts on long LLM streams with no tokens yet.
 */
export async function writeSseFromAsyncGenerator(
  res: SseWritable,
  stream: AsyncGenerator<{ event: string; data: unknown }>,
  heartbeatMs = DEFAULT_HEARTBEAT_MS,
): Promise<void> {
  const iter = stream[Symbol.asyncIterator]();
  let closed = false;

  const heartbeat = setInterval(() => {
    if (closed) return;
    try {
      res.write(`: keepalive ${Date.now()}\n\n`);
      flushSse(res);
    } catch {
      closed = true;
    }
  }, heartbeatMs);

  try {
    while (true) {
      const { done, value } = await iter.next();
      if (done) break;
      const data = JSON.stringify(value.data);
      res.write(`event: ${value.event}\ndata: ${data}\n\n`);
      flushSse(res);
    }
  } finally {
    closed = true;
    clearInterval(heartbeat);
  }
}
