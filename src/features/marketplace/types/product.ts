import type { LocalizedString } from '@/i18n/getLocalized';

export type Currency = 'EUR' | 'USD' | 'GBP';

export type MediaType = 'image' | 'video';

export type ProductMedia = {
  type: MediaType;
  url: string;
  thumbnailUrl?: string;
  aspectRatio?: number;
  durationMs?: number;
};

export type ProductCategory = {
  primary: LocalizedString;
  secondary: LocalizedString;
};

export type ProductAttribute = {
  id: string;
  label: LocalizedString;
  iconKey?: string;
};

export type ProductStock = {
  available: boolean;
  label?: LocalizedString;
};

export type ProductShipping = {
  free: boolean;
  label?: LocalizedString;
};

export type Seller = {
  id: string;
  name: string;
  avatarUrl: string;
  verified: boolean;
  isPro: boolean;
  rating: number;
  salesCount: number;
};

export type ProductEngagement = {
  likes: number;
  comments: number;
  shares: number;
  bookmarks?: number;
};

export type ProductPickup = {
  available: boolean;
};

export type Product = {
  id: string;
  title: LocalizedString;
  description: LocalizedString;
  price: number;
  currency: Currency;
  media: ProductMedia;
  category: ProductCategory;
  categoryId?: string;
  subcategoryId?: string;
  attributes: ProductAttribute[];
  dimensions?: string;
  stock: ProductStock;
  shipping: ProductShipping;
  pickup?: ProductPickup;
  location?: string;
  seller: Seller;
  engagement: ProductEngagement;
  createdAt: string;
  /**
   * Distance in kilometres from the user's current location, when both
   * the user and the product have geo coordinates. Populated by
   * `searchNearbyProducts` (see `services/products.ts` — `NearbyProduct`).
   * Surfaced on the bottom info panel by Step 6; resolves the G.7 deferral.
   */
  distanceKm?: number | null;
  /**
   * Boost expiration timestamp (ISO-8601). When `featuredUntil > now()` the
   * listing is currently boosted (H.12) and renders with the "À la une"
   * badge + surfaces in the Categories Featured rail. NULL or past values
   * mean the listing is not currently featured. Set by the
   * `feature_product` SECURITY DEFINER RPC; users cannot write the
   * underlying column directly (excluded from D.1.5's UPDATE allowlist).
   */
  featuredUntil?: string | null;
};
