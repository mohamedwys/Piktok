import { Share } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { translateSupabaseError } from '@/lib/supabaseErrors';
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
  featured_until: string | null;
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
    featuredUntil: row.featured_until ?? null,
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
  cursor?: ProductsCursor | null;
};

export type NearbyProduct = Product & { distanceKm: number | null };

// Opaque-to-client cursor for `products_within_radius` v2. Shape mirrors
// supabase/migrations/20260610_products_within_radius_v2.sql. Clients should
// pass the value back verbatim — never construct or interpret fields here.
export type ProductsCursor = {
  featured_until: string | null;
  created_at: string;
  id: string;
  distance_km: number | null;
};

export type ListNearbyResult = {
  items: NearbyProduct[];
  nextCursor: ProductsCursor | null;
};

// TODO(types): remove this hand-rolled row + `RpcCall` cast after the next
// `npm run gen:types` against a database with 20260610 applied. The
// regenerated `Database['public']['Functions']['products_within_radius']`
// will lose `p_offset`, gain `p_cursor jsonb`, and the Returns will include
// `featured_until` and `seller`.
type RpcProductRowV2 = {
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
  featured_until: string | null;
  distance_km: number | null;
  seller: SellerRow | null;
};

type ProductsWithinRadiusV2Args = {
  p_latitude: number | null;
  p_longitude: number | null;
  p_radius_km: number | null;
  p_category_id: string | null;
  p_subcategory_id: string | null;
  p_min_price: number | null;
  p_max_price: number | null;
  p_search_query: string | null;
  p_pickup_only: boolean | null;
  p_sort: SearchNearbySort;
  p_limit: number;
  p_cursor: ProductsCursor | null;
};

type ProductsWithinRadiusRpc = (
  fn: 'products_within_radius',
  args: ProductsWithinRadiusV2Args,
) => Promise<{
  data: RpcProductRowV2[] | null;
  error: { message: string } | null;
}>;

export async function searchNearbyProducts(
  params: SearchNearbyParams,
): Promise<ListNearbyResult> {
  const { filters, location } = params;
  const limit = params.limit ?? 50;
  const cursor = params.cursor ?? null;
  const hasCoords =
    location.latitude !== null && location.longitude !== null;
  const sort: SearchNearbySort =
    params.sort ?? (hasCoords ? 'distance' : 'newest');
  const trimmedQuery = filters.query.trim();

  const rpc = supabase.rpc as unknown as ProductsWithinRadiusRpc;
  const { data, error } = await rpc('products_within_radius', {
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
    p_cursor: cursor,
  });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  if (rows.length === 0) {
    return { items: [], nextCursor: null };
  }

  const items: NearbyProduct[] = [];
  for (const row of rows) {
    if (!row.seller) continue; // LEFT JOIN may return null seller if cascade-deleted
    const merged: ProductRow = {
      id: row.id,
      seller_id: row.seller_id,
      title: row.title,
      description: row.description,
      category: row.category,
      category_id: row.category_id,
      subcategory_id: row.subcategory_id,
      attributes: row.attributes,
      dimensions: row.dimensions,
      price: row.price,
      currency: row.currency,
      media_type: row.media_type,
      media_url: row.media_url,
      thumbnail_url: row.thumbnail_url,
      stock_available: row.stock_available,
      stock_label: row.stock_label,
      shipping_free: row.shipping_free,
      shipping_label: row.shipping_label,
      pickup_available: row.pickup_available,
      location: row.location,
      likes_count: row.likes_count,
      comments_count: row.comments_count,
      shares_count: row.shares_count,
      bookmarks_count: row.bookmarks_count,
      created_at: row.created_at,
      featured_until: row.featured_until,
      seller: row.seller,
    };
    items.push({
      ...rowToProduct(merged),
      distanceKm:
        typeof row.distance_km === 'number' && Number.isFinite(row.distance_km)
          ? row.distance_km
          : null,
    });
  }

  // A full page means there may be more — emit a cursor pinned to the last
  // row. A short page means we reached the end.
  const nextCursor: ProductsCursor | null =
    rows.length === limit
      ? {
          featured_until: rows[rows.length - 1].featured_until,
          created_at: rows[rows.length - 1].created_at,
          id: rows[rows.length - 1].id,
          distance_km: rows[rows.length - 1].distance_km,
        }
      : null;

  return { items, nextCursor };
}

// ---------------------------------------------------------------------------
// For-You feed (Phase 5 / A3 + B3)
//
// Wraps the `feed_for_you` SECURITY DEFINER RPC defined by
// supabase/migrations/20260613_feed_for_you.sql. The function returns a
// 40/30/20/10 interleaved mix of follow / boost / trending / serendipity
// slices, with one slice-tag per row. The hook in B3 consumes
// `ListForYouResult`; the screen in B4 reads `items[i].slice` for telemetry
// and any future per-slice UI affordance (e.g., a Featured badge on boost).
// ---------------------------------------------------------------------------

export type FeedSlice = 'follow' | 'boost' | 'trending' | 'serendipity';

export type ForYouProduct = NearbyProduct & { slice: FeedSlice };

// Opaque cursor; clients pass it back verbatim. Mirrors the migration's
// jsonb shape. The `s` field is reserved for a future random-seed cursor
// on the serendipity slice (currently always null in v0).
export type ForYouCursor = {
  f: string | null;
  b: string | null;
  t: string | null;
  s: string | null;
};

export type ListForYouResult = {
  items: ForYouProduct[];
  nextCursor: ForYouCursor | null;
};

export type FeedForYouParams = {
  location: SearchNearbyLocation;
  cursor: ForYouCursor | null;
  limit?: number;
};

// TODO(types): remove `ForYouRpcRow` + `FeedForYouRpc` casts after the next
// `npm run gen:types` against a database with 20260613 applied. The
// regenerated `Database['public']['Functions']['feed_for_you']` will land
// the same shape.
type ForYouRpcRow = RpcProductRowV2 & { slice: FeedSlice };

type FeedForYouRpc = (
  fn: 'feed_for_you',
  args: {
    p_lat: number | null;
    p_lng: number | null;
    p_radius_km: number | null;
    p_cursor: ForYouCursor | null;
    p_limit: number;
  },
) => Promise<{
  data: ForYouRpcRow[] | null;
  error: { message: string } | null;
}>;

export async function feedForYou(
  params: FeedForYouParams,
): Promise<ListForYouResult> {
  const limit = params.limit ?? 30;
  const cursor = params.cursor ?? null;
  const { latitude, longitude, radiusKm } = params.location;
  const hasCoords = latitude !== null && longitude !== null;

  const rpc = supabase.rpc as unknown as FeedForYouRpc;
  const { data, error } = await rpc('feed_for_you', {
    p_lat: hasCoords ? latitude : null,
    p_lng: hasCoords ? longitude : null,
    p_radius_km: hasCoords ? radiusKm : null,
    p_cursor: cursor,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  if (rows.length === 0) {
    return { items: [], nextCursor: null };
  }

  // Walk in interleaved order; the LAST assignment per slice wins because
  // each slice is sorted DESC by its key inside the server. So the last
  // occurrence of slice S in the page is the smallest-key row for S in
  // the page — exactly what we want to pin the next-page cursor to.
  const lastBySlice: Partial<Record<FeedSlice, ForYouRpcRow>> = {};
  for (const r of rows) {
    lastBySlice[r.slice] = r;
  }

  const items: ForYouProduct[] = [];
  for (const row of rows) {
    if (!row.seller) continue;
    const merged: ProductRow = {
      id: row.id,
      seller_id: row.seller_id,
      title: row.title,
      description: row.description,
      category: row.category,
      category_id: row.category_id,
      subcategory_id: row.subcategory_id,
      attributes: row.attributes,
      dimensions: row.dimensions,
      price: row.price,
      currency: row.currency,
      media_type: row.media_type,
      media_url: row.media_url,
      thumbnail_url: row.thumbnail_url,
      stock_available: row.stock_available,
      stock_label: row.stock_label,
      shipping_free: row.shipping_free,
      shipping_label: row.shipping_label,
      pickup_available: row.pickup_available,
      location: row.location,
      likes_count: row.likes_count,
      comments_count: row.comments_count,
      shares_count: row.shares_count,
      bookmarks_count: row.bookmarks_count,
      created_at: row.created_at,
      featured_until: row.featured_until,
      seller: row.seller,
    };
    items.push({
      ...rowToProduct(merged),
      distanceKm:
        typeof row.distance_km === 'number' && Number.isFinite(row.distance_km)
          ? row.distance_km
          : null,
      slice: row.slice,
    });
  }

  // If a slice contributed zero rows this page, preserve the previous
  // cursor value for that slice. A slice with a pinned cursor that
  // continues to return zero rows is naturally exhausted; the next page
  // will keep cursoring the OTHER slices forward. End-of-feed is reached
  // when the server returns rows.length === 0 (handled above) — at that
  // point we emit nextCursor: null and infinite-query stops.
  const nextCursor: ForYouCursor = {
    f: lastBySlice.follow?.created_at ?? cursor?.f ?? null,
    b: lastBySlice.boost?.featured_until ?? cursor?.b ?? null,
    t: lastBySlice.trending?.created_at ?? cursor?.t ?? null,
    s: null,
  };

  return { items, nextCursor };
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
  if (error && error.code !== PG_UNIQUE_VIOLATION) {
    const e = translateSupabaseError(error);
    if (e) throw e;
  }
}

export async function unlikeProduct(productId: string): Promise<void> {
  const userId = await getCurrentUserIdOrThrow();
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);
  const e = translateSupabaseError(error);
  if (e) throw e;
}

export async function bookmarkProduct(productId: string): Promise<void> {
  const userId = await getCurrentUserIdOrThrow();
  const { error } = await supabase
    .from('bookmarks')
    .insert({ user_id: userId, product_id: productId });
  if (error && error.code !== PG_UNIQUE_VIOLATION) {
    const e = translateSupabaseError(error);
    if (e) throw e;
  }
}

export async function unbookmarkProduct(productId: string): Promise<void> {
  const userId = await getCurrentUserIdOrThrow();
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);
  const e = translateSupabaseError(error);
  if (e) throw e;
}

// ---------------------------------------------------------------------------
// Product hides (Phase 5 / A2 + B6)
//
// `hide_product` / `unhide_product` are SECURITY INVOKER RPCs defined by
// supabase/migrations/20260611_product_hides.sql. The mobile client only
// ever calls `hideProduct(id, 'not_interested')` today via the
// MoreActionsSheet's "Not interested" row. `unhideProduct` is exposed for
// future symmetry (e.g., a "Manage hidden" settings screen).
// ---------------------------------------------------------------------------

// TODO(types): remove the `as unknown as ...Rpc` casts after the next
// `npm run gen:types` against a database with 20260611 applied — both
// functions will appear in `Database['public']['Functions']`.
type HideProductRpc = (
  fn: 'hide_product',
  args: { p_product_id: string; p_reason?: string },
) => Promise<{ error: { message: string } | null }>;

type UnhideProductRpc = (
  fn: 'unhide_product',
  args: { p_product_id: string },
) => Promise<{ error: { message: string } | null }>;

export type HideReason = 'not_interested' | 'inappropriate' | 'spam' | 'other';

export async function hideProduct(
  productId: string,
  reason: HideReason = 'not_interested',
): Promise<void> {
  const rpc = supabase.rpc as unknown as HideProductRpc;
  const { error } = await rpc('hide_product', {
    p_product_id: productId,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
}

export async function unhideProduct(productId: string): Promise<void> {
  const rpc = supabase.rpc as unknown as UnhideProductRpc;
  const { error } = await rpc('unhide_product', { p_product_id: productId });
  if (error) throw new Error(error.message);
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

// ---------------------------------------------------------------------------
// Share helpers (Phase E.2)
//
// `incrementShareCount` calls the SECURITY DEFINER RPC defined by
// supabase/migrations/20260521_increment_share_count_rpc.sql. The RPC bumps
// products.shares_count by 1 — the JS client cannot UPDATE the column
// directly because D.1.5 (20260519_tighten_products_update_grants.sql)
// excluded shares_count from the authenticated allowlist.
//
// `shareProduct` composes the system Share sheet. Per SHARE_AUDIT.md §5 the
// `url` and `message` fields are passed both because iOS shows them
// separately while Android appends url to message — passing both gives the
// best cross-platform behavior at the cost of a slight URL duplication on
// Android.
//
// The brand name "Marqe" is hardcoded in the message templates pending
// Phase F's brand-name decision. Locale branching is inline (fr / en) to
// avoid coupling the share message to the i18n bundles for v1; if a
// future requirement adds more variants, move to t('share.message', ...).
// ---------------------------------------------------------------------------

type IncrementShareCountRpc = (
  fn: 'increment_share_count',
  args: { p_product_id: string },
) => Promise<{ error: { message: string } | null }>;

export async function incrementShareCount(productId: string): Promise<void> {
  // Cast through unknown until `npm run gen:types` registers the function
  // in Database['public']['Functions']. The runtime call is unaffected;
  // only the static signature is augmented.
  const rpc = supabase.rpc as unknown as IncrementShareCountRpc;
  const { error } = await rpc('increment_share_count', {
    p_product_id: productId,
  });
  if (error) throw new Error(error.message);
}

export type ShareProductInput = {
  productId: string;
  title: string;
  priceLabel: string;
  locale: 'fr' | 'en';
};

export async function shareProduct(input: ShareProductInput): Promise<void> {
  const url = Linking.createURL(`product/${input.productId}`);
  const message =
    input.locale === 'en'
      ? `Check out ${input.title} for ${input.priceLabel} on Marqe`
      : `Découvrez ${input.title} à ${input.priceLabel} sur Marqe`;

  await Share.share({ message, url });
}

// ---------------------------------------------------------------------------
// Featured-listing boost (Phase H.12)
//
// `featureProduct` calls the `feature_product` SECURITY DEFINER RPC defined
// by supabase/migrations/20260524_featured_listings.sql. The RPC does the
// Pro / ownership / cooldown checks atomically and writes both
// `products.featured_until` and `sellers.last_boost_at`. The JS client
// cannot UPDATE either column directly because B.1.5 (sellers grants) and
// D.1.5 (products grants) deliberately exclude both from the user-writable
// allowlist.
//
// Errors are re-thrown with the Postgres message intact so call sites can
// pattern-match against substrings ("not_pro", "cooldown_active",
// "not_owner_or_product_missing"). The mobile UI gates already prevent the
// first two from firing in normal use; the RPC re-checks as defense in
// depth.
//
// Return-type cast: until `npm run gen:types` runs against an environment
// where this migration is applied, the function does not appear in
// `Database['public']['Functions']`. The documented `as` cast on the
// return value is the single exception to mobile TypeScript strictness for
// this step; replace with the generated type after regen.
//
// `listFeaturedProducts` is the read-side companion. The Categories-page
// Featured rail consumes it through `useFeaturedProducts`. The
// `gt('featured_until', now)` filter is index-backed by
// `products_featured_until_idx` (partial; only currently-featured rows
// are indexed). The DESC ordering surfaces the most-recently boosted
// listings first, which matches the intended discovery experience.
// ---------------------------------------------------------------------------

export type FeatureProductResult = {
  product_id: string;
  featured_until: string;
  next_available_at: string;
};

export async function featureProduct(
  productId: string,
): Promise<FeatureProductResult> {
  const { data, error } = await supabase.rpc(
    'feature_product' as never,
    { p_product_id: productId } as never,
  );
  if (error) {
    // Re-throw with the Postgres error message intact so call sites can
    // pattern-match (cooldown_active vs not_pro vs not_owner_*).
    throw error;
  }
  // Documented escape per missing gen:types update — replace with the
  // generated function-return type after `npm run gen:types`.
  return data as unknown as FeatureProductResult;
}

export async function listFeaturedProducts(opts?: {
  limit?: number;
}): Promise<Product[]> {
  const limit = opts?.limit ?? 10;
  const { data, error } = await supabase
    .from('products')
    .select('*, seller:sellers(*)')
    .gt('featured_until', new Date().toISOString())
    .order('featured_until', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data as unknown as ProductRow[]) ?? []).map(rowToProduct);
}

// ---------------------------------------------------------------------------
// Realtime new-listing subscription (Phase 5 / B5)
//
// Modelled on `subscribeToConversations` (services/messaging.ts). The
// MarketplaceScreen subscribes when the user is on the marketplace tab and
// has a location set; the callback inlines a haversine, filters by the
// active radius, and prepends the listing to the infinite-query cache.
//
// Payload shape: only the fields the realtime handler actually reads. The
// full product (with seller jsonb) is fetched via `getProductById` if the
// new listing is in radius — keeps the realtime path lean and reuses the
// existing seller-join code.
// ---------------------------------------------------------------------------
export type NewListingPayload = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  [key: string]: unknown;
};

export function subscribeToNewListings(
  onInsert: (row: NewListingPayload) => void,
): () => void {
  const channel = supabase
    .channel('products:new')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'products' },
      (payload) => {
        onInsert(payload.new as NewListingPayload);
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
