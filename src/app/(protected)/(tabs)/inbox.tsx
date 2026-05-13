import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter, type Href } from 'expo-router';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  useConversations,
  type ConversationItem,
} from '@/features/marketplace';
import { getLocalized } from '@/i18n/getLocalized';
import { timeAgo } from '@/features/marketplace/utils/timeAgo';
import { lightHaptic } from '@/features/marketplace/utils/haptics';

export default function MessagesScreen(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const lang = i18n.language;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: conversations, isLoading } = useConversations(isAuthenticated);

  const onPressSignIn = (): void => {
    void lightHaptic();
    router.push('/(auth)/login');
  };

  const onPressItem = useCallback(
    (id: string) => {
      void lightHaptic();
      router.push(`/(protected)/conversation/${id}` as Href);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: ConversationItem }) => (
      <ConversationRow item={item} lang={lang} onPress={onPressItem} />
    ),
    [lang, onPressItem],
  );

  const headerPadding = { paddingTop: insets.top + 16 };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, headerPadding]}>
        <Text style={styles.title}>{t('messages.title')}</Text>
        <View style={styles.centerWrap}>
          <Ionicons
            name="chatbubbles-outline"
            size={48}
            color="rgba(255,255,255,0.25)"
          />
          <Text style={styles.empty}>{t('messages.signInPrompt')}</Text>
          <Pressable
            onPress={onPressSignIn}
            style={({ pressed }) => [
              styles.cta,
              pressed && styles.ctaPressed,
            ]}
          >
            <Text style={styles.ctaText}>{t('auth.signIn')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, headerPadding]}>
        <Text style={styles.title}>{t('messages.title')}</Text>
        <View style={styles.centerWrap}>
          <ActivityIndicator color="#fff" />
        </View>
      </View>
    );
  }

  const items = conversations ?? [];

  if (items.length === 0) {
    return (
      <View style={[styles.container, headerPadding]}>
        <Text style={styles.title}>{t('messages.title')}</Text>
        <View style={styles.centerWrap}>
          <Ionicons
            name="chatbubbles-outline"
            size={48}
            color="rgba(255,255,255,0.25)"
          />
          <Text style={styles.empty}>{t('messages.empty')}</Text>
          <Text style={styles.hint}>{t('messages.emptyHint')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, headerPadding]}>
      <Text style={styles.title}>{t('messages.title')}</Text>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

type ConversationRowProps = {
  item: ConversationItem;
  lang: string;
  onPress: (id: string) => void;
};

const ConversationRow = React.memo(function ConversationRow({
  item,
  lang,
  onPress,
}: ConversationRowProps): React.ReactElement {
  const productTitle = item.product
    ? getLocalized(item.product.title, lang)
    : '';

  return (
    <Pressable
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.thumb}>
        {item.product?.thumbnailUrl ? (
          <Image
            source={{ uri: item.product.thumbnailUrl }}
            style={styles.thumbImage}
            transition={120}
            cachePolicy="memory-disk"
          />
        ) : null}
      </View>
      <View style={styles.middle}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.otherParty.name}
          </Text>
          {item.otherParty.verified ? (
            <Ionicons
              name="checkmark-circle"
              size={12}
              color="#3b9eff"
              style={styles.verifiedIcon}
            />
          ) : null}
          {item.otherParty.isPro ? (
            <View style={styles.proPill}>
              <Text style={styles.proPillText}>PRO</Text>
            </View>
          ) : null}
        </View>
        {productTitle.length > 0 ? (
          <Text style={styles.productTitle} numberOfLines={1}>
            {productTitle}
          </Text>
        ) : null}
        <Text style={styles.preview} numberOfLines={1}>
          {item.lastMessagePreview ?? ''}
        </Text>
      </View>
      <Text style={styles.time}>{timeAgo(item.lastMessageAt, lang)}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
    paddingBottom: 80,
  },
  empty: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  hint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  cta: {
    marginTop: 8,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginLeft: 78,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
  },
  thumbImage: {
    width: 54,
    height: 54,
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  proPill: {
    marginLeft: 6,
    backgroundColor: '#7C5CFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  productTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  preview: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 2,
  },
  time: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
});
