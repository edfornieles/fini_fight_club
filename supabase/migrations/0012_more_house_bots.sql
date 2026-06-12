-- ── More house bots — depth + variety for the arena ─────────────────────────
-- The two-sided market-maker pass in workers/battle-cron makes every battle
-- two-sided, but deeper pools + more distinct names in the live feed make the
-- arena feel busier. Seed 30 more bots across all strategy types, funded the
-- same as the original cohort (200k CUTE$ each via the ledger so balances and
-- the ledger stay consistent). Idempotent: re-running won't duplicate or
-- double-fund (unique wallet + idempotency-keyed credit).

set search_path = public;

do $$
declare
  strategies text[] := array[
    'momentum','contrarian','loyalist','late_joiner','flat_bias',
    'momentum_underlying','mean_reversion','late_sniper'
  ];
  i      int;
  w      wallet_address;
  strat  text;
  seed   bigint := 200000;
begin
  for i in 1..30 loop
    -- 0x + b071 + 36 hex = 42 chars; disjoint from the original 0xb070… cohort.
    w := ('0xb071' || lpad(to_hex(i), 36, '0'))::wallet_address;
    strat := strategies[1 + (i % array_length(strategies, 1))];

    -- NOTE: no public.users row — users.id is a no-default PK onto auth.users,
    -- so inserting one here would 23502 and abort the whole migration chain.
    -- Bots only need a house_bots row + a ledger-seeded balance.
    insert into public.house_bots (wallet_address, handle, strategy_type, params, stake, max_per_day, active)
      values (w, 'house_mm_' || lpad(i::text, 2, '0'), strat, '{}'::jsonb, 100, 200, true)
      on conflict (wallet_address) do nothing;

    -- Fund via the ledger (idempotent by key) so fini_balances + ledger agree.
    perform public.credit_balance(
      w, seed, 'admin_grant', 'botseed:' || w, null, null, null, '{}'::jsonb
    );
  end loop;
end $$;
