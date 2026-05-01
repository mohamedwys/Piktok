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
