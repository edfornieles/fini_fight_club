# FINI$ Supply — 10,000,000 fixed

Total supply is a fixed **10,000,000 FINI$**, split 20 / 80 between Fini
holders and the project.

| Bucket | Share | Amount | How it's held |
|---|---|---|---|
| **Fini holders** | 20% | **2,000,000** | Claimable: 10,000 tokens × **200 FINI$/Fini** = 2,000,000. Capped by `claim_campaigns.total_supply_cap = 2,000,000`. |
| **Project wallet** | 80% | **8,000,000** | `0x…feeded`. Currently holds **7,000,000** — the other **1,000,000** is the house-bot float, which sweeps back here on retirement. |

```
holders (2M)  +  project wallet (7M)  +  house-bot float (1M)  =  10,000,000 ✅
```

## Per-Fini claim
- **200 FINI$ per Fini held** (was 10,000 — corrected so the holder bucket
  is exactly 20% of supply).
- Example: Whale #1 holds 253 Finis → claims **50,600 FINI$**.
- The cap is hard-enforced in `claim-fini`: once 2,000,000 is distributed,
  further claims return `supply_cap_reached`. No claim path can exceed it.

## House bots (beta only)
- 20 bots, 50,000 FINI$ each = 1,000,000 total, drawn from the project's 80%.
- They give the arena critical mass while real players are few.
- At launch, sweep them with `sweep_house_bot(wallet)` (or `scripts/sweep-bots.mjs`)
  — their balances return to the project wallet, restoring it to the full 8M.

## Live values (set 2026-06-02)
- `claim_campaigns`: per_fini_amount = 200, total_supply_cap = 2,000,000 ✅
- project wallet `0x…feeded` balance = 7,000,000 ✅
- 20 house bots × 50,000 = 1,000,000 ✅
- holder claims distributed so far = 0
