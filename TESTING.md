# Testing the Crypto Arena

How to convince yourself it all works: prices are live, battles use real data,
winners win, new battles spawn instantly, it feels like Polymarket, and nobody
can game it. Split into what's **already proven**, what you do **by hand**, the
**stress test**, and the **red-team**.

> Order matters: do the deploy in `LAUNCH_DEPLOY.md` first. Until then the engine
> runs but settlement is still the old parimutuel (not your fixed-odds), and the
> operator console + grants 404.

---

## 0. Already proven (against live production data)
These were audited over the 22,000+ battles already in the database:
- **Winners match reality**: 500/500 recent up/down battles — winner === the
  direction the official price actually moved. Zero wrong.
- **Prices are real**: official prices sit within 0.01–0.12% of independent
  Binance candles (they're a 3-source median of CoinGecko + Coinbase + Binance).
- **Cadence is gap-free**: consecutive 5-minute windows are contiguous — a new
  battle's start time === the previous one's end time. No dead air.

Re-run these any time from `scripts/testing/` (below).

---

## 1. Live monitor — watch it breathe
```bash
python3 scripts/testing/monitor.py
```
A refreshing dashboard of every open battle: countdown, **live odds** (the A/B
pool split), bettor count, how many are human vs bot, and a one-sided warning.
Plus a rolling "JUST RESOLVED" log that re-checks each winner against the price
move (`✓` / `✗ MISMATCH!`). Keep it open in a second terminal while you play —
everything you see in the browser should match it.

**What to look for:**
- Every battle two-sided, odds inside ~8–92% (never 0/100). One-sided flags
  should clear within one worker tick (2 min).
- A battle hits `RESOLVING`, then within ~1 min flips to a resolved line, and a
  fresh window for that asset is already counting down.

---

## 1b. Test accounts that play with REAL CUTE$
There are three kinds of account; only real-session ones transact real CUTE$:

- **House bots** (`0xb07…`) — already real (ledger-funded, play via the worker).
  They're your live opposition; nothing to set up.
- **Real wallets** — the only way a *human* plays for real. Server CUTE$ requires
  a SIWE session, which needs a real signature.
- **Dev impersonation** (the `?dev=1` panel) — **view-only online.** It shows an
  account's real balance but can't bet/claim (no signature). Use it to inspect,
  not to play. You can't "play as" the seeded whales — you don't hold their keys.

**To set up real test players:**
1. Make a few throwaway MetaMask accounts (or use real ones).
2. On the site, connect each → sign in (SIWE). New wallet = **0 CUTE$** (correct).
3. Fund them: operator console → **Economy → Fund a test wallet** → paste the
   address + amount → instant CUTE$ via the audited ledger (admin grant). No Fini
   ownership or daily-grant wait. (Or, if a wallet owns Finis, just use `/claim`.)
4. They now play with real CUTE$ end-to-end — bet, win, settle, payout, history.

This is admin-only (your `ADMIN_WALLETS`) and logged in the Audit tab. It's plain
granting, not a back door — there's no "log in as anyone" capability.

## 2. Hands-on play loop (the real test)
On the deployed site:
1. **Connect wallet** → sign the SIWE message. Balance chip shows your **real
   server balance** (0 for a brand-new wallet — that's correct now, not 1000).
2. **`/claim`** → claim your Genesis allocation → balance jumps (real ledger credit).
3. **`/crypto`** → pick a 5-minute battle so you're not waiting long. Note the
   odds. Click a side — the **"To win"** is `stake × 100 ÷ that side's %`.
4. **Place** the bet. After deploy it hits `predict-place` (watch the Network
   tab) and the odds you locked are the server's, not a number you can edit.
5. Watch it in the monitor + the battle page's **live momentum**. When the timer
   hits 0 it shows "Resolving", then settles from the **server** (the Resolution
   Audit panel shows the official prices + source).
6. **Win** → balance increases by exactly the "To win" you were shown. **Lose** →
   stake gone. Either way it appears in **`/profile` → Your battles** with the result.
7. Confirm a **new battle for that asset already exists** to jump straight into.

**Feels-like-Polymarket checklist:** odds move as bets come in · backing the
underdog pays more · your payout is locked at entry · there's always a live
market (bots) to trade against · the resolution shows real prices, not a shrug.

---

## 3. Stress test — does it hold under load?
The honest answer for a few-hundred-user beta: the load is the **house bots**,
and they already run continuously. To push harder:

- **More bot pressure**: in the operator console (Economy tab) or by editing
  `workers/battle-cron/worker.js`, raise `MAKERS_PER_BATTLE` (e.g. 5 → 12) and
  redeploy. Watch `monitor.py` — pools should deepen, odds should still form
  smooth distributions, resolution should keep up (no growing backlog in the
  **Resolution queue** tab).
- **Resolver keeping up**: the cron resolves ended battles every 2 min. Under
  load, watch for `pending` battles older than ~10 min in the Resolution queue —
  that's the signal the resolver is behind. (None today.)
- **Concurrency on one battle**: have several testers (or several wallets) all
  bet the same 5-min battle near the cutoff. Confirm every stake lands in the
  pool, the 30s cutoff locks new bets, and settlement pays everyone correctly.
- **Rate limit**: one wallet can't place >30 predictions/minute (returns
  `rate_limited`). Try it; it should throttle.
- **Supabase**: free/pro tier handles this comfortably; if you expect a spike,
  watch the project's API request graph in the Supabase dashboard.

---

## 4. Red-team — can people game it?
```bash
python3 scripts/testing/redteam.py
```
Fires the known attacks at the **live** edge functions; each must be **refused**:
- anonymous betting → 401 · the **mint-unlimited-CUTE$** `credit-balance` path →
  blocked · non-admin operator actions → 401/403 · direct table writes to
  predictions / balances / config → blocked by RLS.

Already passing today: anon betting, the mint path, and all direct writes are
refused. After you deploy the edge functions, the two `404 (not deployed)` lines
must become `401/403`.

**The one that needs a real session** (the fixed-odds exploit the review caught):
1. Connect a wallet, open the browser console, and grab your token:
   `JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.includes('auth-token')))).access_token`
2. `TEST_JWT=<that> python3 scripts/testing/redteam.py`
3. Then the real proof: place a bet via the UI on a battle where your side is,
   say, 70%. In Supabase, open the `predictions` row — `locked_pct` must be
   **~70 (the server's pool figure), never a value you could have forged**. Try
   tampering the request body's `lockedPct` to 1 with a proxy — the stored value
   shouldn't change. That's what stops a 100× payout exploit.

**Other things to verify can't be gamed:**
- **Self-dealing**: betting both sides of one battle from two wallets just churns
  your own CUTE$ minus nothing (play money) — no edge, and the house bots dilute
  any pool you try to corner.
- **Late info**: entries lock 30s before close, so you can't bet after the move
  is obvious.
- **Price manipulation**: you can't submit prices — they're server-fetched 3-source
  medians; a single exchange glitch is outvoted, and a real divergence voids +
  refunds (check the Resolution queue / void path).
- **Invite gate**: flip Economy → Access → "INVITE-ONLY"; a non-allowlisted
  wallet then gets `not_invited` on sign-in.

---

## Quick reference
| Want to check | How |
|---|---|
| Winners are correct | `monitor.py` JUST RESOLVED log, or the audit in chat |
| Prices are real | audit script (vs Binance) — 0.01–0.12% dev |
| Battles spawn back-to-back | `monitor.py` — countdown never reaches a gap |
| Feels like Polymarket | §2 hands-on checklist |
| Holds under load | §3 — raise `MAKERS_PER_BATTLE`, watch the queue |
| Can't be gamed | `redteam.py` + the locked_pct check |
