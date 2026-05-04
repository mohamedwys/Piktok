import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Upgrade — H.6 placeholder.
 *
 * Auth-gated. Unauthenticated visitors are redirected to `/`
 * rather than shown a sign-in form — sign-in for the web side
 * happens via the magic-link bounce from the mobile app
 * (issue-web-session → /auth/callback). Direct sign-in on web
 * lands in H.7+ if/when the marketing site needs to gate access
 * standalone.
 *
 * `getUser()` (not `getSession()`) is the correct gate —
 * `getUser()` revalidates the JWT against Supabase Auth, while
 * `getSession()` only reads from cookies which a determined user
 * can tamper. Auth-gated pages MUST use `getUser()`.
 *
 * The real Stripe Checkout integration lands in H.7 (or a
 * dedicated H.7+ Pro Checkout step). For H.6 we render the
 * authenticated user's email + a "shipping soon" message — this
 * confirms the magic-link auth-bridge is end-to-end working.
 */
export default async function UpgradePage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/');

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="max-w-md w-full space-y-6 bg-surface-elevated rounded-xl p-8 border border-border">
        <h1 className="font-display text-xxxl font-semibold text-text-primary">
          Become Pro
        </h1>
        <p className="text-text-secondary">
          Welcome, {user.email}. Stripe Checkout integration is
          shipping soon.
        </p>
        <a
          href="/dashboard"
          className="inline-block text-brand underline underline-offset-4"
        >
          Go to dashboard →
        </a>
      </div>
    </main>
  );
}
