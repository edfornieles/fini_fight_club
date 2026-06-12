import { useEffect, useState } from "react";
import { supabase, isOnline } from "../lib/supabase";

/**
 * useAdminGate — decides whether to SHOW the operator console.
 *
 * This is a UX gate only. The real enforcement lives server-side in the
 * `admin-ops` edge function (ADMIN_WALLETS env / users.is_admin); every
 * mutation 403s there if the caller isn't a real admin. So even a faked client
 * gate can at most VIEW — it can never mutate. We still gate the UI to avoid
 * showing operator controls to ordinary players.
 *
 * Admin if the active Supabase session's wallet is in VITE_ADMIN_WALLETS.
 * `devReadOnly` additionally lets a local dev open the console without a wallet
 * (?dev=1 latch) — useful offline; writes still require a real admin session.
 */
const ALLOWLIST = ((import.meta.env.VITE_ADMIN_WALLETS as string | undefined) ?? "")
  .split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);

function devLatch(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).get("dev") === "1") {
    localStorage.setItem("fini_dev", "1");
    return true;
  }
  return localStorage.getItem("fini_dev") === "1";
}

export function useAdminGate() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const devReadOnly = devLatch();

  useEffect(() => {
    if (!isOnline) { setReady(true); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const w = (data.session?.user?.user_metadata?.wallet as string | undefined)?.toLowerCase() ?? null;
      setWallet(w);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const w = (session?.user?.user_metadata?.wallet as string | undefined)?.toLowerCase() ?? null;
      setWallet(w);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const isAdminWallet = wallet != null && ALLOWLIST.includes(wallet);
  // Can mutate (server will still re-check): only with a real admin session.
  const canWrite = isAdminWallet;
  // Can view the console: real admin OR local dev latch.
  const canView = isAdminWallet || devReadOnly;

  return { wallet, ready, canView, canWrite, devReadOnly, allowlistEmpty: ALLOWLIST.length === 0 };
}
