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

type ProductRow = {
  id: string;
  seller_id: string;
  title: Product['title'];
  description: Product['description'];
  category: ProductCategory;
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

function rowToProduct(row: ProductRow): Product {
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
};

export async function listUserEngagement(): Promise<UserEngagement> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { likedIds: new Set(), bookmarkedIds: new Set() };
  }
  const userId = userData.user.id;
  const [likes, bookmarks] = await Promise.all([
    supabase.from('likes').select('product_id').eq('user_id', userId),
    supabase.from('bookmarks').select('product_id').eq('user_id', userId),
  ]);
  if (likes.error) throw likes.error;
  if (bookmarks.error) throw bookmarks.error;
  return {
    likedIds: new Set(likes.data.map((row) => row.product_id as string)),
    bookmarkedIds: new Set(
      bookmarks.data.map((row) => row.product_id as string)
    ),
  };
}
