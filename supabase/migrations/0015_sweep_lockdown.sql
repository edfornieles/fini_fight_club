-- ── SECURITY FIX: lock down sweep_house_bot ─────────────────────────────────
-- sweep_house_bot was SECURITY DEFINER with the default PUBLIC execute grant —
-- every other sensitive RPC revokes public/anon/authenticated, but this one
-- didn't. PostgREST therefore exposed it to the shipped anon key: anyone could
-- POST /rest/v1/rpc/sweep_house_bot {"p_bot":"<ANY wallet>"} and zero that
-- wallet's balance (and it wrote no ledger row → balance/ledger desync).
--
-- This migration: (1) revokes public execute so only the service role (admin-ops)
-- can call it, (2) pins search_path, and (3) writes a proper ledger debit so the
-- ledger and balance stay consistent on a sweep.
--
-- HOTFIX (run in the Supabase SQL editor immediately, before this migration
-- deploys, to stop the live hole):
--   revoke all on function public.sweep_house_bot(wallet_address)
--     from public, authenticated, anon;

set search_path = public;

create or replace function public.sweep_house_bot(p_bot wallet_address)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  select balance into v_balance from public.fini_balances where wallet_address = p_bot;
  if v_balance is null then v_balance := 0; end if;

  if v_balance > 0 then
    update public.fini_balances set balance = 0 where wallet_address = p_bot;
    -- Ledger row so the swept amount is auditable and balance/ledger agree.
    insert into public.fini_coin_ledger (wallet_address, amount, reason, idempotency_key, metadata)
    values (
      p_bot, -v_balance, 'admin_debit',
      'sweep:' || p_bot || ':' || extract(epoch from now())::bigint::text,
      jsonb_build_object('kind', 'house_bot_sweep')
    );
    update public.project_wallet
      set swept_total = swept_total + v_balance, updated_at = now()
      where id = 1;
  end if;

  update public.house_bots set active = false where wallet_address = p_bot;
  return v_balance;
end;
$$;

revoke all on function public.sweep_house_bot(wallet_address) from public, authenticated, anon;
grant execute on function public.sweep_house_bot(wallet_address) to service_role;
