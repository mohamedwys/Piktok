import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Dashboard — H.6 placeholder.
 *
 * Auth-gated symmetrically with /upgrade. Real subscription
 * management UI (current plan, renewal date, cancel-state, link
 * to Stripe Customer Portal) lands in H.10. For H.6 we show the
 * authenticated user's email — same pattern as /upgrade — so the
 * placeholder confirms the auth flow without committing to a UI.
 */
export default async function DashboardPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/');

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="max-w-md w-full space-y-6 bg-surface-elevated rounded-xl p-8 border border-border">
        <h1 className="font-display text-xxxl font-semibold text-text-primary">
          Dashboard
        </h1>
        <p className="text-text-secondary">
          Hi, {user.email}. Subscription management is shipping soon.
        </p>
      </div>
    </main>
  );
}
