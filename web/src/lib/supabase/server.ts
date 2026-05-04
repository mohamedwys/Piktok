import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client for use in Server Components, Route
 * Handlers, and Server Actions.
 *
 * Sessions are stored in HTTP-only cookies. The `getAll` / `setAll`
 * adapters bridge `@supabase/ssr`'s cookie API to Next.js's
 * `cookies()` helper from `next/headers`. The try/catch around
 * `setAll` is the canonical Next.js + Supabase pattern: setting
 * cookies from a Server Component throws (only Route Handlers and
 * Server Actions may set cookies), but the same client is used in
 * both contexts. The middleware in `src/middleware.ts` is what
 * actually refreshes the session cookie on every request, so the
 * thrown set in a Server Component is benign.
 *
 * Always prefer `supabase.auth.getUser()` over `getSession()` on
 * the server — `getUser()` revalidates the JWT against Supabase
 * Auth (cryptographic check), while `getSession()` only reads from
 * cookies (tamperable). Auth-gated pages MUST use `getUser()`.
 */
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component context — setting cookies isn't
            // allowed. The middleware refreshes the session
            // cookie ahead of every request, so this is a no-op
            // in the read-only path.
          }
        },
      },
    },
  );
}
