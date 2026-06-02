-- Enable RLS on project_wallet (advisor flagged it as public without RLS).
-- The table only holds the project wallet address + swept total — not
-- sensitive — so public read is fine; writes remain service-role only
-- (no insert/update/delete policy = denied for anon/authenticated).
alter table public.project_wallet enable row level security;

drop policy if exists project_wallet_public_read on public.project_wallet;
create policy project_wallet_public_read on public.project_wallet for select using ( true );
