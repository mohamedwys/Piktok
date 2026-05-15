import { supabase } from '@/lib/supabase';
import { rowToProduct, type ProductRow } from './products';
import type { Product } from '@/features/marketplace/types/product';

// TODO(types): remove the `as unknown as SetMyInterestsRpc` cast after the
// next `npm run gen:types` against a database with 20260612 applied.
type SetMyInterestsRpc = (
  fn: 'set_my_interests',
  args: { p_interests: string[] },
) => Promise<{ error: { message: string } | null }>;

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
  /**
   * Category IDs the user picked at onboarding (or via "Edit interests").
   * Empty array means "not set" — onboarding hasn't run or was skipped.
   * Mutated via `set_my_interests` RPC; client never writes the column
   * directly (B.1.5 sellers UPDATE allowlist excludes it).
   */
  interests: string[];
  /**
   * Stripe Connect account id (acct_…) provisioned by F.C.1's
   * `stripe-connect-create` edge function. NULL until the seller starts
   * onboarding from /pro/payouts. Surfaced on mobile to drive the
   * Buy Now gate via `useStripeConnectStatus`.
   */
  stripeAccountId: string | null;
  /**
   * Mirrors `charges_enabled` from the Stripe Account object, refreshed
   * by F.C.1's `stripe-account-webhook`. True once Stripe has cleared
   * the seller for receiving funds. The mobile sell-flow gates the
   * `buy_now` purchase mode on this flag — the server-side checkout
   * function already refuses non-Connected sellers, so this is purely
   * seller-side UX.
   */
  stripeChargesEnabled: boolean;
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
  // interests is jsonb in DB; typed as unknown because the regenerated
  // types may lag the 20260612 migration. Validated in rowToSeller.
  interests?: unknown;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
};

function parseInterests(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

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
    interests: parseInterests(row.interests),
    stripeAccountId: row.stripe_account_id ?? null,
    stripeChargesEnabled: row.stripe_charges_enabled ?? false,
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

// ---------------------------------------------------------------------------
// Onboarding interests (Phase 5 / A4 + B7)
//
// `set_my_interests` is a SECURITY DEFINER RPC defined by
// supabase/migrations/20260612_seller_interests.sql. The mobile client calls
// it from the onboarding screen and from the "Edit interests" entry in
// profile settings. Errors with sqlerrm containing 'invalid_interests' are
// re-thrown verbatim so call sites can pattern-match if needed; the v0 UI
// just surfaces a generic toast.
// ---------------------------------------------------------------------------
export async function setMyInterests(interests: string[]): Promise<void> {
  const rpc = supabase.rpc as unknown as SetMyInterestsRpc;
  const { error } = await rpc('set_my_interests', { p_interests: interests });
  if (error) throw new Error(error.message);
}
