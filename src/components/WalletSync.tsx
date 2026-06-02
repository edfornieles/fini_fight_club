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

  // On first mount, sync every per-wallet store to the persisted walletAddress
  // so balance, entries, and strategies all match the account the player was
  // last using. Without this, a page reload could leave a previously-active
  // dev account showing the wrong list because the other stores persist their
  // own activeWallet independently.
  useEffect(() => {
    if (!walletAddress) return;
    const a = walletAddress.toLowerCase();
    useCoinStore.getState().useWallet(a, 1_000);
    import("../state/myEntriesStore").then(({ useMyEntries }) => useMyEntries.getState().useWallet(a));
    import("../state/strategiesStore").then(({ useStrategies }) => useStrategies.getState().useWallet(a));
    // Run only on mount — subsequent wallet changes go through the effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // In dev-impersonation mode the wallet is set manually via DevWalletSwitcher.
    // Don't let wagmi's "not connected" state wipe it.
    // Dev impersonation is ON by default during closed beta; the only way to
    // disable it is the user setting fini_dev=0 (via /?dev=0).
    const devMode = typeof window !== "undefined" && localStorage.getItem("fini_dev") !== "0";
    if (isConnected && address && address.toLowerCase() !== walletAddress) {
      const a = address.toLowerCase();
      connectWallet(a);
      // Switch every per-wallet store in lockstep so balance, active battles,
      // AND deployed auto-attacks all follow the connected account.
      useCoinStore.getState().useWallet(a, 1_000);
      import("../state/myEntriesStore").then(({ useMyEntries }) => useMyEntries.getState().useWallet(a));
      import("../state/strategiesStore").then(({ useStrategies }) => useStrategies.getState().useWallet(a));
    } else if (!isConnected && walletAddress && !devMode) {
      disconnectWallet();
    }
  }, [address, isConnected, walletAddress, connectWallet, disconnectWallet]);

  return null;
}
