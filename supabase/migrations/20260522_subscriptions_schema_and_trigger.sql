-- =============================================================================
-- Migration: 20260522_subscriptions_schema_and_trigger
-- Purpose:   Database foundation for the Pro subscription system per
--            PRO_AUDIT.md §5 (Phase H.2). Adds:
--              1. `public.subscriptions` table mirroring Stripe's subscription
--                 model (one row per seller; the seller_id UNIQUE constraint
--                 enforces 1:1 — a seller cannot hold concurrent Pro subs).
--                 Status enum is the verbatim Stripe Subscription.status set,
--                 enforced by a CHECK constraint so deserialization stays a
--                 no-op against the webhook payload.
--              2. Two supplementary indexes:
--                   * `subscriptions_stripe_customer_id_idx` for webhook
--                     customer-side lookups (one Stripe customer can in
--                     principle map to multiple sellers if business logic
--                     ever splits — not unique, just indexed).
--                   * `subscriptions_status_idx` for admin-dashboard scans
--                     ("show all canceled subs", "list past_due", etc.).
--                 The seller_id and stripe_subscription_id columns are
--                 already UNIQUE so they index automatically — no extra
--                 indexes needed for those.
--              3. SECURITY DEFINER trigger function
--                 `handle_subscription_change()` that maintains the
--                 denormalized `sellers.is_pro` flag from subscription
--                 status changes. Mirrors C.2's `handle_follow_change()`
--                 (20260518_follows_schema_and_counters.sql lines 158-184)
--                 and D.2's `handle_comment_change()`
--                 (20260520_comments_schema.sql lines 190-210), with the
--                 same `set search_path = public, pg_catalog` hardening.
--                 Two triggers wire it:
--                   * `subscriptions_change_trigger`  BEFORE INSERT OR UPDATE
--                     — runs the is_pro sync AND bumps NEW.updated_at on
--                     UPDATE. BEFORE is required to modify NEW.
--                   * `subscriptions_delete_trigger`  AFTER DELETE
--                     — defensively flips is_pro = false. Subscriptions
--                     are normally soft-canceled (status='canceled'); a
--                     hard DELETE is rare but covered for completeness.
--                     AFTER (not BEFORE) because BEFORE DELETE triggers
--                     on the same row return OLD and the sellers update
--                     is the only side effect — order vs. the actual row
--                     removal does not matter.
--              4. RLS: SELECT to `authenticated` scoped to "my own seller's
--                 subscription" via the `sellers.user_id` ↔ `auth.uid()`
--                 mapping. NO insert / update / delete policies — webhooks
--                 write via `service_role` which bypasses RLS by design.
--              5. Table-level GRANT SELECT to `authenticated`. NO
--                 INSERT/UPDATE/DELETE grants — the JS client must never
--                 write to this table. Webhook-only via service_role.
--
-- Trigger SECURITY model — non-negotiable, identical to C.2 / D.2:
--   B.1.5 (20260515_tighten_sellers_update_grants.sql) revoked the table-wide
--   UPDATE grant on `sellers` and re-granted column-level UPDATE only on the
--   user-controlled allowlist:
--     name, avatar_url, bio, website, phone_public, email_public,
--     latitude, longitude, location_text, location_updated_at
--   `is_pro` is deliberately NOT in that allowlist (and stripe_* columns
--   neither). For the trigger below to UPDATE `sellers.is_pro` on every
--   subscription INSERT / UPDATE / DELETE, the function MUST be
--   SECURITY DEFINER (runs as the migration owner) AND must pin
--   `search_path` to defeat the classic SECURITY DEFINER hijack vector
--   (a malicious user creating a `public.sellers` shadow function in their
--   own schema and tricking the trigger into resolving it). Same pattern,
--   same justification, as the C.2 follows-counter and D.2 comments-counter
--   triggers.
--
-- is_pro v1 policy — strict:
--   `sellers.is_pro = true` ONLY when status IN ('active', 'trialing').
--   Every other status (`past_due`, `canceled`, `incomplete`,
--   `incomplete_expired`, `unpaid`, `paused`) flips the flag false.
--   This is intentionally strict: a `past_due` seller (Stripe is retrying
--   a failed payment) loses Pro until payment recovers. Acceptable for v1;
--   if support tickets show this is too aggressive (e.g., 24h grace period
--   needed during normal card-renewal failures), soften by extending the
--   `IN (...)` set or by introducing a grace_until column on subscriptions.
--   Not a v1 concern.
--
-- Account / Stripe deletion composition:
--   * `subscriptions.seller_id REFERENCES public.sellers(id) ON DELETE
--     CASCADE` → deleting a seller wipes their subscription row. The
--     AFTER DELETE branch fires and tries to flip is_pro on the
--     (already-deleting) seller row, which is a harmless no-op — the
--     row is going away in the same transaction.
--   * Account-deletion chain is now:
--       auth.users → sellers (CASCADE on user_id)
--                  → subscriptions (CASCADE on seller_id)  -- new
--     The B.4 `delete_my_account` RPC (20260517_delete_my_account_rpc.sql)
--     needs no edit — the existing `delete from auth.users` triggers the
--     entire chain.
--
-- Stripe-side cleanup is the webhook's job, not this trigger's. When a
-- seller deletes their account, the webhook will subsequently receive a
-- `customer.subscription.deleted` event from Stripe (because the webhook
-- handler should ALSO call `stripe.subscriptions.cancel()` for the
-- seller's sub during account deletion — H.13 territory). At which point
-- the subscription row is already gone (CASCADE happened first) and the
-- webhook upsert is a no-op against the missing FK. Acceptable.
--
-- RLS — own-subscription SELECT walk-through (proof-by-cases):
--   `auth.uid()` returns an `auth.users.id`, not a `sellers.id`. The
--   policy translates via the `sellers.user_id` 1:1 mapping. Three
--   scenarios:
--     (a) User A (sellers.id = a, auth.uid = uA) selects their own sub:
--           USING subquery resolves a.user_id = uA → matches auth.uid.
--           Policy passes. Row visible.
--     (b) User A tries to select user B's sub:
--           USING subquery resolves b.user_id ≠ uA. Policy denies.
--           PostgREST returns the row as not found.
--     (c) Anonymous user tries to SELECT:
--           No GRANT to anon, no policy for anon → cannot reach the table.
--           PostgREST returns 401 / empty.
--
-- Disallowed (out of scope for this migration):
--   * The dormant `sellers.stripe_account_id` / `stripe_charges_enabled` /
--     `stripe_payouts_enabled` columns (added by 20260511_seller_stripe.sql)
--     are NOT touched here. They remain reserved for a future Stripe
--     Connect onboarding flow (marketplace seller payouts), which is out
--     of Phase H scope per PRO_AUDIT.md §2.4.
--   * The optional `subscription_events` audit-trail table (PRO_AUDIT.md
--     §5.3) is NOT created. Deferred — adds complexity without v1 value.
--     Phase F or H.13 territory.
--   * No edits to B.1.5's column-level UPDATE grants on `sellers`. The
--     trigger's SECURITY DEFINER bypasses them by design.
--
-- Idempotent:    CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--                CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS +
--                CREATE TRIGGER, DROP POLICY IF EXISTS + CREATE POLICY.
--                Re-running this migration is a no-op against a database
--                where it has already been applied. The CREATE POLICY
--                form has no IF NOT EXISTS in the Postgres versions
--                Supabase ships, so the DROP-then-CREATE guard is
--                load-bearing.
-- Transactional: wrapped in BEGIN / COMMIT.
-- Reversibility: see ROLLBACK SQL block immediately below. Note: the
--                rollback does NOT restore is_pro for any seller whose
--                flag the trigger flipped during the time this migration
--                was applied. See the rollback block for the manual fix.
-- Type regen:    REQUIRED. This migration adds a new public-schema table
--                (`subscriptions`). The generated
--                `Database['public']['Tables']['subscriptions']` keys
--                appear only after `npm run gen:types` runs against an
--                environment where this migration is applied. H.3 (the
--                Pro state hook + listing-cap enforcement) depends on
--                the regenerated types.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   revoke select                                     on public.subscriptions from authenticated;
--   drop policy   if exists "subscriptions_self_select" on public.subscriptions;
--   drop trigger  if exists subscriptions_delete_trigger on public.subscriptions;
--   drop trigger  if exists subscriptions_change_trigger on public.subscriptions;
--   drop function if exists public.handle_subscription_change();
--   drop index    if exists public.subscriptions_status_idx;
--   drop index    if exists public.subscriptions_stripe_customer_id_idx;
--   drop table    if exists public.subscriptions;
-- commit;
--
-- After-rollback note (manual cleanup):
--   The rollback above does NOT restore `sellers.is_pro` for any seller
--   whose flag the trigger flipped while this migration was live. Once the
--   subscriptions table is gone, no future event can flip the flag, but
--   the existing values reflect the trigger's last decision. To wipe Pro
--   state cleanly post-rollback:
--     update public.sellers set is_pro = false where is_pro = true;
--   Then admins can manually re-flip whoever should legitimately be Pro
--   (which, before H.2 lands, is the seed sellers in the initial
--   migration only).
-- -----------------------------------------------------------------------------

begin;

-- -----------------------------------------------------------------------------
-- 1. subscriptions table.
--    `uuid_generate_v4()` matches the existing convention across this
--    repo's migrations (sellers/products/orders/conversations/messages/
--    push_tokens/comments all use it; uuid-ossp is enabled at
--    20260501_initial_marketplace_schema.sql:16). No need to enable
--    pgcrypto for gen_random_uuid().
--
--    `seller_id UNIQUE` enforces the 1:1 invariant — a seller cannot hold
--    two concurrent Pro subscriptions. The webhook upsert for
--    `customer.subscription.created` therefore needs to either ON CONFLICT
--    DO UPDATE or ensure prior subs are status='canceled' first
--    (H.12 implementation detail).
--
--    `seller_id REFERENCES public.sellers(id) ON DELETE CASCADE` so
--    account deletion (B.4 chain: auth.users → sellers → subscriptions)
--    cleans up automatically.
--
--    `stripe_subscription_id UNIQUE NOT NULL` makes webhook handlers
--    idempotent — repeat deliveries of the same event upsert the same
--    row.
--
--    `stripe_customer_id NOT NULL` because every subscription has a
--    customer in Stripe; we always have it at INSERT time (the webhook
--    payload includes it on `customer.subscription.created`).
--
--    `stripe_price_id NOT NULL` so we can tell monthly vs annual at a
--    glance without reading items. If the Pro tier ever supports
--    multiple line items per subscription, this becomes the "primary"
--    price reference; an items_jsonb column can be added later.
--
--    `current_period_start / current_period_end / trial_end` are
--    nullable because some statuses (incomplete, incomplete_expired)
--    arrive without those fields populated.
--
--    `cancel_at_period_end NOT NULL DEFAULT false` mirrors Stripe's
--    same-named field. UI displays "Plan canceled — access until
--    {current_period_end}" when this is true and status='active'.
--
--    `canceled_at` is the timestamp of cancellation (nullable, populated
--    on `customer.subscription.deleted` and on `cancel` mutations from
--    the Customer Portal that flip cancel_at_period_end).
--
--    `created_at NOT NULL DEFAULT now()` — when our row was inserted,
--    not necessarily when Stripe created the sub (those usually align
--    but the webhook can be delayed).
--
--    `updated_at` is nullable on INSERT and bumped to NOW() by the
--    BEFORE UPDATE branch of the trigger.
-- -----------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                       uuid        primary key default uuid_generate_v4(),
  seller_id                uuid        not null unique
                                       references public.sellers(id) on delete cascade,
  stripe_subscription_id   text        not null unique,
  stripe_customer_id       text        not null,
  stripe_price_id          text        not null,
  status                   text        not null,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean     not null default false,
  canceled_at              timestamptz,
  trial_end                timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz,
  constraint subscriptions_status_valid
    check (status in (
      'active',
      'trialing',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid',
      'paused'
    ))
);

-- -----------------------------------------------------------------------------
-- 2. Indexes.
--    seller_id and stripe_subscription_id are already UNIQUE (declared
--    inline in the table) so they have implicit btree indexes — no
--    extra DDL needed for those access patterns.
--
--    `stripe_customer_id` index supports webhook customer-side lookups.
--    Not unique (one Stripe customer could theoretically be associated
--    with multiple sellers if business logic ever splits, e.g., a user
--    managing two storefronts under one billing entity — not a v1
--    feature, but the index leaves the door open).
--
--    `status` index supports admin-dashboard scans ("list all past_due",
--    "count active", etc.) at H.11 time.
-- -----------------------------------------------------------------------------
create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id);

create index if not exists subscriptions_status_idx
  on public.subscriptions (status);

-- -----------------------------------------------------------------------------
-- 3. is_pro sync trigger function.
--    SECURITY DEFINER runs as the migration owner (typically `postgres`),
--    bypassing the column-level UPDATE grant on sellers from B.1.5
--    (which deliberately excludes is_pro from the user-writable
--    allowlist). SET search_path locks resolution to public + pg_catalog
--    so a malicious user cannot create a `public.sellers` shadow object
--    in their own schema and trick the trigger into resolving it.
--    Mirrors C.2's `handle_follow_change()` and D.2's
--    `handle_comment_change()` exactly — same shape, same hardening.
--
--    Branching:
--      * INSERT or UPDATE → mirror the new status into is_pro.
--                           is_pro = true iff status IN ('active','trialing').
--                           UPDATE additionally sets NEW.updated_at = NOW()
--                           so the timestamp tracks the most recent webhook
--                           write. The is_pro update fires unconditionally
--                           on every UPDATE (not gated on
--                           OLD.status IS DISTINCT FROM NEW.status); this
--                           is idempotent and has negligible cost — the
--                           sellers UPDATE is a single-row PK write — and
--                           keeps the function body straight-line readable.
--      * DELETE          → defensively flip is_pro = false. Hard deletes
--                           are rare (subscriptions are normally
--                           soft-canceled with status='canceled') but
--                           we cover the case for safety.
-- -----------------------------------------------------------------------------
create or replace function public.handle_subscription_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if (TG_OP = 'INSERT' or TG_OP = 'UPDATE') then
    if NEW.status in ('active', 'trialing') then
      update public.sellers
        set is_pro = true
        where id = NEW.seller_id;
    else
      update public.sellers
        set is_pro = false
        where id = NEW.seller_id;
    end if;

    if (TG_OP = 'UPDATE') then
      NEW.updated_at := now();
    end if;

    return NEW;

  elsif (TG_OP = 'DELETE') then
    update public.sellers
      set is_pro = false
      where id = OLD.seller_id;
    return OLD;
  end if;

  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Wire the triggers.
--    Two triggers, one function:
--      * BEFORE INSERT OR UPDATE — required because the function modifies
--        NEW.updated_at on UPDATE. BEFORE-row triggers can return a
--        modified NEW; AFTER-row triggers cannot (their NEW is read-only
--        by the time they fire).
--      * AFTER DELETE — BEFORE DELETE has the same OLD-only constraint
--        but using AFTER is conventionally cleaner (no observable
--        difference for our purposes since we're only doing a side-effect
--        UPDATE on sellers, no NEW to return).
-- -----------------------------------------------------------------------------
drop trigger if exists subscriptions_change_trigger on public.subscriptions;
create trigger subscriptions_change_trigger
  before insert or update on public.subscriptions
  for each row execute function public.handle_subscription_change();

drop trigger if exists subscriptions_delete_trigger on public.subscriptions;
create trigger subscriptions_delete_trigger
  after delete on public.subscriptions
  for each row execute function public.handle_subscription_change();

-- -----------------------------------------------------------------------------
-- 5. Row-Level Security.
--    SELECT is scoped to the calling user's own subscription via the
--    `sellers.user_id` ↔ `auth.uid()` mapping. Single-row equality,
--    planner-cached, negligible cost.
--
--    NO INSERT / UPDATE / DELETE policies for `authenticated`. Webhooks
--    write via `service_role` which bypasses RLS by design. The web
--    codebase's `app/api/stripe/webhook/route.ts` (H.12) initializes its
--    Supabase client with SUPABASE_SERVICE_ROLE_KEY and upserts directly.
--
--    Anonymous (`anon`) users have no path here because no GRANT to
--    anon is added below; the policies themselves are moot for anon.
-- -----------------------------------------------------------------------------
alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_self_select" on public.subscriptions;
create policy "subscriptions_self_select"
  on public.subscriptions
  for select
  to authenticated
  using (
    seller_id in (
      select id from public.sellers where user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 6. Table-level grants.
--    SELECT only. Defense-in-depth: even if a future RLS policy were
--    accidentally added that allowed a write, the missing INSERT/UPDATE/
--    DELETE grants would still block the JS client. Webhooks bypass via
--    service_role.
-- -----------------------------------------------------------------------------
grant select on public.subscriptions to authenticated;

commit;
