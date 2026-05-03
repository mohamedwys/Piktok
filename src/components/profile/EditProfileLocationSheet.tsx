import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, Text } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';
import { useEditProfileLocationSheetStore } from '@/stores/useEditProfileLocationSheetStore';
import {
  useDeviceLocation,
  type LocationPermissionStatus,
} from '@/hooks/useDeviceLocation';
import { reverseGeocode } from '@/lib/geocoding';
import type { GeoLocation } from '@/lib/geocoding/types';
import CitySearchInput from '@/components/feed/CitySearchInput';

const SHEET_BG = colors.surface;

function deviceLabelKey(status: LocationPermissionStatus): string {
  switch (status) {
    case 'granted':
      return 'location.useMyLocation';
    case 'denied':
      return 'location.allowInSettings';
    case 'restricted':
      return 'location.geolocationUnavailable';
    case 'undetermined':
    default:
      return 'location.enableGeolocation';
  }
}

export type EditProfileLocationSheetProps = {
  onSelect: (loc: GeoLocation) => void;
};

export default function EditProfileLocationSheet({
  onSelect,
}: EditProfileLocationSheetProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isOpen = useEditProfileLocationSheetStore((s) => s.isOpen);
  const close = useEditProfileLocationSheetStore((s) => s.close);

  const device = useDeviceLocation();

  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['65%'], []);

  useEffect(() => {
    if (isOpen) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [isOpen]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) close();
    },
    [close],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.6}
      />
    ),
    [],
  );

  const handleUseDeviceLocation = useCallback(async () => {
    if (device.status === 'denied' || device.status === 'restricted') {
      await device.openSettings();
      return;
    }
    let status: LocationPermissionStatus = device.status;
    if (status === 'undetermined') {
      status = await device.request();
    }
    if (status !== 'granted') return;
    const coords = await device.refresh();
    if (!coords) return;

    let displayName = '';
    try {
      const reversed = await reverseGeocode(coords, {
        locale: i18n.language || 'en',
      });
      if (reversed) displayName = reversed.displayName;
    } catch {
      // Fall through to a coords-only display name.
    }
    if (!displayName) {
      displayName = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
    }

    const loc: GeoLocation = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      displayName,
    };
    onSelect(loc);
    close();
  }, [device, onSelect, close, i18n.language]);

  const handleSelectCity = useCallback(
    (loc: GeoLocation) => {
      onSelect(loc);
      close();
    },
    [onSelect, close],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      topInset={insets.top}
    >
      <BottomSheetScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: spacing.xxl + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Text variant="title" weight="semibold">
            {t('profile.locationSheetTitle')}
          </Text>
          <Pressable
            onPress={close}
            haptic="light"
            hitSlop={spacing.sm}
            accessibilityLabel={t('common.cancel')}
          >
            <Ionicons name="close" size={22} color={colors.text.secondary} />
          </Pressable>
        </View>

        <Pressable
          haptic="medium"
          onPress={handleUseDeviceLocation}
          style={styles.deviceButton}
          accessibilityLabel={t(deviceLabelKey(device.status))}
        >
          <Ionicons name="navigate" size={20} color={colors.brand} />
          <Text variant="body" weight="semibold" style={{ flex: 1 }}>
            {t(deviceLabelKey(device.status))}
          </Text>
          {device.loading ? (
            <Text variant="caption" color="tertiary">
              {t('common.loading')}
            </Text>
          ) : null}
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text variant="caption" color="tertiary">
            {t('location.or')}
          </Text>
          <View style={styles.dividerLine} />
        </View>

        <CitySearchInput onSelect={handleSelectCity} />
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
  },
  handleIndicator: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
