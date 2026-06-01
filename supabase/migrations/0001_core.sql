-- ── Core schema: users, balances, ledger, per-Fini records ───────────────────
-- Everything keyed by wallet address (lowercased 0x…) — that's the identity.
-- The Supabase auth.users id stores the wallet in `raw_user_meta_data->>'wallet'`.

set search_path = public;

-- Wallets must be lowercased 0x-prefixed 40-hex.
create domain wallet_address as text
  check (value ~ '^0x[a-f0-9]{40}$');

-- ── users (mirror of auth.users keyed by wallet) ─────────────────────────────
create table if not exists public.users (
  id                uuid primary key references auth.users on delete cascade,
  wallet_address    wallet_address not null unique,
  display_name      text,
  email             text,
  avatar_url        text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists users_wallet_idx on public.users (wallet_address);

-- ── fini_balances (cached balance, source of truth = ledger) ─────────────────
create table if not exists public.fini_balances (
  wallet_address    wallet_address primary key,
  balance           bigint not null default 0 check (balance >= 0),
  lifetime_earned   bigint not null default 0,
  lifetime_spent    bigint not null default 0,
  updated_at        timestamptz default now()
);

-- ── fini_coin_ledger (append-only source of truth) ───────────────────────────
create type ledger_reason as enum (
  'holder_claim', 'daily_grant',
  'battle_entry', 'battle_payout', 'battle_refund',
  'prediction_stake', 'prediction_payout', 'prediction_refund',
  'shop_purchase', 'item_use',
  'admin_grant', 'admin_debit'
);

create table if not exists public.fini_coin_ledger (
  id                bigserial primary key,
  wallet_address    wallet_address not null,
  amount            bigint not null,          -- positive = credit, negative = debit
  reason            ledger_reason not null,
  related_battle_id text,
  related_trade_id  text,
  related_claim_id  text,
  idempotency_key   text unique,              -- prevents double-spend on retry
  metadata          jsonb default '{}'::jsonb,
  created_at        timestamptz default now()
);

create index if not exists ledger_wallet_idx       on public.fini_coin_ledger (wallet_address, created_at desc);
create index if not exists ledger_reason_idx       on public.fini_coin_ledger (reason);

-- ── fini_records (per-token battle stats, follows NFT through transfers) ─────
create table if not exists public.fini_records (
  contract_address  text not null,
  token_id          int  not null,
  wins              int  not null default 0,
  losses            int  not null default 0,
  draws             int  not null default 0,
  xp                int  not null default 0,
  level             int  not null default 1,
  last_battle_at    timestamptz,
  resting_until     timestamptz,
  traits_earned     jsonb not null default '[]'::jsonb,
  updated_at        timestamptz default now(),
  primary key (contract_address, token_id)
);

-- ── battles_log (one row per resolved battle for audit) ──────────────────────
create table if not exists public.battles_log (
  id                bigserial primary key,
  battle_id         text not null,
  battle_type       text not null,              -- 'fight-club' | 'crypto-arena'
  team_wallet       wallet_address not null,
  opponent_wallet   wallet_address,             -- null for PvE
  team_token_ids    int[] not null,
  outcome           text not null,              -- 'win' | 'loss' | 'draw'
  stake             bigint not null default 0,
  payout            bigint not null default 0,
  resolved_at       timestamptz default now(),
  metadata          jsonb default '{}'::jsonb
);

create index if not exists battles_log_wallet_idx on public.battles_log (team_wallet, resolved_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Reads: public for leaderboards, balances visible by owner. Writes: server-only.
alter table public.users           enable row level security;
alter table public.fini_balances   enable row level security;
alter table public.fini_coin_ledger enable row level security;
alter table public.fini_records    enable row level security;
alter table public.battles_log     enable row level security;

-- Users: own row read/update
drop policy if exists users_self_read   on public.users;
drop policy if exists users_self_update on public.users;
create policy users_self_read   on public.users for select using ( auth.uid() = id );
create policy users_self_update on public.users for update using ( auth.uid() = id );

-- Balances: public read (for leaderboards). Writes only via service role / edge functions.
drop policy if exists balances_public_read on public.fini_balances;
create policy balances_public_read on public.fini_balances for select using ( true );

-- Ledger: user can see their own rows.
drop policy if exists ledger_self_read on public.fini_coin_ledger;
create policy ledger_self_read on public.fini_coin_ledger for select
  using ( wallet_address = lower(coalesce(current_setting('request.jwt.claims', true)::jsonb->>'wallet', '')) );

-- Records: public read.
drop policy if exists records_public_read on public.fini_records;
create policy records_public_read on public.fini_records for select using ( true );

-- Battles log: public read.
drop policy if exists battles_log_public_read on public.battles_log;
create policy battles_log_public_read on public.battles_log for select using ( true );

-- ── Triggers ──────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists users_touch on public.users;
create trigger users_touch before update on public.users for each row execute function public.touch_updated_at();

drop trigger if exists balances_touch on public.fini_balances;
create trigger balances_touch before update on public.fini_balances for each row execute function public.touch_updated_at();

drop trigger if exists records_touch on public.fini_records;
create trigger records_touch before update on public.fini_records for each row execute function public.touch_updated_at();
