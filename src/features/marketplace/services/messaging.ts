import { supabase } from '@/lib/supabase';

export type ConversationOtherParty = {
  userId: string;
  name: string;
  avatarUrl: string;
  verified: boolean;
  isPro: boolean;
};

export type ConversationItem = {
  id: string;
  productId: string;
  product: {
    title: { fr: string; en: string };
    thumbnailUrl: string;
    price: number;
    currency: 'EUR' | 'USD' | 'GBP';
  } | null;
  otherParty: ConversationOtherParty;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  iAmBuyer: boolean;
};

export type MessageKind = 'text' | 'offer';

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  kind: MessageKind;
  offerAmount: number | null;
  createdAt: string;
};

type ConversationRow = {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_user_id: string;
  last_message_at: string;
  last_message_preview: string | null;
  created_at: string;
  product?: {
    title: { fr: string; en: string };
    media_url: string;
    thumbnail_url: string | null;
    price: number;
    currency: 'EUR' | 'USD' | 'GBP';
  };
};

type SellerLookup = {
  user_id: string;
  name: string;
  avatar_url: string;
  verified: boolean;
  is_pro: boolean;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  kind: MessageKind;
  offer_amount: number | null;
  created_at: string;
};

function rowToMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    kind: row.kind,
    offerAmount: row.offer_amount,
    createdAt: row.created_at,
  };
}

export async function listConversations(): Promise<ConversationItem[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const myId = u.user.id;

  const { data: rows, error } = await supabase
    .from('conversations')
    .select(`*, product:products(title, media_url, thumbnail_url, price, currency)`)
    .order('last_message_at', { ascending: false });
  if (error) throw error;

  const convs = (rows ?? []) as ConversationRow[];
  const otherIds = new Set<string>();
  for (const c of convs) {
    otherIds.add(c.buyer_id === myId ? c.seller_user_id : c.buyer_id);
  }

  const sellersByUser = new Map<string, SellerLookup>();
  if (otherIds.size > 0) {
    const { data: sellers } = await supabase
      .from('sellers')
      .select('user_id, name, avatar_url, verified, is_pro')
      .in('user_id', Array.from(otherIds));
    ((sellers as SellerLookup[] | null) ?? []).forEach((s) =>
      sellersByUser.set(s.user_id, s),
    );
  }

  return convs.map((c) => {
    const otherId = c.buyer_id === myId ? c.seller_user_id : c.buyer_id;
    const other = sellersByUser.get(otherId);
    return {
      id: c.id,
      productId: c.product_id,
      product: c.product
        ? {
            title: c.product.title,
            thumbnailUrl: c.product.thumbnail_url ?? c.product.media_url,
            price: Number(c.product.price),
            currency: c.product.currency,
          }
        : null,
      otherParty: {
        userId: otherId,
        name: other?.name ?? 'User',
        avatarUrl: other?.avatar_url ?? '',
        verified: other?.verified ?? false,
        isPro: other?.is_pro ?? false,
      },
      lastMessageAt: c.last_message_at,
      lastMessagePreview: c.last_message_preview,
      iAmBuyer: c.buyer_id === myId,
    };
  });
}

export async function getConversationById(id: string): Promise<ConversationItem | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const myId = u.user.id;

  const { data: row, error } = await supabase
    .from('conversations')
    .select(`*, product:products(title, media_url, thumbnail_url, price, currency)`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const c = row as ConversationRow;
  const otherId = c.buyer_id === myId ? c.seller_user_id : c.buyer_id;
  const { data: sellers } = await supabase
    .from('sellers')
    .select('user_id, name, avatar_url, verified, is_pro')
    .eq('user_id', otherId)
    .maybeSingle();
  const other = sellers as SellerLookup | null;
  return {
    id: c.id,
    productId: c.product_id,
    product: c.product
      ? {
          title: c.product.title,
          thumbnailUrl: c.product.thumbnail_url ?? c.product.media_url,
          price: Number(c.product.price),
          currency: c.product.currency,
        }
      : null,
    otherParty: {
      userId: otherId,
      name: other?.name ?? 'User',
      avatarUrl: other?.avatar_url ?? '',
      verified: other?.verified ?? false,
      isPro: other?.is_pro ?? false,
    },
    lastMessageAt: c.last_message_at,
    lastMessagePreview: c.last_message_preview,
    iAmBuyer: c.buyer_id === myId,
  };
}

export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as MessageRow[]).map(rowToMessage);
}

export async function sendMessage(input: {
  conversationId: string;
  body: string;
  kind?: MessageKind;
  offerAmount?: number;
}): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');
  const { error } = await supabase.from('messages').insert({
    conversation_id: input.conversationId,
    sender_id: u.user.id,
    body: input.body,
    kind: input.kind ?? 'text',
    offer_amount: input.kind === 'offer' ? input.offerAmount ?? null : null,
  });
  if (error) throw error;
}

export async function startOrGetConversation(productId: string): Promise<string> {
  // Ensure the current user has a seller row (so the other side can resolve their display info).
  const { data: u } = await supabase.auth.getUser();
  if (u.user) {
    const username =
      (u.user.user_metadata?.username as string | undefined) ||
      u.user.email?.split('@')[0] ||
      'User';
    await supabase.rpc('get_or_create_seller_for_current_user', {
      p_username: username,
      p_avatar_url: '',
    });
  }
  const { data, error } = await supabase.rpc('start_or_get_conversation', {
    p_product_id: productId,
  });
  if (error) throw error;
  return data as string;
}

export function subscribeToConversations(onChange: () => void) {
  const channel = supabase
    .channel('conversations:user')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'conversations' },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToMessages(
  conversationId: string,
  onInsert: (m: ChatMessage) => void,
) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onInsert(rowToMessage(payload.new as MessageRow)),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
