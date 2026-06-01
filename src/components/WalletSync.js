import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useUIStore } from "../state/uiStore";
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
        const devMode = typeof window !== "undefined" && localStorage.getItem("fini_dev") === "1";
        if (isConnected && address && address.toLowerCase() !== walletAddress) {
            connectWallet(address.toLowerCase());
        }
        else if (!isConnected && walletAddress && !devMode) {
            disconnectWallet();
        }
    }, [address, isConnected, walletAddress, connectWallet, disconnectWallet]);
    return null;
}
