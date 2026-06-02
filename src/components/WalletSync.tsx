import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useUIStore } from "../state/uiStore";
import { useCoinStore } from "../state/coinStore";
import { useSiweAuth } from "../hooks/useSiweAuth";

/**
 * Bridges wagmi + Supabase auth into the legacy useUIStore so the rest of the
 * app can keep reading `walletAddress` from one place. Mount once near the top
 * of the tree (inside <App />).
 *
 * - useSiweAuth() runs SIWE → Supabase session on every wallet connect
 * - We mirror the connected wallet into useUIStore so existing components work
 */
export function WalletSync() {
  const { address, isConnected } = useAccount();
  const { walletAddress, connectWallet, disconnectWallet } = useUIStore();
  useSiweAuth(); // side effect — runs SIWE on connect

  useEffect(() => {
    // In dev-impersonation mode the wallet is set manually via DevWalletSwitcher.
    // Don't let wagmi's "not connected" state wipe it.
    // Dev impersonation is ON by default during closed beta; the only way to
    // disable it is the user setting fini_dev=0 (via /?dev=0).
    const devMode = typeof window !== "undefined" && localStorage.getItem("fini_dev") !== "0";
    if (isConnected && address && address.toLowerCase() !== walletAddress) {
      const a = address.toLowerCase();
      connectWallet(a);
      // Load this connected wallet's own balance.
      useCoinStore.getState().useWallet(a, 1_000);
    } else if (!isConnected && walletAddress && !devMode) {
      disconnectWallet();
    }
  }, [address, isConnected, walletAddress, connectWallet, disconnectWallet]);

  return null;
}
