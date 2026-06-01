-- ── Crypto Arena RPCs ───────────────────────────────────────────────────────
-- Atomic volume bump + battle resolution settlement.

set search_path = public;

create or replace function public.bump_battle_volume(
  p_battle_id  text,
  p_amount     bigint
) returns void
language sql security definer set search_path = public as $$
  update public.battle_instances
     set total_volume = total_volume + p_amount
   where id = p_battle_id;
$$;

revoke all on function public.bump_battle_volume from public, authenticated, anon;
grant execute on function public.bump_battle_volume to service_role;

-- resolve_battle:
--   Sets official end price and winning side on a battle, marks predictions
--   resolved, and pays out winners. Idempotent: re-running on the same battle
--   is a no-op (uses per-battle idempotency keys).
--
-- The actual payout math: winners split the pool minus losers' stakes ×0.93 (7% fee).
-- For MVP we keep it simple — winners get stake × (totalPool / winningPool) capped at 3×.
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
  v_payout           bigint;
  v_credit_reason    ledger_reason;
  v_idem             text;
begin
  select * into v_battle from public.battle_instances where id = p_battle_id for update;
  if not found then raise exception 'battle_not_found'; end if;
  if v_battle.resolution_status = 'resolved' then
    return json_build_object('already_resolved', true);
  end if;

  -- Compute pools
  select
    coalesce(sum(stake), 0)                                                          as total_pool,
    coalesce(sum(stake) filter (where p_winning_side is not null and side = p_winning_side), 0) as winning_pool
  into v_total_pool, v_winning_pool
  from public.predictions
  where battle_id = p_battle_id and status = 'open';

  if p_winning_side is null then
    -- Voided: refund all stakes
    for v_predictions in
      select id, wallet_address, stake from public.predictions
       where battle_id = p_battle_id and status = 'open'
    loop
      v_idem := 'predict:refund:' || v_predictions.id::text;
      perform public.credit_balance(
        v_predictions.wallet_address, v_predictions.stake, 'prediction_refund',
        v_idem, p_battle_id, null, null, '{}'::jsonb
      );
      update public.predictions
         set status = 'voided', payout = v_predictions.stake
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

  -- Compute pro-rata payout
  if v_winning_pool > 0 then
    v_payout_per_unit := (v_total_pool::numeric) / (v_winning_pool::numeric);
  end if;
  v_credit_reason := 'prediction_payout';

  for v_predictions in
    select id, wallet_address, stake, side from public.predictions
     where battle_id = p_battle_id and status = 'open'
  loop
    if v_predictions.side = p_winning_side then
      v_payout := floor(v_predictions.stake * v_payout_per_unit)::bigint;
      v_idem := 'predict:payout:' || v_predictions.id::text;
      perform public.credit_balance(
        v_predictions.wallet_address, v_payout, v_credit_reason,
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
    'resolved', true,
    'winning_side', p_winning_side,
    'total_pool', v_total_pool,
    'winning_pool', v_winning_pool
  );
end;
$$;

revoke all on function public.resolve_battle from public, authenticated, anon;
grant execute on function public.resolve_battle to service_role;
