import { setRequestLocale } from 'next-intl/server';

/**
 * Admin forbidden landing.
 *
 * Where the admin-reports auth gate
 * (`[locale]/admin/reports/layout.tsx`) bounces unauthenticated
 * or non-admin visitors. Lives outside the `/admin/reports`
 * subtree on purpose -- the layout's gate would otherwise loop
 * non-admins back to itself.
 *
 * EN-only copy in v1 (matches the reports surface). Static page
 * so it can be prerendered.
 */
export const dynamic = 'force-static';

export default async function AdminForbiddenPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-text-primary">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="font-display text-3xl font-semibold">
          Access denied
        </h1>
        <p className="text-text-secondary">
          You do not have admin access. If you believe this is an error,
          contact support.
        </p>
      </div>
    </main>
  );
}
