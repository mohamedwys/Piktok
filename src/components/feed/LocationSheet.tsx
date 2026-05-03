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
import { useLocationSheetStore } from '@/stores/useLocationSheetStore';
import { useUserLocation } from '@/features/location/stores/useUserLocation';
import { useLocationSession } from '@/features/location/stores/useLocationSession';
import {
  useDeviceLocation,
  type LocationPermissionStatus,
} from '@/hooks/useDeviceLocation';
import type { GeoLocation } from '@/lib/geocoding/types';
import type { RadiusKm } from '@/features/location/constants';
import CitySearchInput from './CitySearchInput';
import RadiusPicker from './RadiusPicker';

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

export default function LocationSheet() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isOpen = useLocationSheetStore((s) => s.isOpen);
  const close = useLocationSheetStore((s) => s.close);
  const dismissFirstLaunchPrompt = useLocationSession(
    (s) => s.dismissFirstLaunchPrompt,
  );

  const radiusKm = useUserLocation((s) => s.radiusKm);
  const setRadius = useUserLocation((s) => s.setRadius);
  const setLocationFromGeoLocation = useUserLocation(
    (s) => s.setLocationFromGeoLocation,
  );
  const setDeviceLocation = useUserLocation((s) => s.setDeviceLocation);

  const device = useDeviceLocation();

  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['80%'], []);

  useEffect(() => {
    if (isOpen) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [isOpen]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        dismissFirstLaunchPrompt();
        close();
      }
    },
    [close, dismissFirstLaunchPrompt],
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
    await setDeviceLocation(coords);
    close();
  }, [device, setDeviceLocation, close]);

  const handleSelectCity = useCallback(
    (loc: GeoLocation) => {
      setLocationFromGeoLocation(loc);
      close();
    },
    [setLocationFromGeoLocation, close],
  );

  const handleRadiusChange = useCallback(
    (km: RadiusKm) => {
      setRadius(km);
    },
    [setRadius],
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
            {t('location.title')}
          </Text>
          <Pressable
            onPress={() => {
              dismissFirstLaunchPrompt();
              close();
            }}
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

        <View style={styles.dividerSpacer} />

        <View style={{ gap: spacing.sm }}>
          <Text variant="label">{t('location.radius')}</Text>
          <View style={{ marginHorizontal: -spacing.lg }}>
            <RadiusPicker value={radiusKm} onChange={handleRadiusChange} />
          </View>
        </View>
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
  dividerSpacer: {
    height: spacing.sm,
  },
});
