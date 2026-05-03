import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSeller } from '@/features/marketplace/hooks/useSeller';
import { useMySeller } from '@/features/marketplace/hooks/useMySeller';
import { useFollowing } from '@/features/marketplace/hooks/useFollowing';
import {
  FollowerListSkeletons,
  FollowerListEmpty,
} from '@/components/profile/FollowerListPrimitives';
import FollowerRow from '@/components/profile/FollowerRow';
import { Text } from '@/components/ui';
import { lightHaptic } from '@/features/marketplace/utils/haptics';
import { colors } from '@/theme';

export default function SellerFollowingScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sellerId = id ?? null;
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: seller } = useSeller(sellerId);
  const { data: mySeller } = useMySeller(isAuthenticated);
  const followingQuery = useFollowing(sellerId);

  const items = followingQuery.data?.pages.flatMap((page) => page) ?? [];

  const onPressBack = (): void => {
    void lightHaptic();
    router.back();
  };

  const onEndReached = (): void => {
    if (followingQuery.hasNextPage && !followingQuery.isFetchingNextPage) {
      void followingQuery.fetchNextPage();
    }
  };

  const headerTitle = seller?.name
    ? t('social.followingOfTitle', { name: seller.name })
    : t('social.followingTitle');

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.headerBar}>
        <Pressable
          onPress={onPressBack}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>
        <Text variant="title" weight="bold" style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FollowerRow
            seller={{
              id: item.id,
              name: item.name,
              avatar_url: item.avatar_url,
              bio: item.bio,
              verified: item.verified,
              is_pro: item.is_pro,
            }}
            showFollowButton={!mySeller || mySeller.id !== item.id}
          />
        )}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          followingQuery.isLoading ? (
            <FollowerListSkeletons count={6} />
          ) : (
            <FollowerListEmpty
              iconName="person-add-outline"
              title={t('social.noFollowingTitle')}
            />
          )
        }
        ListFooterComponent={
          followingQuery.isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.text.secondary} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={followingQuery.isRefetching && !followingQuery.isFetchingNextPage}
            onRefresh={() => {
              void followingQuery.refetch();
            }}
            tintColor={colors.text.secondary}
          />
        }
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, color: '#fff' },
  headerSpacer: { width: 40 },
  footerLoader: { paddingVertical: 16, alignItems: 'center' },
  emptyContainer: { flexGrow: 1 },
});
