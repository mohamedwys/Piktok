import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Session-refresh middleware.
 *
 * Every Supabase + Next.js SSR setup needs this. The client's
 * access token is short-lived (1 hour by default); without
 * proactive refresh, a long-idle session would silently expire
 * mid-request. Calling `supabase.auth.getUser()` inside the
 * middleware does two things at once:
 *
 *   1. Touches Supabase Auth, which transparently refreshes the
 *      access + refresh tokens if they're near expiry. The
 *      `setAll` adapter writes the rotated cookies to BOTH the
 *      incoming request (so downstream Server Components see the
 *      new values via `cookies().get(...)`) AND the outgoing
 *      response (so the browser persists them).
 *   2. Validates the JWT cryptographically. If the token's been
 *      tampered or revoked, the user shows up as null in
 *      downstream `getUser()` calls — the auth-gate behavior is
 *      consistent.
 *
 * The matcher excludes static assets and Next.js internals.
 * Everything else — pages, route handlers, server actions — gets
 * a session-refresh attempt. The middleware does NOT redirect
 * unauth'd traffic anywhere; auth-gating decisions stay in the
 * page-level `getUser() ? content : redirect('/')` pattern so
 * the middleware can stay one-job (refresh) and not entangle
 * with route-specific auth requirements.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Touch the user — the side effect is the cookie refresh.
  // The returned value is intentionally unused here; auth gates
  // happen at the page level via `getSupabaseServer().auth.getUser()`.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every request EXCEPT:
     * - /_next/static    (Next.js static files)
     * - /_next/image     (Next.js image optimizer)
     * - /favicon.ico     (browser-default fetch)
     * - any image asset  (svg / png / jpg / etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
