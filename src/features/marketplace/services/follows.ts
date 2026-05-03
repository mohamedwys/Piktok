import { supabase } from '@/lib/supabase';
import { AuthRequiredError } from '@/features/marketplace/services/products';

// Postgres SQLSTATE for unique-violation. A duplicate (follower_id,
// following_id) row was inserted -> we treat re-follows as idempotent so the
// optimistic UI toggle in `useToggleFollow` stays consistent under double-tap
// or network retry. Mirrors the convention used by likeProduct /
// bookmarkProduct in `products.ts`.
const PG_UNIQUE_VIOLATION = '23505';

export type FollowerRow = {
  id: string;
  user_id: string | null;
  name: string;
  avatar_url: string;
  bio: string | null;
  verified: boolean;
  is_pro: boolean;
  followed_at: string;
};

type SellerJoin = {
  id: string;
  user_id: string | null;
  name: string;
  avatar_url: string;
  bio: string | null;
  verified: boolean;
  is_pro: boolean;
};

const SELLER_JOIN_COLUMNS = 'id, user_id, name, avatar_url, bio, verified, is_pro';

async function getMySellerIdOrCreate(): Promise<string> {
  const { data: u, error: userErr } = await supabase.auth.getUser();
  if (userErr || !u.user) throw new AuthRequiredError();

  const username = (u.user.user_metadata?.username as string | undefined)
    || u.user.email?.split('@')[0]
    || 'User';

  const { data, error } = await supabase.rpc(
    'get_or_create_seller_for_current_user',
    { p_username: username, p_avatar_url: '' },
  );
  if (error) throw error;
  return data as string;
}

export async function followSeller(followingId: string): Promise<void> {
  const followerId = await getMySellerIdOrCreate();
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });
  if (error && error.code !== PG_UNIQUE_VIOLATION) throw error;
}

export async function unfollowSeller(followingId: string): Promise<void> {
  const followerId = await getMySellerIdOrCreate();
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  if (error) throw error;
}

export type ListPageOpts = {
  limit?: number;
  offset?: number;
};

const DEFAULT_PAGE_SIZE = 20;

export async function listFollowers(
  sellerId: string,
  opts: ListPageOpts = {},
): Promise<FollowerRow[]> {
  const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
  const offset = opts.offset ?? 0;

  // Two FKs to `sellers` on `follows` (follower_id, following_id) so the
  // join must be disambiguated. PostgREST accepts either the FK constraint
  // name (`follows_follower_id_fkey`) or the column name (`follower_id`) as
  // the hint after `!`. The column-name form is more readable.
  const { data, error } = await supabase
    .from('follows')
    .select(`created_at, follower:sellers!follower_id(${SELLER_JOIN_COLUMNS})`)
    .eq('following_id', sellerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  type Row = { created_at: string; follower: SellerJoin };
  return (data as unknown as Row[]).map((row) => ({
    id: row.follower.id,
    user_id: row.follower.user_id,
    name: row.follower.name,
    avatar_url: row.follower.avatar_url,
    bio: row.follower.bio,
    verified: row.follower.verified,
    is_pro: row.follower.is_pro,
    followed_at: row.created_at,
  }));
}

export async function listFollowing(
  sellerId: string,
  opts: ListPageOpts = {},
): Promise<FollowerRow[]> {
  const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
  const offset = opts.offset ?? 0;

  const { data, error } = await supabase
    .from('follows')
    .select(`created_at, following:sellers!following_id(${SELLER_JOIN_COLUMNS})`)
    .eq('follower_id', sellerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  type Row = { created_at: string; following: SellerJoin };
  return (data as unknown as Row[]).map((row) => ({
    id: row.following.id,
    user_id: row.following.user_id,
    name: row.following.name,
    avatar_url: row.following.avatar_url,
    bio: row.following.bio,
    verified: row.following.verified,
    is_pro: row.following.is_pro,
    followed_at: row.created_at,
  }));
}
