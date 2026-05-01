import { supabase } from '@/lib/supabase';
import { File } from 'expo-file-system';
import { AuthRequiredError } from '@/features/marketplace/services/products';

export type CreateProductInput = {
  title: string;
  description: string;
  price: number;
  currency: 'EUR' | 'USD' | 'GBP';
  imageUri: string; // local file URI
  category: { primary: string; secondary: string };
  attributes: Array<{ id: string; label: string; iconKey?: string }>;
  dimensions?: string;
  stockAvailable: boolean;
  shippingFree: boolean;
};

async function getCurrentUserOrThrow() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new AuthRequiredError();
  return data.user;
}

export async function uploadProductImage(localUri: string): Promise<string> {
  const user = await getCurrentUserOrThrow();
  const ext = (localUri.split('.').pop() || 'jpg').toLowerCase();
  const fileName = `${user.id}/${Date.now()}.${ext}`;
  const file = new File(localUri);
  const bytes = await file.bytes();
  const contentType =
    ext === 'png' ? 'image/png' :
    ext === 'webp' ? 'image/webp' :
    'image/jpeg';
  const { data, error } = await supabase.storage
    .from('product-media')
    .upload(fileName, bytes, { contentType, upsert: false });
  if (error) throw error;
  const pub = supabase.storage.from('product-media').getPublicUrl(data.path);
  return pub.data.publicUrl;
}

export async function ensureSellerForCurrentUser(): Promise<string> {
  const user = await getCurrentUserOrThrow();
  const username = (user.user_metadata?.username as string | undefined)
    || user.email?.split('@')[0]
    || 'User';
  const { data, error } = await supabase.rpc('get_or_create_seller_for_current_user', {
    p_username: username,
    p_avatar_url: '',
  });
  if (error) throw error;
  return data as string;
}

export async function createProduct(input: CreateProductInput): Promise<string> {
  await getCurrentUserOrThrow();

  // 1. Upload image
  const imageUrl = await uploadProductImage(input.imageUri);

  // 2. Ensure seller exists
  const sellerId = await ensureSellerForCurrentUser();

  // 3. Insert product. User-entered text is duplicated into fr+en for now.
  const dup = (s: string) => ({ fr: s, en: s });
  const { data, error } = await supabase
    .from('products')
    .insert({
      seller_id: sellerId,
      title: dup(input.title),
      description: dup(input.description),
      category: {
        primary: dup(input.category.primary),
        secondary: dup(input.category.secondary),
      },
      attributes: input.attributes.map((a) => ({
        id: a.id,
        label: dup(a.label),
        ...(a.iconKey ? { iconKey: a.iconKey } : {}),
      })),
      dimensions: input.dimensions ?? null,
      price: input.price,
      currency: input.currency,
      media_type: 'image',
      media_url: imageUrl,
      thumbnail_url: imageUrl,
      stock_available: input.stockAvailable,
      shipping_free: input.shippingFree,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}
