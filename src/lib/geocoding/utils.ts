import { geocodeAddress } from './index';

/**
 * Best-effort forward geocoding for submit handlers.
 *
 * Returns the first match's coordinates, or `null` for empty input,
 * empty results, or any transport / parse failure. Never throws —
 * callers can use the result to set lat/lng on a row without their
 * insert / update path depending on geocoding success.
 *
 * Used by Phase G.8's sell-flow submit handler.
 */
export async function geocodeForSubmit(
  text: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  try {
    const results = await geocodeAddress(trimmed, { limit: 1 });
    const first = results[0];
    if (!first) return null;
    return { latitude: first.latitude, longitude: first.longitude };
  } catch {
    return null;
  }
}
