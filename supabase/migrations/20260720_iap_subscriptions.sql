-- =============================================================================
-- Migration: 20260720_iap_subscriptions
-- Purpose:   Phase 8 / Track A foundation for Apple StoreKit + Google Play
--            Billing IAP subscriptions. Extends the existing public.subscriptions
--            table (originally Stripe-only, created at 20260522) with IAP-side
--            identity columns and a provider tag, plus a new
--            public.iap_receipts audit table.
--
-- 1. subscriptions.payment_provider
--    Distinguishes Stripe (web upgrade flow via the Next.js companion at
--    /upgrade) from IAP (mobile, this track). Existing rows backfill to
--    'stripe' via the column default; new IAP rows write 'apple_iap' or
--    'google_play'. The handle_subscription_change() trigger introduced at
--    20260522 does NOT branch on provider — it flips sellers.is_pro on
--    status IN ('active','trialing') regardless. That's deliberate: Pro is
--    Pro whether it was bought through Apple, Google, or Stripe.
--
-- 2. subscriptions.apple_transaction_id / google_purchase_token
--    The IAP-side primary keys (Apple's original_transaction_id and
--    Google's purchaseToken respectively). Both are nullable because each
--    row only carries one of the three identity flavors (Stripe sub ID,
--    Apple txn, Google token) — the other two are NULL.
--
--    Partial UNIQUE indexes (created below) enforce that the same Apple
--    transaction or Google purchase token cannot be credited to two
--    different seller rows. This is load-bearing: without the unique
--    index, a malicious or buggy client could replay the same receipt
--    across multiple accounts. The validate-iap-receipt edge function
--    upserts ON CONFLICT against these indexes — duplicate POSTs are
--    therefore idempotent.
--
-- 3. subscriptions.current_period_end
--    Already present from 20260522 (the Stripe path uses it). The
--    `add column if not exists` here is a defensive no-op against any
--    environment where the column was dropped. For IAP this column is
--    LOAD-BEARING in a way it isn't for Stripe: Apple and Google do NOT
--    push renewal webhooks the way Stripe does. The client therefore
--    issues a silent restore-purchases on each app launch
--    (src/features/iap/services.ts), which re-validates against the
--    stores and updates current_period_end. The UI reads this column to
--    decide whether to keep Pro affordances on or fall back.
--
-- 4. Loosen NOT NULL on Stripe-specific columns
--    The original 20260522 schema modeled subscriptions after a Stripe-
--    only world and marked the three stripe_* columns
--    (stripe_subscription_id, stripe_customer_id, stripe_price_id)
--    NOT NULL. Track A's Apple StoreKit / Play Billing rows don't have
--    Stripe identifiers — only apple_transaction_id or
--    google_purchase_token. Dropping NOT NULL preserves the validity of
--    every existing Stripe row (each already has non-null values) while
--    permitting IAP rows to omit them entirely.
--
--    The existing UNIQUE constraint on stripe_subscription_id is
--    unaffected — Postgres permits multiple NULLs in a UNIQUE column by
--    default (UNIQUE NULLS DISTINCT semantics).
--
-- 5. iap_receipts
--    Append-only audit table. One row per validation attempt, valid or
--    not. Used by support to investigate disputed charges, by ops to
--    detect receipt-replay attacks (multiple invalid rows for the same
--    user_id in a short window), and as a paper trail for App Store /
--    Play Console refund correspondence. RLS-locked to service_role —
--    no client reads, no client writes.
--
-- Idempotent:    add column if not exists, create unique index if not
--                exists, create table if not exists, etc. Re-running this
--                migration is a no-op against a database where it has
--                already been applied.
-- Transactional: wrapped in BEGIN / COMMIT.
-- Reversibility: see ROLLBACK SQL block immediately below. Note: the
--                rollback does NOT delete the iap_receipts table contents
--                before dropping — running the rollback wipes the audit
--                trail. That is fine because the rollback is a developer
--                operation against a non-production database; production
--                rollbacks should be done by hand with explicit data
--                preservation.
-- Type regen:    REQUIRED. This migration adds public.iap_receipts and new
--                columns on public.subscriptions. Run `npm run gen:types`
--                after applying.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert this migration)
-- -----------------------------------------------------------------------------
-- begin;
--   -- Step 1: drop the new objects (indexes, columns, table).
--   drop index    if exists public.subscriptions_google_token_uidx;
--   drop index    if exists public.subscriptions_apple_txn_uidx;
--   alter table   public.subscriptions
--     drop column if exists google_purchase_token,
--     drop column if exists apple_transaction_id,
--     drop column if exists payment_provider;
--   -- current_period_end is NOT dropped — it predates this migration.
--   drop index    if exists public.iap_receipts_user_idx;
--   drop table    if exists public.iap_receipts;
--
--   -- Step 2: restore NOT NULL on the Stripe-specific columns.
--   --
--   -- After this migration, IAP rows may exist with NULL stripe_* values.
--   -- A bare `alter column ... set not null` would fail on those rows.
--   -- Backfill with synthetic placeholders before re-applying the
--   -- constraint. The 'legacy_' prefix is grep-able so ops can audit
--   -- and clean these up post-rollback. The UNIQUE constraint on
--   -- stripe_subscription_id is satisfied because each id is distinct.
--   update public.subscriptions
--     set stripe_subscription_id = 'legacy_' || id::text
--     where stripe_subscription_id is null;
--   update public.subscriptions
--     set stripe_customer_id = 'legacy_' || id::text
--     where stripe_customer_id is null;
--   update public.subscriptions
--     set stripe_price_id = 'legacy_' || id::text
--     where stripe_price_id is null;
--   alter table public.subscriptions
--     alter column stripe_subscription_id set not null,
--     alter column stripe_customer_id     set not null,
--     alter column stripe_price_id        set not null;
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- -----------------------------------------------------------------------------
-- 1. Extend subscriptions with IAP-side identity + provider tag.
--    payment_provider defaults to 'stripe' so the existing Stripe rows
--    backfill cleanly without a separate UPDATE statement. The CHECK
--    constraint is inline so new providers (if ever added) need an
--    explicit migration to extend it — no silent acceptance of typos.
-- -----------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists payment_provider text
    not null
    default 'stripe'
    check (payment_provider in ('stripe', 'apple_iap', 'google_play')),
  add column if not exists apple_transaction_id text,
  add column if not exists google_purchase_token text,
  add column if not exists current_period_end timestamptz;

-- -----------------------------------------------------------------------------
-- 2. Partial unique indexes so duplicate receipts can't double-grant Pro.
--    Partial (WHERE ... IS NOT NULL) so the indexes don't penalize Stripe
--    rows (which leave both columns NULL). The validate-iap-receipt edge
--    function upserts ON CONFLICT against these — repeat deliveries from
--    the client are idempotent.
-- -----------------------------------------------------------------------------
create unique index if not exists subscriptions_apple_txn_uidx
  on public.subscriptions (apple_transaction_id)
  where apple_transaction_id is not null;

create unique index if not exists subscriptions_google_token_uidx
  on public.subscriptions (google_purchase_token)
  where google_purchase_token is not null;

-- -----------------------------------------------------------------------------
-- 3. Loosen NOT NULL on Stripe-specific columns.
--
--    The original 20260522 schema modeled `subscriptions` after a Stripe-
--    only world and marked stripe_* columns NOT NULL. Track A's Apple
--    StoreKit / Play Billing rows don't have Stripe identifiers — only
--    apple_transaction_id or google_purchase_token. Dropping NOT NULL
--    preserves Stripe row validity (every existing Stripe row already has
--    non-null values, so this is a relaxation only) while permitting IAP
--    rows to omit them.
--
--    The existing UNIQUE constraint on stripe_subscription_id is
--    unaffected — Postgres permits multiple NULLs in a UNIQUE column by
--    default (UNIQUE NULLS DISTINCT semantics).
--
--    `alter column ... drop not null` is idempotent: re-running this
--    statement against an already-nullable column is a no-op (Postgres
--    doesn't error, it just emits a NOTICE).
-- -----------------------------------------------------------------------------
alter table public.subscriptions
  alter column stripe_subscription_id drop not null,
  alter column stripe_customer_id     drop not null,
  alter column stripe_price_id        drop not null;

-- -----------------------------------------------------------------------------
-- 4. iap_receipts audit table. Locked down to service_role only.
--    No RLS policies = no client access. The edge function bypasses RLS
--    via service_role and is the only writer. raw_response is jsonb so
--    we can run jsonb_path_query for diagnostics without re-parsing.
-- -----------------------------------------------------------------------------
create table if not exists public.iap_receipts (
  id                       uuid        primary key default uuid_generate_v4(),
  user_id                  uuid        not null references auth.users(id) on delete cascade,
  platform                 text        not null check (platform in ('ios', 'android')),
  raw_receipt              text        not null,
  transaction_id           text,
  original_transaction_id  text,
  product_id               text,
  expires_at               timestamptz,
  verification_status      text        not null check (verification_status in ('valid', 'invalid', 'expired')),
  raw_response             jsonb,
  verified_at              timestamptz not null default now(),
  created_at               timestamptz not null default now()
);

create index if not exists iap_receipts_user_idx
  on public.iap_receipts (user_id, created_at desc);

alter table public.iap_receipts enable row level security;

revoke all on public.iap_receipts from public;
revoke all on public.iap_receipts from anon;
revoke all on public.iap_receipts from authenticated;
-- No policies. Only service_role (edge function) writes.

commit;
