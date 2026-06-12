#!/usr/bin/env python3
"""
Live arena monitor — watch the system breathe in real time.

Polls the public tables every few seconds and prints, for every open battle:
its countdown, the two-sided pool split (the live odds), and bettor count; plus
a rolling log of battles that just resolved (winner + whether the price move
agrees). Use it while you click around the site to confirm what you see in the
UI matches the server, and to watch new windows spawn the instant one closes.

Usage:
    python3 scripts/testing/monitor.py                 # uses .env.production
    SUPABASE_URL=... SUPABASE_ANON_KEY=... python3 scripts/testing/monitor.py
"""
import os, sys, time, json, urllib.request, datetime, re

def load_env():
    url = os.environ.get("SUPABASE_URL"); key = os.environ.get("SUPABASE_ANON_KEY")
    if url and key: return url, key
    try:
        for line in open(os.path.join(os.path.dirname(__file__), "../../.env.production")):
            m = re.match(r'\s*VITE_(SUPABASE_URL|SUPABASE_ANON_KEY)\s*=\s*(.+)', line)
            if m:
                if m.group(1) == "SUPABASE_URL": url = m.group(2).strip()
                else: key = m.group(2).strip()
    except FileNotFoundError: pass
    if not url or not key:
        sys.exit("Set SUPABASE_URL + SUPABASE_ANON_KEY (or run from repo with .env.production).")
    return url, key

URL, KEY = load_env()
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

def get(path):
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", headers=H)
    return json.load(urllib.request.urlopen(req, timeout=15))

def now(): return datetime.datetime.now(datetime.timezone.utc)
def parse(t): return datetime.datetime.fromisoformat(t.replace("Z", "+00:00"))

seen_resolved = set()

def tick():
    battles = get("battle_instances?status=eq.open&select=id,asset_a,asset_b,end_time&order=end_time.asc&limit=60")
    ids = [b["id"] for b in battles]
    pools = {}
    if ids:
        inlist = ",".join(ids)
        preds = get(f"predictions?battle_id=in.({inlist})&select=battle_id,side,stake,wallet_address&limit=5000")
        for p in preds:
            e = pools.setdefault(p["battle_id"], {"A": 0, "B": 0, "w": set()})
            e["A" if p["side"] == "A" else "B"] += p["stake"] or 0
            e["w"].add(p["wallet_address"])
    os.system("clear")
    print(f"  LIVE ARENA  ·  {now():%H:%M:%S} UTC  ·  {len(battles)} open battles\n")
    print(f"  {'battle':<34} {'ends in':>8}  {'A%':>4} {'pool':>8} {'bettors':>7}  {'humans?':>7}")
    print("  " + "-" * 78)
    one_sided = 0
    for b in sorted(battles, key=lambda x: x["end_time"]):
        e = pools.get(b["id"], {"A": 0, "B": 0, "w": set()})
        tot = e["A"] + e["B"]; pa = round(e["A"] / tot * 100) if tot else 50
        if tot and (e["A"] == 0 or e["B"] == 0): one_sided += 1
        secs = (parse(b["end_time"]) - now()).total_seconds()
        cd = f"{int(secs//60)}m{int(secs%60):02d}s" if secs > 0 else "RESOLVING"
        humans = sum(1 for w in e["w"] if not w.startswith("0xb07"))
        flag = "" if (e["A"] and e["B"]) or not tot else "  ⚠ONE-SIDED"
        print(f"  {b['id']:<34} {cd:>8}  {pa:>3}% {tot:>8} {len(e['w']):>7}  {humans:>7}{flag}")
    if one_sided: print(f"\n  ⚠ {one_sided} battle(s) one-sided — bots should balance them next worker tick (2 min)")

    # rolling resolved log
    recent = get("battle_instances?resolution_status=in.(resolved,voided)&select=id,asset_a,winning_side,resolution_status,official_start_price_a,official_end_price_a,end_time&order=end_time.desc&limit=8")
    new = [r for r in recent if r["id"] not in seen_resolved]
    if new:
        print("\n  JUST RESOLVED:")
        for r in reversed(new):
            seen_resolved.add(r["id"])
            s, en = r["official_start_price_a"], r["official_end_price_a"]
            if r["resolution_status"] == "voided":
                print(f"    ↩  {r['id']:<34} VOIDED — stakes refunded")
            elif s is not None and en is not None:
                expect = "A" if float(en) > float(s) else "B"
                agree = "✓" if expect == r["winning_side"] else "✗ MISMATCH!"
                print(f"    ✓  {r['id']:<34} {s}→{en}  winner {r['winning_side']} {agree}")
    for r in recent: seen_resolved.add(r["id"])

if __name__ == "__main__":
    try:
        while True:
            try: tick()
            except Exception as ex: print("poll error:", ex)
            time.sleep(5)
    except KeyboardInterrupt:
        print("\nbye")
