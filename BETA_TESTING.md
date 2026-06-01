# Fini Fight Club — Closed Beta

Welcome! You're one of a handful of Fini holders getting an early look at the game. This is a **closed beta** — no real money is involved, FINI$ is purely an in-game currency.

Below: what to try, what's known to be rough, and how to give feedback.

## What to try (5–10 min tour)

### 1. Connect your wallet
Top-right **Connect Wallet** → MetaMask / Coinbase Wallet / WalletConnect. The site reads your Fini ownership from a May 2026 snapshot — your Finis will populate automatically.

> **Don't have a Fini-holder wallet handy?** Append `?dev=1` to any URL (e.g. `/?dev=1`) to enable the bottom-right **DEV impersonation panel** — pick from quick-picks (Whale #1, Whale #2, Mid holder) or paste any 0x… address. Lets you tour the site as any holder.

### 2. Crypto Arena (`/crypto`)
- Browse the live battles — Up/Down on BTC/ETH/SOL/etc, plus Outperform and Clan War types
- Notice the 🐋 / 📊 / 🥚 personas streaming bets in the **Live Predictions** sidebar — these are the top 100 Fini holders running automated strategies, reacting to real price movement
- Click into a battle → place a prediction → see the hero arena + countdown + locked entry
- Wait a few minutes — when timers hit zero, you'll see **🎉 You won** / **💀 Lost** / **↩️ Voided** toast notifications with the real price action that decided it

### 3. Automated Attack (`/strategies`)
- Click **⚙️ Automated Attack** from the Crypto Arena header
- Click **+ Deploy an Attack** — pick a template, allocate budget, set stop conditions, choose compound or save mode
- The strategy now runs in the background placing predictions for you
- **Try the new signal-driven templates**: 📈 Live Momentum, 🪞 Mean Reversion, 🎯 Late Sniper — they read the real underlying asset price, not just the sim's drift

### 4. Fight Club (`/fight-club`)
- Pick 3 starters from your Stable
- Equip items (paid in 🍪 Crumbs), buy potions
- Click **⚔️ Enter Arena** → 3v3 auto-battle vs a ghost team scaled to your power
- Win = +stake from the Fini Treasury · Lose = stake goes back to treasury
- Bust below 100 FINI$ → forced restart, Fini XP/items wipe

### 5. Player profiles + challenges
- Click any wallet on the Leaderboard or in the Live Predictions feed → goes to `/p/<wallet>`
- Each profile has a **🔗 Copy challenge link** + **🐦 Tweet** button
- Paste a link in chat and the recipient lands on `/challenge?from=…` to accept

## Known rough edges

- **Art is placeholder.** Real per-Fini 3D art is coming. Today every Fini shows a clan gif stand-in.
- **No persistence between devices yet.** Backend is being wired up — for now your stats live in browser localStorage. Reloading is fine; switching devices resets you.
- **Automated Attack strategies are early-stage.** They read live signals (price velocity, intra-window return) but don't yet backtest or self-tune.
- **You may see Fini sprites missing.** The art bundle is hosted separately (Google Drive) and still being moved to a CDN.

## What we want feedback on

1. **Does the game loop feel right?** Are FINI$ stakes / Crumbs / item prices well-tuned?
2. **What confused you?** Especially: first-time experience, the strategies UI, the prediction flow
3. **What did you wish existed?** Battle types, social features, anything missing
4. **Bugs.** Screenshots help. Console errors help more.

## How to give feedback

- Email: **ed@finiliar.com**
- Twitter / X: DM **@edfornieles**
- The dismissible black bar at the top of the site links straight to both

Thanks for taking a look. This is shaped by what early testers tell us.
