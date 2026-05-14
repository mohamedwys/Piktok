// deno-lint-ignore-file
//
// Minimal Sentry client for Deno Edge Functions. Posts an event
// envelope to Sentry's store endpoint via fetch. No external dependency.
//
// Why custom: @sentry/deno exists but adds 200KB+ to the function bundle
// and pulls in a chain of esm.sh deps. For error-only capture (no
// performance, no breadcrumbs, no transactions), a 30-line fetch wrapper
// does the job.

type SentryConfig = {
  dsn: string;
  environment: string;
  release: string;
};

function parseDsn(dsn: string): { url: string; publicKey: string; projectId: string } {
  // Sentry DSN shape: https://<publicKey>@<host>/<projectId>
  const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
  if (!m) throw new Error('Invalid Sentry DSN');
  const [, publicKey, host, projectId] = m;
  return {
    url: `https://${host}/api/${projectId}/store/`,
    publicKey,
    projectId,
  };
}

let config: { dsn: ReturnType<typeof parseDsn>; environment: string; release: string } | null = null;

export function initEdgeSentry(): void {
  const dsn = Deno.env.get('SENTRY_DSN');
  if (!dsn) return;   // Silent — env not set.
  try {
    config = {
      dsn: parseDsn(dsn),
      environment: Deno.env.get('APP_ENVIRONMENT') ?? 'production',
      release: Deno.env.get('SENTRY_RELEASE') ?? 'edge@unknown',
    };
  } catch (err) {
    console.error('initEdgeSentry: invalid DSN', err);
  }
}

export async function captureEdgeException(
  error: unknown,
  extra: Record<string, unknown> = {},
): Promise<void> {
  if (!config) return;
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    const event = {
      event_id: crypto.randomUUID().replace(/-/g, ''),
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      level: 'error',
      environment: config.environment,
      release: config.release,
      exception: {
        values: [{
          type: e.name,
          value: e.message,
          stacktrace: e.stack ? {
            frames: parseStack(e.stack),
          } : undefined,
        }],
      },
      extra,
      tags: {
        runtime: 'deno-edge',
        ...((extra.tags as Record<string, string> | undefined) ?? {}),
      },
    };
    const auth = [
      'Sentry sentry_version=7',
      `sentry_key=${config.dsn.publicKey}`,
      'sentry_client=mony-edge/1.0',
    ].join(', ');
    await fetch(config.dsn.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': auth,
      },
      body: JSON.stringify(event),
    });
  } catch (sendErr) {
    // Best effort. Don't let Sentry failures bubble up and break the
    // edge function's actual response.
    console.error('captureEdgeException: send failed', sendErr);
  }
}

function parseStack(stack: string): Array<{ filename: string; function: string; lineno: number; colno: number }> {
  return stack.split('\n').slice(1).map((line) => {
    const m = line.trim().match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/)
      ?? line.trim().match(/at\s+(.+?):(\d+):(\d+)/);
    if (!m) return { filename: 'unknown', function: '<anonymous>', lineno: 0, colno: 0 };
    if (m.length === 5) {
      return {
        function: m[1],
        filename: m[2],
        lineno: Number(m[3]),
        colno: Number(m[4]),
      };
    }
    return {
      function: '<anonymous>',
      filename: m[1],
      lineno: Number(m[2]),
      colno: Number(m[3]),
    };
  }).reverse(); // Sentry expects oldest-first.
}
