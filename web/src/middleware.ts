import {
  createServerClient,
  type CookieOptions,
} from '@supabase/ssr';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';

/**
 * Composed middleware: next-intl locale routing + Supabase
 * session refresh.
 *
 * Two responsibilities, run in order:
 *
 *   1. **Locale routing (next-intl)** — inspects the URL +
 *      NEXT_LOCALE cookie + Accept-Language header to decide the
 *      active locale. For paths that need a redirect or rewrite
 *      (e.g., a fresh visitor with `Accept-Language: fr-FR`
 *      hitting `/foo` may be redirected to `/fr/foo` depending
 *      on routing config), it returns a redirect response. We
 *      use that response as the base for step 2 so the cookie
 *      writes from Supabase land on the same response object the
 *      user receives.
 *
 *   2. **Supabase session refresh** — touches `getUser()` to
 *      transparently rotate near-expiry access/refresh tokens.
 *      Mirrors the H.6 implementation byte-for-byte; only the
 *      composition with the locale middleware is new.
 *
 * Auth gating decisions stay at the page level
 * (`getSupabaseServer().auth.getUser() ? content : redirect('/')`)
 * — middleware is one-job-each per concern.
 *
 * The matcher (see `config` below) excludes:
 *   - /_next/* internals + static asset extensions (Next.js).
 *   - /api/* — API routes are technical endpoints, not
 *              user-facing localized content. The H.5 magic-link
 *              callback handler at /auth/callback is also
 *              excluded so it stays at the canonical
 *              non-locale-prefixed path.
 *   - /auth/error — same rationale; rare error page kept simple.
 */
const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  // 1. Run next-intl first. For locale-routing paths, this
  //    returns either a redirect/rewrite (e.g., adding /fr to
  //    the URL for a French-preferring visitor) or a plain
  //    NextResponse.next() that carries the resolved locale on
  //    request headers for downstream consumers.
  let response = intlMiddleware(request);

  // 2. Compose with Supabase session refresh. Reuse the response
  //    object from step 1 so cookie writes land on whatever
  //    response the user ultimately receives — including
  //    redirects.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          // Re-create the response so it picks up the rotated
          // request cookies from the lines above. Carry over the
          // original response's headers (which include
          // next-intl's locale-resolution headers like
          // x-middleware-rewrite / x-next-intl-locale).
          const refreshed = NextResponse.next({ request });
          response.headers.forEach((value, key) => {
            refreshed.headers.set(key, value);
          });
          response = refreshed;
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Touch the user — the side effect is the cookie refresh.
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
     * - /api/*           (technical endpoints — no locale prefix)
     * - /auth/callback   (H.5 magic-link landing — stays at root)
     * - /auth/error      (rare error page, English-only)
     */
    '/((?!_next/static|_next/image|favicon.ico|api|auth/callback|auth/error|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
