import { supabase } from '@/lib/supabase';

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export type OrderShippingAddress = {
  name: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  postal_code: string | null;
  state: string | null;
  country: string | null;
};

export type Order = {
  id: string;
  productId: string;
  productTitle: { fr: string; en: string } | null;
  productThumbnail: string | null;
  amount: number;
  currency: 'EUR' | 'USD' | 'GBP';
  status: OrderStatus;
  createdAt: string;
  /**
   * Phase 8 / Track B: populated only on buy_now orders. Shape matches
   * the jsonb projected by supabase/functions/stripe-webhook on
   * checkout.session.completed (see 20260713_order_shipping.sql).
   * Buyer-side listMyOrders does not select these fields, so they are
   * always null in that view; seller-side listMySales selects them.
   */
  shippingAddress: OrderShippingAddress | null;
  buyerPhone: string | null;
  buyerName: string | null;
};

type OrderRow = {
  id: string;
  product_id: string;
  amount: number;
  currency: 'EUR' | 'USD' | 'GBP';
  status: OrderStatus;
  created_at: string;
  shipping_address?: OrderShippingAddress | null;
  buyer_phone?: string | null;
  buyer_name?: string | null;
  product?: {
    title: { fr: string; en: string };
    media_url: string;
    thumbnail_url: string | null;
  };
};

function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    productId: row.product_id,
    productTitle: row.product?.title ?? null,
    productThumbnail: row.product?.thumbnail_url ?? row.product?.media_url ?? null,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
    shippingAddress: row.shipping_address ?? null,
    buyerPhone: row.buyer_phone ?? null,
    buyerName: row.buyer_name ?? null,
  };
}

export class StripeNotConfiguredError extends Error {
  constructor() {
    super('Stripe checkout function is not deployed yet.');
    this.name = 'StripeNotConfiguredError';
  }
}

export async function createCheckoutSession(productId: string): Promise<{
  url: string;
  sessionId: string;
  orderId: string;
}> {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { product_id: productId },
  });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 404 || (error.message ?? '').toLowerCase().includes('not found')) {
      throw new StripeNotConfiguredError();
    }
    throw error;
  }
  const payload = data as { url?: string; session_id?: string; order_id?: string };
  if (!payload?.url) throw new Error('Invalid checkout response');
  return {
    url: payload.url,
    sessionId: payload.session_id ?? '',
    orderId: payload.order_id ?? '',
  };
}

export async function listMyOrders(): Promise<Order[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('id, product_id, amount, currency, status, created_at, product:products(title, media_url, thumbnail_url)')
    .eq('buyer_id', u.user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as OrderRow[]).map(rowToOrder);
}

/**
 * Phase 8 / Track B: seller-side counterpart to listMyOrders. Returns
 * the orders where the current authenticated user is the seller, with
 * shipping address + buyer contact details surfaced for fulfilment.
 *
 * RLS posture: the "orders select seller" policy from 20260510_orders.sql
 * already allows seller_id-in-my-sellers reads, so this query needs no
 * service role.
 */
export async function listMySales(): Promise<Order[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data: sellerRow } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', u.user.id)
    .maybeSingle();
  if (!sellerRow) return [];
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, product_id, amount, currency, status, created_at, shipping_address, buyer_phone, buyer_name, product:products(title, media_url, thumbnail_url)',
    )
    .eq('seller_id', sellerRow.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as OrderRow[]).map(rowToOrder);
}
