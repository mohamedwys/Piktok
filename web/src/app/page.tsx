/**
 * Public landing — H.6 placeholder.
 *
 * Kept deliberately minimal. The real landing (hero, pricing,
 * feature grid, FAQ) is H.7's scope. For H.6 we just need a
 * non-404 response at `/` so Vercel's deploy is recognizably
 * "Mony" and so the auth-error page's "Back to home" link
 * resolves to something coherent.
 */
export default function LandingPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="max-w-2xl w-full text-center space-y-6">
        <h1 className="font-display text-hero font-semibold text-text-primary">
          Mony
        </h1>
        <p className="text-text-secondary text-xl">Coming soon.</p>
      </div>
    </main>
  );
}
