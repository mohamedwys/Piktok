import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import type { GeoCoordinate } from '@/lib/geocoding/types';

export type LocationPermissionStatus =
  | 'undetermined'
  | 'granted'
  | 'denied'
  | 'restricted';

export type DeviceLocationState = {
  status: LocationPermissionStatus;
  coords: GeoCoordinate | null;
  accuracyMeters: number | null;
  loading: boolean;
  error: string | null;
  request: () => Promise<LocationPermissionStatus>;
  refresh: () => Promise<GeoCoordinate | null>;
  openSettings: () => Promise<void>;
};

export type UseDeviceLocationOptions = {
  accuracy?: 'low' | 'balanced' | 'high';
};

const ACCURACY_MAP: Record<
  NonNullable<UseDeviceLocationOptions['accuracy']>,
  Location.Accuracy
> = {
  low: Location.Accuracy.Lowest,
  balanced: Location.Accuracy.Balanced,
  high: Location.Accuracy.High,
};

function mapStatus(
  resp: Location.LocationPermissionResponse,
  servicesEnabled: boolean,
): LocationPermissionStatus {
  if (resp.status === Location.PermissionStatus.GRANTED) return 'granted';
  if (resp.status === Location.PermissionStatus.UNDETERMINED) {
    return servicesEnabled ? 'undetermined' : 'restricted';
  }
  return 'denied';
}

export function useDeviceLocation(
  opts?: UseDeviceLocationOptions,
): DeviceLocationState {
  const accuracy = opts?.accuracy ?? 'balanced';
  const [status, setStatus] = useState<LocationPermissionStatus>('undetermined');
  const [coords, setCoords] = useState<GeoCoordinate | null>(null);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  const statusRef = useRef<LocationPermissionStatus>('undetermined');

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        const [resp, servicesEnabled] = await Promise.all([
          Location.getForegroundPermissionsAsync(),
          Location.hasServicesEnabledAsync().catch(() => true),
        ]);
        if (!mounted.current) return;
        const next = mapStatus(resp, servicesEnabled);
        statusRef.current = next;
        setStatus(next);
      } catch {
        if (!mounted.current) return;
        statusRef.current = 'undetermined';
        setStatus('undetermined');
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, []);

  const request = useCallback(async (): Promise<LocationPermissionStatus> => {
    let next: LocationPermissionStatus = 'undetermined';
    try {
      const [resp, servicesEnabled] = await Promise.all([
        Location.requestForegroundPermissionsAsync(),
        Location.hasServicesEnabledAsync().catch(() => true),
      ]);
      next = mapStatus(resp, servicesEnabled);
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : 'Permission request failed');
      }
      next = 'denied';
    }
    statusRef.current = next;
    if (mounted.current) setStatus(next);
    return next;
  }, []);

  const refresh = useCallback(async (): Promise<GeoCoordinate | null> => {
    if (statusRef.current !== 'granted') {
      if (mounted.current) {
        setError('Location permission not granted');
      }
      return null;
    }
    if (mounted.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: ACCURACY_MAP[accuracy],
      });
      const next: GeoCoordinate = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      if (mounted.current) {
        setCoords(next);
        setAccuracyMeters(
          typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null,
        );
      }
      return next;
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to read location');
      }
      return null;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [accuracy]);

  const openSettings = useCallback(async (): Promise<void> => {
    try {
      await Linking.openSettings();
    } catch {
      // No-op on platforms where Linking.openSettings is unsupported.
    }
  }, []);

  return {
    status,
    coords,
    accuracyMeters,
    loading,
    error,
    request,
    refresh,
    openSettings,
  };
}
