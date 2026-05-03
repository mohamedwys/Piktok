const MIN_INTERVAL_MS = 1100;

let lastStartedAt = 0;
let chain: Promise<unknown> = Promise.resolve();

export function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastStartedAt));
    if (wait > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, wait));
    }
    lastStartedAt = Date.now();
    return fn();
  });

  chain = next.catch(() => undefined);
  return next;
}
