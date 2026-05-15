import { NextResponse } from 'next/server';
import { requireProApi } from '@/lib/pro/auth';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Pro: mint a Stripe Connect onboarding URL (Track F.C.2).
 *
 * Server-side proxy to the F.C.1 `create-account-link` Supabase Edge
 * Function. The web client never calls the edge function directly —
 * routing through this handler keeps the locale-aware return URL
 * concern, the country allow-list, and any future Connect-specific
 * gating in one place.
 *
 * Resolution chain:
 *   1. requireProApi() — caller must be Pro. Anonymous and free
 *      callers are rejected with the standard discriminated-union
 *      response.
 *   2. Body validation — { country: string }, must be a 2-letter ISO
 *      from the F.C.1 allow-list. Defense in depth: the edge function
 *      validates the same list, but rejecting here saves a function
 *      invocation on bad input.
 *   3. Invoke the edge function via supabase.functions.invoke. The
 *      cookie-authed SSR client forwards the user's session JWT in
 *      the Authorization header automatically — the edge function
 *      uses that to verify the caller and resolve the seller row,
 *      so we MUST NOT pass the body's seller_id (no such field) and
 *      we MUST use this client (not the service-role admin client)
 *      to preserve the auth chain.
 *   4. Forward the { url } payload to the client. The client does a
 *      hard navigation to it.
 *
 * Errors:
 *   - 400 invalid_body / country_not_supported on validation failure.
 *   - 502 edge_function_error if the edge function returns non-2xx
 *     (the edge function's own error message is included for ops).
 *   - 500 generic on unknown failures.
 */
const ALLOWED_COUNTRIES = new Set([
  'FR',
  'BE',
  'CH',
  'LU',
  'MC',
  'GB',
  'IE',
  'DE',
  'NL',
  'IT',
  'ES',
  'PT',
  'US',
  'CA',
]);

type OnboardBody = { country: string };

function validateBody(raw: unknown): OnboardBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const country = obj.country;
  if (typeof country !== 'string' || country.length !== 2) return null;
  return { country: country.toUpperCase() };
}

export async function POST(req: Request) {
  const gate = await requireProApi();
  if (!gate.ok) return gate.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const body = validateBody(raw);
  if (!body) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!ALLOWED_COUNTRIES.has(body.country)) {
    return NextResponse.json(
      { error: 'country_not_supported' },
      { status: 400 },
    );
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.functions.invoke<{
    url: string;
    account_id: string;
  }>('create-account-link', {
    body: { country: body.country },
  });

  if (error) {
    console.error(
      `[pro/stripe/connect/onboard] edge fn error seller=${gate.sellerId}: ${error.message}`,
    );
    return NextResponse.json(
      { error: 'edge_function_error', details: error.message },
      { status: 502 },
    );
  }

  if (!data?.url) {
    console.error(
      `[pro/stripe/connect/onboard] edge fn returned no url seller=${gate.sellerId}`,
    );
    return NextResponse.json(
      { error: 'edge_function_error', details: 'missing_url' },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: data.url });
}
