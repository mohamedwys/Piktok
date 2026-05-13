import { supabase } from '@/lib/supabase';
import { AuthRequiredError } from '@/features/marketplace/services/products';
import { translateSupabaseError } from '@/lib/supabaseErrors';
import type { Database } from '@/types/supabase';

// =============================================================================
// Types
// =============================================================================

export type CommentRow = Database['public']['Tables']['comments']['Row'];

export type CommentAuthor = {
  id: string;
  name: string;
  avatar_url: string;
  verified: boolean;
  is_pro: boolean;
};

export type CommentWithAuthor = CommentRow & {
  author: CommentAuthor;
};

export type CommentPage = {
  items: CommentWithAuthor[];
  // null when fewer than `limit` rows came back, signalling no more pages.
  // useInfiniteQuery's getNextPageParam maps null → undefined to stop.
  nextCursor: string | null;
};

const SELECT_WITH_AUTHOR =
  'id, product_id, author_id, body, created_at, updated_at, ' +
  'author:sellers!author_id(id, name, avatar_url, verified, is_pro)';

// PostgREST returns embedded many-to-one as an object, but the generated
// TS type (`CommentRow & { author: CommentAuthor }`) needs an `as unknown`
// cast because the SDK's select-string parser cannot infer the join shape.
// Same documented escape hatch as `listFollowers` / `listFollowing` in
// services/follows.ts and `RpcProductRow` in products.ts.

const DEFAULT_PAGE_SIZE = 20;

// =============================================================================
// Helpers
// =============================================================================

// Resolve (or lazily create) the seller row for the calling auth user.
// Mirrors `services/follows.ts:getMySellerIdOrCreate` — same RPC, same
// fallback username derivation. Comments need this because `author_id`
// references `public.sellers(id)`, not `auth.users(id)`.
async function getMySellerIdOrCreate(): Promise<string> {
  const { data: u, error: userErr } = await supabase.auth.getUser();
  if (userErr || !u.user) throw new AuthRequiredError();

  const username =
    (u.user.user_metadata?.username as string | undefined) ||
    u.user.email?.split('@')[0] ||
    'User';

  const { data, error } = await supabase.rpc(
    'get_or_create_seller_for_current_user',
    { p_username: username, p_avatar_url: '' },
  );
  if (error) throw error;
  return data as string;
}

// =============================================================================
// Public API
// =============================================================================

export async function listComments(
  productId: string,
  opts: { cursor?: string; limit?: number } = {},
): Promise<CommentPage> {
  const limit = opts.limit ?? DEFAULT_PAGE_SIZE;

  let query = supabase
    .from('comments')
    .select(SELECT_WITH_AUTHOR)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);

  // Cursor is the `created_at` of the oldest row in the previous page.
  // Strict `lt` paginates without overlap because (product_id, created_at)
  // is the index and created_at is timestamptz with microsecond resolution.
  if (opts.cursor !== undefined) {
    query = query.lt('created_at', opts.cursor);
  }

  const { data, error } = await query;
  if (error) throw error;

  const items = (data as unknown as CommentWithAuthor[]) ?? [];
  const nextCursor =
    items.length === limit ? items[items.length - 1].created_at : null;

  return { items, nextCursor };
}

export async function postComment(input: {
  productId: string;
  body: string;
}): Promise<CommentWithAuthor> {
  const sellerId = await getMySellerIdOrCreate();

  const { data, error } = await supabase
    .from('comments')
    .insert({
      product_id: input.productId,
      author_id: sellerId,
      body: input.body.trim(),
    })
    .select(SELECT_WITH_AUTHOR)
    .single();
  const e = translateSupabaseError(error);
  if (e) throw e;

  return data as unknown as CommentWithAuthor;
}

export async function deleteComment(commentId: string): Promise<void> {
  // RLS gates ownership (`comments self delete` policy from D.2).
  // The AFTER DELETE trigger handles `products.comments_count` decrement.
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId);
  if (error) throw error;
}

export async function getCommentWithAuthor(
  commentId: string,
): Promise<CommentWithAuthor | null> {
  // Used by D.5's realtime hook to enrich INSERT payloads with the author
  // join (postgres_changes events carry only the raw row, never embedded
  // selects). Same `as unknown as ...` cast as listComments / postComment.
  const { data, error } = await supabase
    .from('comments')
    .select(SELECT_WITH_AUTHOR)
    .eq('id', commentId)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as unknown as CommentWithAuthor) : null;
}

export type CommentRealtimeHandlers = {
  onInsert?: (row: CommentRow) => void;
  onUpdate?: (row: CommentRow) => void;
  onDelete?: (oldRow: { id: string }) => void;
};

// Subscribes to postgres_changes on public.comments filtered by product_id.
// Returns an unsubscribe function. Mirrors the cleanup idiom used by
// `subscribeToMessages` / `subscribeToConversations` in services/messaging.ts
// (lines 233-272) — callers receive `() => void`, not the RealtimeChannel
// itself, to keep cleanup invocation uniform across the codebase.
export function subscribeToProductComments(
  productId: string,
  handlers: CommentRealtimeHandlers,
): () => void {
  const filter = `product_id=eq.${productId}`;
  const channel = supabase
    .channel(`comments:${productId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'comments', filter },
      (payload) => handlers.onInsert?.(payload.new as CommentRow),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'comments', filter },
      (payload) => handlers.onUpdate?.(payload.new as CommentRow),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'comments', filter },
      (payload) => handlers.onDelete?.(payload.old as { id: string }),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function editComment(input: {
  commentId: string;
  body: string;
}): Promise<CommentWithAuthor> {
  // `updated_at` is set server-side by D.2's BEFORE UPDATE OF body trigger
  // (`comments_touch_updated_at_trigger`), so the patch only carries `body`.
  // Column-level UPDATE grant from D.2 covers (body, updated_at) — the
  // trigger writing `updated_at` does not need DEFINER privileges.
  const { data, error } = await supabase
    .from('comments')
    .update({ body: input.body.trim() })
    .eq('id', input.commentId)
    .select(SELECT_WITH_AUTHOR)
    .single();
  if (error) throw error;

  return data as unknown as CommentWithAuthor;
}
