import { requireProApi } from '@/lib/pro/auth';
import { getSupabaseServer } from '@/lib/supabase/server';
import {
  fetchSellerOrders,
  filterOrdersByQuery,
  type SellerOrderRow,
  type SellerOrderStatus,
} from '@/lib/pro/data';

/**
 * Pro orders CSV export (Track 4).
 *
 * GET handler, Pro-gated. Accepts the same filter params as the list page
 * (`status`, `from`, `to`, `q`) so the downloaded file mirrors whatever
 * the seller has on screen.
 *
 * CSV format follows RFC 4180:
 *   - CRLF line endings.
 *   - Fields containing comma, double-quote, CR or LF are wrapped in
 *     double quotes; inner double quotes are doubled.
 *   - UTF-8 (no BOM).
 *
 * Filename: orders-YYYY-MM-DD.csv where the date is "today" in UTC.
 * Streaming would be overkill here — Pro sellers' order pages stay in
 * the low-thousands range and the response is built in memory before
 * being handed to `Response`.
 *
 * Product title is exported in FR per spec (the marketplace's primary
 * authoring locale). Empty FR titles fall back to '' (not the EN title)
 * so the CSV is deterministic and doesn't surprise admins reconciling
 * exports against the French authoring view.
 */
export const dynamic = 'force-dynamic';

const STATUS_VALUES = new Set<SellerOrderStatus>([
  'paid',
  'pending',
  'refunded',
  'failed',
  'cancelled',
]);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeStatus(
  raw: string | null,
): SellerOrderStatus | undefined {
  if (raw && STATUS_VALUES.has(raw as SellerOrderStatus)) {
    return raw as SellerOrderStatus;
  }
  return undefined;
}

function normalizeDate(raw: string | null): string | undefined {
  return raw && ISO_DATE_RE.test(raw) ? raw : undefined;
}

function escapeField(value: string | number | null | undefined): string {
  const str = value == null ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(rows: SellerOrderRow[]): string {
  const header = [
    'order_id',
    'created_at',
    'product_title',
    'price',
    'currency',
    'status',
    'buyer_name',
    'buyer_phone',
    'shipping_line1',
    'shipping_city',
    'shipping_postal_code',
    'shipping_country',
  ].join(',');

  const lines = rows.map((row) => {
    const shipping = row.shippingAddress;
    return [
      escapeField(row.id),
      escapeField(row.createdAt),
      escapeField(row.productTitle?.fr ?? ''),
      escapeField(row.amount),
      escapeField(row.currency),
      escapeField(row.status),
      escapeField(row.buyerName),
      escapeField(row.buyerPhone),
      escapeField(shipping?.line1),
      escapeField(shipping?.city),
      escapeField(shipping?.postal_code),
      escapeField(shipping?.country),
    ].join(',');
  });

  return [header, ...lines].join('\r\n');
}

function todayUtcIsoDate(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET(req: Request) {
  const gate = await requireProApi();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const status = normalizeStatus(url.searchParams.get('status'));
  const from = normalizeDate(url.searchParams.get('from'));
  const to = normalizeDate(url.searchParams.get('to'));
  const q = (url.searchParams.get('q') ?? '').trim();

  const supabase = await getSupabaseServer();
  const allRows = await fetchSellerOrders(supabase, gate.sellerId, {
    status,
    from,
    to,
  });
  const filtered = filterOrdersByQuery(allRows, q);

  const csv = buildCsv(filtered);
  const filename = `orders-${todayUtcIsoDate()}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
