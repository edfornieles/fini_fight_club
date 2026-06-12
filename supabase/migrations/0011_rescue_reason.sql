-- ── Separate ledger reason for emergency rescue top-ups ──────────────────────
-- The daily drop and the emergency rescue are different economic events: the
-- daily drop is cooldown-gated, the rescue is floor-gated. Giving rescue its own
-- ledger_reason keeps them independently auditable and lets the daily-drop
-- cooldown check filter on reason alone (using ledger_reason_idx) instead of a
-- JSON metadata predicate. See supabase/functions/claim-grant.
--
-- PG15 allows ADD VALUE inside a migration transaction as long as the new value
-- is not *used* in the same transaction (it isn't here).
alter type public.ledger_reason add value if not exists 'rescue_grant';
