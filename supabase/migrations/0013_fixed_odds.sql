-- ── Fixed-odds (Polymarket-style) settlement ────────────────────────────────
-- Replaces the parimutuel payout in resolve_battle with FIXED ODDS LOCKED AT
-- ENTRY: a winner is paid stake × 100/locked_pct — exactly the "To win" figure
-- the bet panel shows when the prediction is placed. Backing a 40% underdog
-- locks 2.5×; a 70% favourite locks ~1.43×. The implied probability (locked_pct)
-- reflects the live pool balance at entry, so odds still move with other
-- people's bets — but each player's payout is certain the moment they bet,
-- rather than floating with the final pool.
--
-- The house (play-money ledger) covers any net between paid winnings and the
-- pool; for the non-cash beta this is just minting via credit_balance. The
-- return json reports house P&L per battle for the operator economy view.
--
-- Void path is unchanged (all stakes refunded). Idempotent (already-resolved
-- battles no-op).

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

  -- ── Fixed-odds payout: winners get stake × 100 / locked_pct ────────────────
  for v_predictions in
    select id, wallet_address, stake, side, locked_pct from public.predictions
     where battle_id = p_battle_id and status = 'open'
  loop
    if v_predictions.side = p_winning_side then
      -- locked_pct is the implied probability at entry (1..99); guard nulls/0.
      v_payout := floor(v_predictions.stake::numeric * 100.0
                        / greatest(coalesce(v_predictions.locked_pct, 50), 1))::bigint;
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
    'resolved', true,
    'winning_side', p_winning_side,
    'total_pool', v_total_pool,
    'winning_pool', v_winning_pool,
    'paid_out', v_paid_out,
    'house_pl', v_total_pool - v_paid_out   -- positive = house kept; negative = house topped up
  );
end;
$$;

revoke all on function public.resolve_battle from public, authenticated, anon;
grant execute on function public.resolve_battle to service_role;
