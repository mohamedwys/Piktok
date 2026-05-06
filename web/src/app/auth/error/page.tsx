/**
 * Generic auth-failure landing.
 *
 * Reached when the magic-link callback at /auth/callback can't
 * exchange the token (expired, already used, malformed). Kept
 * intentionally generic — we don't surface the raw Supabase error
 * to the visitor by default.
 *
 * Diagnostic mode: append `?debug=1` to the URL (the `reason` query
 * param is already there) to render the underlying error message.
 * Useful while debugging the upgrade auth bridge in production
 * without surfacing raw error text to ordinary users.
 */
export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; debug?: string }>;
}) {
  const { reason, debug } = await searchParams;
  const showReason =
    debug === '1' || process.env.NODE_ENV !== 'production';

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
        {showReason && reason ? (
          <pre className="text-left text-xs bg-surface border border-border rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all text-text-secondary">
            reason: {reason}
          </pre>
        ) : null}
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
