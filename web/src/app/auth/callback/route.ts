import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Auth callback — magic-link landing.
 *
 * Two inbound link formats are supported because Supabase issues
 * different shapes depending on how the link was generated:
 *
 *   A. PKCE flow (browser-initiated `signInWithOtp` from
 *      `@supabase/ssr`'s browser client). Arrives as:
 *        /auth/callback?code=<...>&next=<path>
 *      Exchange via `exchangeCodeForSession(code)`.
 *
 *   B. OTP flow (server-initiated `auth.admin.generateLink` in the
 *      `issue-web-session` Edge Function — the mobile bridge).
 *      Arrives as:
 *        /auth/callback?token_hash=<...>&type=magiclink&next=<path>
 *      Exchange via `verifyOtp({ token_hash, type })`.
 *
 * Both paths land in the SAME handler and produce the same outcome:
 * a session cookie set via `@supabase/ssr`'s server-client adapter,
 * followed by a redirect to `next`.
 *
 * Open-redirect discipline: `next` is whitelisted to relative paths
 * (`startsWith('/')` AND not `'//'` — the scheme-relative trick that
 * bounces off-domain).
 *
 * Failure modes redirect to `/auth/error?reason=...` rather than
 * surface raw error text mid-flight.
 */
export const dynamic = 'force-dynamic';

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
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const rawType = url.searchParams.get('type');
  const next = url.searchParams.get('next') ?? '/upgrade';

  // Whitelist `next` to same-origin relative paths.
  const safeNext =
    next.startsWith('/') && !next.startsWith('//') ? next : '/upgrade';

  const supabase = await getSupabaseServer();

  // --- Path A: PKCE code-exchange (browser /sign-in flow) ---
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('[auth/callback] exchangeCodeForSession failed:', error.message);
      return NextResponse.redirect(
        new URL(
          `/auth/error?reason=${encodeURIComponent(error.message)}`,
          url.origin,
        ),
      );
    }
    return NextResponse.redirect(new URL(safeNext, url.origin));
  }

  // --- Path B: OTP token_hash (mobile bridge / admin.generateLink) ---
  if (tokenHash && rawType) {
    if (!ALLOWED_OTP_TYPES.has(rawType as EmailOtpType)) {
      return NextResponse.redirect(
        new URL('/auth/error?reason=invalid_type', url.origin),
      );
    }

    const { error } = await supabase.auth.verifyOtp({
      type: rawType as EmailOtpType,
      token_hash: tokenHash,
    });

    if (error) {
      console.error('[auth/callback] verifyOtp failed:', error.message);
      return NextResponse.redirect(
        new URL(
          `/auth/error?reason=${encodeURIComponent(error.message)}`,
          url.origin,
        ),
      );
    }

    return NextResponse.redirect(new URL(safeNext, url.origin));
  }

  // Neither shape — link is malformed.
  console.error('[auth/callback] missing both code and token_hash params:', url.search);
  return NextResponse.redirect(
    new URL('/auth/error?reason=missing_params', url.origin),
  );
}
