-- ── Invite-only beta gate ────────────────────────────────────────────────────
-- A soft-launch allowlist. While economy_config.open_beta is true (the default),
-- anyone can sign in. Flip it false in the operator console to require an invite:
-- siwe-verify then rejects any wallet that isn't in beta_allowlist (or is_admin).
-- This lets the arena run open today and lock down to a closed group instantly,
-- without a redeploy.

set search_path = public;

alter table public.economy_config
  add column if not exists open_beta boolean not null default true;

create table if not exists public.beta_allowlist (
  wallet_address  wallet_address primary key,
  note            text,
  added_at        timestamptz not null default now()
);

alter table public.beta_allowlist enable row level security;
-- No policies → only the service role (siwe-verify, admin-ops) can read/write.
