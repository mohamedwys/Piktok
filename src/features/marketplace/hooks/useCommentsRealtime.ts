import { useEffect } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import {
  getCommentWithAuthor,
  subscribeToProductComments,
  type CommentPage,
  type CommentWithAuthor,
} from '@/features/marketplace/services/comments';
import { COMMENTS_QUERY_KEY } from './useComments';

// Side-effect hook. Subscribes to postgres_changes on `public.comments`
// filtered by product_id while the sheet is open, merging INSERT / UPDATE /
// DELETE events into the `['marketplace', 'comments', productId]` cache.
// Self-echoes from D.3's mutation hooks dedupe by id (the temp-id is already
// swapped to the server id by the time the realtime echo arrives).
//
// Mirrors the messaging realtime pattern at
// `services/messaging.ts:233-272` + `hooks/useMessages.ts:20-31` — same
// channel-name-as-filter idiom, same `() => void` cleanup contract.
export function useCommentsRealtime(productId: string | null): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!productId) return;

    const queryKey = COMMENTS_QUERY_KEY(productId);
    const productKey = ['marketplace', 'products', 'byId', productId];
    const listKey = ['marketplace', 'products', 'list'];

    type Cache = InfiniteData<CommentPage, string | undefined>;

    const hasComment = (cache: Cache | undefined, id: string): boolean =>
      cache?.pages.some((p) => p.items.some((c) => c.id === id)) ?? false;

    const unsubscribe = subscribeToProductComments(productId, {
      onInsert: async (row) => {
        // Self-echo / dup-event guard: every INSERT we already have in
        // cache is a no-op. Catches our own posts (server id was swapped
        // in by usePostComment.onSuccess) and repeat events from
        // reconnect-storms.
        if (hasComment(qc.getQueryData<Cache>(queryKey), row.id)) return;

        // Realtime payloads carry only the raw row — fetch the author
        // join via a one-row select. On transient failure, skip; the
        // next pull-to-refresh / refetch picks it up.
        let enriched: CommentWithAuthor | null = null;
        try {
          enriched = await getCommentWithAuthor(row.id);
        } catch {
          return;
        }
        if (!enriched) return;
        const enrichedRow = enriched;

        qc.setQueryData<Cache>(queryKey, (old) => {
          if (!old || old.pages.length === 0) {
            return {
              pages: [{ items: [enrichedRow], nextCursor: null }],
              pageParams: [undefined],
            };
          }
          // Re-check after the await — another echo or our own
          // mutation could have populated the row in the meantime.
          if (hasComment(old, enrichedRow.id)) return old;
          return {
            ...old,
            pages: old.pages.map((p, i) =>
              i === 0
                ? { ...p, items: [enrichedRow, ...p.items] }
                : p,
            ),
          };
        });

        // Action-rail counter is trigger-maintained server-side; refresh
        // the product cache so the badge re-reads it.
        qc.invalidateQueries({ queryKey: productKey });
        qc.invalidateQueries({ queryKey: listKey });
      },

      onUpdate: (row) => {
        // Idempotent body / updated_at patch. No author re-fetch — the
        // cached row already carries the join, and edits do not change
        // author identity.
        qc.setQueryData<Cache>(queryKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              items: p.items.map((c) =>
                c.id === row.id
                  ? { ...c, body: row.body, updated_at: row.updated_at }
                  : c,
              ),
            })),
          };
        });
      },

      onDelete: ({ id }) => {
        // Idempotent filter. If our own useDeleteComment already removed
        // the row, this no-ops.
        qc.setQueryData<Cache>(queryKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              items: p.items.filter((c) => c.id !== id),
            })),
          };
        });
        qc.invalidateQueries({ queryKey: productKey });
        qc.invalidateQueries({ queryKey: listKey });
      },
    });

    return unsubscribe;
  }, [productId, qc]);
}
