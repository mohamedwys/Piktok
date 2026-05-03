import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetFooter,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, Text } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';
import { useCommentsSheetStore } from '@/stores/useCommentsSheetStore';
import { useRequireAuth } from '@/stores/useRequireAuth';
import { useComments } from '@/features/marketplace/hooks/useComments';
import { useCommentsRealtime } from '@/features/marketplace/hooks/useCommentsRealtime';
import { usePostComment } from '@/features/marketplace/hooks/usePostComment';
import { useEditComment } from '@/features/marketplace/hooks/useEditComment';
import { useDeleteComment } from '@/features/marketplace/hooks/useDeleteComment';
import { useMySeller } from '@/features/marketplace/hooks/useMySeller';
import { useProduct } from '@/features/marketplace/hooks/useProduct';
import { formatCount } from '@/features/marketplace/utils/formatCount';
import type { CommentWithAuthor } from '@/features/marketplace/services/comments';
import CommentItem from './CommentItem';
import CommentInput from './CommentInput';

const SHEET_BG = colors.surface;
const SNAP_POINTS: (string | number)[] = ['90%'];
const MAX_BODY_LENGTH = 1000;

export default function CommentsSheet(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);

  const isOpen = useCommentsSheetStore((s) => s.isOpen);
  const productId = useCommentsSheetStore((s) => s.productId);
  const close = useCommentsSheetStore((s) => s.close);

  const safeProductId = productId ?? '';
  const product = useProduct(productId);
  const commentsQuery = useComments(safeProductId);
  // Realtime subscription is a no-op when productId is null (sheet closed
  // or transitioning between products). Cleans up + re-subscribes on
  // productId change via the hook's useEffect deps.
  useCommentsRealtime(productId);
  const postComment = usePostComment(safeProductId);
  const editComment = useEditComment(safeProductId);
  const deleteComment = useDeleteComment(safeProductId);
  const { data: mySeller } = useMySeller(true);
  const { requireAuth } = useRequireAuth();

  const [bodyDraft, setBodyDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const snapPoints = useMemo(() => SNAP_POINTS, []);

  // Drive the imperative sheet ref from the store. Mirrors LocationSheet.
  useEffect(() => {
    if (isOpen) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [isOpen]);

  // Reset compose / edit state when the sheet closes or switches product.
  useEffect(() => {
    if (!isOpen) {
      setBodyDraft('');
      setEditingId(null);
    }
  }, [isOpen, productId]);

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

  const flatItems: CommentWithAuthor[] = useMemo(() => {
    const pages = commentsQuery.data?.pages ?? [];
    return pages.flatMap((page) => page.items);
  }, [commentsQuery.data]);

  const commentsCount = product.data?.engagement.comments ?? 0;

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------
  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setBodyDraft('');
  }, []);

  const handleSubmit = useCallback(() => {
    if (!requireAuth()) return;
    const trimmed = bodyDraft.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_BODY_LENGTH) return;
    if (!productId) return;

    if (editingId) {
      editComment.mutate(
        { commentId: editingId, body: trimmed },
        {
          onSuccess: () => {
            setBodyDraft('');
            setEditingId(null);
          },
          onError: (err) => {
            Alert.alert(t('common.errorGeneric'), err.message);
          },
        },
      );
    } else {
      postComment.mutate(
        { body: trimmed },
        {
          onSuccess: () => setBodyDraft(''),
          onError: (err) => {
            Alert.alert(t('common.errorGeneric'), err.message);
          },
        },
      );
    }
  }, [
    bodyDraft,
    editingId,
    editComment,
    postComment,
    productId,
    requireAuth,
    t,
  ]);

  const startEdit = useCallback((comment: CommentWithAuthor) => {
    setEditingId(comment.id);
    setBodyDraft(comment.body);
  }, []);

  const handleDelete = useCallback(
    (comment: CommentWithAuthor) => {
      Alert.alert(
        t('comments.deleteConfirmTitle'),
        t('comments.deleteConfirmBody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('comments.deleteConfirmAction'),
            style: 'destructive',
            onPress: () => {
              if (editingId === comment.id) cancelEdit();
              deleteComment.mutate(
                { commentId: comment.id },
                {
                  onError: (err) => {
                    Alert.alert(t('common.errorGeneric'), err.message);
                  },
                },
              );
            },
          },
        ],
      );
    },
    [cancelEdit, deleteComment, editingId, t],
  );

  const navigateToSeller = useCallback(
    (sellerId: string) => {
      if (!sellerId) return;
      close();
      router.push(`/(protected)/seller/${sellerId}` as Href);
    },
    [close, router],
  );

  const onEndReached = useCallback(() => {
    if (
      commentsQuery.hasNextPage &&
      !commentsQuery.isFetchingNextPage &&
      !commentsQuery.isLoading
    ) {
      void commentsQuery.fetchNextPage();
    }
  }, [commentsQuery]);

  // -----------------------------------------------------------------------
  // Renderers
  // -----------------------------------------------------------------------
  const renderItem = useCallback(
    ({ item }: { item: CommentWithAuthor }) => {
      const isOwn =
        mySeller !== null &&
        mySeller !== undefined &&
        item.author_id === mySeller.id;
      const isPending = item.id.startsWith('temp-');
      return (
        <CommentItem
          comment={item}
          isOwn={isOwn}
          isPending={isPending}
          onPressAuthor={() => navigateToSeller(item.author_id)}
          onEdit={isOwn && !isPending ? () => startEdit(item) : undefined}
          onDelete={isOwn && !isPending ? () => handleDelete(item) : undefined}
        />
      );
    },
    [handleDelete, mySeller, navigateToSeller, startEdit],
  );

  const renderEmpty = useCallback(() => {
    if (commentsQuery.isLoading) {
      return <CommentsSkeletons count={5} />;
    }
    return <CommentsEmpty />;
  }, [commentsQuery.isLoading]);

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={insets.bottom}>
        <CommentInput
          value={bodyDraft}
          onChangeText={setBodyDraft}
          onSubmit={handleSubmit}
          submitting={postComment.isPending || editComment.isPending}
          mode={editingId ? 'edit' : 'create'}
          onCancelEdit={cancelEdit}
          maxLength={MAX_BODY_LENGTH}
        />
      </BottomSheetFooter>
    ),
    [
      bodyDraft,
      cancelEdit,
      editComment.isPending,
      editingId,
      handleSubmit,
      insets.bottom,
      postComment.isPending,
    ],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      footerComponent={renderFooter}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      topInset={insets.top}
    >
      <View style={styles.headerRow}>
        <Text variant="title" weight="semibold">
          {commentsCount > 0
            ? `${t('comments.title')} · ${formatCount(commentsCount)}`
            : t('comments.title')}
        </Text>
        <Pressable
          haptic="light"
          onPress={close}
          hitSlop={spacing.sm}
          accessibilityLabel={t('common.cancel')}
        >
          <Ionicons name="close" size={22} color={colors.text.secondary} />
        </Pressable>
      </View>

      <BottomSheetFlatList
        data={flatItems}
        keyExtractor={(c) => c.id}
        renderItem={renderItem}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          commentsQuery.isFetchingNextPage ? (
            <View style={{ paddingVertical: spacing.md }}>
              <ActivityIndicator size="small" color={colors.text.secondary} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={commentsQuery.isRefetching && !commentsQuery.isLoading}
            onRefresh={() => {
              void commentsQuery.refetch();
            }}
            tintColor={colors.text.secondary}
          />
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: spacing.sm,
          paddingBottom: 140 + insets.bottom,
          flexGrow: 1,
        }}
      />
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------
// Inline subcomponents (kept local — no reuse outside this sheet)
// ---------------------------------------------------------------------------

function CommentsSkeletons({ count }: { count: number }): React.ReactElement {
  return (
    <View style={{ paddingTop: spacing.sm }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            opacity: 0.4,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.surfaceElevated,
            }}
          />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <View
              style={{
                height: 12,
                width: '40%',
                backgroundColor: colors.surfaceElevated,
                borderRadius: radii.xs,
              }}
            />
            <View
              style={{
                height: 12,
                width: '90%',
                backgroundColor: colors.surfaceElevated,
                borderRadius: radii.xs,
              }}
            />
            <View
              style={{
                height: 12,
                width: '60%',
                backgroundColor: colors.surfaceElevated,
                borderRadius: radii.xs,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function CommentsEmpty(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.huge,
        gap: spacing.md,
      }}
    >
      <Ionicons
        name="chatbubble-outline"
        size={36}
        color={colors.text.tertiary}
      />
      <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
        {t('comments.emptyTitle')}
      </Text>
    </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
