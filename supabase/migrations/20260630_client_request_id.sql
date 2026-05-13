-- =============================================================================
-- Migration: 20260630_client_request_id
-- Purpose:   Phase 7 / Track A -- per-(user, request) idempotency keys for
--            retry-safe writes on `messages` and `products`.
--
--            Adds:
--              - public.messages.client_request_id  text  (nullable)
--              - public.products.client_request_id  text  (nullable)
--              - partial unique index per table, scoped to the owning user
--                so two different users' UUIDs cannot collide.
--
-- Why per-user uniqueness:
--   The client generates a v4 UUID per logical mutation. The collision
--   surface is per-user -- user A's "send message" UUID and user B's
--   "send message" UUID can coexist harmlessly. Scoping the unique
--   constraint to (owner_id, client_request_id) means a malicious or
--   buggy client cannot affect another user's writes by guessing their
--   UUIDs, and the index stays narrow under the realistic mutation rate.
--
-- Why partial (WHERE client_request_id is not null):
--   The columns are nullable so existing rows -- pre-Phase-7 -- continue
--   to participate in queries unchanged. The partial unique index also
--   excludes them from the uniqueness check (a NULL key disables the
--   row from the index entirely). Only new writes that pass a non-null
--   client_request_id are deduped, which matches the wire contract
--   in src/features/marketplace/services/{messaging,sell}.ts.
--
-- Why messages + products only (not orders):
--   Orders need a matching Stripe-side idempotency key + a rewrite of
--   the create-checkout-session edge function to plumb it through, plus
--   an `orders.client_request_id` constraint of its own. That work is
--   deferred to Track B; Phase 7 ships idempotency for the two highest
--   double-submit risk paths (chat send, listing create).
--
-- Wire contract for the client (Phase 7 / Step 6):
--   On INSERT with a client_request_id, callers race against the unique
--   constraint. The losing INSERT receives a unique-violation (23505);
--   callers swallow it and SELECT the winning row by
--   (sender_id|seller_id, client_request_id) to return a consistent
--   ChatMessage / product id, making retries idempotent.
--
-- Idempotent:    ADD COLUMN IF NOT EXISTS, CREATE UNIQUE INDEX IF NOT EXISTS.
-- Transactional: wrapped in begin / commit.
-- Reversibility: see ROLLBACK SQL block below.
-- Type regen:    REQUIRED. Adds `client_request_id` to messages.Row /
--                products.Row / Insert / Update / Relationships. Run
--                `npm run gen:types`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert)
-- -----------------------------------------------------------------------------
-- begin;
--   drop index  if exists public.messages_client_request_id_uidx;
--   drop index  if exists public.products_client_request_id_uidx;
--   alter table public.messages  drop column if exists client_request_id;
--   alter table public.products  drop column if exists client_request_id;
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- =============================================================================
-- 1. messages.client_request_id + partial unique index on (sender_id, key)
-- =============================================================================
alter table public.messages
  add column if not exists client_request_id text;

create unique index if not exists messages_client_request_id_uidx
  on public.messages (sender_id, client_request_id)
  where client_request_id is not null;

-- =============================================================================
-- 2. products.client_request_id + partial unique index on (seller_id, key)
-- =============================================================================
alter table public.products
  add column if not exists client_request_id text;

create unique index if not exists products_client_request_id_uidx
  on public.products (seller_id, client_request_id)
  where client_request_id is not null;

commit;
