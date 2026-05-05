import { supabase } from '@/lib/supabase';
import { rowToProduct, type ProductRow } from './products';
import type { Product } from '@/features/marketplace/types/product';

export type SellerProfile = {
  id: string;
  name: string;
  avatarUrl: string;
  verified: boolean;
  isPro: boolean;
  rating: number;
  salesCount: number;
  followersCount: number;
  followingCount: number;
  createdAt: string;
  bio?: string;
  website?: string;
  phonePublic?: string;
  emailPublic?: string;
  latitude: number | null;
  longitude: number | null;
  locationText: string | null;
  locationUpdatedAt: string | null;
  /**
   * Timestamp of the seller's most recent boost (H.12). NULL if they have
   * never used the perk. The boost cooldown is computed FROM this
   * timestamp: `lastBoostAt + 7 days` is the next-available-boost moment.
   * BoostButton derives its disabled-with-countdown state from this field.
   */
  lastBoostAt: string | null;
};

type SellerRow = {
  id: string;
  name: string;
  avatar_url: string;
  verified: boolean;
  is_pro: boolean;
  rating: number;
  sales_count: number;
  followers_count: number;
  following_count: number;
  created_at: string;
  bio: string | null;
  website: string | null;
  phone_public: string | null;
  email_public: string | null;
  latitude: number | null;
  longitude: number | null;
  location_text: string | null;
  location_updated_at: string | null;
  last_boost_at: string | null;
};

function rowToSeller(row: SellerRow): SellerProfile {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    verified: row.verified,
    isPro: row.is_pro,
    rating: Number(row.rating),
    salesCount: row.sales_count,
    followersCount: row.followers_count ?? 0,
    followingCount: row.following_count ?? 0,
    createdAt: row.created_at,
    bio: row.bio ?? undefined,
    website: row.website ?? undefined,
    phonePublic: row.phone_public ?? undefined,
    emailPublic: row.email_public ?? undefined,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    locationText: row.location_text ?? null,
    locationUpdatedAt: row.location_updated_at ?? null,
    lastBoostAt: row.last_boost_at ?? null,
  };
}

export async function getSellerById(id: string): Promise<SellerProfile | null> {
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToSeller(data as SellerRow) : null;
}

export async function listProductsBySeller(
  sellerId: string,
  limit = 20,
): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, seller:sellers(*)')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as ProductRow[]).map(rowToProduct);
}

export async function getMySeller(): Promise<SellerProfile | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('user_id', u.user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToSeller(data as SellerRow) : null;
}

export type UpdateMySellerInput = {
  name?: string;
  avatarUrl?: string;
  bio?: string | null;
  website?: string | null;
  phonePublic?: string | null;
  emailPublic?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationText?: string | null;
};

export async function updateMySeller(
  input: UpdateMySellerInput,
): Promise<SellerProfile> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');

  const username = (u.user.user_metadata?.username as string | undefined)
    || u.user.email?.split('@')[0]
    || 'User';
  await supabase.rpc('get_or_create_seller_for_current_user', {
    p_username: username,
    p_avatar_url: '',
  });

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;
  if (input.bio !== undefined) patch.bio = input.bio || null;
  if (input.website !== undefined) patch.website = input.website || null;
  if (input.phonePublic !== undefined) patch.phone_public = input.phonePublic || null;
  if (input.emailPublic !== undefined) patch.email_public = input.emailPublic || null;

  const touchesLocation =
    input.latitude !== undefined
    || input.longitude !== undefined
    || input.locationText !== undefined;
  if (input.latitude !== undefined) patch.latitude = input.latitude;
  if (input.longitude !== undefined) patch.longitude = input.longitude;
  if (input.locationText !== undefined) patch.location_text = input.locationText;
  if (touchesLocation) patch.location_updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('sellers')
    .update(patch)
    .eq('user_id', u.user.id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToSeller(data as SellerRow);
}
