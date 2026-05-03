import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable as RNPressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';

export type TypedConfirmModalProps = {
  visible: boolean;
  title: string;
  body: string;
  /** Phrase the user must type verbatim (case-insensitive). */
  expectedPhrase: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Cross-platform replacement for `Alert.prompt` (which is iOS-only). Single
 * TextInput inside a centered Modal; the confirm button stays disabled until
 * the input matches `expectedPhrase` (trimmed, case-insensitive). Used by
 * the delete-account flow where a typed phrase is the second confirmation
 * step.
 */
export function TypedConfirmModal({
  visible,
  title,
  body,
  expectedPhrase,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: TypedConfirmModalProps): React.ReactElement {
  const { t } = useTranslation();
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  const matches = text.trim().toUpperCase() === expectedPhrase.toUpperCase();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdropWrap}
      >
        <RNPressable
          accessibilityLabel={cancelLabel ?? t('common.cancel')}
          onPress={onCancel}
          style={styles.backdrop}
        />
        <View style={styles.card}>
          <Text variant="title" weight="semibold">
            {title}
          </Text>
          <Text variant="body" color="secondary">
            {body}
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={expectedPhrase}
            placeholderTextColor={colors.text.tertiary}
            style={styles.input}
          />
          <View style={styles.actions}>
            <Pressable
              haptic="light"
              onPress={onCancel}
              style={styles.cancelBtn}
            >
              <Text variant="body" weight="semibold">
                {cancelLabel ?? t('common.cancel')}
              </Text>
            </Pressable>
            <Pressable
              haptic="medium"
              disabled={!matches}
              onPress={onConfirm}
              style={[styles.confirmBtn, !matches && styles.confirmBtnDisabled]}
            >
              <Text
                variant="body"
                weight="semibold"
                style={{
                  color: matches
                    ? colors.text.primary
                    : colors.text.tertiary,
                }}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
    gap: spacing.md,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text.primary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  confirmBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.feedback.danger,
  },
  confirmBtnDisabled: {
    backgroundColor: colors.surfaceElevated,
  },
});

export default TypedConfirmModal;
