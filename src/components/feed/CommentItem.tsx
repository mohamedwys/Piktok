import React from 'react';
import { Alert, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Avatar, Pressable, ProBadge, Text, VerifiedCheck } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { timeAgo } from '@/features/marketplace/utils/timeAgo';
import type { CommentWithAuthor } from '@/features/marketplace/services/comments';

export type CommentItemProps = {
  comment: CommentWithAuthor;
  isOwn: boolean;
  isPending?: boolean;
  onPressAuthor?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function CommentItem({
  comment,
  isOwn,
  isPending = false,
  onPressAuthor,
  onEdit,
  onDelete,
}: CommentItemProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const author = comment.author;

  const showActions = isOwn && !isPending && (onEdit || onDelete);

  const handleOwnActions = (): void => {
    Alert.alert(t('comments.actionsTitle'), undefined, [
      ...(onEdit
        ? [{ text: t('comments.actionEdit'), onPress: onEdit }]
        : []),
      ...(onDelete
        ? [
            {
              text: t('comments.actionDelete'),
              style: 'destructive' as const,
              onPress: onDelete,
            },
          ]
        : []),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        opacity: isPending ? 0.55 : 1,
      }}
    >
      <Pressable haptic="light" onPress={onPressAuthor} disabled={!onPressAuthor}>
        <Avatar
          source={author.avatar_url ? { uri: author.avatar_url } : undefined}
          name={author.name}
          size="sm"
        />
      </Pressable>

      <View style={{ flex: 1, gap: spacing.xs }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: spacing.xs,
          }}
        >
          <Text variant="body" weight="semibold">
            {author.name || t('comments.unknownAuthor')}
          </Text>
          {author.verified ? <VerifiedCheck size={12} /> : null}
          {author.is_pro ? <ProBadge size="sm" /> : null}
          <Text variant="caption" color="tertiary">
            · {timeAgo(comment.created_at, lang)}
          </Text>
          {comment.updated_at ? (
            <Text variant="caption" color="tertiary">
              · {t('comments.editedSuffix')}
            </Text>
          ) : null}
        </View>

        <Text variant="body" color={isPending ? 'tertiary' : 'primary'}>
          {comment.body}
        </Text>
      </View>

      {showActions ? (
        <Pressable
          haptic="light"
          onPress={handleOwnActions}
          hitSlop={spacing.sm}
          accessibilityLabel={t('comments.openActionsAriaLabel')}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={18}
            color={colors.text.tertiary}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

export default CommentItem;
