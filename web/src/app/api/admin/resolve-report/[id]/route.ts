import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/auth';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Admin: resolve a content report (Phase 8 / Track E).
 *
 * POST `/api/admin/resolve-report/[id]?locale=en` with a
 * form-encoded body:
 *
 *   resolution  -- 'dismissed' | 'action_taken'   (required)
 *   action      -- 'delete_product' | 'suspend_seller'
 *                  | 'delete_comment' | 'delete_message'
 *                  | (omitted)                   (optional)
 *
 * Defense-in-depth: `requireAdminApi()` re-checks `is_admin`
 * even though the page that POSTs here was rendered behind the
 * admin-reports layout's gate. A compromised or stale page tab
 * (admin demoted between page-load and click) still gets
 * stopped here.
 *
 * The privileged write is delegated to the
 * `public.admin_resolve_report` RPC, called via the cookie-
 * authed server client (NOT the service-role admin client) so
 * `auth.uid()` inside the SECURITY DEFINER function resolves
 * to the admin's user ID for `resolved_by` provenance. The RPC
 * runs the `is_admin` check a THIRD time on the database side
 * -- a hostile request bypassing the route entirely (e.g.,
 * direct `supabase.rpc()` from a leaked anon key) still gets
 * rejected at the function body.
 *
 * Plain HTML form posts cannot follow JSON responses; we return
 * a 303 See Other redirect back to the reports queue so the
 * browser does a GET on the destination and the user lands on
 * the refreshed list. The `?error=` query param surfaces RPC
 * failures inline on the queue page.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const locale = url.searchParams.get('locale') || 'en';
  const queueUrl =
    locale === 'en' ? '/admin/reports' : `/${locale}/admin/reports`;

  let resolution: string | null = null;
  let action: string | null = null;
  try {
    const form = await req.formData();
    const r = form.get('resolution');
    const a = form.get('action');
    resolution = typeof r === 'string' ? r : null;
    action = typeof a === 'string' && a.length > 0 ? a : null;
  } catch {
    return NextResponse.redirect(
      new URL(`${queueUrl}?error=invalid_body`, req.url),
      303,
    );
  }

  if (resolution !== 'dismissed' && resolution !== 'action_taken') {
    return NextResponse.redirect(
      new URL(`${queueUrl}?error=invalid_resolution`, req.url),
      303,
    );
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.rpc('admin_resolve_report', {
    p_report_id: id,
    p_resolution: resolution,
    p_action: action,
  });

  if (error) {
    console.error(
      `[track-e] resolve-report rpc failed report=${id} admin=${auth.userId}: ${error.message}`,
    );
    const errCode = encodeURIComponent(error.message);
    return NextResponse.redirect(
      new URL(`${queueUrl}?error=${errCode}`, req.url),
      303,
    );
  }

  console.log(
    `[track-e] resolve-report ok report=${id} resolution=${resolution} action=${action ?? 'none'} admin=${auth.userId}`,
  );
  return NextResponse.redirect(new URL(queueUrl, req.url), 303);
}
