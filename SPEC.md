# Fini Fight Club — Functional Spec

Plain-English checklist of every element on every page and what it should
do. Use this to test that the system actually works end-to-end.

---

## Global elements (every page)

### Top navigation bar
- **Fini logo** (top-left) — clicking goes to `/`.
- **Crypto Arena tab** — goes to `/crypto`. The hub for all battles.
- **Fight Club tab** — goes to `/fight-club` (separate PvP game mode).
- **Leaderboard tab** — goes to `/leaderboard`.
- **Claim FINI$ tab** — goes to `/claim`.
- **🎁 Daily +500 button** — appears when the daily drop is ready. Click grants +500 FINI$ once per 24h per account. Disappears after claiming.
- **🪂 Top up button** — only appears when balance is below 100. Grants +500 emergency FINI$. Prevents getting stuck.
- **🪙 Balance chip** — shows the active wallet's current FINI$. Click goes to `/claim`.
- **Wallet chip** (top-right) — shows the active account's truncated address (`0x18ce…16a6`). Click opens a dropdown with Profile / Sign out.

### Dev wallet switcher (bottom-right, when `?dev=1`)
- **Quick picks** — Whale #1, mid-tier holder, any address you type.
- **🤖 House bots** — list of all 20 active bots, click any to "play as" that account.
- **Performance →** link — goes to `/admin/bots`.
- **Disconnect** — signs out of the current dev impersonation.

### Notification toasts (top-right, overlay)
- Win / loss / void notifications when a battle settles.
- Daily drop / top-up confirmations.
- Auto-dismiss after a few seconds; click to dismiss earlier.

---

## `/` — Landing page
- **Hero animation** — two Finis facing off.
- **"Enter the Arena" CTA** — goes to `/crypto`.
- **Explainer cards** — what FINI$ is, how battles work, no real-money disclaimer.

---

## `/crypto` — Crypto Arena
The main hub. Lists every live battle as a card.

### Per battle card
- **Two asset thumbnails** (e.g. BTC + ETH) — the Finis fighting.
- **Status chip** — green `Live`, red blinking `Ending soon` (<20 min), `Resolved` once finished.
- **Duration label** (top-right) — `15m`, `1h`, `2h`.
- **Title** — `BTC vs ETH`, `BTC Up or Down 15m`, etc.
- **Question** — `Will BTC outperform ETH over the next 2 hours?`
- **Two side percentages** — current implied probability for each side, updates live.
- **Mini sparkline** — last 24h price for each asset.
- **Live price** — current $ for each asset, with 24h % change.
- **Volume** — total FINI$ staked on this battle.
- **⏱ ends X** — live countdown to resolution, ticks every second.
- **Click anywhere on the card** → goes to `/battle/:id`.

### My Active Battles section (top of page)
- One row per open position you hold.
- Shows side picked, stake, current mark-to-market value, sell button.
- "Sell" button cashes the position out at current value, returns FINI$ to wallet.
- Settled rows show outcome briefly before being cleaned up.

### Filters
- By asset, by duration, by battle type. Defaults to all live.

---

## `/battle/:id` — Single battle page
Where you place a prediction and watch it resolve.

### Header
- **Breadcrumb**: Crypto Arena / Bitcoin / BTC vs UNI
- **Asset chips** — BTC, UNI tags with live status.
- **Duration** — `2h`.
- **Title** — `BTC vs UNI`.
- **Question** — the resolution rule in plain English.
- **Resolution rule box** — `Resolves to whichever has the higher % return over the 2h window, priced by median of CoinGecko + Coinbase + Binance.`

### Winner banner (only when battle has ended)
- **🏁 Battle Settled** label.
- **Winner declaration** — `BTC carries this round`.
- **Reasoning** — `BTC returned +0.42%, UNI returned -0.71% — BTC outperformed`.
- **Player outcome pill** — `🎉 You won 156 FINI$` (green) or `💀 You lost this one` (red), if you bet.
- **Up next** — `Auto-jumping in 8s…` countdown with a `Stay here` button and a `Next round →` button. Pauses on hover.

### Battle Arena hero (the main visual)
- Two side cards with percentages.
- Player's pick highlighted with a star.
- Progress bar at bottom showing time elapsed.
- **Resolution in** — countdown `1h 57m`. Hits 0 → flips to `Resolving…` or settled state.
- **Status** — `● Battle in progress` (green) / `🏁 Settled — see banner above` (purple) / `⚖️ Awaiting price oracle` (when server holds for manual review) / `🎉 You won — payout X` / `💀 Lost X` / `↩️ Voided — X refunded` / `💸 Sold early for X`.
- **Stake summary** — `You staked 100 FINI$ on UNI. Sit tight…` while open; flips to outcome line on settle.
- If the player has settled, **timer hides** (no contradictory "1h 57m remaining" next to "You won").

### Live Market card
- **Per-asset % since open** — big green/red number, e.g. `▲ +0.42%` for BTC.
- **Price line** — `$70,013 → $69,419`.
- **Combined price graph** — both assets on one chart, percentage axis since open.
- **LIVE indicator** — green dot, ticks every second.

### Battle Momentum card
- **Big side percentages** — `Yes 44%` / `No 56%`.
- **Distribution bar** — visual split.
- **Volume** — `211K Fini Coin`.
- **Time Left** — `1h 57m` while live / `Settled` / `Hold` (manual review) / `Voided`.
- **Arena Mood** — `Volatile` / `Calm` based on price spread.

### Battle Log
- Timestamped activity for this round.
- **🟢 Battle started Jun 2, 08:30:00 BST — BTC at $70,088** (real local time).
- **📊 BTC now $69,419 — ▼ -0.85% since open · UNI leading** (live).
- **🏁 Settled Jun 2, 10:30:00 BST — BTC closed $69,419 (-0.85%). UNI wins.** (post-resolution).
- **Recent predictions list** — ghost personas + real bot bets on this battle.

### Place your prediction panel (right side)
- **Two side buttons** — BTC % / UNI %. Click to select.
- **FINI$ amount** — preset chips (50 / 100 / 250 / 500) + free-input box.
- **Stake breakdown** — Stake, Arena fee (7%), Max winnings.
- **Predict button** — locks in the entry. Disabled if no side picked or insufficient balance.
- **Disclaimer** — `Fini Coin is a non-transferable in-game currency. No real-world value.`

### Resolution Audit (below the prediction panel, only when settled)
- **Manual review banner** if the server flagged price-integrity issues.
- **Official start price** — source + timestamp + deviation between sources.
- **Official end price** — same, or "Price integrity check failed" if sources disagreed.
- **Resolution formula** — exact rule used.
- **Full audit log** — every price sample collected.

### Battle Rules
- Median of CoinGecko + Coinbase + Binance.
- Winner decided purely by the price move — no ties or voids.
- Share-based payout (underdog pays more).
- Sell-anytime.
- Play-money beta disclaimer.

---

## `/profile` — Your profile (Activity Hub)

### Header stat strip
- **Net P&L** — big colored number (green if positive, red if negative), with realised + unrealised breakdown beneath.
- **Open positions** — count + total FINI$ at risk.
- **Volume staked** — all-time FINI$ wagered.
- **Battles bet on** — unique battles + settled count.
- **Win rate** — `%` + W/L/V/S breakdown.

### Tabs
- **Open** — every live position with mark-to-market.
- **Activity** — chronological log of every event (placed / won / lost / refunded / sold).
- **History** — settled rows only.

### Open positions table (per row)
- Battle title (clickable → returns to battle page).
- Side pill (green for A, red for B).
- Stake.
- Entry % (the odds when you bet).
- Now % (current market odds).
- Worth (mark-to-market value in FINI$).
- Unrealised P&L (FINI$ + %).
- **Sell button** — cashes out at current value.
- `Ends in 5m 12s` sub-label.

### Activity table (per row)
- Event icon + label (📍 Open / 🎉 Won / 💀 Lost / ↩️ Refunded / 💸 Sold early).
- Battle title (clickable → re-enter next round).
- Side pill.
- Stake.
- Outcome — `+450 (paid 600)` / `-100` / `Refunded 100` / `+50 (sold for 150)`.
- Relative timestamp (`2m ago`, hover for exact local time).

### Empty state
- **🎲 Your forecast log is empty.**
- CTA to `/crypto`.

### Account settings (below the activity hub)
- Avatar upload, display name, bio, email.
- Save button → confirms with toast.

---

## `/p/:wallet` — Public profile (shareable)
- Same as `/profile` but read-only and for any wallet.
- "⚔️ Challenge me" button → prefilled `/challenge` link.
- Stats are public so leaderboards can link here.

---

## `/claim` — Claim FINI$
- **Eligibility check** — how many Finis the connected wallet holds.
- **Claim breakdown** — `253 Finis × 200 FINI$ = 50,600 FINI$`.
- **Claim button** — calls the server claim function. One-time per holder.
- **Balance display** — your current FINI$.
- **Supply meter** — `X / 2,000,000 distributed`.

---

## `/leaderboard`
- **Toggle** between Profit ladder and Volume ladder.
- **Per row** — rank, handle, wallet, P&L (or volume), battles played, win rate.
- Click row → goes to `/p/:wallet`.

---

## `/strategies` — Automated Attack
Deploy autonomous bots that play for you.

### Header
- **Wallet balance** — your FINI$.
- **Locked in attacks** — total budget held inside strategies.
- **+ Deploy an Attack** — opens the deploy modal.

### Per strategy card
- Strategy name + type (Momentum, Contrarian, etc.).
- ACTIVE / PAUSED pill.
- Budget bar — `350 / 500 FINI$`.
- Today's forecasts — `1 / 20`.
- Win rate — `50%` or `—` if no data yet.
- Net P&L — `+50` / `-200`.
- Capital, reinvest mode, asset filter summary.
- Total forecasts placed.
- **Plain-English insight** (after ≥3 settled): `📈 Working: …` or `📉 Underwater: …`.
- **Pause / Edit / Delete** buttons.

### Deploy modal
- Choose strategy template.
- Set budget, per-forecast stake, max per day.
- Stop conditions (gain target / loss limit).
- Reinvest mode (Compound / Save profits).
- Market condition gate (Any / Bullish / Bearish / Volatile / Calm).
- Asset filter (any of the 10 supported).
- Deploy button — debits budget from wallet immediately.

---

## `/admin/bots` (dev-only)
Behind-the-scenes view of the 20 house bots.

### Aggregate stats
- Total P&L across all bots.
- Total predictions placed.
- Settled count.
- Overall win rate.

### Per bot row
- Handle + wallet (truncated).
- Strategy type + param summary.
- Current balance.
- P&L from starting 200k.
- Total predictions (with `(N open)` chip).
- Win %.
- Click row to expand: strategy blurb, params, total staked/paid, last 10 predictions with outcomes.

### Strategy rollup
- Aggregate P&L + win rate by strategy type — shows which approach is actually working.

---

# User pipeline (the end-to-end happy path)

Use this as a test script. If every step works, the system works.

1. **Land** on `/`. See the hero animation.
2. Click **Enter the Arena** → arrives at `/crypto`.
3. See a grid of **live battle cards** with ticking countdowns, live prices, sparklines.
4. (Optional) Click **Claim FINI$** in the nav → arrives at `/claim`. Sees holder count, claims, balance jumps from 0 to claim amount.
5. Back to `/crypto`. **Click a battle card** (say `BTC vs UNI 2h`) → arrives at `/battle/btc-vs-uni-2h`.
6. **Read the question + resolution rule.** Watch the live percentages, live price graph, battle log update in real time.
7. In the prediction panel: **click UNI**, **select 100 FINI$**, **click Predict**.
8. Balance chip in nav drops by 100. The prediction panel locks. Hero footer flips to `You staked 100 FINI$ on UNI. Sit tight…`. A new row appears in the Battle Log: `Your prediction recorded`.
9. Go to `/profile`. **See the entry in Open**, with mark-to-market value updating as UNI's odds shift.
10. (Optional) Click **Sell** on `/profile`. Position cashes out. Balance returns. Row moves to Activity / History tabs as `💸 Sold early`.
11. If kept open: wait for the timer to hit 0 on `/battle/btc-vs-uni-2h`.
12. Timer hits 0 → **resolver fires within 500ms**. Hero status flips to `🎉 You won — payout 156 FINI$`. WinnerBanner appears above with reasoning + auto-jump countdown.
13. Balance chip jumps up by the payout. Toast notification appears: `🎉 You won 156 FINI$`.
14. WinnerBanner counts down 8s → **auto-navigates** to the next round (`btc-vs-uni-2h` next instance). Player can click `Stay here` to cancel.
15. New battle loads. Timer ticks fresh. Player can place a new prediction immediately.
16. Go to `/profile`. **History tab** shows the won entry with outcome `+56 (paid 156)`. P&L in header updates.
17. Go to `/leaderboard`. **Find yourself** ranked by Profit. Click your row → arrives at `/p/your-wallet` (public profile).
18. (Optional) Deploy an **auto-attack** on `/strategies`. Set budget 500, stake 50, Compound mode. It starts placing forecasts within seconds. Card shows `Today: 1/20` ticking up.
19. **Switch dev accounts** via the bottom-right panel (e.g. play as `house_contra`). Balance chip flips to the bot's balance, `/profile` shows the bot's history. Switching back to your own account restores your own state.
20. Refresh the page. Everything persists — your balance, your active battles, your activity history.

---

# Free tier guarantees
- Supabase: free tier, ~340K function invocations/month with current cron (under 500K limit).
- Cloudflare Pages + Functions: free tier (100K req/day, 25s edge-cached price proxy keeps usage low).
- Cloudflare R2: free egress.
- No infrastructure added cost from any feature above.
