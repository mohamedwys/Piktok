import type { PostgrestError } from '@supabase/supabase-js';
import { RateLimitError } from '@/features/marketplace/errors';

/**
 * Map known Postgres error shapes returned by Supabase to typed JS errors
 * so the global mutation onError handler (lib/queryClient.ts) can branch
 * on `instanceof` and surface the right localized copy.
 *
 * SQLSTATE 42501 is canonically "insufficient privilege". Phase 6's
 * `check_rate_limit` trigger raises 42501 with `hint = <bucket name>` on
 * overflow (e.g. likes_minute, messages_minute, conversations_minute).
 * Real RLS denials raise the same SQLSTATE but DO NOT set a hint — the
 * bucket presence is what disambiguates rate-limit overflows from RLS
 * rejections without relying on message-string parsing.
 *
 * Returns:
 *   - null when `error` is null (caller can ignore)
 *   - a typed Error subclass when the shape matches a known pattern
 *   - the original PostgrestError cast to Error otherwise (caller throws)
 *
 * Callers replace `if (error) throw error;` with:
 *   const e = translateSupabaseError(error); if (e) throw e;
 */
export function translateSupabaseError(
  error: PostgrestError | null,
): Error | null {
  if (!error) return null;
  if (error.code === '42501' && error.hint) {
    return new RateLimitError(error.hint);
  }
  return error as unknown as Error;
}
