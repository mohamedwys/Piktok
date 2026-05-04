import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Auth callback — magic-link landing.
 *
 * The H.5 mobile flow:
 *   1. User taps "Upgrade to Pro" in the app.
 *   2. The `issue-web-session` Edge Function mints a Supabase
 *      magic-link with `redirectTo: WEB_BASE_URL + '/upgrade'`.
 *   3. Supabase Auth's email-style link points the browser at
 *      THIS handler with `?token_hash=...&type=magiclink&next=/upgrade`.
 *   4. We call `verifyOtp({ token_hash, type })`, which exchanges
 *      the single-use token for a session. `@supabase/ssr` writes
 *      the session cookie via the server-client adapter.
 *   5. We redirect to `next` (defaulted to `/upgrade`).
 *
 * Open-redirect discipline: `next` is whitelisted to relative
 * paths (`startsWith('/')` AND not `'//'` — the latter is the
 * scheme-relative trick that bounces off-domain). Mirrors the
 * H.5 Edge Function's `redirect_to` whitelist.
 *
 * Failure modes redirect to `/auth/error?reason=...` rather than
 * surface raw error text mid-flight. The error page is a friendly
 * static placeholder.
 */
const ALLOWED_OTP_TYPES = new Set<EmailOtpType>([
  'email',
  'magiclink',
  'recovery',
  'invite',
  'signup',
  'email_change',
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const rawType = url.searchParams.get('type');
  const next = url.searchParams.get('next') ?? '/upgrade';

  // Whitelist `next` to same-origin relative paths.
  const safeNext =
    next.startsWith('/') && !next.startsWith('//') ? next : '/upgrade';

  if (!tokenHash || !rawType) {
    return NextResponse.redirect(
      new URL('/auth/error?reason=missing_params', url.origin),
    );
  }

  // Validate `type` against the Supabase-supported OTP types so a
  // malformed link can't pass arbitrary strings into verifyOtp.
  if (!ALLOWED_OTP_TYPES.has(rawType as EmailOtpType)) {
    return NextResponse.redirect(
      new URL('/auth/error?reason=invalid_type', url.origin),
    );
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.verifyOtp({
    type: rawType as EmailOtpType,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/auth/error?reason=${encodeURIComponent(error.message)}`,
        url.origin,
      ),
    );
  }

  return NextResponse.redirect(new URL(safeNext, url.origin));
}
