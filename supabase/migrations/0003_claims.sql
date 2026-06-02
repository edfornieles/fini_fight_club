-- ── Claim campaigns + holder claims + wallet signatures (SIWE nonces) ────────

set search_path = public;

create type claim_campaign_status as enum ('draft', 'active', 'paused', 'closed');
create type holder_claim_status   as enum ('pending', 'completed', 'rejected', 'flagged');

create table if not exists public.claim_campaigns (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null,
  starts_at                   timestamptz not null,
  ends_at                     timestamptz not null,
  snapshot_block_number       bigint,
  per_fini_amount             bigint not null default 10000,
  base_wallet_amount          bigint not null default 0,
  max_claim_per_wallet        bigint,
  total_supply_cap            bigint not null default 10000000,  -- 10M FINI$ supply cap
  total_distributed           bigint not null default 0,
  status                      claim_campaign_status not null default 'draft',
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

create table if not exists public.holder_snapshots (
  id                bigserial primary key,
  campaign_id       uuid not null references public.claim_campaigns,
  wallet_address    wallet_address not null,
  token_id          int not null,
  contract_address  text not null,
  snapshot_block_number bigint,
  created_at        timestamptz default now(),
  unique (campaign_id, contract_address, token_id)
);

create index if not exists holder_snapshots_wallet_idx on public.holder_snapshots (campaign_id, wallet_address);

create table if not exists public.holder_claims (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid not null references public.claim_campaigns,
  wallet_address      wallet_address not null,
  claimed_amount      bigint not null,
  claimed_token_ids   int[] not null,
  signature_hash      text not null,
  status              holder_claim_status not null default 'completed',
  idempotency_key     text unique,
  created_at          timestamptz default now(),
  unique (campaign_id, wallet_address)
);

create index if not exists holder_claims_wallet_idx on public.holder_claims (wallet_address);

-- Per-token-id claim record: enforces "each token can claim once per campaign"
create table if not exists public.claimed_token_ids (
  id                bigserial primary key,
  campaign_id       uuid not null references public.claim_campaigns,
  contract_address  text not null,
  token_id          int not null,
  claimed_by_wallet wallet_address not null,
  holder_claim_id   uuid not null references public.holder_claims,
  created_at        timestamptz default now(),
  unique (campaign_id, contract_address, token_id)
);

-- SIWE nonces: single-use, expire fast
create table if not exists public.wallet_signatures (
  id                bigserial primary key,
  wallet_address    wallet_address not null,
  nonce             text not null,
  message           text not null,
  signature         text,
  issued_at         timestamptz not null default now(),
  expires_at        timestamptz not null,
  used_at           timestamptz,
  domain            text,
  unique (wallet_address, nonce)
);

create index if not exists wallet_sigs_nonce_idx on public.wallet_signatures (nonce);
create index if not exists wallet_sigs_wallet_idx on public.wallet_signatures (wallet_address, issued_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.claim_campaigns   enable row level security;
alter table public.holder_snapshots  enable row level security;
alter table public.holder_claims     enable row level security;
alter table public.claimed_token_ids enable row level security;
alter table public.wallet_signatures enable row level security;

drop policy if exists campaigns_public on public.claim_campaigns;
create policy campaigns_public on public.claim_campaigns for select using ( true );

-- Holder snapshots & claims: public read (so users can verify their eligibility)
drop policy if exists snapshots_public on public.holder_snapshots;
create policy snapshots_public on public.holder_snapshots for select using ( true );

drop policy if exists claims_public on public.holder_claims;
create policy claims_public on public.holder_claims for select using ( true );

drop policy if exists claimed_tokens_public on public.claimed_token_ids;
create policy claimed_tokens_public on public.claimed_token_ids for select using ( true );

-- Signatures: writes only via edge functions (service role bypasses RLS).
-- No public read — these are private auth artifacts.

-- ── Seed the live campaign ───────────────────────────────────────────────────
insert into public.claim_campaigns (id, name, starts_at, ends_at, per_fini_amount, total_supply_cap, status)
values (
  '00000000-0000-0000-0000-000000000001',
  'Genesis Holder Claim',
  now(),
  now() + interval '90 days',
  200,        -- per-Fini claim: 10,000 tokens × 200 = 2,000,000 = 20% of the 10M supply
  2000000,    -- holder allocation cap (20% of total). Remaining 80% lives in the project wallet.
  'active'
) on conflict (id) do nothing;
