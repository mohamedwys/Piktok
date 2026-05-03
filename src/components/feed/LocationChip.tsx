import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Chip } from '@/components/ui';
import { colors } from '@/theme';
import { useUserLocation } from '@/features/location/stores/useUserLocation';
import type { RadiusKm } from '@/features/location/constants';

const MAX_LABEL_CHARS = 20;

function truncate(value: string, max = MAX_LABEL_CHARS): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

export type LocationChipProps = {
  onPress: () => void;
};

export function LocationChip({ onPress }: LocationChipProps) {
  const { t } = useTranslation();
  const latitude = useUserLocation((s) => s.latitude);
  const longitude = useUserLocation((s) => s.longitude);
  const city = useUserLocation((s) => s.city);
  const displayName = useUserLocation((s) => s.displayName);
  const radiusKm = useUserLocation((s) => s.radiusKm);

  const hasLocation = latitude !== null && longitude !== null;

  const formatRadius = (km: RadiusKm): string =>
    km === null ? t('location.noLimit') : `${km} km`;

  if (!hasLocation) {
    return (
      <Chip
        variant="glass"
        size="sm"
        leadingIcon={
          <Ionicons name="location-outline" size={12} color={colors.text.primary} />
        }
        label={t('location.setMyLocation')}
        onPress={onPress}
        accessibilityLabel={t('location.setMyLocation')}
      />
    );
  }

  const primary = city ?? displayName ?? '';
  const label = `${truncate(primary)} · ${formatRadius(radiusKm)}`;

  return (
    <Chip
      variant="glass"
      size="sm"
      leadingIcon={<Ionicons name="location" size={12} color={colors.brand} />}
      trailingIcon={
        <Ionicons name="chevron-down" size={12} color={colors.text.secondary} />
      }
      label={label}
      onPress={onPress}
      accessibilityLabel={label}
    />
  );
}

export default LocationChip;
