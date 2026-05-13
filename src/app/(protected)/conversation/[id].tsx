import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui';
import { useConversation } from '@/features/marketplace/hooks/useConversation';
import { useMessages } from '@/features/marketplace/hooks/useMessages';
import type { ChatMessage } from '@/features/marketplace/services/messaging';
import { useMySeller } from '@/features/marketplace/hooks/useMySeller';
import { useSendMessage } from '@/features/marketplace/hooks/useSendMessage';
import { getLocalized } from '@/i18n/getLocalized';
import {
  lightHaptic,
  mediumHaptic,
} from '@/features/marketplace/utils/haptics';
import { useAuthStore } from '@/stores/useAuthStore';
import { colors } from '@/theme';

const BUBBLE_OTHER = 'rgba(255,255,255,0.08)';

export default function ConversationScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const myUserId = useAuthStore((s) => s.user?.id);
  const lang = i18n.language;

  const { data: conv, isLoading: loadingConv } = useConversation(id ?? null);
  const { data: messages, isLoading: loadingMsgs } = useMessages(id ?? null);
  const { data: mySeller } = useMySeller(!!myUserId);
  const sendMutation = useSendMessage(
    id ?? null,
    conv
      ? {
          recipientUserId: conv.otherParty.userId,
          senderName: mySeller?.name ?? 'New message',
        }
      : null,
  );

  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const onPressBack = (): void => {
    void lightHaptic();
    router.back();
  };

  const onPressSend = (): void => {
    const body = draft.trim();
    if (!body || !id) return;
    void mediumHaptic();
    sendMutation.mutate(
      { body },
      { onSuccess: () => setDraft('') },
    );
  };

  if (loadingConv) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top + 16 }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  if (!conv) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.errorText}>{t('chat.loadError')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onPressBack} hitSlop={12} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Avatar
            name={conv.otherParty.name}
            uri={conv.otherParty.avatarUrl}
            size={36}
          />
          <View style={{ flexShrink: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.headerName} numberOfLines={1}>
                {conv.otherParty.name}
              </Text>
              {conv.otherParty.verified ? (
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color="#3b9eff"
                  style={{ marginLeft: 4 }}
                />
              ) : null}
            </View>
            {conv.product ? (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {getLocalized(conv.product.title, lang)}
              </Text>
            ) : null}
          </View>
        </View>
        {conv.product ? (
          <Image
            source={{ uri: conv.product.thumbnailUrl }}
            style={styles.headerProduct}
            resizeMode="cover"
          />
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <FlatList
        ref={listRef}
        data={messages ?? []}
        keyExtractor={(m) => m.id}
        inverted={false}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: true })
        }
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        ListEmptyComponent={
          loadingMsgs ? (
            <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
          ) : null
        }
        renderItem={({ item }) => {
          const mine = item.senderId === myUserId;
          const isOffer = item.kind === 'offer';
          return (
            <View
              style={[
                styles.bubbleRow,
                { justifyContent: mine ? 'flex-end' : 'flex-start' },
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  mine ? styles.bubbleMine : styles.bubbleOther,
                  isOffer && styles.bubbleOffer,
                ]}
              >
                {isOffer ? (
                  <Text
                    style={[styles.offerLabel, mine && { color: '#fff' }]}
                  >
                    {t('chat.offerLabel')}
                  </Text>
                ) : null}
                <Text style={[styles.bubbleText, mine && { color: '#fff' }]}>
                  {isOffer && item.offerAmount !== null
                    ? new Intl.NumberFormat(
                        lang === 'fr' ? 'fr-FR' : 'en-US',
                        { style: 'currency', currency: 'EUR' },
                      ).format(item.offerAmount)
                    : item.body}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('chat.inputPlaceholder')}
          placeholderTextColor="rgba(255,255,255,0.4)"
          style={styles.input}
          multiline
        />
        <Pressable
          onPress={onPressSend}
          disabled={!draft.trim() || sendMutation.isPending}
          style={({ pressed }) => [
            styles.sendBtn,
            (!draft.trim() || sendMutation.isPending) && { opacity: 0.5 },
            pressed && { opacity: 0.7 },
          ]}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBack: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    marginTop: 1,
  },
  headerProduct: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#222',
  },
  bubbleRow: { flexDirection: 'row' },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  bubbleMine: { backgroundColor: colors.brand },
  bubbleOther: { backgroundColor: BUBBLE_OTHER },
  bubbleOffer: { borderWidth: 1, borderColor: 'rgba(255,200,61,0.6)' },
  offerLabel: {
    color: '#FFC83D',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  bubbleText: { color: '#fff', fontSize: 15, lineHeight: 20 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#0a0a0a',
  },
  input: {
    flex: 1,
    maxHeight: 110,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { color: '#fff', fontSize: 14 },
});
