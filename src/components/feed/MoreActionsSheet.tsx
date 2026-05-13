import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, Text } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';
import { useMoreActionsSheetStore } from '@/stores/useMoreActionsSheetStore';
import { useHideProduct } from '@/features/marketplace/hooks/useHideProduct';
import { toast } from '@/shared/ui/toast';

const SHEET_BG = colors.surface;
const SNAP_POINTS: (string | number)[] = ['35%'];

export default function MoreActionsSheet(): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);

  const isOpen = useMoreActionsSheetStore((s) => s.isOpen);
  const productId = useMoreActionsSheetStore((s) => s.productId);
  const close = useMoreActionsSheetStore((s) => s.close);
  const hideMutation = useHideProduct();

  const snapPoints = useMemo(() => SNAP_POINTS, []);

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

  const handleCopyLink = useCallback(async () => {
    if (!productId) {
      close();
      return;
    }
    const url = Linking.createURL(`product/${productId}`);
    try {
      await Clipboard.setStringAsync(url);
      Alert.alert(t('more.linkCopiedTitle'));
    } catch {
      Alert.alert(t('common.errorGeneric'));
    } finally {
      close();
    }
  }, [close, productId, t]);

  const handleReport = useCallback(() => {
    Alert.alert(t('common.comingSoonTitle'), t('common.comingSoonBody'));
    close();
  }, [close, t]);

  const handleHide = useCallback(() => {
    Alert.alert(t('common.comingSoonTitle'), t('common.comingSoonBody'));
    close();
  }, [close, t]);

  const handleNotInterested = useCallback(() => {
    if (!productId) {
      close();
      return;
    }
    hideMutation.mutate(
      { productId },
      {
        onSuccess: () => {
          toast.success(t('actions.notInterestedDone'));
        },
        onError: () => {
          toast.error(t('common.errorGeneric'));
        },
      },
    );
    close();
  }, [close, hideMutation, productId, t]);

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
      topInset={insets.top}
    >
      <View style={styles.header}>
        <Text variant="title" weight="semibold">
          {t('more.title')}
        </Text>
      </View>

      <View style={{ paddingBottom: insets.bottom + spacing.md }}>
        <Pressable
          haptic="light"
          onPress={handleNotInterested}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={t('actions.notInterested')}
        >
          <Ionicons
            name="thumbs-down-outline"
            size={20}
            color={colors.text.primary}
          />
          <Text variant="body">{t('actions.notInterested')}</Text>
        </Pressable>

        <Pressable
          haptic="light"
          onPress={() => {
            void handleCopyLink();
          }}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={t('more.copyLink')}
        >
          <Ionicons
            name="link-outline"
            size={20}
            color={colors.text.primary}
          />
          <Text variant="body">{t('more.copyLink')}</Text>
        </Pressable>

        <Pressable
          haptic="light"
          onPress={handleReport}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={t('more.report')}
        >
          <Ionicons
            name="flag-outline"
            size={20}
            color={colors.text.primary}
          />
          <Text variant="body">{t('more.report')}</Text>
        </Pressable>

        <Pressable
          haptic="light"
          onPress={handleHide}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={t('more.hide')}
        >
          <Ionicons
            name="eye-off-outline"
            size={20}
            color={colors.feedback.danger}
          />
          <Text variant="body" style={{ color: colors.feedback.danger }}>
            {t('more.hide')}
          </Text>
        </Pressable>
      </View>
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
    backgroundColor: colors.borderStrong,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
