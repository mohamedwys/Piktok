-- =============================================================================
-- Migration: 20260502_engagement_triggers
-- Purpose:   Atomic synchronization of engagement counters on `products`.
--            Inserting / deleting rows in `likes` and `bookmarks` keeps
--            `products.likes_count` and `products.bookmarks_count` in step
--            without race conditions or trigger-less app-side increments.
--
-- Notes:
--   * `security definer` so the trigger can update `products` regardless of
--     the calling user's RLS policies (RLS still gates the insert/delete on
--     `likes` / `bookmarks` themselves).
--   * `greatest(... - 1, 0)` clamps the counter at zero in case a delete
--     ever races ahead of an insert.
-- =============================================================================

-- Trigger: keep products.likes_count in sync with likes table.
create or replace function public.on_like_change()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'INSERT') then
    update public.products
    set likes_count = likes_count + 1
    where id = NEW.product_id;
    return NEW;
  elsif (TG_OP = 'DELETE') then
    update public.products
    set likes_count = greatest(likes_count - 1, 0)
    where id = OLD.product_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists likes_count_sync on public.likes;
create trigger likes_count_sync
after insert or delete on public.likes
for each row execute function public.on_like_change();

-- Trigger: keep products.bookmarks_count in sync with bookmarks table.
create or replace function public.on_bookmark_change()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'INSERT') then
    update public.products
    set bookmarks_count = bookmarks_count + 1
    where id = NEW.product_id;
    return NEW;
  elsif (TG_OP = 'DELETE') then
    update public.products
    set bookmarks_count = greatest(bookmarks_count - 1, 0)
    where id = OLD.product_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists bookmarks_count_sync on public.bookmarks;
create trigger bookmarks_count_sync
after insert or delete on public.bookmarks
for each row execute function public.on_bookmark_change();
