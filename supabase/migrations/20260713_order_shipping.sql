-- =============================================================================
-- Migration: 20260713_order_shipping
-- Purpose:   Phase 8 / Track B -- persist Stripe Checkout shipping address,
--            buyer phone, and buyer name on the orders row.
--
--            Adds three nullable columns:
--              - shipping_address jsonb
--              - buyer_phone      text
--              - buyer_name       text
--
-- shipping_address jsonb shape (matches the projection built in
-- supabase/functions/stripe-webhook/index.ts on 'checkout.session.completed'):
--   {
--     name:        text | null,   -- shipping_details.name
--     line1:       text | null,   -- shipping_details.address.line1
--     line2:       text | null,   -- shipping_details.address.line2
--     city:        text | null,   -- shipping_details.address.city
--     postal_code: text | null,   -- shipping_details.address.postal_code
--     state:       text | null,   -- shipping_details.address.state
--     country:     text | null    -- shipping_details.address.country (ISO-2)
--   }
--
--   We persist the WHOLE shipping_details payload as jsonb instead of a
--   set of typed columns because:
--     - The shape is owned by Stripe; future field additions (e.g. a
--       tracking_number when we eventually wire Stripe Shipping) should
--       NOT require a migration.
--     - The seller's Sales view (profile.tsx) reads it as one blob for
--       display -- no per-field query selectivity is needed.
--     - country sits inside the jsonb (not a separate column) because
--       no current query filters on country. If we ever add VAT / tax
--       reporting that filters by country, promote it to a typed column
--       in a follow-up migration.
--
-- buyer_phone / buyer_name:
--   Mirrored from customer_details.phone / customer_details.name on the
--   completed Stripe Checkout Session. Phone is collected via
--   phone_number_collection in the session creation (Step 3 of Track B);
--   name falls back to shipping_details.name in the webhook handler.
--   Stored as plain text -- this is the seller's own customer contact
--   information for their direct-buy orders.
--
-- Populated for buy_now orders ONLY:
--   Contact-only listings never produce an orders row (no Stripe session
--   is ever created -- the buyer is routed to start_or_get_conversation
--   from the action rail). All three columns are nullable so that
--   pre-Phase-8 orders rows (which lack shipping data) keep validating.
--
-- Idempotent:    ADD COLUMN IF NOT EXISTS, no constraints to retract.
-- Transactional: wrapped in begin / commit.
-- Reversibility: see ROLLBACK SQL block below.
-- Type regen:    REQUIRED. Adds shipping_address / buyer_phone /
--                buyer_name to the orders row type. Run `npm run gen:types`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ROLLBACK SQL (run manually to revert)
-- -----------------------------------------------------------------------------
-- begin;
--   alter table public.orders drop column if exists buyer_name;
--   alter table public.orders drop column if exists buyer_phone;
--   alter table public.orders drop column if exists shipping_address;
-- commit;
-- -----------------------------------------------------------------------------

begin;

alter table public.orders
  add column if not exists shipping_address jsonb,
  add column if not exists buyer_phone      text,
  add column if not exists buyer_name       text;

commit;
