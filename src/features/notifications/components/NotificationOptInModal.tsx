import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, Surface, Text } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';
import { mmkvSync } from '@/shared/storage/mmkv';
import { requestAndRegisterPushPermission } from '@/hooks/usePushNotifications';

const DECLINED_KEY = 'notifications.optInDeclinedAt';
const RE_PROMPT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export type NotificationOptInModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function NotificationOptInModal({
  visible,
  onClose,
}: NotificationOptInModalProps): React.ReactElement {
  const { t } = useTranslation();

  const handleAllow = async (): Promise<void> => {
    onClose();
    try {
      await requestAndRegisterPushPermission();
    } catch {
      // Silent: the OS permission dialog is the user-visible signal.
    }
  };

  const handleLater = (): void => {
    mmkvSync.setString(DECLINED_KEY, String(Date.now()));
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleLater}
    >
      <View style={styles.backdrop}>
        <Surface
          variant="surfaceElevated"
          radius="xxl"
          padding="xl"
          style={styles.card}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="notifications" size={32} color={colors.brand} />
          </View>
          <Text variant="title" weight="semibold" style={styles.title}>
            {t('notifications.optInTitle')}
          </Text>
          <Text variant="body" color="secondary" style={styles.body}>
            {t('notifications.optInBody')}
          </Text>
          <View style={styles.actions}>
            <Pressable
              onPress={handleLater}
              haptic="light"
              style={styles.secondary}
            >
              <Text variant="body" weight="semibold" color="secondary">
                {t('notifications.optInLater')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void handleAllow()}
              haptic="medium"
              style={styles.primary}
            >
              <Text variant="body" weight="semibold" style={styles.primaryText}>
                {t('notifications.optInAllow')}
              </Text>
            </Pressable>
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

// True if the user dismissed the opt-in within the last 30 days.
export function isOptInRecentlyDeclined(): boolean {
  const raw = mmkvSync.getString(DECLINED_KEY);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at)) return false;
  return Date.now() - at < RE_PROMPT_COOLDOWN_MS;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,90,92,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    width: '100%',
  },
  secondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radii.pill,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  primary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
  },
  primaryText: {
    color: '#fff',
  },
});
