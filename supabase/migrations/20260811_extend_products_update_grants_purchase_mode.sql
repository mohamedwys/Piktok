-- =============================================================================
-- Migration: 20260811_extend_products_update_grants_purchase_mode
-- Purpose:   Extend the column-level UPDATE allowlist on public.products
--            (set by 20260519_tighten_products_update_grants) to include
--            purchase_mode. The column was introduced by 20260712 but the
--            grant was not extended, so any client-side UPDATE that touches
--            purchase_mode raises "permission denied for column
--            purchase_mode". The defect was latent because mobile only
--            wrote purchase_mode on INSERT (table-level INSERT grant
--            applies, column UPDATE grant does not). Track 3's web bulk-
--            update + single-product editor activate the path.
--
--            The Pro-only enforcement is unchanged — the
--            enforce_purchase_mode_pro_only_trg trigger (20260712) still
--            silently downgrades buy_now -> contact_only for non-Pro
--            sellers regardless of who issues the UPDATE.
--
-- Idempotent:    GRANT is naturally idempotent for the same target/column.
-- Transactional: wrapped in begin/commit.
-- Reversibility: see ROLLBACK SQL block below.
-- Type regen:    NOT REQUIRED. Column-level grants do not surface in the
--                generated Database types.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL
-- -----------------------------------------------------------------------------
-- begin;
--   revoke update (purchase_mode) on public.products from authenticated;
-- commit;
-- -----------------------------------------------------------------------------

begin;

grant update (purchase_mode) on public.products to authenticated;

commit;