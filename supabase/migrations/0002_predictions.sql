-- ── Crypto Arena predictions ─────────────────────────────────────────────────

set search_path = public;

create type prediction_status as enum ('open', 'locked', 'resolved', 'voided');

-- Battle templates that produce rolling battles (BTC Up/Down 1h, etc.)
create table if not exists public.battle_templates (
  id                       text primary key,           -- e.g. 'btc-updown-1h'
  name                     text not null,
  question_template        text not null,
  battle_type              text not null,              -- 'updown'|'abovebelow'|'outperform'|'volatility'|'clanwar'
  asset_a                  text not null,
  asset_b                  text,
  duration_minutes         int  not null,
  primary_price_source     text not null default 'coingecko_v3',
  backup_price_sources     text[] not null default array['coinbase_spot','binance_spot'],
  stale_threshold_seconds  int  not null default 30,
  max_deviation_bps        int  not null default 50,
  entry_cutoff_seconds     int  not null default 30,
  active                   boolean not null default true,
  created_at               timestamptz default now()
);

-- Battle instances created from templates (one per window)
create table if not exists public.battle_instances (
  id                        text primary key,           -- e.g. 'btc-updown-1h-2026-06-01-14'
  template_id               text not null references public.battle_templates,
  asset_a                   text not null,
  asset_b                   text,
  start_time                timestamptz not null,
  end_time                  timestamptz not null,
  entry_cutoff              timestamptz not null,
  status                    prediction_status not null default 'open',
  official_start_price_a    numeric,
  official_start_price_b    numeric,
  official_end_price_a      numeric,
  official_end_price_b      numeric,
  start_price_source        text,
  end_price_source          text,
  start_price_recorded_at   timestamptz,
  end_price_recorded_at     timestamptz,
  backup_checks             jsonb default '{}'::jsonb,
  resolution_formula        text,
  resolution_calculation    text,
  winning_side              text,                       -- 'A' | 'B' | null (draw/void)
  resolution_status         text not null default 'pending', -- 'pending'|'resolved'|'manual_review'|'voided'
  audit_log                 jsonb not null default '[]'::jsonb,
  void_reason               text,
  total_volume              bigint not null default 0,
  created_at                timestamptz default now()
);

create index if not exists battle_instances_status_idx on public.battle_instances (status, end_time);

-- Predictions placed by users
create table if not exists public.predictions (
  id                 bigserial primary key,
  battle_id          text not null references public.battle_instances on delete cascade,
  wallet_address     wallet_address not null,
  side               text not null,                    -- 'A' | 'B'
  stake              bigint not null check (stake > 0),
  locked_pct         int,                              -- displayed % at time of entry, for payout math
  payout             bigint,                           -- set on resolution
  status             prediction_status not null default 'open',
  idempotency_key    text unique,
  created_at         timestamptz default now()
);

create index if not exists predictions_wallet_idx on public.predictions (wallet_address, created_at desc);
create index if not exists predictions_battle_idx on public.predictions (battle_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.battle_templates  enable row level security;
alter table public.battle_instances  enable row level security;
alter table public.predictions       enable row level security;

drop policy if exists battle_templates_public on public.battle_templates;
drop policy if exists battle_instances_public on public.battle_instances;
drop policy if exists predictions_self_read   on public.predictions;
drop policy if exists predictions_public_read on public.predictions;

create policy battle_templates_public on public.battle_templates for select using ( true );
create policy battle_instances_public on public.battle_instances for select using ( true );
-- Predictions are public so leaderboards / "top stakers" can be shown.
create policy predictions_public_read on public.predictions for select using ( true );
