-- ── Operator zone: admin identity, economy config, audit log ─────────────────
-- Powers the operator console (/admin) — real admin auth (replacing the
-- client-only ?dev=1 gate), tunable economics for both games, and an audit
-- trail for every operator mutation. All writes go through the `admin-ops`
-- edge function (service role + admin check); nothing here is publicly writable.

set search_path = public;

-- 1. Admin identity ----------------------------------------------------------
-- A wallet is an operator if users.is_admin is true OR its address is in the
-- admin-ops function's ADMIN_WALLETS env allowlist (bootstrap before any row
-- is flagged). The env allowlist is the chicken-and-egg breaker for the first
-- admin; flip is_admin afterwards to manage operators from the DB.
alter table public.users add column if not exists is_admin boolean not null default false;

-- 2. Economy config (singleton) ----------------------------------------------
-- One row holds every tunable lever for both games. Seeded with the values
-- currently hardcoded in the client (coinStore daily drop / rescue, the 7%
-- arena fee, the 30s entry cutoff, treasuryStore's Fight Club caps) so flipping
-- to config-driven changes nothing until an operator edits it.
create table if not exists public.economy_config (
  id                  int primary key default 1,
  -- Crypto Arena
  daily_grant         bigint  not null default 500,        -- CUTE$ per daily claim
  rescue_amount       bigint  not null default 500,        -- emergency top-up amount
  rescue_floor        bigint  not null default 100,        -- below this, rescue is available
  new_account_seed    bigint  not null default 1000,       -- fresh play-account starting balance
  arena_fee_pct       numeric not null default 7,          -- house rake on the pool, %
  entry_cutoff_seconds int    not null default 30,         -- lock entries N seconds before end
  bots_paused         boolean not null default false,      -- global house-bot kill switch
  -- Fight Club
  fc_daily_cap        bigint  not null default 1000,       -- per-player daily CUTE$ cap
  fc_treasury_float   bigint  not null default 10000000,   -- house float backing payouts
  fc_stake_min        bigint  not null default 10,
  fc_stake_max        bigint  not null default 1000,
  -- bookkeeping
  updated_at          timestamptz not null default now(),
  updated_by          text,
  constraint economy_config_singleton check (id = 1)
);

insert into public.economy_config (id) values (1) on conflict (id) do nothing;

alter table public.economy_config enable row level security;
drop policy if exists economy_config_public on public.economy_config;
-- Public read so the client can drive grants/caps from config; writes are
-- service-role only (no write policy = denied for anon/authenticated).
create policy economy_config_public on public.economy_config for select using ( true );

-- 3. Admin audit log ---------------------------------------------------------
-- Every operator mutation (bot pause/tune/retire/spawn, manual resolve/void,
-- config edit) is appended here for trust. Service-role only — surfaced back to
-- operators through the admin-ops function, never read directly by the client.
create table if not exists public.admin_actions (
  id            bigserial primary key,
  admin_wallet  text not null,
  action        text not null,                 -- e.g. 'bot.retire', 'battle.resolve'
  payload       jsonb not null default '{}'::jsonb,
  result        jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);

alter table public.admin_actions enable row level security;
-- No policies → only the service role (which bypasses RLS) can read/write.

-- 4. Spawn helper ------------------------------------------------------------
-- Create a new house bot atomically: user row, balance seed, and house_bots
-- row. Returns the seeded balance. Admin-only (service role).
create or replace function public.spawn_house_bot(
  p_wallet        wallet_address,
  p_handle        text,
  p_strategy_type text,
  p_params        jsonb,
  p_stake         bigint,
  p_max_per_day   int,
  p_seed          bigint
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  -- No public.users row: users.id is a no-default PK onto auth.users, so an
  -- insert without it fails. Bots need only house_bots + a seeded balance.
  insert into public.house_bots (wallet_address, handle, strategy_type, params, stake, max_per_day, active)
    values (p_wallet, p_handle, p_strategy_type, coalesce(p_params, '{}'::jsonb), p_stake, p_max_per_day, true)
    on conflict (wallet_address) do update
      set handle = excluded.handle, strategy_type = excluded.strategy_type,
          params = excluded.params, stake = excluded.stake,
          max_per_day = excluded.max_per_day, active = true;

  if p_seed > 0 then
    perform public.credit_balance(
      p_wallet, p_seed, 'admin_grant',
      'botseed:' || p_wallet || ':' || extract(epoch from now())::bigint::text,
      null, null, null, '{}'::jsonb
    );
  end if;

  return coalesce((select balance from public.fini_balances where wallet_address = p_wallet), 0);
end;
$$;

revoke all on function public.spawn_house_bot from public, authenticated, anon;
grant execute on function public.spawn_house_bot to service_role;
