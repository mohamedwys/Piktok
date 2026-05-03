import { supabase } from '@/lib/supabase';
import type {
  Product,
  Currency,
  MediaType,
  ProductCategory,
  ProductAttribute,
  ProductStock,
  ProductShipping,
} from '@/features/marketplace/types/product';
import type { MarketplaceFilters } from '@/stores/useMarketplaceFilters';
import type { Database } from '@/types/supabase';

export class AuthRequiredError extends Error {
  constructor() {
    super('Authentication required.');
    this.name = 'AuthRequiredError';
  }
}

async function getCurrentUserIdOrThrow(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new AuthRequiredError();
  return data.user.id;
}

type SellerRow = {
  id: string;
  name: string;
  avatar_url: string;
  verified: boolean;
  is_pro: boolean;
  rating: number;
  sales_count: number;
};

export type ProductRow = {
  id: string;
  seller_id: string;
  title: Product['title'];
  description: Product['description'];
  category: ProductCategory;
  category_id: string | null;
  subcategory_id: string | null;
  attributes: ProductAttribute[];
  dimensions: string | null;
  price: number;
  currency: Currency;
  media_type: MediaType;
  media_url: string;
  thumbnail_url: string | null;
  stock_available: boolean;
  stock_label: ProductStock['label'] | null;
  shipping_free: boolean;
  shipping_label: ProductShipping['label'] | null;
  pickup_available: boolean;
  location: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  bookmarks_count: number;
  created_at: string;
  seller: SellerRow;
};

export function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: Number(row.price),
    currency: row.currency,
    media: {
      type: row.media_type,
      url: row.media_url,
      thumbnailUrl: row.thumbnail_url ?? undefined,
    },
    category: row.category,
    categoryId: row.category_id ?? undefined,
    subcategoryId: row.subcategory_id ?? undefined,
    attributes: row.attributes,
    dimensions: row.dimensions ?? undefined,
    stock: {
      available: row.stock_available,
      label: row.stock_label ?? undefined,
    },
    shipping: {
      free: row.shipping_free,
      label: row.shipping_label ?? undefined,
    },
    pickup: { available: row.pickup_available },
    location: row.location ?? undefined,
    seller: {
      id: row.seller.id,
      name: row.seller.name,
      avatarUrl: row.seller.avatar_url,
      verified: row.seller.verified,
      isPro: row.seller.is_pro,
      rating: Number(row.seller.rating),
      salesCount: row.seller.sales_count,
    },
    engagement: {
      likes: row.likes_count,
      comments: row.comments_count,
      shares: row.shares_count,
      bookmarks: row.bookmarks_count,
    },
    createdAt: row.created_at,
  };
}

export type ListProductsParams = {
  cursor?: string;
  limit?: number;
};

export type ListProductsResult = {
  items: Product[];
  nextCursor: string | null;
};

export async function listProducts(
  params?: ListProductsParams
): Promise<ListProductsResult> {
  const limit = params?.limit ?? 20;
  const { data, error } = await supabase
    .from('products')
    .select('*, seller:sellers(*)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const items = (data as unknown as ProductRow[]).map(rowToProduct);
  return { items, nextCursor: null }; // cursor pagination wired in a later step
}

export async function searchProducts(
  filters: MarketplaceFilters,
  limit = 20,
): Promise<ListProductsResult> {
  let query = supabase
    .from('products')
    .select('*, seller:sellers(*)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filters.query.trim().length > 0) {
    const q = filters.query.trim().replace(/[%_]/g, '');
    const pattern = `%${q}%`;
    query = query.or(
      [
        `title->>fr.ilike.${pattern}`,
        `title->>en.ilike.${pattern}`,
        `description->>fr.ilike.${pattern}`,
        `description->>en.ilike.${pattern}`,
      ].join(','),
    );
  }
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters.subcategoryId) query = query.eq('subcategory_id', filters.subcategoryId);
  if (filters.priceMax !== null) query = query.lte('price', filters.priceMax);
  if (filters.pickupOnly) query = query.eq('pickup_available', true);
  if (filters.locationQuery.trim().length > 0) {
    const loc = filters.locationQuery.trim().replace(/[%_]/g, '');
    query = query.ilike('location', `%${loc}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  const items = (data as unknown as ProductRow[]).map(rowToProduct);
  return { items, nextCursor: null };
}

export type SearchNearbyLocation = {
  latitude: number | null;
  longitude: number | null;
  radiusKm: number | null;
};

export type SearchNearbySort =
  | 'distance'
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'most_liked';

export type SearchNearbyParams = {
  filters: MarketplaceFilters;
  location: SearchNearbyLocation;
  sort?: SearchNearbySort;
  limit?: number;
  offset?: number;
};

export type NearbyProduct = Product & { distanceKm: number | null };

export type ListNearbyResult = {
  items: NearbyProduct[];
  nextCursor: string | null;
};

type RpcProductRow =
  Database['public']['Functions']['products_within_radius']['Returns'][number];

export async function searchNearbyProducts(
  params: SearchNearbyParams,
): Promise<ListNearbyResult> {
  const { filters, location } = params;
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  const hasCoords =
    location.latitude !== null && location.longitude !== null;
  const sort: SearchNearbySort =
    params.sort ?? (hasCoords ? 'distance' : 'newest');
  const trimmedQuery = filters.query.trim();

  const { data, error } = await supabase.rpc('products_within_radius', {
    p_latitude: hasCoords ? location.latitude : null,
    p_longitude: hasCoords ? location.longitude : null,
    p_radius_km: hasCoords ? location.radiusKm : null,
    p_category_id: filters.categoryId,
    p_subcategory_id: filters.subcategoryId,
    p_min_price: null,
    p_max_price: filters.priceMax,
    p_search_query: trimmedQuery.length > 0 ? trimmedQuery : null,
    p_pickup_only: filters.pickupOnly ? true : null,
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;

  const rows = (data as unknown as RpcProductRow[]) ?? [];
  if (rows.length === 0) {
    return { items: [], nextCursor: null };
  }

  const sellerIds = Array.from(
    new Set(rows.map((r) => r.seller_id).filter((id): id is string => !!id)),
  );

  const { data: sellersData, error: sellersErr } = await supabase
    .from('sellers')
    .select('*')
    .in('id', sellerIds);
  if (sellersErr) throw sellersErr;

  const sellerById = new Map<string, SellerRow>();
  for (const s of (sellersData as unknown as SellerRow[]) ?? []) {
    sellerById.set(s.id, s);
  }

  const items: NearbyProduct[] = [];
  for (const row of rows) {
    const seller = sellerById.get(row.seller_id);
    if (!seller) continue;
    const merged: ProductRow = { ...(row as unknown as ProductRow), seller };
    items.push({
      ...rowToProduct(merged),
      distanceKm:
        typeof row.distance_km === 'number' && Number.isFinite(row.distance_km)
          ? row.distance_km
          : null,
    });
  }

  return { items, nextCursor: null };
}

export type ListTrendingParams = {
  sinceDays?: number;
  limit?: number;
};

export async function listTrendingProducts(
  params?: ListTrendingParams,
): Promise<ListProductsResult> {
  const sinceDays = params?.sinceDays ?? 7;
  const limit = params?.limit ?? 12;
  const since = new Date(
    Date.now() - sinceDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await supabase
    .from('products')
    .select('*, seller:sellers(*)')
    .gte('created_at', since)
    .order('likes_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const items = (data as unknown as ProductRow[]).map(rowToProduct);
  return { items, nextCursor: null };
}

export async function listMyProducts(): Promise<Product[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data: sellerRow } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', u.user.id)
    .maybeSingle();
  if (!sellerRow) return [];
  const { data, error } = await supabase
    .from('products')
    .select('*, seller:sellers(*)')
    .eq('seller_id', sellerRow.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as ProductRow[]).map(rowToProduct);
}

export async function deleteProduct(productId: string): Promise<void> {
  const { data: row, error: fetchErr } = await supabase
    .from('products')
    .select('id, media_url')
    .eq('id', productId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) return;

  const url = row.media_url as string;
  const marker = '/product-media/';
  const idx = url.indexOf(marker);
  if (idx >= 0) {
    const path = url.substring(idx + marker.length);
    await supabase.storage.from('product-media').remove([path]).catch(() => {});
  }

  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) throw error;
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, seller:sellers(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProduct(data as unknown as ProductRow) : null;
}

// Postgres unique-violation: a duplicate (user_id, product_id) row was
// inserted. We treat re-likes / re-bookmarks as idempotent rather than an
// error so the UI's optimistic toggle stays consistent.
const PG_UNIQUE_VIOLATION = '23505';

export async function likeProduct(productId: string): Promise<void> {
  const userId = await getCurrentUserIdOrThrow();
  const { error } = await supabase
    .from('likes')
    .insert({ user_id: userId, product_id: productId });
  if (error && error.code !== PG_UNIQUE_VIOLATION) throw error;
}

export async function unlikeProduct(productId: string): Promise<void> {
  const userId = await getCurrentUserIdOrThrow();
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);
  if (error) throw error;
}

export async function bookmarkProduct(productId: string): Promise<void> {
  const userId = await getCurrentUserIdOrThrow();
  const { error } = await supabase
    .from('bookmarks')
    .insert({ user_id: userId, product_id: productId });
  if (error && error.code !== PG_UNIQUE_VIOLATION) throw error;
}

export async function unbookmarkProduct(productId: string): Promise<void> {
  const userId = await getCurrentUserIdOrThrow();
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);
  if (error) throw error;
}

export type UserEngagement = {
  likedIds: Set<string>;
  bookmarkedIds: Set<string>;
  followingSellerIds: Set<string>;
};

export async function listUserEngagement(): Promise<UserEngagement> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return {
      likedIds: new Set(),
      bookmarkedIds: new Set(),
      followingSellerIds: new Set(),
    };
  }
  const userId = userData.user.id;

  // Likes / bookmarks key by auth.users.id; follows key by sellers.id
  // (the calling user's seller-row id). Fetch the seller_id in parallel
  // with the engagement queries — no serial latency. If the user has not
  // yet been promoted to a seller row (e.g., they have only browsed),
  // they cannot have follow rows either, so followingSellerIds is empty.
  const [sellerRowResult, likes, bookmarks] = await Promise.all([
    supabase.from('sellers').select('id').eq('user_id', userId).maybeSingle(),
    supabase.from('likes').select('product_id').eq('user_id', userId),
    supabase.from('bookmarks').select('product_id').eq('user_id', userId),
  ]);
  if (sellerRowResult.error) throw sellerRowResult.error;
  if (likes.error) throw likes.error;
  if (bookmarks.error) throw bookmarks.error;

  const followerSellerId = sellerRowResult.data?.id ?? null;
  let followingSellerIds = new Set<string>();
  if (followerSellerId) {
    const follows = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', followerSellerId);
    if (follows.error) throw follows.error;
    followingSellerIds = new Set(
      follows.data.map((row) => row.following_id as string),
    );
  }

  return {
    likedIds: new Set(likes.data.map((row) => row.product_id as string)),
    bookmarkedIds: new Set(
      bookmarks.data.map((row) => row.product_id as string)
    ),
    followingSellerIds,
  };
}
