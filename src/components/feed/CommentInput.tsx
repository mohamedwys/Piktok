import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

export type CommentInputProps = {
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  mode?: 'create' | 'edit';
  onCancelEdit?: () => void;
  maxLength?: number;
  placeholder?: string;
  autoFocus?: boolean;
};

const DEFAULT_MAX = 1000;
const COUNTER_THRESHOLD = 0.8;

export function CommentInput({
  value,
  onChangeText,
  onSubmit,
  submitting = false,
  mode = 'create',
  onCancelEdit,
  maxLength = DEFAULT_MAX,
  placeholder,
  autoFocus = false,
}: CommentInputProps): React.ReactElement {
  const { t } = useTranslation();
  const trimmedLen = value.trim().length;
  const canSubmit = !submitting && trimmedLen > 0 && trimmedLen <= maxLength;
  const showCounter = value.length > maxLength * COUNTER_THRESHOLD;

  return (
    <View
      style={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      {mode === 'edit' ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: spacing.xs,
          }}
        >
          <Text
            variant="caption"
            color="primary"
            style={{ color: colors.brand }}
          >
            {t('comments.editingIndicator')}
          </Text>
          <Pressable haptic="light" onPress={onCancelEdit} hitSlop={spacing.sm}>
            <Text
              variant="caption"
              color="primary"
              style={{ color: colors.brand }}
            >
              {t('common.cancel')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: spacing.sm,
        }}
      >
        <BottomSheetTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? t('comments.inputPlaceholder')}
          placeholderTextColor={colors.text.tertiary}
          multiline
          maxLength={maxLength}
          autoFocus={autoFocus}
          textAlignVertical="center"
          style={{
            flex: 1,
            minHeight: 40,
            maxHeight: 120,
            backgroundColor: colors.surfaceElevated,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.lg,
            color: colors.text.primary,
            fontFamily: typography.family.sans,
            fontSize: typography.size.md,
          }}
        />

        <Pressable
          haptic="light"
          onPress={onSubmit}
          disabled={!canSubmit}
          accessibilityLabel={
            mode === 'edit'
              ? t('comments.submitEditAriaLabel')
              : t('comments.submitCreateAriaLabel')
          }
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: canSubmit
                ? colors.brand
                : colors.surfaceElevated,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.brandText} />
            ) : (
              <Ionicons
                name={mode === 'edit' ? 'checkmark' : 'arrow-up'}
                size={18}
                color={canSubmit ? colors.brandText : colors.text.tertiary}
              />
            )}
          </View>
        </Pressable>
      </View>

      {showCounter ? (
        <Text
          variant="caption"
          color="tertiary"
          style={{ alignSelf: 'flex-end', marginTop: spacing.xs }}
        >
          {value.length}/{maxLength}
        </Text>
      ) : null}
    </View>
  );
}

export default CommentInput;
