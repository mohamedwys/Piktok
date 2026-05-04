import { supabase } from '@/lib/supabase';
import { File } from 'expo-file-system';
import { AuthRequiredError } from '@/features/marketplace/services/products';
import { FREE_TIER_LISTING_CAP } from '@/features/marketplace/constants';
import { ListingCapReachedError } from '@/features/marketplace/errors';
import type { LocalizedString } from '@/i18n/getLocalized';

export type CreateProductInput = {
  title: string;
  description: string;
  price: number;
  currency: 'EUR' | 'USD' | 'GBP';
  mediaUri: string; // local file URI
  mediaType: 'image' | 'video';
  category: { primary: LocalizedString; secondary: LocalizedString };
  categoryId: string;
  subcategoryId: string;
  attributes: Array<{ id: string; label: string; iconKey?: string }>;
  dimensions?: string;
  stockAvailable: boolean;
  shippingFree: boolean;
  pickupAvailable: boolean;
  location?: string;
  /**
   * Optional geographic coordinates for the listing. When provided,
   * `latitude` + `longitude` + `location_updated_at` are written to
   * the new row and the generated `location_point` populates
   * automatically. Best-effort — callers (G.8) geocode on submit and
   * pass these only when geocoding succeeds.
   */
  latitude?: number | null;
  longitude?: number | null;
};

async function getCurrentUserOrThrow() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new AuthRequiredError();
  return data.user;
}

const dup = (s: string): LocalizedString => ({ fr: s, en: s });

function resolveContentType(ext: string, mediaType: 'image' | 'video'): string {
  if (mediaType === 'video') {
    if (ext === 'mov') return 'video/quicktime';
    if (ext === 'webm') return 'video/webm';
    if (ext === 'm4v') return 'video/x-m4v';
    return 'video/mp4';
  }
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export async function uploadProductMedia(
  localUri: string,
  mediaType: 'image' | 'video'
): Promise<string> {
  const user = await getCurrentUserOrThrow();
  const ext = (localUri.split('.').pop() || (mediaType === 'video' ? 'mp4' : 'jpg')).toLowerCase();
  const fileName = `${user.id}/${Date.now()}.${ext}`;
  const file = new File(localUri);
  const bytes = await file.bytes();
  const contentType = resolveContentType(ext, mediaType);
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

  // 1. Ensure seller exists. Auto-creates via the
  //    `get_or_create_seller_for_current_user` RPC if missing; for new
  //    accounts the row defaults `is_pro = false`.
  const sellerId = await ensureSellerForCurrentUser();

  // 2. Free-tier cap check (Phase H.3). Performed BEFORE the media
  //    upload so a rejected create doesn't waste the storage write.
  //    Two server reads:
  //      (a) Single-column `is_pro` lookup on the seller row. The H.2
  //          trigger keeps this synchronized with subscription status,
  //          so it is the authoritative gate here.
  //      (b) HEAD-only count of existing products for this seller.
  //          `count: 'exact', head: true` sends no row data — only the
  //          Content-Range count header — keeping the gate cheap even
  //          for high-listing sellers.
  //    Race-condition acknowledgement: this client-side check + the
  //    subsequent INSERT are not atomic. Two simultaneous creates from
  //    the same seller could in principle race past the cap by one. We
  //    accept this v1 trade-off; tightening would require a SECURITY
  //    DEFINER RPC that wraps the count + insert in a single
  //    transaction (Phase F territory if support tickets surface it).
  const { data: sellerRow, error: sellerErr } = await supabase
    .from('sellers')
    .select('is_pro')
    .eq('id', sellerId)
    .single();
  if (sellerErr) throw sellerErr;
  if (!sellerRow.is_pro) {
    const { count, error: countErr } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', sellerId);
    if (countErr) throw countErr;
    if ((count ?? 0) >= FREE_TIER_LISTING_CAP) {
      throw new ListingCapReachedError(FREE_TIER_LISTING_CAP);
    }
  }

  // 3. Upload media
  const mediaUrl = await uploadProductMedia(input.mediaUri, input.mediaType);

  // 4. Insert product. User-entered text is duplicated into fr+en for now.
  //    Geo columns (latitude/longitude/location_updated_at) are included
  //    only when both coordinates are provided — the generated
  //    `location_point` populates automatically via the G.1 migration.
  const hasCoords =
    typeof input.latitude === 'number' &&
    typeof input.longitude === 'number' &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude);

  const insertPayload: Record<string, unknown> = {
    seller_id: sellerId,
    title: dup(input.title),
    description: dup(input.description),
    category: {
      primary: input.category.primary,
      secondary: input.category.secondary,
    },
    category_id: input.categoryId,
    subcategory_id: input.subcategoryId,
    attributes: input.attributes.map((a) => ({
      id: a.id,
      label: dup(a.label),
      ...(a.iconKey ? { iconKey: a.iconKey } : {}),
    })),
    dimensions: input.dimensions ?? null,
    price: input.price,
    currency: input.currency,
    media_type: input.mediaType,
    media_url: mediaUrl,
    thumbnail_url: mediaUrl,
    stock_available: input.stockAvailable,
    shipping_free: input.shippingFree,
    pickup_available: input.pickupAvailable,
    location: input.location ?? null,
  };
  if (hasCoords) {
    insertPayload.latitude = input.latitude;
    insertPayload.longitude = input.longitude;
    insertPayload.location_updated_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('products')
    .insert(insertPayload)
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export type UpdateProductInput = Omit<CreateProductInput, 'mediaUri' | 'mediaType'> & {
  newMediaUri?: string;
  newMediaType?: 'image' | 'video';
};

export async function updateProduct(
  productId: string,
  input: UpdateProductInput,
): Promise<void> {
  await getCurrentUserOrThrow();

  const patch: Record<string, unknown> = {
    title: dup(input.title),
    description: dup(input.description),
    price: input.price,
    currency: input.currency,
    category: {
      primary: input.category.primary,
      secondary: input.category.secondary,
    },
    category_id: input.categoryId,
    subcategory_id: input.subcategoryId,
    attributes: input.attributes.map((a) => ({
      id: a.id,
      label: dup(a.label),
      ...(a.iconKey ? { iconKey: a.iconKey } : {}),
    })),
    dimensions: input.dimensions ?? null,
    stock_available: input.stockAvailable,
    shipping_free: input.shippingFree,
    pickup_available: input.pickupAvailable,
    location: input.location ?? null,
  };

  if (input.newMediaUri && input.newMediaType) {
    const url = await uploadProductMedia(input.newMediaUri, input.newMediaType);
    patch.media_type = input.newMediaType;
    patch.media_url = url;
    patch.thumbnail_url = url;
  }

  const { error } = await supabase
    .from('products')
    .update(patch)
    .eq('id', productId);
  if (error) throw error;
}
