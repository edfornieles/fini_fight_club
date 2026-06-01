-- ── Atomic balance operations ────────────────────────────────────────────────
-- These are the ONLY way balance should change. Edge functions call them via
-- service-role RPC. They write the ledger row + update the cached balance in
-- a single transaction. Idempotency keys prevent double-spend on retry.

set search_path = public;

-- credit_balance: add FINI$ to a wallet (claim, payout, refund, admin grant)
create or replace function public.credit_balance(
  p_wallet            wallet_address,
  p_amount            bigint,
  p_reason            ledger_reason,
  p_idempotency_key   text,
  p_battle_id         text default null,
  p_trade_id          text default null,
  p_claim_id          text default null,
  p_metadata          jsonb default '{}'::jsonb
)
returns table (new_balance bigint, ledger_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id bigint;
  v_new_balance bigint;
  v_ledger_id   bigint;
begin
  if p_amount <= 0 then
    raise exception 'credit amount must be positive (got %)', p_amount;
  end if;

  -- Idempotency: if this key was already processed, return the prior outcome
  if p_idempotency_key is not null then
    select id into v_existing_id from public.fini_coin_ledger where idempotency_key = p_idempotency_key;
    if found then
      select balance into v_new_balance from public.fini_balances where wallet_address = p_wallet;
      return query select coalesce(v_new_balance, 0::bigint), v_existing_id;
      return;
    end if;
  end if;

  insert into public.fini_balances (wallet_address, balance, lifetime_earned)
  values (p_wallet, p_amount, p_amount)
  on conflict (wallet_address) do update
    set balance         = public.fini_balances.balance + p_amount,
        lifetime_earned = public.fini_balances.lifetime_earned + p_amount,
        updated_at      = now()
  returning balance into v_new_balance;

  insert into public.fini_coin_ledger
    (wallet_address, amount, reason, related_battle_id, related_trade_id, related_claim_id, idempotency_key, metadata)
  values
    (p_wallet, p_amount, p_reason, p_battle_id, p_trade_id, p_claim_id, p_idempotency_key, p_metadata)
  returning id into v_ledger_id;

  return query select v_new_balance, v_ledger_id;
end;
$$;

-- debit_balance: subtract FINI$ from a wallet (entry, stake, purchase, refund out)
-- Will raise if balance is insufficient — caller catches and returns 402.
create or replace function public.debit_balance(
  p_wallet            wallet_address,
  p_amount            bigint,
  p_reason            ledger_reason,
  p_idempotency_key   text,
  p_battle_id         text default null,
  p_trade_id          text default null,
  p_claim_id          text default null,
  p_metadata          jsonb default '{}'::jsonb
)
returns table (new_balance bigint, ledger_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id bigint;
  v_balance     bigint;
  v_new_balance bigint;
  v_ledger_id   bigint;
begin
  if p_amount <= 0 then
    raise exception 'debit amount must be positive (got %)', p_amount;
  end if;

  -- Idempotency
  if p_idempotency_key is not null then
    select id into v_existing_id from public.fini_coin_ledger where idempotency_key = p_idempotency_key;
    if found then
      select balance into v_new_balance from public.fini_balances where wallet_address = p_wallet;
      return query select coalesce(v_new_balance, 0::bigint), v_existing_id;
      return;
    end if;
  end if;

  -- Lock the row, check funds, deduct
  select balance into v_balance from public.fini_balances where wallet_address = p_wallet for update;
  if v_balance is null then
    raise exception 'insufficient_funds (wallet has no balance)';
  end if;
  if v_balance < p_amount then
    raise exception 'insufficient_funds (have %, need %)', v_balance, p_amount;
  end if;

  update public.fini_balances
     set balance        = balance - p_amount,
         lifetime_spent = lifetime_spent + p_amount,
         updated_at     = now()
   where wallet_address = p_wallet
  returning balance into v_new_balance;

  insert into public.fini_coin_ledger
    (wallet_address, amount, reason, related_battle_id, related_trade_id, related_claim_id, idempotency_key, metadata)
  values
    (p_wallet, -p_amount, p_reason, p_battle_id, p_trade_id, p_claim_id, p_idempotency_key, p_metadata)
  returning id into v_ledger_id;

  return query select v_new_balance, v_ledger_id;
end;
$$;

-- record_battle_outcome: apply per-Fini stat changes for a settled battle.
-- Called once per battle by the resolver, with the array of token outcomes.
create or replace function public.record_battle_outcome(
  p_contract_address text,
  p_outcomes         jsonb     -- [{ token_id, outcome }] where outcome ∈ 'win'|'loss'|'draw'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_token_id int;
  v_outcome  text;
  v_xp_gain  int;
  v_rest_ms  int;
begin
  for r in select jsonb_array_elements(p_outcomes) loop
    v_token_id := (r->>'token_id')::int;
    v_outcome  := (r->>'outcome')::text;
    v_xp_gain  := case v_outcome when 'win' then 30 when 'draw' then 12 else 6 end;
    v_rest_ms  := case v_outcome when 'win' then 0 when 'draw' then 30 * 60 * 1000 else 60 * 60 * 1000 end;

    insert into public.fini_records (contract_address, token_id, wins, losses, draws, xp, level, last_battle_at, resting_until)
    values (
      p_contract_address, v_token_id,
      case v_outcome when 'win'  then 1 else 0 end,
      case v_outcome when 'loss' then 1 else 0 end,
      case v_outcome when 'draw' then 1 else 0 end,
      v_xp_gain,
      1,
      now(),
      case when v_rest_ms = 0 then null else now() + (v_rest_ms || ' milliseconds')::interval end
    )
    on conflict (contract_address, token_id) do update set
      wins   = public.fini_records.wins   + case v_outcome when 'win'  then 1 else 0 end,
      losses = public.fini_records.losses + case v_outcome when 'loss' then 1 else 0 end,
      draws  = public.fini_records.draws  + case v_outcome when 'draw' then 1 else 0 end,
      xp     = public.fini_records.xp + v_xp_gain,
      level  = floor((public.fini_records.xp + v_xp_gain) / 100) + 1,
      last_battle_at = now(),
      resting_until  = case when v_rest_ms = 0 then null else now() + (v_rest_ms || ' milliseconds')::interval end;
  end loop;
end;
$$;

-- Lock down the RPCs — only service role can call.
revoke all on function public.credit_balance       from public, authenticated, anon;
revoke all on function public.debit_balance        from public, authenticated, anon;
revoke all on function public.record_battle_outcome from public, authenticated, anon;
grant execute on function public.credit_balance       to service_role;
grant execute on function public.debit_balance        to service_role;
grant execute on function public.record_battle_outcome to service_role;
