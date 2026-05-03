import type { GeoCoordinate, GeoLocation } from './types';

const CAPACITY = 200;
const TTL_MS = 24 * 60 * 60 * 1000;
const REVERSE_PRECISION = 1e4;

type Entry<V> = { value: V; expiresAt: number };

class LruCache<V> {
  private readonly map = new Map<string, Entry<V>>();

  get(key: string): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= CAPACITY) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { value, expiresAt: Date.now() + TTL_MS });
  }
}

const forwardCache = new LruCache<GeoLocation[]>();
const reverseCache = new LruCache<GeoLocation | null>();

function roundCoord(n: number): number {
  return Math.round(n * REVERSE_PRECISION) / REVERSE_PRECISION;
}

export function forwardKey(
  provider: string,
  query: string,
  locale: string,
  limit: number,
): string {
  return `${provider}:fwd:${locale}:${limit}:${query.trim().toLowerCase()}`;
}

export function reverseKey(
  provider: string,
  coord: GeoCoordinate,
  locale: string,
): string {
  return `${provider}:rev:${locale}:${roundCoord(coord.latitude)},${roundCoord(
    coord.longitude,
  )}`;
}

export function getForward(key: string): GeoLocation[] | undefined {
  return forwardCache.get(key);
}

export function setForward(key: string, value: GeoLocation[]): void {
  forwardCache.set(key, value);
}

export function getReverse(key: string): GeoLocation | null | undefined {
  return reverseCache.get(key);
}

export function setReverse(key: string, value: GeoLocation | null): void {
  reverseCache.set(key, value);
}
