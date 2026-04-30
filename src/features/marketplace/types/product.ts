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
  primary: string;
  secondary: string;
};

export type ProductAttribute = {
  id: string;
  label: string;
  iconKey?: string;
};

export type ProductStock = {
  available: boolean;
  label?: string;
};

export type ProductShipping = {
  free: boolean;
  label?: string;
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

export type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: Currency;
  media: ProductMedia;
  category: ProductCategory;
  attributes: ProductAttribute[];
  dimensions?: string;
  stock: ProductStock;
  shipping: ProductShipping;
  seller: Seller;
  engagement: ProductEngagement;
  createdAt: string;
};
