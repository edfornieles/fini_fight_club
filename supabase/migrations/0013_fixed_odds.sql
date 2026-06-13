-- ── resolve_battle: PARIMUTUEL settlement (self-funding) ────────────────────
-- DESIGN DECISION (2026-06-13): the arena pays PARIMUTUEL, not fixed-odds.
-- Fixed-odds priced off the instantaneous pool let the house MINT a shortfall,
-- which a both-side / thin-pool self-seed could farm risk-free (audit CRITICAL
-- #2). Parimutuel is self-funding — winners split exactly the pool the losers
-- staked, so the house can never be drained and there is nothing to seed. With
-- deep two-sided bot liquidity the odds barely move on a single bet, so it still
-- reads as locked/Polymarket-like; the bet panel shows the payout as an estimate.
--
-- This migration re-asserts the parimutuel resolve_battle (same behaviour as the
-- live 0005 version) and adds paid_out / house_pl to the return for the operator
-- economy view. Safe to deploy: it does not change live settlement behaviour.
-- Void path unchanged (all stakes refunded). Idempotent.

set search_path = public;

create or replace function public.resolve_battle(
  p_battle_id           text,
  p_winning_side        text,                -- 'A' | 'B' | null=void
  p_end_price_a         numeric,
  p_end_price_b         numeric,
  p_end_price_source    text,
  p_resolution_formula  text,
  p_resolution_calc     text
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_battle           record;
  v_predictions      record;
  v_total_pool       bigint := 0;
  v_winning_pool     bigint := 0;
  v_payout_per_unit  numeric := 0;
  v_paid_out         bigint := 0;
  v_payout           bigint;
  v_idem             text;
begin
  select * into v_battle from public.battle_instances where id = p_battle_id for update;
  if not found then raise exception 'battle_not_found'; end if;
  if v_battle.resolution_status = 'resolved' then
    return json_build_object('already_resolved', true);
  end if;

  select
    coalesce(sum(stake), 0),
    coalesce(sum(stake) filter (where p_winning_side is not null and side = p_winning_side), 0)
  into v_total_pool, v_winning_pool
  from public.predictions
  where battle_id = p_battle_id and status = 'open';

  -- ── Void: refund every stake ──────────────────────────────────────────────
  if p_winning_side is null then
    for v_predictions in
      select id, wallet_address, stake from public.predictions
       where battle_id = p_battle_id and status = 'open'
    loop
      v_idem := 'predict:refund:' || v_predictions.id::text;
      perform public.credit_balance(
        v_predictions.wallet_address, v_predictions.stake, 'prediction_refund',
        v_idem, p_battle_id, null, null, '{}'::jsonb
      );
      update public.predictions set status = 'voided', payout = v_predictions.stake
       where id = v_predictions.id;
    end loop;
    update public.battle_instances set
      status = 'voided', resolution_status = 'voided',
      official_end_price_a = p_end_price_a, official_end_price_b = p_end_price_b,
      end_price_source = p_end_price_source, end_price_recorded_at = now(),
      resolution_formula = p_resolution_formula, resolution_calculation = p_resolution_calc,
      void_reason = 'no_winning_side'
    where id = p_battle_id;
    return json_build_object('voided', true);
  end if;

  -- ── Parimutuel payout: winners split the whole pool pro-rata to their stake.
  if v_winning_pool > 0 then
    v_payout_per_unit := (v_total_pool::numeric) / (v_winning_pool::numeric);
  end if;

  for v_predictions in
    select id, wallet_address, stake, side from public.predictions
     where battle_id = p_battle_id and status = 'open'
  loop
    if v_predictions.side = p_winning_side then
      v_payout := floor(v_predictions.stake * v_payout_per_unit)::bigint;
      v_paid_out := v_paid_out + v_payout;
      v_idem := 'predict:payout:' || v_predictions.id::text;
      perform public.credit_balance(
        v_predictions.wallet_address, v_payout, 'prediction_payout',
        v_idem, p_battle_id, null, null, '{}'::jsonb
      );
      update public.predictions set status = 'resolved', payout = v_payout where id = v_predictions.id;
    else
      update public.predictions set status = 'resolved', payout = 0 where id = v_predictions.id;
    end if;
  end loop;

  update public.battle_instances set
    status = 'resolved', resolution_status = 'resolved',
    winning_side = p_winning_side,
    official_end_price_a = p_end_price_a, official_end_price_b = p_end_price_b,
    end_price_source = p_end_price_source, end_price_recorded_at = now(),
    resolution_formula = p_resolution_formula, resolution_calculation = p_resolution_calc
  where id = p_battle_id;

  return json_build_object(
    'resolved', true, 'winning_side', p_winning_side,
    'total_pool', v_total_pool, 'winning_pool', v_winning_pool,
    'paid_out', v_paid_out, 'house_pl', v_total_pool - v_paid_out  -- ~0 dust; parimutuel self-funds
  );
end;
$$;

revoke all on function public.resolve_battle from public, authenticated, anon;
grant execute on function public.resolve_battle to service_role;
