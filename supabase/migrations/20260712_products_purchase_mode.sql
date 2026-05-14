-- =============================================================================
-- Migration: 20260712_products_purchase_mode
-- Purpose:   Phase 8 / Track B -- hybrid purchase model.
--
--            Adds `products.purchase_mode` (text, two-state) and a BEFORE
--            INSERT/UPDATE trigger that silently downgrades non-Pro sellers
--            to `contact_only`.
--
-- Two-state model:
--   'buy_now'      -- buyer can pay through Stripe Checkout. Stripe collects
--                     shipping address + phone (see 20260713_order_shipping
--                     + create-checkout-session edge function).
--   'contact_only' -- buyer can only message the seller via the existing
--                     start_or_get_conversation RPC. Default for every new
--                     and existing product.
--
-- Default is 'contact_only':
--   This is the no-behavior-change default for every row already in the
--   table (the column lands as `not null default 'contact_only'`, so the
--   backfill is implicit). Non-Pro sellers and Pro sellers who never opt
--   in keep the existing contact-seller flow. No client-side fallback
--   needed -- the action rail reads the column directly.
--
-- Pro-only enforcement -- silent downgrade, not exception:
--   The trigger fires BEFORE INSERT and BEFORE UPDATE of purchase_mode /
--   seller_id. When the NEW row's `purchase_mode = 'buy_now'` and the
--   owning seller's `is_pro` is false, the trigger rewrites NEW.purchase_mode
--   to 'contact_only' INSTEAD of raising.
--
--   The "silent downgrade" choice is deliberate:
--     - A Pro seller can list `buy_now` while subscribed. Later their
--       subscription expires (sellers.is_pro flips false via the
--       subscriptions trigger). Their existing listing rows STAY at
--       'buy_now' in storage -- the trigger only runs on writes -- so
--       the read path needs no migration when Pro lapses.
--     - But the moment that ex-Pro seller saves an edit to such a
--       listing, the trigger downgrades it to 'contact_only'. This
--       avoids raising an error mid-edit (which would block save) and
--       keeps the data converging toward the right state without
--       requiring a Pro-status backfill job.
--     - For new inserts by a non-Pro: same silent downgrade. The client
--       hides the toggle for non-Pro sellers (see newPost.tsx), so this
--       branch only triggers on a forged client payload.
--
--   We do NOT downgrade pre-existing 'buy_now' rows in bulk when Pro
--   expires. The action rail still reads purchase_mode == 'buy_now' and
--   will keep offering Buy until the row is touched again. This is
--   acceptable because:
--     a) The downstream create-checkout-session edge function re-checks
--        purchase_mode === 'buy_now' on the server (Step 3); it does
--        NOT re-check is_pro at order time. If the seller is allowed to
--        keep buy_now listings on a lapsed sub for the rest of the
--        billing cycle, the only knob to also gate by live is_pro lives
--        in the edge function and would need a separate decision.
--     b) The product-list seller projection still surfaces seller.is_pro
--        in the feed payload, so any UI that wants to badge buy_now
--        listings as "by a Pro seller" has the data.
--
-- Trigger column list:
--   BEFORE INSERT OR UPDATE OF purchase_mode, seller_id -- we don't fire
--   on every column write (avoids re-evaluating Pro status on price/title
--   edits) but DO fire when seller_id is reassigned (ownership transfer
--   would otherwise leak a non-Pro seller into a buy_now row).
--
-- search_path:
--   The trigger is SECURITY DEFINER (it needs to read sellers.is_pro
--   regardless of caller RLS) and pins search_path = public, pg_catalog
--   per the existing project convention (see 20260625_user_blocks.sql).
--
-- Idempotent:    ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
--                DROP TRIGGER IF EXISTS + CREATE TRIGGER.
-- Transactional: wrapped in begin / commit.
-- Reversibility: see ROLLBACK SQL block below.
-- Type regen:    REQUIRED. Adds the `purchase_mode` field to the
--                products row type. Run `npm run gen:types`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert)
-- -----------------------------------------------------------------------------
-- begin;
--   drop trigger  if exists enforce_purchase_mode_pro_only_trg on public.products;
--   drop function if exists public.enforce_purchase_mode_pro_only();
--   alter table   public.products drop column if exists purchase_mode;
-- commit;
-- -----------------------------------------------------------------------------

begin;

-- =============================================================================
-- 1. Column
-- =============================================================================
alter table public.products
  add column if not exists purchase_mode text
    not null
    default 'contact_only'
    check (purchase_mode in ('buy_now', 'contact_only'));

-- =============================================================================
-- 2. Pro-only enforcement trigger
-- =============================================================================
create or replace function public.enforce_purchase_mode_pro_only()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_is_pro boolean;
begin
  if NEW.purchase_mode = 'buy_now' then
    select is_pro
      into v_is_pro
      from public.sellers
      where id = NEW.seller_id;
    if not coalesce(v_is_pro, false) then
      -- Silently downgrade instead of raising -- protects existing
      -- buy_now listings that survive a Pro downgrade event without
      -- blocking the seller's own edits.
      NEW.purchase_mode := 'contact_only';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists enforce_purchase_mode_pro_only_trg on public.products;
create trigger enforce_purchase_mode_pro_only_trg
  before insert or update of purchase_mode, seller_id
  on public.products
  for each row
  execute function public.enforce_purchase_mode_pro_only();

commit;
