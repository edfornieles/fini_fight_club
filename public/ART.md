# Art assets — not committed to git

The three heaviest art directories are gitignored:

- `public/clan-art/` (~730 MB) — clan-specific battle gifs (`miners.gif`, `royals.gif`, …)
- `public/clan-finis/` (~440 MB) — per-clan Fini sprite sheets
- `public/hero/` (~11 MB) — landing-page hero `.mp4` clips

For local dev, drop your copies into these folders and the app picks them up automatically (the file paths it requests are stable). For production, host these on a CDN / IPFS / Git LFS and either:

- Mirror them under the same paths via a CDN proxy, or
- Rewrite the asset URLs in `src/game/wallet/toFini.ts` and any `<img src="/clan-art/…">` to point at the CDN

Also requires `public/battle-placeholder.png` — the cute Finis-facing-off image used on every battle page (~150 KB, can be committed if small enough — currently not committed).
