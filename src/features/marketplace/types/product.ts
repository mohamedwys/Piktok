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
  attributes: ProductAttribute[];
  dimensions?: string;
  stock: ProductStock;
  shipping: ProductShipping;
  pickup?: ProductPickup;
  location?: string;
  seller: Seller;
  engagement: ProductEngagement;
  createdAt: string;
};
