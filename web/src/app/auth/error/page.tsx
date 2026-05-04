/**
 * Generic auth-failure landing.
 *
 * Reached when the magic-link callback at /auth/callback can't
 * exchange the token (expired, already used, malformed). Kept
 * intentionally generic — we don't surface the raw Supabase error
 * to the visitor. Most failure modes have the same correct
 * recovery: request a fresh link from the mobile app.
 *
 * The `reason` query param is captured for future telemetry; for
 * v1 it's not displayed.
 */
export default async function AuthErrorPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="font-display text-xxxl font-semibold text-text-primary">
          Authentication failed
        </h1>
        <p className="text-text-secondary">
          The link may have expired or already been used. Please request
          a new one from the app.
        </p>
        <a
          href="/"
          className="inline-block text-brand underline underline-offset-4"
        >
          Back to home
        </a>
      </div>
    </main>
  );
}
