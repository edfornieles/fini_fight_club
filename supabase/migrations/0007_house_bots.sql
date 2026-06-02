-- ── House bots ───────────────────────────────────────────────────────────────
-- Rational automated players that give the arena critical mass during beta.
-- Each bot is a real account (its own wallet_address + fini_balances row) that
-- runs one of the Automated Attack strategy types server-side. Admin can later
-- sweep their balances to a project wallet and deactivate them once enough real
-- players are running their own automated battles.

create table if not exists public.house_bots (
  wallet_address   wallet_address primary key,   -- synthetic 0x… id for the bot
  handle           text not null,                -- display name, e.g. "house_oracle"
  strategy_type    text not null,                -- momentum | contrarian | loyalist | late_joiner | flat_bias | momentum_underlying | mean_reversion | late_sniper
  params           jsonb not null default '{}',  -- { sideFilter?, pctThreshold?, velocityThreshold?, minEdgePp?, assetFilter? }
  stake            bigint not null default 100,  -- FINI$ per forecast
  max_per_day      int    not null default 40,
  active           boolean not null default true,
  created_at       timestamptz default now()
);

alter table public.house_bots enable row level security;
drop policy if exists house_bots_public on public.house_bots;
create policy house_bots_public on public.house_bots for select using ( true );

-- A project treasury wallet to sweep bot balances into when retiring them.
create table if not exists public.project_wallet (
  id            int primary key default 1,
  wallet_address wallet_address not null,
  swept_total   bigint not null default 0,
  updated_at    timestamptz default now(),
  constraint project_wallet_singleton check (id = 1)
);

insert into public.project_wallet (id, wallet_address)
values (1, '0x0000000000000000000000000000000000feeded')
on conflict (id) do nothing;

-- Sweep: move a bot's full balance into the project wallet + deactivate it.
-- Returns the amount swept. Admin-only (service role).
create or replace function public.sweep_house_bot(p_bot wallet_address)
returns bigint
language plpgsql
security definer
as $$
declare
  v_balance bigint;
begin
  select balance into v_balance from public.fini_balances where wallet_address = p_bot;
  if v_balance is null then v_balance := 0; end if;

  if v_balance > 0 then
    update public.fini_balances set balance = 0 where wallet_address = p_bot;
    update public.project_wallet
      set swept_total = swept_total + v_balance, updated_at = now()
      where id = 1;
  end if;

  update public.house_bots set active = false where wallet_address = p_bot;
  return v_balance;
end;
$$;
