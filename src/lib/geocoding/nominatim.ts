import {
  GeocodingError,
  type GeoCoordinate,
  type GeoLocation,
  type GeocodeOptions,
  type GeocodingProvider,
  type ReverseGeocodeOptions,
} from './types';

const PROVIDER_NAME = 'nominatim';
const BASE_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'Pictok/1.0 (contact: support@pictok.app)';
const DEFAULT_LIMIT = 5;
const DEFAULT_LOCALE = 'en';

type NominatimAddress = {
  city?: unknown;
  town?: unknown;
  village?: unknown;
  country?: unknown;
  country_code?: unknown;
  postcode?: unknown;
};

type NominatimItem = {
  lat?: unknown;
  lon?: unknown;
  display_name?: unknown;
  address?: NominatimAddress;
};

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function parseCoord(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function mapItem(raw: NominatimItem): GeoLocation | null {
  const latitude = parseCoord(raw.lat);
  const longitude = parseCoord(raw.lon);
  if (latitude === null || longitude === null) return null;
  const displayName = asString(raw.display_name) ?? '';
  const addr = raw.address ?? {};
  const city =
    asString(addr.city) ?? asString(addr.town) ?? asString(addr.village);
  const country = asString(addr.country);
  const cc = asString(addr.country_code);
  return {
    latitude,
    longitude,
    displayName,
    city,
    country,
    countryCode: cc ? cc.toUpperCase() : undefined,
    postcode: asString(addr.postcode),
  };
}

async function fetchJson(url: string, locale: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': locale,
        Accept: 'application/json',
      },
    });
  } catch (err) {
    throw new GeocodingError('Network error contacting Nominatim', {
      provider: PROVIDER_NAME,
      cause: err,
    });
  }

  if (!response.ok) {
    throw new GeocodingError(
      `Nominatim responded with HTTP ${response.status}`,
      { provider: PROVIDER_NAME, status: response.status },
    );
  }

  try {
    return await response.json();
  } catch (err) {
    throw new GeocodingError('Malformed JSON from Nominatim', {
      provider: PROVIDER_NAME,
      status: response.status,
      cause: err,
    });
  }
}

async function geocode(
  query: string,
  opts?: GeocodeOptions,
): Promise<GeoLocation[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  const locale = opts?.locale ?? DEFAULT_LOCALE;
  const url =
    `${BASE_URL}/search?format=jsonv2` +
    `&q=${encodeURIComponent(trimmed)}` +
    `&addressdetails=1` +
    `&limit=${encodeURIComponent(String(limit))}` +
    `&accept-language=${encodeURIComponent(locale)}`;

  const raw = await fetchJson(url, locale);
  if (!Array.isArray(raw)) {
    throw new GeocodingError('Unexpected Nominatim response (not an array)', {
      provider: PROVIDER_NAME,
    });
  }
  const out: GeoLocation[] = [];
  for (const item of raw) {
    if (item && typeof item === 'object') {
      const mapped = mapItem(item as NominatimItem);
      if (mapped) out.push(mapped);
    }
  }
  return out;
}

async function reverseGeocode(
  coord: GeoCoordinate,
  opts?: ReverseGeocodeOptions,
): Promise<GeoLocation | null> {
  const locale = opts?.locale ?? DEFAULT_LOCALE;
  const url =
    `${BASE_URL}/reverse?format=jsonv2` +
    `&lat=${encodeURIComponent(String(coord.latitude))}` +
    `&lon=${encodeURIComponent(String(coord.longitude))}` +
    `&addressdetails=1` +
    `&accept-language=${encodeURIComponent(locale)}`;

  const raw = await fetchJson(url, locale);
  if (!raw || typeof raw !== 'object') return null;
  if ('error' in (raw as Record<string, unknown>)) return null;
  return mapItem(raw as NominatimItem);
}

export const nominatimProvider: GeocodingProvider = {
  name: PROVIDER_NAME,
  geocode,
  reverseGeocode,
};
