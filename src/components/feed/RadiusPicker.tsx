import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chip } from '@/components/ui';
import { spacing } from '@/theme';
import {
  RADIUS_OPTIONS_KM,
  type RadiusKm,
} from '@/features/location/constants';

export type RadiusPickerProps = {
  value: RadiusKm;
  onChange: (km: RadiusKm) => void;
};

export function RadiusPicker({ value, onChange }: RadiusPickerProps) {
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
      }}
    >
      {RADIUS_OPTIONS_KM.map((km) => {
        const active = value === km;
        const label = km === null ? t('location.noLimit') : `${km} km`;
        const key = km === null ? 'no-limit' : String(km);
        return (
          <View key={key}>
            <Chip
              variant={active ? 'filled' : 'glass'}
              size="md"
              label={label}
              onPress={() => onChange(km)}
              accessibilityLabel={label}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

export default RadiusPicker;
