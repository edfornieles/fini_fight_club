#!/usr/bin/env python3
"""
Red-team probe — try to game the system against the LIVE edge functions.

Every check is an attack we expect the server to REFUSE. A test "passes" when the
exploit is blocked. Run after deploying the edge functions; re-run anytime.

What it checks (no wallet/signature needed — these all probe the auth and
validation boundaries that must hold for anonymous or forged callers):
  1. predict-place without a session            → must 401 (no anon betting)
  2. predict-place with a forged lockedPct:1    → must 401 first; if a token is
     supplied, the server must IGNORE the client value (server-locked odds)
  3. credit-balance from the browser key        → must fail (internal-key gated;
     this is the "mint unlimited CUTE$" path that must never be open)
  4. admin-ops without admin                     → must 401/403
  5. claim-grant without a session               → must 401
  6. direct REST write to predictions (anon)     → must fail (RLS select-only)
  7. direct REST write to economy_config (anon)  → must fail (no public write)
  8. direct REST write to fini_balances (anon)   → must fail (service-role only)

Usage:
    python3 scripts/testing/redteam.py
    # optional: TEST_JWT=<a real player session token> to also probe authed paths
"""
import os, sys, json, urllib.request, urllib.error, re

URL = None; KEY = None
for line in open(os.path.join(os.path.dirname(__file__), "../../.env.production")):
    m = re.match(r'\s*VITE_SUPABASE_URL\s*=\s*(.+)', line)
    if m: URL = m.group(1).strip()
    m = re.match(r'\s*VITE_SUPABASE_ANON_KEY\s*=\s*(.+)', line)
    if m: KEY = m.group(1).strip()
URL = os.environ.get("SUPABASE_URL", URL); KEY = os.environ.get("SUPABASE_ANON_KEY", KEY)
JWT = os.environ.get("TEST_JWT")

def call(path, body=None, token=None, method="POST"):
    headers = {"apikey": KEY, "Authorization": f"Bearer {token or KEY}", "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{URL}{path}", data=data, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=15)
        return r.status, r.read().decode()[:200]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]
    except Exception as e:
        return 0, str(e)[:200]

passed = failed = 0
def check(name, blocked, detail):
    global passed, failed
    print(f"  [{'PASS' if blocked else 'FAIL ⚠'}] {name}\n         {detail}")
    if blocked: passed += 1
    else: failed += 1

print(f"Red-teaming {URL}\n")

s, b = call("/functions/v1/predict-place", {"battleId": "x", "side": "A", "stake": 100, "idempotencyKey": "rt1"})
check("anon predict-place blocked", s == 401, f"status {s} {b}")

s, b = call("/functions/v1/credit-balance", {"wallet": "0x"+"1"*40, "amount": 9999999, "reason": "admin_grant", "idempotencyKey": "rt-mint"})
check("anon credit-balance (mint) blocked", s in (401, 403, 400, 500) and '"newBalance"' not in b, f"status {s} {b}")

s, b = call("/functions/v1/admin-ops", {"action": "config.set", "patch": {"daily_grant": 999999}})
check("non-admin admin-ops blocked", s in (401, 403, 404), f"status {s} {b}" + ("  (404 = not deployed yet; must be 401/403 after deploy)" if s == 404 else ""))

s, b = call("/functions/v1/claim-grant", {"kind": "daily"})
check("anon claim-grant blocked", s in (401, 404), f"status {s} {b}" + ("  (404 = not deployed yet; must be 401 after deploy)" if s == 404 else ""))

s, b = call("/rest/v1/predictions", {"battle_id": "x", "wallet_address": "0x"+"2"*40, "side": "A", "stake": 1, "locked_pct": 1, "idempotency_key": "rt-direct"})
check("anon direct predictions INSERT blocked", s in (401, 403, 404), f"status {s} {b}")

s, b = call("/rest/v1/economy_config?id=eq.1", {"daily_grant": 999999}, method="PATCH")
check("anon economy_config UPDATE blocked", s in (401, 403, 404) or "0" in b[:3], f"status {s} {b}")

s, b = call("/rest/v1/fini_balances", {"wallet_address": "0x"+"3"*40, "balance": 9999999}, method="POST")
check("anon fini_balances INSERT blocked", s in (401, 403, 404), f"status {s} {b}")

if JWT:
    print("\n  (authed probes with TEST_JWT)")
    s, b = call("/functions/v1/predict-place", {"battleId": "DOESNOTEXIST", "side": "A", "stake": 100, "lockedPct": 1, "idempotencyKey": "rt-odds"}, token=JWT)
    check("forged lockedPct on bad battle rejected", s in (404, 409, 402), f"status {s} {b}  (on a REAL open battle, check the resulting prediction's locked_pct == the pool %, not 1)")

print(f"\n  {passed} blocked / {failed} OPEN" + ("  — all exploits refused ✓" if failed == 0 else "  — ⚠ INVESTIGATE THE FAILURES"))
sys.exit(1 if failed else 0)
