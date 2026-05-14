// deno-lint-ignore-file
//
// Health check endpoint for synthetic uptime monitoring.
//
// - Anonymous (no JWT required) so Better Stack and other monitoring
//   services can hit it without auth setup.
// - Returns 200 + JSON with timestamp + commit ref (set via
//   SENTRY_RELEASE env, which gets bumped on each deploy).
// - Does NOT touch the database. A failing database should not cause
//   the health endpoint to fail — it would just shift monitor coverage
//   to "is the DB up" rather than "is the function runtime up".
// - Performance budget: < 100ms response time on the green path.

import { initEdgeSentry, captureEdgeException }
  from '../_shared/sentry.ts';

initEdgeSentry();

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',     // Monitoring services
                                            // ping from many origins;
                                            // health endpoint allows
                                            // them all by design.
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Cache-Control': 'no-store',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = JSON.stringify({
      ok: true,
      timestamp: new Date().toISOString(),
      release: Deno.env.get('SENTRY_RELEASE') ?? 'unknown',
      environment: Deno.env.get('APP_ENVIRONMENT') ?? 'production',
    });
    return new Response(body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    await captureEdgeException(err, { function: 'health' });
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});
