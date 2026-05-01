import { supabase } from '@/lib/supabase';

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export type Order = {
  id: string;
  productId: string;
  productTitle: { fr: string; en: string } | null;
  productThumbnail: string | null;
  amount: number;
  currency: 'EUR' | 'USD' | 'GBP';
  status: OrderStatus;
  createdAt: string;
};

type OrderRow = {
  id: string;
  product_id: string;
  amount: number;
  currency: 'EUR' | 'USD' | 'GBP';
  status: OrderStatus;
  created_at: string;
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
    body: { product_id: productId, return_url: 'https://example.com/checkout-return' },
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
