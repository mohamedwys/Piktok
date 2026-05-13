import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { mmkvStorage } from '@shared/storage/mmkv';
import { geocodeAddress, reverseGeocode } from '@/lib/geocoding';
import type { GeoCoordinate, GeoLocation } from '@/lib/geocoding/types';
import {
  DEFAULT_RADIUS_KM,
  RADIUS_OPTIONS_KM,
  USER_LOCATION_STORAGE_KEY,
  USER_LOCATION_STORE_VERSION,
  type RadiusKm,
} from '../constants';

export type LocationSource = 'device' | 'manual' | null;

export type UserLocationData = {
  latitude: number | null;
  longitude: number | null;
  displayName: string | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  source: LocationSource;
  lastUpdatedAt: number | null;
  radiusKm: RadiusKm;
};

export type UserLocationActions = {
  setManualLocation: (query: string) => Promise<boolean>;
  setLocationFromGeoLocation: (loc: GeoLocation) => void;
  setDeviceLocation: (
    coord: GeoCoordinate,
    opts?: { displayName?: string },
  ) => Promise<void>;
  setRadius: (km: RadiusKm) => void;
  clear: () => void;
};

export type UserLocationStore = UserLocationData & UserLocationActions;

const INITIAL_DATA: UserLocationData = {
  latitude: null,
  longitude: null,
  displayName: null,
  city: null,
  country: null,
  countryCode: null,
  source: null,
  lastUpdatedAt: null,
  radiusKm: DEFAULT_RADIUS_KM,
};

function isValidRadius(km: unknown): km is RadiusKm {
  return (RADIUS_OPTIONS_KM as readonly (number | null)[]).includes(
    km as number | null,
  );
}

export const useUserLocation = create<UserLocationStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_DATA,

      setManualLocation: async (query) => {
        const trimmed = query.trim();
        if (trimmed.length === 0) {
          throw new Error('Empty location query');
        }
        const results = await geocodeAddress(trimmed, { limit: 1 });
        if (results.length === 0) return false;
        const r = results[0];
        if (!r) return false;
        set({
          latitude: r.latitude,
          longitude: r.longitude,
          displayName: r.displayName,
          city: r.city ?? null,
          country: r.country ?? null,
          countryCode: r.countryCode ?? null,
          source: 'manual',
          lastUpdatedAt: Date.now(),
        });
        return true;
      },

      setLocationFromGeoLocation: (loc) => {
        set({
          latitude: loc.latitude,
          longitude: loc.longitude,
          displayName: loc.displayName,
          city: loc.city ?? null,
          country: loc.country ?? null,
          countryCode: loc.countryCode ?? null,
          source: 'manual',
          lastUpdatedAt: Date.now(),
        });
      },

      setDeviceLocation: async (coord, opts) => {
        if (opts?.displayName !== undefined) {
          set({
            latitude: coord.latitude,
            longitude: coord.longitude,
            displayName: opts.displayName,
            city: null,
            country: null,
            countryCode: null,
            source: 'device',
            lastUpdatedAt: Date.now(),
          });
          return;
        }

        set({
          latitude: coord.latitude,
          longitude: coord.longitude,
          source: 'device',
          lastUpdatedAt: Date.now(),
        });

        try {
          const loc = await reverseGeocode(coord);
          if (!loc) return;
          const current = get();
          if (
            current.latitude !== coord.latitude ||
            current.longitude !== coord.longitude
          ) {
            return;
          }
          set({
            displayName: loc.displayName,
            city: loc.city ?? null,
            country: loc.country ?? null,
            countryCode: loc.countryCode ?? null,
          });
        } catch {
          // Coords are still valid without a display name.
        }
      },

      setRadius: (km) => {
        if (!isValidRadius(km)) {
          throw new Error(`Invalid radius: ${km}`);
        }
        set({ radiusKm: km });
      },

      clear: () => set({ ...INITIAL_DATA }),
    }),
    {
      name: USER_LOCATION_STORAGE_KEY,
      version: USER_LOCATION_STORE_VERSION,
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        latitude: state.latitude,
        longitude: state.longitude,
        displayName: state.displayName,
        city: state.city,
        country: state.country,
        countryCode: state.countryCode,
        source: state.source,
        lastUpdatedAt: state.lastUpdatedAt,
        radiusKm: state.radiusKm,
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      migrate: (persistedState: any, _fromVersion: number) => {
        // No migrations needed at v1. Future schema changes land here.
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        // Defensive: corrupted/legacy radiusKm → fall back to default.
        if (state && !isValidRadius(state.radiusKm)) {
          state.radiusKm = DEFAULT_RADIUS_KM;
        }
      },
    },
  ),
);

export function useHasLocation(): boolean {
  return useUserLocation((s) => s.latitude !== null && s.longitude !== null);
}

export function useUserCoord(): GeoCoordinate | null {
  return useUserLocation(
    useShallow((s) =>
      s.latitude !== null && s.longitude !== null
        ? { latitude: s.latitude, longitude: s.longitude }
        : null,
    ),
  );
}
