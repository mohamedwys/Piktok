import productsData from '../data/products.json';
import type { Product } from '../types/product';

const products: Product[] = productsData as unknown as Product[];

export type ListProductsParams = {
  cursor?: string;
  limit?: number;
};

export type ListProductsResult = {
  items: Product[];
  nextCursor: string | null;
};

export function listProducts(
  params?: ListProductsParams
): Promise<ListProductsResult> {
  // TODO(step-N): replace with Supabase call
  const limit = params?.limit ?? products.length;
  const startIndex = params?.cursor
    ? products.findIndex((p) => p.id === params.cursor) + 1
    : 0;
  const items = products.slice(startIndex, startIndex + limit);
  const last = items[items.length - 1];
  const nextCursor =
    last && startIndex + limit < products.length ? last.id : null;
  return Promise.resolve({ items, nextCursor });
}

export function getProductById(id: string): Promise<Product | null> {
  // TODO(step-N): replace with Supabase call
  const found = products.find((p) => p.id === id) ?? null;
  return Promise.resolve(found);
}

export function likeProduct(_id: string): Promise<void> {
  // TODO(step-N): replace with Supabase call
  return Promise.resolve();
}

export function unlikeProduct(_id: string): Promise<void> {
  // TODO(step-N): replace with Supabase call
  return Promise.resolve();
}
