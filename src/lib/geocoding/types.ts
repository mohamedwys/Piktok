export type GeoCoordinate = {
  latitude: number;
  longitude: number;
};

export type GeoLocation = GeoCoordinate & {
  displayName: string;
  city?: string;
  country?: string;
  countryCode?: string;
  postcode?: string;
};

export type GeocodeOptions = {
  limit?: number;
  locale?: string;
};

export type ReverseGeocodeOptions = {
  locale?: string;
};

export interface GeocodingProvider {
  name: string;
  geocode(query: string, opts?: GeocodeOptions): Promise<GeoLocation[]>;
  reverseGeocode(
    coord: GeoCoordinate,
    opts?: ReverseGeocodeOptions,
  ): Promise<GeoLocation | null>;
}

export class GeocodingError extends Error {
  readonly provider: string;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(
    message: string,
    opts: { provider: string; status?: number; cause?: unknown },
  ) {
    super(message);
    this.name = 'GeocodingError';
    this.provider = opts.provider;
    this.status = opts.status;
    this.cause = opts.cause;
  }
}
