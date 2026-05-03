import {
  forwardKey,
  getForward,
  getReverse,
  reverseKey,
  setForward,
  setReverse,
} from './cache';
import { nominatimProvider } from './nominatim';
import { throttled } from './throttle';
import type {
  GeoCoordinate,
  GeoLocation,
  GeocodeOptions,
  GeocodingProvider,
  ReverseGeocodeOptions,
} from './types';

export type {
  GeoCoordinate,
  GeoLocation,
  GeocodeOptions,
  GeocodingProvider,
  ReverseGeocodeOptions,
} from './types';
export { GeocodingError } from './types';

const DEFAULT_LIMIT = 5;
const DEFAULT_LOCALE = 'en';

function selectProvider(): GeocodingProvider {
  const name = process.env.EXPO_PUBLIC_GEOCODING_PROVIDER ?? 'nominatim';
  switch (name) {
    case 'nominatim':
      return nominatimProvider;
    default:
      return nominatimProvider;
  }
}

const provider = selectProvider();

export async function geocodeAddress(
  query: string,
  opts?: GeocodeOptions,
): Promise<GeoLocation[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  const locale = opts?.locale ?? DEFAULT_LOCALE;
  const key = forwardKey(provider.name, trimmed, locale, limit);

  const cached = getForward(key);
  if (cached) return cached;

  const result = await throttled(() =>
    provider.geocode(trimmed, { limit, locale }),
  );
  setForward(key, result);
  return result;
}

export async function reverseGeocode(
  coord: GeoCoordinate,
  opts?: ReverseGeocodeOptions,
): Promise<GeoLocation | null> {
  const locale = opts?.locale ?? DEFAULT_LOCALE;
  const key = reverseKey(provider.name, coord, locale);

  const cached = getReverse(key);
  if (cached !== undefined) return cached;

  const result = await throttled(() =>
    provider.reverseGeocode(coord, { locale }),
  );
  setReverse(key, result);
  return result;
}
