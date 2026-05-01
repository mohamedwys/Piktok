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
  createdAt: string;
  bio?: string;
  website?: string;
  phonePublic?: string;
  emailPublic?: string;
};

type SellerRow = {
  id: string;
  name: string;
  avatar_url: string;
  verified: boolean;
  is_pro: boolean;
  rating: number;
  sales_count: number;
  created_at: string;
  bio: string | null;
  website: string | null;
  phone_public: string | null;
  email_public: string | null;
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
    createdAt: row.created_at,
    bio: row.bio ?? undefined,
    website: row.website ?? undefined,
    phonePublic: row.phone_public ?? undefined,
    emailPublic: row.email_public ?? undefined,
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
  bio?: string | null;
  website?: string | null;
  phonePublic?: string | null;
  emailPublic?: string | null;
};

export async function updateMySeller(input: UpdateMySellerInput): Promise<void> {
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
  if (input.bio !== undefined) patch.bio = input.bio || null;
  if (input.website !== undefined) patch.website = input.website || null;
  if (input.phonePublic !== undefined) patch.phone_public = input.phonePublic || null;
  if (input.emailPublic !== undefined) patch.email_public = input.emailPublic || null;

  const { error } = await supabase
    .from('sellers')
    .update(patch)
    .eq('user_id', u.user.id);
  if (error) throw error;
}
