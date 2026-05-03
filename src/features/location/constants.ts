export const RADIUS_OPTIONS_KM = [5, 10, 20, 50, 100, 500, 1000, null] as const;

export type RadiusKm = (typeof RADIUS_OPTIONS_KM)[number];

export const DEFAULT_RADIUS_KM: RadiusKm = 20;

export const USER_LOCATION_STORAGE_KEY = 'user-location-v1';
export const USER_LOCATION_STORE_VERSION = 1;
