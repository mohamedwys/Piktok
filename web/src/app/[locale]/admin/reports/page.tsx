import { setRequestLocale } from 'next-intl/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Admin reports queue (Phase 8 / Track E).
 *
 * Server Component. Lists open `content_reports` (where
 * `resolved_at IS NULL`), newest first, with the target row
 * pre-joined so the admin can read the report in one screen
 * without bouncing into other tables.
 *
 * Auth is enforced by the parent layout
 * (`[locale]/admin/reports/layout.tsx`) -- no `requireAdmin()`
 * call here. Service-role client is used for the cross-user
 * reads (RLS on `content_reports` only allows reporters to
 * `SELECT` their own rows; admin triage needs the full queue).
 *
 * Target fetching is BATCHED by `target_type` rather than per
 * report row. Each `target_type` becomes at most one `WHERE id
 * IN (...)` query. That collapses the N+1 to four queries (one
 * per target type that has at least one open report), all run
 * in parallel via `Promise.all`. Reporter sellers are fetched
 * the same way against `sellers.user_id`.
 *
 * Forms POST plain HTML to `/api/admin/resolve-report/[id]`
 * (the route handler does the RPC call + redirects back here).
 * No client JS in the row -- the conditional "Action taken"
 * options are computed server-side from `target_type` so the
 * dropdown only shows the action that matches.
 *
 * `force-dynamic` because auth, cookies, and live queue data
 * make caching unsafe.
 */
export const dynamic = 'force-dynamic';

type ContentReportRow = {
  id: string;
  reporter_id: string | null;
  target_type: 'product' | 'comment' | 'message' | 'seller';
  target_id: string;
  reason: string;
  notes: string | null;
  created_at: string;
};

type ProductTarget = {
  id: string;
  title: Record<string, string> | null;
  media_url: string | null;
  thumbnail_url: string | null;
  seller_id: string | null;
};
type CommentTarget = {
  id: string;
  body: string;
  author_id: string | null;
};
type MessageTarget = {
  id: string;
  body: string;
  sender_id: string | null;
};
type SellerTarget = {
  id: string;
  name: string | null;
  avatar_url: string | null;
};
type ReporterRow = {
  id: string;
  user_id: string | null;
  name: string | null;
  avatar_url: string | null;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function productTitle(row: ProductTarget | undefined): string {
  if (!row) return '(deleted)';
  const title = row.title;
  if (!title) return '(untitled)';
  return title.en ?? title.fr ?? title.ar ?? '(untitled)';
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

const ACTION_FOR_TARGET: Record<
  ContentReportRow['target_type'],
  { value: string; label: string }
> = {
  product: { value: 'delete_product', label: 'Delete product' },
  comment: { value: 'delete_comment', label: 'Delete comment' },
  message: { value: 'delete_message', label: 'Delete message' },
  seller: { value: 'suspend_seller', label: 'Suspend seller' },
};

export default async function AdminReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error: errorParam } = await searchParams;
  setRequestLocale(locale);

  const admin = getSupabaseAdmin();

  const { data: reportsRaw, error: reportsErr } = await admin
    .from('content_reports')
    .select(
      'id, reporter_id, target_type, target_id, reason, notes, created_at',
    )
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (reportsErr) {
    console.error('[track-e] reports list query failed:', reportsErr.message);
  }
  const reports = (reportsRaw ?? []) as ContentReportRow[];

  // Bucket target IDs by type so we can issue one batched query per
  // target table instead of per-row lookups.
  const productIds: string[] = [];
  const commentIds: string[] = [];
  const messageIds: string[] = [];
  const sellerIds: string[] = [];
  const reporterUserIds = new Set<string>();
  for (const r of reports) {
    if (r.target_type === 'product') productIds.push(r.target_id);
    else if (r.target_type === 'comment') commentIds.push(r.target_id);
    else if (r.target_type === 'message') messageIds.push(r.target_id);
    else if (r.target_type === 'seller') sellerIds.push(r.target_id);
    if (r.reporter_id) reporterUserIds.add(r.reporter_id);
  }

  const [productsRes, commentsRes, messagesRes, sellersRes, reportersRes] =
    await Promise.all([
      productIds.length
        ? admin
            .from('products')
            .select('id, title, media_url, thumbnail_url, seller_id')
            .in('id', productIds)
        : Promise.resolve({ data: [] as ProductTarget[] }),
      commentIds.length
        ? admin
            .from('comments')
            .select('id, body, author_id')
            .in('id', commentIds)
        : Promise.resolve({ data: [] as CommentTarget[] }),
      messageIds.length
        ? admin
            .from('messages')
            .select('id, body, sender_id')
            .in('id', messageIds)
        : Promise.resolve({ data: [] as MessageTarget[] }),
      sellerIds.length
        ? admin.from('sellers').select('id, name, avatar_url').in('id', sellerIds)
        : Promise.resolve({ data: [] as SellerTarget[] }),
      reporterUserIds.size
        ? admin
            .from('sellers')
            .select('id, user_id, name, avatar_url')
            .in('user_id', Array.from(reporterUserIds))
        : Promise.resolve({ data: [] as ReporterRow[] }),
    ]);

  const productMap = new Map<string, ProductTarget>(
    ((productsRes.data ?? []) as ProductTarget[]).map((p) => [p.id, p]),
  );
  const commentMap = new Map<string, CommentTarget>(
    ((commentsRes.data ?? []) as CommentTarget[]).map((c) => [c.id, c]),
  );
  const messageMap = new Map<string, MessageTarget>(
    ((messagesRes.data ?? []) as MessageTarget[]).map((m) => [m.id, m]),
  );
  const sellerMap = new Map<string, SellerTarget>(
    ((sellersRes.data ?? []) as SellerTarget[]).map((s) => [s.id, s]),
  );
  const reporterMap = new Map<string, ReporterRow>();
  for (const row of (reportersRes.data ?? []) as ReporterRow[]) {
    if (row.user_id) reporterMap.set(row.user_id, row);
  }

  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">
            Open reports
          </h2>
          <p className="text-sm text-text-secondary">
            {reports.length === 0
              ? 'Queue is clear.'
              : `${reports.length} pending`}
          </p>
        </div>
      </header>

      {errorParam ? (
        <div
          role="alert"
          className="mb-6 rounded-lg bg-feedback-danger/10 px-4 py-3 text-sm text-feedback-danger"
        >
          Action failed: {errorParam}
        </div>
      ) : null}

      {reports.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-elevated p-12 text-center text-text-secondary">
          No open reports.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface-elevated">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary">
              <tr>
                <th className="px-4 py-3 font-medium">Reported</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const reporter = report.reporter_id
                  ? reporterMap.get(report.reporter_id) ?? null
                  : null;

                let targetCell: React.ReactNode = '(unknown)';
                if (report.target_type === 'product') {
                  const p = productMap.get(report.target_id);
                  targetCell = (
                    <div className="flex items-center gap-2">
                      {p?.thumbnail_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={p.thumbnail_url}
                          alt=""
                          className="size-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="size-10 rounded-md bg-surface" />
                      )}
                      <div>
                        <div className="font-medium">
                          Product: {productTitle(p)}
                        </div>
                        <div className="font-mono text-xs text-text-tertiary">
                          {report.target_id.slice(0, 8)}…
                        </div>
                      </div>
                    </div>
                  );
                } else if (report.target_type === 'comment') {
                  const c = commentMap.get(report.target_id);
                  targetCell = (
                    <div>
                      <div className="font-medium">Comment</div>
                      <div className="text-text-secondary">
                        {c ? `"${truncate(c.body, 80)}"` : '(deleted)'}
                      </div>
                    </div>
                  );
                } else if (report.target_type === 'message') {
                  const m = messageMap.get(report.target_id);
                  targetCell = (
                    <div>
                      <div className="font-medium">Message</div>
                      <div className="text-text-secondary">
                        {m ? `"${truncate(m.body, 80)}"` : '(deleted)'}
                      </div>
                    </div>
                  );
                } else if (report.target_type === 'seller') {
                  const s = sellerMap.get(report.target_id);
                  targetCell = (
                    <div className="flex items-center gap-2">
                      {s?.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={s.avatar_url}
                          alt=""
                          className="size-10 rounded-pill object-cover"
                        />
                      ) : (
                        <div className="size-10 rounded-pill bg-surface" />
                      )}
                      <div>
                        <div className="font-medium">
                          Seller: {s?.name ?? '(deleted)'}
                        </div>
                        <div className="font-mono text-xs text-text-tertiary">
                          {report.target_id.slice(0, 8)}…
                        </div>
                      </div>
                    </div>
                  );
                }

                const action = ACTION_FOR_TARGET[report.target_type];
                const formAction = `/api/admin/resolve-report/${report.id}?locale=${locale}`;

                return (
                  <tr
                    key={report.id}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        {reporter?.avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={reporter.avatar_url}
                            alt=""
                            className="size-8 rounded-pill object-cover"
                          />
                        ) : (
                          <div className="size-8 rounded-pill bg-surface" />
                        )}
                        <span className="text-text-secondary">
                          {reporter?.name ?? '(unknown)'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">{targetCell}</td>
                    <td className="px-4 py-3 align-top">
                      <span className="rounded-pill bg-surface px-2 py-1 text-xs font-medium">
                        {report.reason}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-text-secondary">
                      {report.notes ? truncate(report.notes, 120) : '—'}
                    </td>
                    <td className="px-4 py-3 align-top text-text-tertiary">
                      {formatDate(report.created_at)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-2">
                        <form action={formAction} method="post">
                          <input
                            type="hidden"
                            name="resolution"
                            value="dismissed"
                          />
                          <button
                            type="submit"
                            className="w-full rounded-pill border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface"
                          >
                            Dismiss
                          </button>
                        </form>
                        <form action={formAction} method="post">
                          <input
                            type="hidden"
                            name="resolution"
                            value="action_taken"
                          />
                          <input
                            type="hidden"
                            name="action"
                            value={action.value}
                          />
                          <button
                            type="submit"
                            className="w-full rounded-pill bg-feedback-danger px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                          >
                            {action.label}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
