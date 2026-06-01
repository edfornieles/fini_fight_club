# Art assets — not committed to git

The three heaviest art directories are gitignored:

- `public/clan-art/` (~730 MB) — clan battle gifs (`miners.gif`, `royals.gif`, …)
- `public/clan-finis/` (~440 MB) — per-clan Fini sprite sheets
- `public/hero/` (~11 MB) — landing-page hero `.mp4` clips

**Download them from Google Drive:**
https://drive.google.com/drive/folders/1TmuohNQRwDw4508CjmIEEY8ZV5tOIB1u?usp=sharing

Unzip into `public/` so paths like `public/clan-art/miners.gif` resolve. The app loads them via stable URLs (e.g. `<img src="/clan-art/miners.gif">`).

For production, host these on a CDN / IPFS and either mirror the same paths via proxy or rewrite the asset URLs in `src/game/wallet/toFini.ts`.

Also: `public/battle-placeholder.png` — the cute Finis-facing-off image used on every battle page. Drop the file into `public/` and every battle hero will use it as the stand-in until per-asset 3D art lands.
